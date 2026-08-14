const { getDb } = require('../mongoClient');
const {
  TDS_CONTROL_MAX_AGE_MS,
  TDS_STABILITY_MAX_SPREAD_PERCENT,
  TDS_STABILITY_MIN_SPREAD_PPM,
  TDS_STABILITY_REQUIRED_SAMPLES,
  TDS_STABILITY_WINDOW_MS,
  TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW,
  TDS_WINDOW_MAX_ROBUST_SPREAD_RAW,
  TDS_WINDOW_MAX_SPREAD_RAW,
  TDS_WINDOW_SAMPLE_COUNT,
  TDS_WINDOW_TRIMMED_SAMPLE_COUNT,
} = require('../config/tdsQualityConfig');
const { TELEMETRY_MAX_FUTURE_SKEW_MS } = require('../config/phase22Config');

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isMeasurementWithinStabilityWindow(measurementAt, now = new Date()) {
  const measuredTime = measurementAt instanceof Date ? measurementAt.getTime() : Number.NaN;
  const ageMs = now.getTime() - measuredTime;
  return Number.isFinite(measuredTime)
    && ageMs >= -TELEMETRY_MAX_FUTURE_SKEW_MS
    && ageMs <= TDS_STABILITY_WINDOW_MS;
}

function isTdsWindowStable(sample) {
  if (!sample) return false;
  if (sample.tdsWindowStable !== true
    || sample.tdsSampleCount !== TDS_WINDOW_SAMPLE_COUNT
    || !Number.isInteger(sample.tdsMin)
    || !Number.isInteger(sample.tdsRaw)
    || !Number.isInteger(sample.tdsMax)
    || !Number.isInteger(sample.tdsSpreadRaw)
    || sample.tdsSpreadRaw < 0
    || sample.tdsSpreadRaw !== sample.tdsMax - sample.tdsMin
    || !(sample.tdsMin <= sample.tdsRaw && sample.tdsRaw <= sample.tdsMax)) return false;

  const hasRobustWindow = ['tdsRobustMin', 'tdsRobustMax', 'tdsRobustSpreadRaw', 'tdsTrimmedSampleCount']
    .every((field) => Number.isInteger(sample[field]));
  if (!hasRobustWindow) return sample.tdsSpreadRaw <= TDS_WINDOW_MAX_SPREAD_RAW;

  return sample.tdsTrimmedSampleCount === TDS_WINDOW_TRIMMED_SAMPLE_COUNT
    && sample.tdsRobustSpreadRaw === sample.tdsRobustMax - sample.tdsRobustMin
    && sample.tdsMin <= sample.tdsRobustMin
    && sample.tdsRobustMin <= sample.tdsRaw
    && sample.tdsRaw <= sample.tdsRobustMax
    && sample.tdsRobustMax <= sample.tdsMax
    && sample.tdsRobustSpreadRaw <= TDS_WINDOW_MAX_ROBUST_SPREAD_RAW
    && sample.tdsSpreadRaw <= TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW;
}

function calculateTdsStability(samples, options = {}) {
  const requireIdentity = options.requireIdentity === true;
  const valid = (Array.isArray(samples) ? samples : []).filter((sample) => (
    sample
    && isTdsWindowStable(sample)
    && isFiniteNumber(sample.tdsPpm)
    && sample.tdsMeasurementValid === true
    && (!requireIdentity || (
      sample.schemaVersion === 2
      && sample.telemetryIdentityValid === true
      && sample.telemetryDuplicate !== true
      && sample.telemetryOrderStatus === 'ACCEPTED'
      && sample.telemetryBootSessionValid === true
      && sample.measurementFreshnessVerified === true
      && sample.measurementAt instanceof Date
      && typeof sample.measurementId === 'string'
      && sample.measurementId.length > 0
    ))
  ));
  const distinct = [];
  const seen = new Set();
  for (const sample of valid) {
    const key = requireIdentity ? sample.measurementId : Symbol('legacy-test-sample');
    if (!seen.has(key)) {
      seen.add(key);
      distinct.push(sample);
    }
  }
  if (distinct.length < TDS_STABILITY_REQUIRED_SAMPLES) {
    return {
      tdsStable: false,
      tdsStabilitySampleCount: distinct.length,
      tdsStabilityDistinctMeasurementCount: distinct.length,
      tdsStabilitySpreadPpm: null,
      tdsStabilityThresholdPpm: null,
      tdsStabilityReason: 'tds_stability_insufficient_samples',
    };
  }

  const selected = distinct.slice(0, TDS_STABILITY_REQUIRED_SAMPLES);
  const values = selected.map((sample) => sample.tdsPpm);
  const spread = Math.max(...values) - Math.min(...values);
  const threshold = Math.max(
    TDS_STABILITY_MIN_SPREAD_PPM,
    median(values) * TDS_STABILITY_MAX_SPREAD_PERCENT,
  );
  const stable = spread <= threshold;
  return {
    tdsStable: stable,
    tdsStabilitySampleCount: selected.length,
    tdsStabilityDistinctMeasurementCount: selected.length,
    tdsStabilitySpreadPpm: Number(spread.toFixed(2)),
    tdsStabilityThresholdPpm: Number(threshold.toFixed(2)),
    tdsStabilityReason: stable ? null : 'tds_stability_spread_exceeded',
  };
}

async function evaluateTdsStability(deviceId, current, now = new Date()) {
  if (!current.tdsCalibrationSetId || current.tdsMeasurementValid !== true) {
    return calculateTdsStability([], { requireIdentity: true });
  }
  if (current.measurementFreshnessVerified !== true
    || !isMeasurementWithinStabilityWindow(current.measurementAt, now)) {
    return calculateTdsStability([], { requireIdentity: true });
  }
  const database = getDb();
  const previous = await database.collection('sensor_logs')
    .find({
      deviceId,
      schemaVersion: 2,
      bootId: current.bootId,
      measurementId: { $ne: current.measurementId },
      telemetryIdentityValid: true,
      telemetryDuplicate: { $ne: true },
      telemetryOrderStatus: 'ACCEPTED',
      telemetryBootSessionValid: true,
      measurementFreshnessVerified: true,
      measurementAt: { $gte: new Date(now.getTime() - TDS_STABILITY_WINDOW_MS) },
      tdsCalibrationSetId: current.tdsCalibrationSetId,
      tdsWindowStable: true,
      tdsSampleCount: TDS_WINDOW_SAMPLE_COUNT,
      tdsMeasurementValid: true,
      tdsPpm: { $type: 'number' },
    })
    .sort({ createdAt: -1 })
    .limit(Math.max(10, TDS_STABILITY_REQUIRED_SAMPLES * 4))
    .toArray();
  return calculateTdsStability([current, ...previous], { requireIdentity: true });
}

function buildControlValidity(payload, calibration, stability, measurementAt, now = new Date(), telemetry = {}) {
  const reasons = [];
  if (telemetry.telemetryIdentityValid !== true) reasons.push('telemetry_identity_invalid');
  if (telemetry.telemetryOrderStatus !== 'ACCEPTED') reasons.push('telemetry_order_not_accepted');
  if (telemetry.telemetryBootSessionValid !== true) reasons.push('telemetry_boot_session_invalid');
  if (!calibration.tdsCalibrationSetId) reasons.push('tds_calibration_set_missing');
  if (calibration.tdsCalibrationMode !== 'piecewise_linear_ec') reasons.push('tds_calibration_set_inactive');
  if (calibration.tdsCalibrationPointCount < 3) reasons.push('tds_calibration_insufficient_points');
  if (payload.waterTempValid !== true) reasons.push('water_temp_invalid');
  if (calibration.tdsTemperatureCompensated !== true) reasons.push('tds_temperature_not_compensated');
  if (payload.tdsWindowStable !== true) reasons.push('tds_window_unstable');
  if (calibration.tdsCalibrationInRange !== true) reasons.push('tds_outside_calibration_range');
  if (calibration.tdsCalibrationWarning !== null) reasons.push('tds_calibration_warning');
  if (!isFiniteNumber(calibration.ecUsCm) || !isFiniteNumber(calibration.tdsPpm)) {
    reasons.push('tds_value_invalid');
  }
  if (stability.tdsStable !== true) reasons.push('tds_unstable');
  const measuredTime = measurementAt instanceof Date ? measurementAt.getTime() : Number.NaN;
  if (telemetry.measurementFreshnessVerified !== true) {
    reasons.push('tds_measurement_time_unverified');
  } else if (!Number.isFinite(measuredTime) || now.getTime() - measuredTime > TDS_CONTROL_MAX_AGE_MS) {
    reasons.push('tds_measurement_stale');
  }
  return {
    tdsControlValid: reasons.length === 0,
    tdsControlInvalidReasons: [...new Set(reasons)],
  };
}

module.exports = {
  median,
  isMeasurementWithinStabilityWindow,
  isTdsWindowStable,
  calculateTdsStability,
  evaluateTdsStability,
  buildControlValidity,
};
