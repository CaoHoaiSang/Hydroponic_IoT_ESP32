const { TDS_CONTROL_MAX_AGE_MS } = require('../config/tdsQualityConfig');

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function assessAutoDosingReadiness({ settings, device, activeSet, activeRun, dailyUsage, now = new Date() }) {
  const reasons = [];
  const latest = device && device.latest ? device.latest : {};
  const activeSetId = device && device.activeTdsCalibrationSetId;

  if (!settings || settings.cropCode !== 'cai_ngot') reasons.push('crop_profile_invalid');
  if (!settings || settings.targetRangeConfirmed !== true) reasons.push('tds_target_range_unconfirmed');
  if (!activeSetId) reasons.push('tds_calibration_set_missing');
  if (!activeSet || activeSet.status !== 'active') reasons.push('tds_calibration_set_inactive');
  if (!activeSet || activeSet.validationStatus !== 'valid' || activeSet.pointCount < 3) reasons.push('tds_calibration_insufficient_points');
  if (latest.tdsCalibrationSetId !== activeSetId) reasons.push('tds_calibration_set_mismatch');
  if (latest.tdsControlValid !== true) reasons.push('tds_control_invalid');
  if (latest.tdsStable !== true) reasons.push('tds_unstable');
  if (latest.tdsCalibrationInRange !== true) reasons.push('tds_outside_calibration_range');
  if (latest.tdsCalibrationWarning !== null) reasons.push('tds_calibration_warning');
  if (latest.tdsTemperatureCompensated !== true) reasons.push('tds_temperature_not_compensated');
  if (latest.waterLevel !== 'normal') reasons.push('water_level_low');
  if (latest.waterTempValid !== true) reasons.push('water_temp_invalid');
  if (settings && settings.requireMainPumpOn && latest.pumpMain !== true) reasons.push('main_pump_not_running');

  const lastSeenMs = device && device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : Number.NaN;
  if (!Number.isFinite(lastSeenMs) || now.getTime() - lastSeenMs > TDS_CONTROL_MAX_AGE_MS) reasons.push('tds_measurement_stale');

  const pumpCalibration = device && device.latestCalibration ? device.latestCalibration : {};
  if (!isPositiveNumber(pumpCalibration.pumpAFlowRateMlPerSec)
    || !isPositiveNumber(pumpCalibration.pumpBFlowRateMlPerSec)) reasons.push('pump_calibration_missing');

  if (activeSet && settings && (
    settings.targetMinPpm < activeSet.minReferenceTdsPpm
    || settings.targetMaxPpm > activeSet.maxReferenceTdsPpm
  )) reasons.push('tds_target_outside_calibrated_range');

  if (activeRun) reasons.push(activeRun.status === 'mixing_wait' ? 'mixing_wait_active' : 'dosing_run_active');
  if (dailyUsage && settings
    && dailyUsage.dailyDoseUsedMlPerPump + settings.stepDoseMlPerPump > settings.maxDailyDoseMlPerPump) {
    reasons.push('daily_dose_limit_reached');
  }

  return { ready: reasons.length === 0, reasons: [...new Set(reasons)] };
}

module.exports = { assessAutoDosingReadiness };
