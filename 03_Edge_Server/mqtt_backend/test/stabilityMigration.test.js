const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateTdsStability } = require('../src/services/tdsQualityService');
const { runLegacyMigration } = require('../scripts/migrateLegacyTdsCalibrations');
const { getLegacyReasons } = require('../scripts/migrateLegacyTdsCalibrations');

function modernCalibrationRow(overrides = {}) {
  return {
    _id: 100,
    deviceId: 'device001',
    calibrationSetId: 'set1',
    measuredRaw: 1241,
    measuredVoltage: 1,
    measuredVoltage25: 1,
    referenceEcUsCm: 500,
    referenceTdsPpm: 250,
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

function stableSample(tdsPpm, overrides = {}) {
  return {
    tdsPpm,
    tdsWindowStable: true,
    tdsSampleCount: 30,
    tdsSpreadRaw: 20,
    tdsMeasurementValid: true,
    ...overrides,
  };
}

test('three stable payloads inside threshold are stable', () => {
  const samples = [700, 710, 705].map((tdsPpm) => stableSample(tdsPpm));
  assert.equal(calculateTdsStability(samples).tdsStable, true);
});

test('firmware-unstable payload is excluded', () => {
  const samples = [700, 710, 705].map((tdsPpm, index) => stableSample(tdsPpm, { tdsWindowStable: index !== 0 }));
  assert.equal(calculateTdsStability(samples).tdsStable, false);
});

test('TDS spread above threshold is unstable', () => {
  const samples = [700, 740, 780].map((tdsPpm) => stableSample(tdsPpm));
  assert.equal(calculateTdsStability(samples).tdsStable, false);
});

test('window with zero samples cannot contribute to stability', () => {
  const samples = [700, 705, 710].map((tdsPpm) => stableSample(tdsPpm, { tdsSampleCount: 0 }));
  assert.equal(calculateTdsStability(samples).tdsStable, false);
});

test('window with 29 samples cannot contribute to stability', () => {
  const samples = [700, 705, 710].map((tdsPpm) => stableSample(tdsPpm, { tdsSampleCount: 29 }));
  assert.equal(calculateTdsStability(samples).tdsStable, false);
});

test('window with raw spread 51 cannot contribute to stability', () => {
  const samples = [700, 705, 710].map((tdsPpm) => stableSample(tdsPpm, { tdsSpreadRaw: 51 }));
  assert.equal(calculateTdsStability(samples).tdsStable, false);
});

test('migration dry-run performs no writes', async () => {
  let writes = 0;
  const rows = [
    { _id: 1, referenceTdsPpm: 700 },
    { _id: 2, calibrationSetId: null, waterTemp: 25 },
    { _id: 3, calibrationSetId: '', referenceEcUsCm: 500, referenceScale: '500', waterTemp: 25 },
    { _id: 4, calibrationSetId: 'set1', referenceScale: '500', waterTemp: 25 },
    modernCalibrationRow({ _id: 5 }),
  ];
  const database = {
    collection() {
      return {
        find() { return { async toArray() { return rows; } }; },
        async updateOne() { writes += 1; },
      };
    },
  };
  const summary = await runLegacyMigration(database, { apply: false });
  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.totalRowsScanned, 5);
  assert.equal(summary.legacyRowsFound, 4);
  assert.equal(summary.missingCalibrationSetId, 3);
  assert.equal(summary.rowsWithSetIdButIncomplete, 1);
  assert.equal(summary.completeModernRows, 1);
  assert.equal(writes, 0);
});

test('migration classifies null empty and incomplete set rows', () => {
  assert.ok(getLegacyReasons({ calibrationSetId: null }).includes('missing_calibration_set_id'));
  assert.ok(getLegacyReasons({ calibrationSetId: '' }).includes('missing_calibration_set_id'));
  const reasons = getLegacyReasons({
    calibrationSetId: 'set1', referenceEcUsCm: 500, referenceScale: '700', waterTemp: 85,
  });
  assert.ok(reasons.includes('missing_or_invalid_reference_scale'));
  assert.ok(reasons.includes('missing_or_invalid_water_temperature'));
});

const incompleteModernPointCases = [
  ['deviceId', { deviceId: null }, 'missing_or_invalid_device_id'],
  ['calibrationSetId', { calibrationSetId: null }, 'missing_calibration_set_id'],
  ['measuredRaw', { measuredRaw: null }, 'missing_or_invalid_measured_raw'],
  ['measuredVoltage', { measuredVoltage: null }, 'missing_or_invalid_measured_voltage'],
  ['raw voltage relationship', { measuredVoltage: 1.2 }, 'measured_raw_voltage_mismatch'],
  ['referenceEcUsCm', { referenceEcUsCm: null }, 'missing_reference_ec'],
  ['referenceScale', { referenceScale: '700' }, 'missing_or_invalid_reference_scale'],
  ['tdsFactor', { tdsFactor: 0.7 }, 'missing_or_invalid_tds_factor'],
  ['referenceTdsPpm', { referenceTdsPpm: null }, 'missing_or_invalid_reference_tds_ppm'],
  ['EC to TDS relationship', { referenceTdsPpm: 300 }, 'reference_tds_ppm_mismatch'],
  ['waterTemp', { waterTemp: 85 }, 'missing_or_invalid_water_temperature'],
  ['measuredVoltage25', { measuredVoltage25: null }, 'missing_or_invalid_measured_voltage_25'],
  ['voltage25 relationship', { measuredVoltage25: 1.1 }, 'measured_voltage_25_mismatch'],
  ['temperatureCompensated', { temperatureCompensated: false }, 'temperature_compensation_not_confirmed'],
  ['temperatureFactorUsed', { temperatureFactorUsed: null }, 'missing_or_invalid_temperature_factor'],
  ['temperature factor relationship', { temperatureFactorUsed: 1.1 }, 'temperature_factor_mismatch'],
  ['temperatureReferenceC', { temperatureReferenceC: 20 }, 'missing_or_invalid_temperature_reference'],
  ['temperatureAlphaPerC', { temperatureAlphaPerC: 0.01 }, 'missing_or_invalid_temperature_alpha'],
  ['method', { method: 'legacy_factor' }, 'missing_or_invalid_method'],
  ['legacy marker', { legacy: true }, 'legacy_marker_present'],
];

for (const [field, overrides, expectedReason] of incompleteModernPointCases) {
  test(`migration rejects modern point with invalid ${field}`, () => {
    const reasons = getLegacyReasons(modernCalibrationRow(overrides));
    assert.ok(reasons.includes(expectedReason));
  });
}

test('migration accepts a complete modern point', () => {
  assert.deepEqual(getLegacyReasons(modernCalibrationRow()), []);
});

test('migration summary counts every incomplete metadata reason', async () => {
  const rows = incompleteModernPointCases.map(([, overrides], index) => (
    modernCalibrationRow({ _id: index + 1, ...overrides })
  ));
  const database = {
    collection() {
      return {
        find() { return { async toArray() { return rows; } }; },
        async updateOne() { throw new Error('dry-run must not write'); },
      };
    },
  };

  const summary = await runLegacyMigration(database, { apply: false });

  assert.equal(summary.totalRowsScanned, incompleteModernPointCases.length);
  assert.equal(summary.rowsRequiringAudit, incompleteModernPointCases.length);
  assert.equal(summary.completeModernRows, 0);
  for (const [, , expectedReason] of incompleteModernPointCases) {
    assert.ok(summary.reasonCounts[expectedReason] >= 1, `missing count for ${expectedReason}`);
  }
});

test('migration apply only marks incomplete rows and never infers calibration values', async () => {
  const rows = [
    modernCalibrationRow({ _id: 1 }),
    modernCalibrationRow({ _id: 2, referenceEcUsCm: null }),
  ];
  const updates = [];
  const database = {
    collection() {
      return {
        find() { return { async toArray() { return rows; } }; },
        async updateOne(filter, update) { updates.push({ filter, update }); },
      };
    },
  };

  const summary = await runLegacyMigration(database, { apply: true });

  assert.equal(summary.rowsMarkedLegacy, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].filter._id, 2);
  assert.equal(Object.hasOwn(updates[0].update.$set, 'referenceScale'), false);
  assert.equal(Object.hasOwn(updates[0].update.$set, 'referenceTdsPpm'), false);
  assert.equal(Object.hasOwn(updates[0].update.$set, 'status'), false);
  assert.deepEqual(
    Object.keys(updates[0].update.$set).sort(),
    ['legacy', 'legacyAuditedAt', 'legacyReasons'].sort(),
  );
});
