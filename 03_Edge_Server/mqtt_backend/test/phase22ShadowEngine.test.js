const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateShadowDosing } = require('../src/services/shadowDosingEngine');

function context(overrides = {}) {
  const now = new Date();
  const base = {
    shadowEnabled: true,
    autoDosingEnabled: false,
    autoDosingLockedOff: true,
    telemetry: {
      schemaVersion: 2,
      telemetryIdentityValid: true,
      telemetryDuplicate: false,
      telemetryOrderStatus: 'ACCEPTED',
      telemetryBootSessionValid: true,
      receivedAt: now,
    },
    measurement: {
      measurementAt: now,
      measurementFreshnessVerified: true,
      tdsSampleCount: 30,
      tdsWindowStable: true,
      tdsStabilityDistinctMeasurementCount: 3,
      tdsStable: true,
      tdsCalibrationInRange: true,
      tdsTemperatureCompensated: true,
      waterTemp: 25,
      waterTempValid: true,
      waterLevel: 'normal',
      pumpMain: true,
      pumpA: false,
      pumpB: false,
      tdsPpm: 700,
    },
    settings: {
      cropCode: 'cai_ngot',
      targetRangeConfirmed: true,
      targetMinPpm: 800,
      targetMaxPpm: 1200,
      stepDoseMlPerPump: 1,
      maxDoseMlPerPumpPerRun: 1,
      maxDailyDoseMlPerPump: 2,
      requireMainPumpOn: true,
    },
    activeSet: { status: 'active', pointCount: 3 },
    activeRun: null,
    pumpCalibration: { pumpAFlowRateMlPerSec: 2, pumpBFlowRateMlPerSec: 1.8 },
    dailyDoseUsedMlPerPump: 0,
  };
  return {
    ...base,
    ...overrides,
    telemetry: { ...base.telemetry, ...(overrides.telemetry || {}) },
    measurement: { ...base.measurement, ...(overrides.measurement || {}) },
    settings: overrides.settings === null ? null : { ...base.settings, ...(overrides.settings || {}) },
    pumpCalibration: { ...base.pumpCalibration, ...(overrides.pumpCalibration || {}) },
  };
}

function reason(result, code) {
  assert.ok(result.reasonCodes.includes(code), `expected reason ${code}: ${result.reasonCodes.join(', ')}`);
}

test('all 30 shadow safety gates pass only for complete safe data', () => {
  const result = evaluateShadowDosing(context());
  assert.equal(result.gates.length, 30);
  assert.ok(result.gates.every((item) => item.status === 'PASS'));
  assert.equal(result.decision, 'ELIGIBLE');
});

test('eligible low TDS returns a hypothetical fixed dose step', () => {
  const result = evaluateShadowDosing(context());
  assert.equal(result.hypotheticalAction, 'DOSE_STEP');
  assert.equal(result.hypotheticalDoseMlPerPump, 1);
  assert.equal(result.hypotheticalPumpADurationMs, 500);
  assert.equal(result.hypotheticalPumpBDurationMs, 556);
});

test('TDS within target returns NO_DOSE with no fake amount or duration', () => {
  const result = evaluateShadowDosing(context({ measurement: { tdsPpm: 900 } }));
  assert.equal(result.decision, 'ELIGIBLE');
  assert.equal(result.hypotheticalAction, 'NO_DOSE');
  assert.equal(result.hypotheticalDoseMlPerPump, null);
  assert.equal(result.hypotheticalPumpADurationMs, null);
});

test('TDS above target also returns NO_DOSE', () => {
  const result = evaluateShadowDosing(context({ measurement: { tdsPpm: 1300 } }));
  assert.equal(result.decision, 'ELIGIBLE');
  assert.equal(result.hypotheticalAction, 'NO_DOSE');
});

const blockedScenarios = [
  ['disabled Shadow Mode', { shadowEnabled: false }, 'SHADOW_MODE_DISABLED'],
  ['Auto Dosing not OFF', { autoDosingEnabled: true }, 'AUTO_DOSING_MUST_REMAIN_OFF'],
  ['legacy telemetry', { telemetry: { schemaVersion: undefined } }, 'LEGACY_TELEMETRY'],
  ['invalid identity', { telemetry: { telemetryIdentityValid: false } }, 'INVALID_TELEMETRY_IDENTITY'],
  ['duplicate measurement', { telemetry: { telemetryDuplicate: true } }, 'DUPLICATE_MEASUREMENT'],
  ['out-of-order measurement', { telemetry: { telemetryOrderStatus: 'OUT_OF_ORDER' } }, 'OUT_OF_ORDER'],
  ['unconfirmed boot transition', { telemetry: { telemetryBootSessionValid: false } }, 'BOOT_TRANSITION_UNCONFIRMED'],
  ['stale measurement', { measurement: { measurementAt: new Date(0) } }, 'STALE_MEASUREMENT'],
  ['insufficient firmware samples', { measurement: { tdsSampleCount: 0, tdsWindowStable: false } }, 'INSUFFICIENT_FIRMWARE_SAMPLES'],
  ['insufficient distinct measurements', { measurement: { tdsStabilityDistinctMeasurementCount: 2 } }, 'INSUFFICIENT_DISTINCT_MEASUREMENTS'],
  ['unstable TDS', { measurement: { tdsStable: false } }, 'TDS_UNSTABLE'],
  ['outside interpolation range', { measurement: { tdsCalibrationInRange: false } }, 'OUTSIDE_CALIBRATION_RANGE'],
  ['invalid temperature compensation', { measurement: { tdsTemperatureCompensated: false } }, 'INVALID_TEMPERATURE_COMPENSATION'],
  ['invalid water temperature', { measurement: { waterTemp: null, waterTempValid: false } }, 'INVALID_WATER_TEMPERATURE'],
  ['unsafe water level', { measurement: { waterLevel: 'low' } }, 'UNSAFE_WATER_LEVEL'],
  ['main pump OFF when required', { measurement: { pumpMain: false } }, 'MAIN_PUMP_OFF'],
  ['Pump A already running', { measurement: { pumpA: true } }, 'PUMP_A_RUNNING'],
  ['Pump B already running', { measurement: { pumpB: true } }, 'PUMP_B_RUNNING'],
  ['active dosing run', { activeRun: { status: 'in_progress' } }, 'DOSING_RUN_ACTIVE'],
  ['mixing wait', { activeRun: { status: 'mixing_wait' } }, 'MIXING_IN_PROGRESS'],
  ['daily limit reached', { dailyDoseUsedMlPerPump: 2 }, 'DAILY_LIMIT_REACHED'],
  ['unsafe duration', { pumpCalibration: { pumpAFlowRateMlPerSec: 0.1 } }, 'PUMP_DURATION_OR_DOSE_LIMIT_INVALID'],
  ['missing Phase 22 lock', { autoDosingLockedOff: false }, 'AUTO_DOSING_LOCK_MISSING'],
];

for (const [name, changes, reasonCode] of blockedScenarios) {
  test(`${name} is fail-closed`, () => {
    const result = evaluateShadowDosing(context(changes));
    assert.notEqual(result.decision, 'ELIGIBLE');
    assert.equal(result.hypotheticalAction, 'WAIT');
    assert.equal(result.hypotheticalDoseMlPerPump, null);
    reason(result, reasonCode);
  });
}

const insufficientScenarios = [
  ['missing active calibration', { activeSet: null }, 'NO_ACTIVE_CALIBRATION'],
  ['calibration below three points', { activeSet: { status: 'active', pointCount: 2 } }, 'INSUFFICIENT_CALIBRATION_POINTS'],
  ['missing Pump A calibration', { pumpCalibration: { pumpAFlowRateMlPerSec: null } }, 'MISSING_PUMP_A_CALIBRATION'],
  ['missing Pump B calibration', { pumpCalibration: { pumpBFlowRateMlPerSec: null } }, 'MISSING_PUMP_B_CALIBRATION'],
  ['wrong crop', { settings: { cropCode: 'legacy_crop' } }, 'CROP_NOT_CONFIRMED'],
  ['unconfirmed target', { settings: { targetRangeConfirmed: false } }, 'UNCONFIRMED_TARGET'],
  ['missing daily usage', { dailyDoseUsedMlPerPump: null }, 'DAILY_LIMIT_DATA_MISSING'],
];

for (const [name, changes, reasonCode] of insufficientScenarios) {
  test(`${name} returns insufficient data`, () => {
    const result = evaluateShadowDosing(context(changes));
    assert.equal(result.decision, 'INSUFFICIENT_DATA');
    assert.equal(result.hypotheticalAction, 'WAIT');
    reason(result, reasonCode);
  });
}

test('shadow engine has no publisher or dosing repository argument', () => {
  assert.equal(evaluateShadowDosing.length, 1);
  const source = evaluateShadowDosing.toString();
  assert.equal(source.includes('publishPump'), false);
  assert.equal(source.includes('dosing_runs'), false);
});

test('reason priority is deterministic by gate order', () => {
  const result = evaluateShadowDosing(context({
    shadowEnabled: false,
    telemetry: { schemaVersion: undefined },
    measurement: { waterLevel: 'low' },
  }));
  assert.equal(result.primaryReasonCode, 'SHADOW_MODE_DISABLED');
});
