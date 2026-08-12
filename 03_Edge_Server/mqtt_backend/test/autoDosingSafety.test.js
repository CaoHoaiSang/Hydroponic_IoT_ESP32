const test = require('node:test');
const assert = require('node:assert/strict');
const { assessAutoDosingReadiness } = require('../src/services/autoDosingReadinessService');
const { DEFAULT_SETTINGS, getMixingMeasurementInvalidReasons } = require('../src/services/autoDosingService');

function fixture(overrides = {}) {
  const now = new Date();
  return {
    settings: { ...DEFAULT_SETTINGS, enabled: true, targetRangeConfirmed: true },
    device: {
      activeTdsCalibrationSetId: 'set1', lastSeenAt: now,
      latestCalibration: { pumpAFlowRateMlPerSec: 2, pumpBFlowRateMlPerSec: 1.8 },
      latest: {
        tdsCalibrationSetId: 'set1', tdsControlValid: true, tdsStable: true,
        tdsCalibrationInRange: true, tdsCalibrationWarning: null,
        tdsTemperatureCompensated: true, waterLevel: 'normal', waterTempValid: true,
        pumpMain: true, tdsPpm: 700,
      },
    },
    activeSet: {
      setId: 'set1', status: 'active', validationStatus: 'valid', pointCount: 3,
      minReferenceTdsPpm: 200, maxReferenceTdsPpm: 1500,
    },
    activeRun: null,
    dailyUsage: { dailyDoseUsedMlPerPump: 0 },
    now,
    ...overrides,
  };
}

test('19 undefined stability blocks readiness', () => {
  const data = fixture(); delete data.device.latest.tdsStable;
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_unstable'));
});

test('20 false stability blocks readiness', () => {
  const data = fixture(); data.device.latest.tdsStable = false;
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_unstable'));
});

test('21 calibration warning blocks readiness', () => {
  const data = fixture(); data.device.latest.tdsCalibrationWarning = 'warning';
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_calibration_warning'));
});

test('22 out-of-range calibration blocks readiness', () => {
  const data = fixture(); data.device.latest.tdsCalibrationInRange = false;
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_outside_calibration_range'));
});

test('23 insufficient points block readiness', () => {
  const data = fixture(); data.activeSet.pointCount = 2;
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_calibration_insufficient_points'));
});

test('24 inactive set blocks readiness', () => {
  const data = fixture(); data.activeSet.status = 'retired';
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_calibration_set_inactive'));
});

test('25 target outside active calibrated range blocks readiness', () => {
  const data = fixture(); data.settings.targetMaxPpm = 1600;
  assert.ok(assessAutoDosingReadiness(data).reasons.includes('tds_target_outside_calibrated_range'));
});

test('26 Auto Dosing defaults OFF and target unconfirmed', () => {
  assert.equal(DEFAULT_SETTINGS.enabled, false);
  assert.equal(DEFAULT_SETTINGS.targetRangeConfirmed, false);
});

test('27 measurement before mixingUntil cannot finalize', () => {
  const mixingUntil = new Date();
  const measurementAt = new Date(mixingUntil.getTime() - 1000);
  const reasons = getMixingMeasurementInvalidReasons({
    measurementAt, tdsCalibrationSetId: 'set1', tdsPpm: 800, tdsControlValid: true, tdsStable: true,
    tdsCalibrationInRange: true, tdsCalibrationWarning: null,
    tdsTemperatureCompensated: true,
  }, {
    tdsCalibrationSetIdAtStart: 'set1', mixingStartedAt: new Date(mixingUntil.getTime() - 10000), mixingUntil,
  }, { activeTdsCalibrationSetId: 'set1' }, {
    setId: 'set1', status: 'active', validationStatus: 'valid', pointCount: 3,
  }, new Date(mixingUntil.getTime() + 1000));
  assert.ok(reasons.includes('tds_measurement_not_after_mixing'));
});

test('28 calibration set change blocks post-mixing completion', () => {
  const now = new Date();
  const reasons = getMixingMeasurementInvalidReasons({
    measurementAt: now, tdsCalibrationSetId: 'set2', tdsPpm: 800, tdsControlValid: true, tdsStable: true,
    tdsCalibrationInRange: true, tdsCalibrationWarning: null, tdsTemperatureCompensated: true,
  }, {
    tdsCalibrationSetIdAtStart: 'set1', mixingStartedAt: new Date(now.getTime() - 2000), mixingUntil: new Date(now.getTime() - 1000),
  }, { activeTdsCalibrationSetId: 'set2' }, {
    setId: 'set2', status: 'active', validationStatus: 'valid', pointCount: 3,
  }, now);
  assert.ok(reasons.includes('tds_calibration_set_mismatch_after_mixing'));
  assert.ok(reasons.includes('tds_calibration_set_changed_during_run'));
});
