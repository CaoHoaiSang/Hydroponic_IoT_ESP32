const {
  TDS_ADC_MAX,
  TDS_ADC_REFERENCE_VOLTAGE,
  TDS_ADC_VOLTAGE_TOLERANCE,
  TDS_SENSOR_MAX_VOLTAGE,
  TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW,
  TDS_WINDOW_MAX_ROBUST_SPREAD_RAW,
  TDS_WINDOW_MAX_SPREAD_RAW,
  TDS_WINDOW_SAMPLE_COUNT,
  TDS_WINDOW_TRIMMED_SAMPLE_COUNT,
} = require('../config/tdsQualityConfig');
const { TELEMETRY_SCHEMA_VERSION } = require('../config/phase22Config');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

const ROBUST_WINDOW_FIELDS = [
  'tdsRobustMin',
  'tdsRobustMax',
  'tdsRobustSpreadRaw',
  'tdsTrimmedSampleCount',
];

function validateSensorPayload(payload) {
  const errors = [];
  if (!isObject(payload)) return { ok: false, errors: ['payload must be an object'] };
  if (typeof payload.deviceId !== 'string' || !payload.deviceId.trim()) errors.push('deviceId must be a non-empty string');
  const hasIdentityField = ['schemaVersion', 'bootId', 'measurementSeq', 'measurementId', 'sampledAtUptimeMs']
    .some((field) => Object.prototype.hasOwnProperty.call(payload, field));
  if (hasIdentityField) {
    if (payload.schemaVersion !== TELEMETRY_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${TELEMETRY_SCHEMA_VERSION}`);
    if (typeof payload.bootId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(payload.bootId)) errors.push('bootId must be an 8-64 character non-secret identifier');
    if (!Number.isSafeInteger(payload.measurementSeq) || payload.measurementSeq <= 0) errors.push('measurementSeq must be a positive safe integer');
    if (typeof payload.measurementId !== 'string' || !payload.measurementId.trim()) errors.push('measurementId must be a non-empty string');
    if (!Number.isSafeInteger(payload.sampledAtUptimeMs) || payload.sampledAtUptimeMs < 0) errors.push('sampledAtUptimeMs must be a non-negative safe integer');
    if (typeof payload.deviceId === 'string' && typeof payload.bootId === 'string'
      && Number.isSafeInteger(payload.measurementSeq) && typeof payload.measurementId === 'string'
      && payload.measurementId !== `${payload.deviceId}:${payload.bootId}:${payload.measurementSeq}`) {
      errors.push('measurementId must equal deviceId:bootId:measurementSeq');
    }
  }
  if (!Number.isInteger(payload.tdsRaw) || payload.tdsRaw < 0 || payload.tdsRaw > TDS_ADC_MAX) errors.push(`tdsRaw must be an integer from 0 to ${TDS_ADC_MAX}`);
  if (!isNumber(payload.tdsVoltage) || payload.tdsVoltage < 0 || payload.tdsVoltage > TDS_SENSOR_MAX_VOLTAGE) errors.push(`tdsVoltage must be from 0 to ${TDS_SENSOR_MAX_VOLTAGE}`);
  if (Number.isInteger(payload.tdsRaw) && isNumber(payload.tdsVoltage)) {
    const expectedVoltage = payload.tdsRaw * TDS_ADC_REFERENCE_VOLTAGE / TDS_ADC_MAX;
    if (Math.abs(payload.tdsVoltage - expectedVoltage) > TDS_ADC_VOLTAGE_TOLERANCE) {
      errors.push(`tdsVoltage must match tdsRaw within ${TDS_ADC_VOLTAGE_TOLERANCE} V`);
    }
  }
  if (!Number.isInteger(payload.tdsMin) || payload.tdsMin < 0 || payload.tdsMin > 4095) errors.push('tdsMin must be an integer from 0 to 4095');
  if (!Number.isInteger(payload.tdsMax) || payload.tdsMax < 0 || payload.tdsMax > 4095) errors.push('tdsMax must be an integer from 0 to 4095');
  if (Number.isInteger(payload.tdsMin) && Number.isInteger(payload.tdsRaw) && Number.isInteger(payload.tdsMax)
    && !(payload.tdsMin <= payload.tdsRaw && payload.tdsRaw <= payload.tdsMax)) {
    errors.push('tdsMin must be less than or equal to tdsRaw and tdsRaw must be less than or equal to tdsMax');
  }
  if (!Number.isInteger(payload.tdsSampleCount) || payload.tdsSampleCount < 0 || payload.tdsSampleCount > TDS_WINDOW_SAMPLE_COUNT) errors.push(`tdsSampleCount must be an integer from 0 to ${TDS_WINDOW_SAMPLE_COUNT}`);
  if (!Number.isInteger(payload.tdsSpreadRaw) || payload.tdsSpreadRaw < 0) errors.push('tdsSpreadRaw must be a non-negative integer');
  if (Number.isInteger(payload.tdsMin) && Number.isInteger(payload.tdsMax) && Number.isInteger(payload.tdsSpreadRaw)
    && payload.tdsSpreadRaw !== payload.tdsMax - payload.tdsMin) errors.push('tdsSpreadRaw must equal tdsMax minus tdsMin');
  const robustFieldsPresent = ROBUST_WINDOW_FIELDS.filter((field) => (
    Object.prototype.hasOwnProperty.call(payload, field)
  ));
  const hasRobustWindow = robustFieldsPresent.length === ROBUST_WINDOW_FIELDS.length;
  if (robustFieldsPresent.length > 0 && !hasRobustWindow) {
    errors.push('robust TDS window fields must be provided together');
  }
  if (hasRobustWindow) {
    if (!Number.isInteger(payload.tdsRobustMin) || payload.tdsRobustMin < 0 || payload.tdsRobustMin > TDS_ADC_MAX) errors.push(`tdsRobustMin must be an integer from 0 to ${TDS_ADC_MAX}`);
    if (!Number.isInteger(payload.tdsRobustMax) || payload.tdsRobustMax < 0 || payload.tdsRobustMax > TDS_ADC_MAX) errors.push(`tdsRobustMax must be an integer from 0 to ${TDS_ADC_MAX}`);
    if (!Number.isInteger(payload.tdsRobustSpreadRaw) || payload.tdsRobustSpreadRaw < 0) errors.push('tdsRobustSpreadRaw must be a non-negative integer');
    if (!Number.isInteger(payload.tdsTrimmedSampleCount) || payload.tdsTrimmedSampleCount < 0 || payload.tdsTrimmedSampleCount > TDS_WINDOW_SAMPLE_COUNT) errors.push(`tdsTrimmedSampleCount must be an integer from 0 to ${TDS_WINDOW_SAMPLE_COUNT}`);
    if (Number.isInteger(payload.tdsRobustMin) && Number.isInteger(payload.tdsRobustMax)
      && Number.isInteger(payload.tdsRobustSpreadRaw)
      && payload.tdsRobustSpreadRaw !== payload.tdsRobustMax - payload.tdsRobustMin) {
      errors.push('tdsRobustSpreadRaw must equal tdsRobustMax minus tdsRobustMin');
    }
    if (Number.isInteger(payload.tdsMin) && Number.isInteger(payload.tdsRobustMin)
      && Number.isInteger(payload.tdsRaw) && Number.isInteger(payload.tdsRobustMax)
      && Number.isInteger(payload.tdsMax)
      && !(payload.tdsMin <= payload.tdsRobustMin
        && payload.tdsRobustMin <= payload.tdsRaw
        && payload.tdsRaw <= payload.tdsRobustMax
        && payload.tdsRobustMax <= payload.tdsMax)) {
      errors.push('robust TDS bounds must stay inside full bounds and contain tdsRaw');
    }
    if (payload.tdsSampleCount === TDS_WINDOW_SAMPLE_COUNT
      && payload.tdsTrimmedSampleCount !== TDS_WINDOW_TRIMMED_SAMPLE_COUNT) {
      errors.push(`tdsTrimmedSampleCount must equal ${TDS_WINDOW_TRIMMED_SAMPLE_COUNT} for a complete window`);
    }
  }
  if (typeof payload.tdsWindowStable !== 'boolean') errors.push('tdsWindowStable must be boolean');
  if (Number.isInteger(payload.tdsSampleCount)
    && Number.isInteger(payload.tdsSpreadRaw)
    && typeof payload.tdsWindowStable === 'boolean') {
    const expectedWindowStable = hasRobustWindow
      ? payload.tdsSampleCount === TDS_WINDOW_SAMPLE_COUNT
        && payload.tdsTrimmedSampleCount === TDS_WINDOW_TRIMMED_SAMPLE_COUNT
        && payload.tdsRobustSpreadRaw <= TDS_WINDOW_MAX_ROBUST_SPREAD_RAW
        && payload.tdsSpreadRaw <= TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW
      : payload.tdsSampleCount === TDS_WINDOW_SAMPLE_COUNT
        && payload.tdsSpreadRaw <= TDS_WINDOW_MAX_SPREAD_RAW;
    if (payload.tdsWindowStable !== expectedWindowStable) {
      errors.push(hasRobustWindow
        ? `tdsWindowStable must require ${TDS_WINDOW_SAMPLE_COUNT} samples, ${TDS_WINDOW_TRIMMED_SAMPLE_COUNT} retained samples, robust spread <= ${TDS_WINDOW_MAX_ROBUST_SPREAD_RAW}, and full spread <= ${TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW}`
        : `tdsWindowStable must equal (tdsSampleCount === ${TDS_WINDOW_SAMPLE_COUNT} && tdsSpreadRaw <= ${TDS_WINDOW_MAX_SPREAD_RAW})`);
    }
  }
  if (!(isNumber(payload.waterTemp) || payload.waterTemp === null)) errors.push('waterTemp must be a number or null');
  if (typeof payload.waterTempValid !== 'boolean') errors.push('waterTempValid must be boolean');
  if (payload.waterTempValid === true && (!isNumber(payload.waterTemp) || payload.waterTemp < 0 || payload.waterTemp > 50 || payload.waterTemp === 85)) errors.push('valid waterTemp must be from 0 to 50 and must not be 85');
  if (payload.waterTempValid === false && payload.waterTemp !== null) errors.push('waterTemp must be null when waterTempValid is false');
  if (!['normal', 'low', 'error'].includes(payload.waterLevel)) errors.push('waterLevel must be one of: normal, low, error');
  for (const field of ['pumpMain', 'pumpA', 'pumpB', 'pumpSpare']) {
    if (typeof payload[field] !== 'boolean') errors.push(`${field} must be boolean`);
  }
  if (!(isNumber(payload.ph) || payload.ph === null)) errors.push('ph must be a number or null');
  if (!isNumber(payload.uptimeMs) || payload.uptimeMs < 0) errors.push('uptimeMs must be a non-negative number');
  if (hasIdentityField && Number.isSafeInteger(payload.sampledAtUptimeMs) && isNumber(payload.uptimeMs)
    && payload.sampledAtUptimeMs > payload.uptimeMs) errors.push('sampledAtUptimeMs must not exceed uptimeMs');
  return { ok: errors.length === 0, errors };
}

module.exports = { validateSensorPayload };
