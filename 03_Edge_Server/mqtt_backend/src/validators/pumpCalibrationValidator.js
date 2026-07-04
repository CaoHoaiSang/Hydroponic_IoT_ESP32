const MAX_DURATION_MS = 30000;
const MAX_MEASURED_ML = 1000;
const DEFAULT_METHOD = 'manual_graduated_cup';

function normalizePump(value) {
  if (typeof value === 'string' && value.toUpperCase() === 'A') {
    return 'A';
  }

  if (typeof value === 'string' && value.toUpperCase() === 'B') {
    return 'B';
  }

  return value;
}

function parsePositiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function validatePumpCalibration(deviceId, body) {
  const errors = [];
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const pump = normalizePump(payload.pump);
  const durationMs = parsePositiveNumber(payload.durationMs);
  const measuredMl = parsePositiveNumber(payload.measuredMl);
  let method = DEFAULT_METHOD;
  let note = '';

  if (normalizedDeviceId.length === 0) {
    errors.push('deviceId route parameter is required');
  }

  if (!['A', 'B'].includes(pump)) {
    errors.push('pump must be one of: A, B');
  }

  if (durationMs === null) {
    errors.push('durationMs must be a positive number');
  } else if (durationMs > MAX_DURATION_MS) {
    errors.push(`durationMs must be less than or equal to ${MAX_DURATION_MS}`);
  }

  if (measuredMl === null) {
    errors.push('measuredMl must be a positive number');
  } else if (measuredMl > MAX_MEASURED_ML) {
    errors.push(`measuredMl must be less than or equal to ${MAX_MEASURED_ML}`);
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
      pump,
      durationMs,
      measuredMl,
      method,
      note,
    },
    errors,
  };
}

module.exports = {
  validatePumpCalibration,
};
