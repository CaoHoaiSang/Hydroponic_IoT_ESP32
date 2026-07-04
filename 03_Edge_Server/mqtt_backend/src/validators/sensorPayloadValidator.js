function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateSensorPayload(payload) {
  const errors = [];

  if (!isObject(payload)) {
    return {
      ok: false,
      errors: ['payload must be an object'],
    };
  }

  if (typeof payload.deviceId !== 'string' || payload.deviceId.trim().length === 0) {
    errors.push('deviceId must be a non-empty string');
  }

  if (!isNumber(payload.tdsRaw)) {
    errors.push('tdsRaw must be a number');
  }

  if (!isNumber(payload.tdsVoltage)) {
    errors.push('tdsVoltage must be a number');
  }

  if (!isNumber(payload.tdsMin)) {
    errors.push('tdsMin must be a number');
  }

  if (!isNumber(payload.tdsMax)) {
    errors.push('tdsMax must be a number');
  }

  if (!(isNumber(payload.waterTemp) || payload.waterTemp === null)) {
    errors.push('waterTemp must be a number or null');
  }

  if (typeof payload.waterTempValid !== 'boolean') {
    errors.push('waterTempValid must be boolean');
  }

  if (!['normal', 'low', 'error'].includes(payload.waterLevel)) {
    errors.push('waterLevel must be one of: normal, low, error');
  }

  if (typeof payload.pumpMain !== 'boolean') {
    errors.push('pumpMain must be boolean');
  }

  if (typeof payload.pumpA !== 'boolean') {
    errors.push('pumpA must be boolean');
  }

  if (typeof payload.pumpB !== 'boolean') {
    errors.push('pumpB must be boolean');
  }

  if (typeof payload.pumpSpare !== 'boolean') {
    errors.push('pumpSpare must be boolean');
  }

  if (!(isNumber(payload.ph) || payload.ph === null)) {
    errors.push('ph must be a number or null');
  }

  if (!isNumber(payload.uptimeMs)) {
    errors.push('uptimeMs must be a number');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateSensorPayload,
};
