const { TDS_CONTROL_MAX_AGE_MS, TDS_WINDOW_SAMPLE_COUNT } = require('../config/tdsQualityConfig');

const GATE_STATUS = Object.freeze({ PASS: 'PASS', BLOCKED: 'BLOCKED', INSUFFICIENT_DATA: 'INSUFFICIENT_DATA' });
const DECISION = Object.freeze({ ELIGIBLE: 'ELIGIBLE', BLOCKED: 'BLOCKED', INSUFFICIENT_DATA: 'INSUFFICIENT_DATA' });

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function gate(code, status, reasonCode, detail = null) {
  return { code, status, reasonCode: status === GATE_STATUS.PASS ? null : reasonCode, detail };
}

function pass(code, detail = null) { return gate(code, GATE_STATUS.PASS, null, detail); }
function blocked(code, reason, detail = null) { return gate(code, GATE_STATUS.BLOCKED, reason, detail); }
function missing(code, reason, detail = null) { return gate(code, GATE_STATUS.INSUFFICIENT_DATA, reason, detail); }

function evaluateShadowDosing(context, now = new Date()) {
  const telemetry = context.telemetry || {};
  const measurement = context.measurement || {};
  const settings = context.settings || null;
  const activeSet = context.activeSet || null;
  const activeRun = context.activeRun || null;
  const pumps = context.pumpCalibration || {};
  const measurementAtMs = new Date(measurement.measurementAt || telemetry.measurementAt || 0).getTime();
  const measurementAgeMs = now.getTime() - measurementAtMs;
  const fresh = measurement.measurementFreshnessVerified === true
    && Number.isFinite(measurementAtMs)
    && measurementAgeMs >= 0
    && measurementAgeMs <= TDS_CONTROL_MAX_AGE_MS;
  const targetReady = settings && finitePositive(settings.targetMinPpm)
    && finitePositive(settings.targetMaxPpm) && settings.targetMaxPpm > settings.targetMinPpm;
  const flowA = pumps.pumpAFlowRateMlPerSec;
  const flowB = pumps.pumpBFlowRateMlPerSec;
  const doseMl = settings && (settings.stepDoseMlPerPump || settings.doseMlPerPump);
  const durationA = finitePositive(doseMl) && finitePositive(flowA) ? Math.round(doseMl / flowA * 1000) : null;
  const durationB = finitePositive(doseMl) && finitePositive(flowB) ? Math.round(doseMl / flowB * 1000) : null;
  const used = typeof context.dailyDoseUsedMlPerPump === 'number' ? context.dailyDoseUsedMlPerPump : null;
  const maxDaily = settings && settings.maxDailyDoseMlPerPump;

  const gates = [
    context.shadowEnabled === true ? pass('SHADOW_MODE_ENABLED') : blocked('SHADOW_MODE_ENABLED', 'SHADOW_MODE_DISABLED'),
    context.autoDosingEnabled === false ? pass('AUTO_DOSING_OFF') : blocked('AUTO_DOSING_OFF', 'AUTO_DOSING_MUST_REMAIN_OFF'),
    telemetry.schemaVersion === 2 ? pass('TELEMETRY_SCHEMA_V2') : blocked('TELEMETRY_SCHEMA_V2', 'LEGACY_TELEMETRY'),
    telemetry.telemetryIdentityValid === true ? pass('IDENTITY_VALID') : blocked('IDENTITY_VALID', 'INVALID_TELEMETRY_IDENTITY'),
    telemetry.telemetryDuplicate === false ? pass('NOT_DUPLICATE') : blocked('NOT_DUPLICATE', 'DUPLICATE_MEASUREMENT'),
    telemetry.telemetryOrderStatus === 'ACCEPTED' ? pass('ORDER_ACCEPTED') : blocked('ORDER_ACCEPTED', telemetry.telemetryOrderStatus === 'OUT_OF_ORDER' ? 'OUT_OF_ORDER' : 'ORDER_NOT_ACCEPTED'),
    telemetry.telemetryBootSessionValid === true ? pass('BOOT_SESSION_VALID') : blocked('BOOT_SESSION_VALID', 'BOOT_TRANSITION_UNCONFIRMED'),
    fresh
      ? pass('MEASUREMENT_FRESH', `ageMs=${measurementAgeMs}`)
      : blocked(
        'MEASUREMENT_FRESH',
        'STALE_MEASUREMENT',
        `verified=${measurement.measurementFreshnessVerified === true}; ageMs=${Number.isFinite(measurementAgeMs) ? measurementAgeMs : 'N/A'}; source=${measurement.measurementTimeSource || 'N/A'}`,
      ),
    measurement.tdsSampleCount === TDS_WINDOW_SAMPLE_COUNT && measurement.tdsWindowStable === true
      ? pass('FIRMWARE_SAMPLE_WINDOW') : blocked('FIRMWARE_SAMPLE_WINDOW', 'INSUFFICIENT_FIRMWARE_SAMPLES'),
    measurement.tdsStabilityDistinctMeasurementCount >= 3
      ? pass('THREE_DISTINCT_MEASUREMENTS') : blocked('THREE_DISTINCT_MEASUREMENTS', 'INSUFFICIENT_DISTINCT_MEASUREMENTS'),
    measurement.tdsStable === true ? pass('TDS_STABLE') : blocked('TDS_STABLE', 'TDS_UNSTABLE'),
    activeSet && activeSet.status === 'active' ? pass('ACTIVE_CALIBRATION') : missing('ACTIVE_CALIBRATION', 'NO_ACTIVE_CALIBRATION'),
    activeSet && activeSet.pointCount >= 3 ? pass('CALIBRATION_POINT_COUNT') : missing('CALIBRATION_POINT_COUNT', 'INSUFFICIENT_CALIBRATION_POINTS'),
    measurement.tdsCalibrationInRange === true ? pass('CALIBRATION_RANGE') : blocked('CALIBRATION_RANGE', 'OUTSIDE_CALIBRATION_RANGE'),
    measurement.tdsTemperatureCompensated === true ? pass('TEMPERATURE_COMPENSATION') : blocked('TEMPERATURE_COMPENSATION', 'INVALID_TEMPERATURE_COMPENSATION'),
    measurement.waterTempValid === true && typeof measurement.waterTemp === 'number'
      ? pass('WATER_TEMPERATURE') : blocked('WATER_TEMPERATURE', 'INVALID_WATER_TEMPERATURE'),
    measurement.waterLevel === 'normal' ? pass('WATER_LEVEL') : blocked('WATER_LEVEL', 'UNSAFE_WATER_LEVEL'),
    settings && settings.requireMainPumpOn === false || measurement.pumpMain === true
      ? pass('MAIN_PUMP_REQUIRED_STATE') : blocked('MAIN_PUMP_REQUIRED_STATE', 'MAIN_PUMP_OFF'),
    measurement.pumpA === false ? pass('PUMP_A_IDLE') : blocked('PUMP_A_IDLE', 'PUMP_A_RUNNING'),
    measurement.pumpB === false ? pass('PUMP_B_IDLE') : blocked('PUMP_B_IDLE', 'PUMP_B_RUNNING'),
    !activeRun ? pass('NO_ACTIVE_DOSING_RUN') : blocked('NO_ACTIVE_DOSING_RUN', 'DOSING_RUN_ACTIVE'),
    !activeRun || activeRun.status !== 'mixing_wait' ? pass('NOT_MIXING') : blocked('NOT_MIXING', 'MIXING_IN_PROGRESS'),
    finitePositive(flowA) ? pass('PUMP_A_CALIBRATION') : missing('PUMP_A_CALIBRATION', 'MISSING_PUMP_A_CALIBRATION'),
    finitePositive(flowB) ? pass('PUMP_B_CALIBRATION') : missing('PUMP_B_CALIBRATION', 'MISSING_PUMP_B_CALIBRATION'),
    settings && settings.cropCode === 'cai_ngot' ? pass('CROP_CAI_NGOT') : missing('CROP_CAI_NGOT', 'CROP_NOT_CONFIRMED'),
    settings && settings.targetRangeConfirmed === true && targetReady ? pass('TARGET_CONFIRMED') : missing('TARGET_CONFIRMED', 'UNCONFIRMED_TARGET'),
    pass('TANK_VOLUME', 'NOT_REQUIRED_FOR_FIXED_STEP_V1'),
    used !== null && finitePositive(maxDaily) && finitePositive(doseMl)
      ? (used + doseMl <= maxDaily ? pass('DAILY_DOSE_LIMIT') : blocked('DAILY_DOSE_LIMIT', 'DAILY_LIMIT_REACHED'))
      : missing('DAILY_DOSE_LIMIT', 'DAILY_LIMIT_DATA_MISSING'),
    finitePositive(doseMl) && settings && doseMl <= settings.maxDoseMlPerPumpPerRun
      && durationA > 0 && durationA <= 5000 && durationB > 0 && durationB <= 5000
      ? pass('PHASE21_SAFETY_LIMITS') : blocked('PHASE21_SAFETY_LIMITS', 'PUMP_DURATION_OR_DOSE_LIMIT_INVALID'),
    context.autoDosingLockedOff === true ? pass('AUTO_DOSING_PHASE22_LOCK') : blocked('AUTO_DOSING_PHASE22_LOCK', 'AUTO_DOSING_LOCK_MISSING'),
  ];

  const failed = gates.filter((item) => item.status !== GATE_STATUS.PASS);
  const hasInsufficientData = failed.some((item) => item.status === GATE_STATUS.INSUFFICIENT_DATA);
  const decision = failed.length === 0
    ? DECISION.ELIGIBLE
    : hasInsufficientData ? DECISION.INSUFFICIENT_DATA : DECISION.BLOCKED;
  let hypotheticalAction = 'WAIT';
  if (decision === DECISION.ELIGIBLE) {
    hypotheticalAction = measurement.tdsPpm < settings.targetMinPpm ? 'DOSE_STEP' : 'NO_DOSE';
  }
  const includeDose = decision === DECISION.ELIGIBLE && hypotheticalAction === 'DOSE_STEP';

  return {
    decision,
    primaryReasonCode: failed.length > 0 ? failed[0].reasonCode : (hypotheticalAction === 'DOSE_STEP' ? 'TDS_BELOW_TARGET' : 'TDS_AT_OR_ABOVE_TARGET'),
    reasonCodes: [...new Set(failed.map((item) => item.reasonCode))],
    gates,
    hypotheticalAction,
    hypotheticalDoseMlPerPump: includeDose ? doseMl : null,
    hypotheticalPumpADurationMs: includeDose ? durationA : null,
    hypotheticalPumpBDurationMs: includeDose ? durationB : null,
  };
}

module.exports = { GATE_STATUS, DECISION, evaluateShadowDosing };
