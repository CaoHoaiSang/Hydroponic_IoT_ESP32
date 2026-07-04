const DEFAULT_METHOD = 'one_point_voltage_factor';
const MAX_TDS_VOLTAGE = 3.3;
const MAX_REFERENCE_TDS_PPM = 5000;

function parsePositiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function validateTdsCalibration(deviceId, body) {
  const errors = [];
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const measuredRaw = parsePositiveNumber(payload.measuredRaw);
  const measuredVoltage = parsePositiveNumber(payload.measuredVoltage);
  const referenceTdsPpm = parsePositiveNumber(payload.referenceTdsPpm);
  const waterTemp = parseNullableNumber(payload.waterTemp);
  let method = DEFAULT_METHOD;
  let note = '';

  if (normalizedDeviceId.length === 0) {
    errors.push('deviceId route parameter is required');
  }

  if (measuredRaw === null) {
    errors.push('measuredRaw must be a positive number');
  }

  if (measuredVoltage === null) {
    errors.push('measuredVoltage must be a positive number');
  } else if (measuredVoltage > MAX_TDS_VOLTAGE) {
    errors.push(`measuredVoltage must be less than or equal to ${MAX_TDS_VOLTAGE}`);
  }

  if (referenceTdsPpm === null) {
    errors.push('referenceTdsPpm must be a positive number');
  } else if (referenceTdsPpm > MAX_REFERENCE_TDS_PPM) {
    errors.push(`referenceTdsPpm must be less than or equal to ${MAX_REFERENCE_TDS_PPM}`);
  }

  if (waterTemp === undefined) {
    errors.push('waterTemp must be a number or null');
  }

  if (payload.method !== undefined) {
    if (typeof payload.method !== 'string') {
      errors.push('method must be a string when provided');
    } else if (payload.method.trim().length > 0) {
      method = payload.method.trim();
    }
  }

  if (payload.note !== undefined) {
    if (typeof payload.note !== 'string') {
      errors.push('note must be a string when provided');
    } else {
      note = payload.note.trim();
    }
  }

  return {
    ok: errors.length === 0,
    value: {
      deviceId: normalizedDeviceId,
      measuredRaw,
      measuredVoltage,
      referenceTdsPpm,
      waterTemp: waterTemp === undefined ? null : waterTemp,
      method,
      note,
    },
    errors,
  };
}

module.exports = {
  validateTdsCalibration,
};
