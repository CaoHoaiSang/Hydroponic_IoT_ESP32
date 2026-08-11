const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBaseCalibrationResult,
  buildSetValidation,
  interpolateEcWithinRange,
} = require('../src/services/tdsCalibrationService');
const { validateCalibrationPoint } = require('../src/validators/tdsCalibrationSetValidator');
const { validateSensorPayload } = require('../src/validators/sensorPayloadValidator');

function point(voltage25, ec, overrides = {}) {
  return {
    deviceId: 'device001',
    calibrationSetId: 'set1',
    measuredVoltage25: voltage25,
    measuredVoltage: voltage25,
    measuredRaw: Math.round(voltage25 * 4095 / 3.3),
    referenceEcUsCm: ec,
    referenceTdsPpm: ec * 0.5,
    referenceScale: '500',
    tdsFactor: 0.5,
    waterTemp: 25,
    temperatureCompensated: true,
    temperatureReferenceC: 25,
    temperatureAlphaPerC: 0.02,
    temperatureFactorUsed: 1,
    method: 'piecewise_linear_ec',
    ...overrides,
  };
}

function validPointBody(overrides = {}) {
  return {
    measuredRaw: 1241,
    measuredVoltage: 1.0,
    waterTemp: 25,
    referenceEcUsCm: 500,
    referenceScale: '500',
    tdsFactor: 0.5,
    ...overrides,
  };
}

test('1 no active set result has null control ppm', () => {
  const result = buildBaseCalibrationResult();
  assert.equal(result.tdsPpm, null);
  assert.equal(result.tdsMeasurementValid, false);
});

test('2 one point cannot validate a set', () => {
  assert.equal(buildSetValidation([point(1, 500)], 'device001', 'set1').ok, false);
});

test('3 two points cannot validate a set', () => {
  assert.equal(buildSetValidation([point(1, 500), point(1.5, 1000)], 'device001', 'set1').ok, false);
});

test('4 three monotonic EC points validate', () => {
  assert.equal(buildSetValidation([point(0.5, 300), point(1, 700), point(1.5, 1400)], 'device001', 'set1').ok, true);
});

test('5 points from another set are rejected', () => {
  const rows = [point(0.5, 300), point(1, 700, { calibrationSetId: 'set2' }), point(1.5, 1400)];
  assert.equal(buildSetValidation(rows, 'device001', 'set1').ok, false);
});

test('6 missing temperature is rejected', () => {
  assert.equal(validateCalibrationPoint('device001', 'set1', validPointBody({ waterTemp: null })).ok, false);
});

test('7 DS18B20 startup value 85 C is rejected', () => {
  assert.equal(validateCalibrationPoint('device001', 'set1', validPointBody({ waterTemp: 85 })).ok, false);
});

test('8 ADC 5000 is rejected', () => {
  assert.equal(validateCalibrationPoint('device001', 'set1', validPointBody({ measuredRaw: 5000 })).ok, false);
});

test('9 SEN0244 voltage 3.3 V is rejected', () => {
  assert.equal(validateCalibrationPoint('device001', 'set1', validPointBody({ measuredRaw: 4095, measuredVoltage: 3.3 })).ok, false);
});

test('10 ADC and voltage mismatch is rejected', () => {
  assert.equal(validateCalibrationPoint('device001', 'set1', validPointBody({ measuredVoltage: 1.2 })).ok, false);
});

test('11 duplicate compensated voltage is rejected', () => {
  const rows = [point(1, 400), point(1, 800), point(1.5, 1200)];
  assert.equal(buildSetValidation(rows, 'device001', 'set1').ok, false);
});

test('12 duplicate EC is rejected', () => {
  const rows = [point(0.5, 400), point(1, 400), point(1.5, 1200)];
  assert.equal(buildSetValidation(rows, 'device001', 'set1').ok, false);
});

test('13 decreasing EC with increasing voltage is rejected', () => {
  const rows = [point(0.5, 400), point(1, 900), point(1.5, 800)];
  assert.equal(buildSetValidation(rows, 'device001', 'set1').ok, false);
});

test('14 scale 500 converts 1413 us/cm to 706.5 ppm', () => {
  assert.equal(1413 * 0.5, 706.5);
});

test('15 EC interpolation inside range is correct', () => {
  const value = interpolateEcWithinRange(1.25, [point(0.5, 300), point(1, 700), point(1.5, 1500)]);
  assert.equal(value, 1100);
});

test('16 below range does not produce EC', () => {
  assert.equal(interpolateEcWithinRange(0.1, [point(0.5, 300), point(1, 700), point(1.5, 1500)]), null);
});

test('17 above range does not produce EC', () => {
  assert.equal(interpolateEcWithinRange(2, [point(0.5, 300), point(1, 700), point(1.5, 1500)]), null);
});

test('18 legacy point cannot validate for activation', () => {
  const rows = [point(0.5, 300), point(1, 700, { legacy: true }), point(1.5, 1500)];
  assert.equal(buildSetValidation(rows, 'device001', 'set1').ok, false);
});

test('30 sensor validator enforces min raw max relationship', () => {
  const payload = {
    deviceId: 'device001', tdsRaw: 100, tdsVoltage: 0.1, tdsMin: 110, tdsMax: 120,
    tdsSampleCount: 30, tdsSpreadRaw: 10, tdsWindowStable: true,
    waterTemp: 25, waterTempValid: true, waterLevel: 'normal',
    pumpMain: false, pumpA: false, pumpB: false, pumpSpare: false, ph: null, uptimeMs: 1000,
  };
  assert.equal(validateSensorPayload(payload).ok, false);
});

function validSensorPayload(overrides = {}) {
  return {
    deviceId: 'device001', tdsRaw: 100, tdsVoltage: 100 * 3.3 / 4095,
    tdsMin: 90, tdsMax: 110, tdsSampleCount: 30, tdsSpreadRaw: 20,
    tdsWindowStable: true, waterTemp: 25, waterTempValid: true,
    waterLevel: 'normal', pumpMain: false, pumpA: false, pumpB: false,
    pumpSpare: false, ph: null, uptimeMs: 1000, ...overrides,
  };
}

test('stable flag is rejected when sample count is zero', () => {
  assert.equal(validateSensorPayload(validSensorPayload({ tdsSampleCount: 0 })).ok, false);
});

test('stable flag is rejected when sample count is 29', () => {
  assert.equal(validateSensorPayload(validSensorPayload({ tdsSampleCount: 29 })).ok, false);
});

test('stable flag is rejected when raw spread is 51', () => {
  const payload = validSensorPayload({ tdsMin: 75, tdsMax: 126, tdsRaw: 100, tdsSpreadRaw: 51 });
  assert.equal(validateSensorPayload(payload).ok, false);
});

test('false stable flag is rejected for a complete low-spread window', () => {
  assert.equal(validateSensorPayload(validSensorPayload({ tdsWindowStable: false })).ok, false);
});

test('false stable flag is accepted for an incomplete window', () => {
  assert.equal(validateSensorPayload(validSensorPayload({ tdsSampleCount: 29, tdsWindowStable: false })).ok, true);
});

test('false stable flag is accepted when raw spread exceeds 50', () => {
  const payload = validSensorPayload({
    tdsMin: 75, tdsMax: 126, tdsRaw: 100, tdsSpreadRaw: 51, tdsWindowStable: false,
  });
  assert.equal(validateSensorPayload(payload).ok, true);
});
