const PUMP_LIMITS_MS = {
  main: 10000,
  A: 5000,
  B: 5000,
};

function normalizePump(value) {
  if (value === 'main') {
    return 'main';
  }

  if (typeof value === 'string' && value.toUpperCase() === 'A') {
    return 'A';
  }

  if (typeof value === 'string' && value.toUpperCase() === 'B') {
    return 'B';
  }

  return value;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validatePumpCommand(deviceId, body) {
  const errors = [];
  const pump = normalizePump(body && body.pump);
  const action = body && body.action;
  const durationMs = body && body.durationMs;
  const reason = body && body.reason;

  if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    errors.push('deviceId route parameter is required');
  }

  if (!Object.prototype.hasOwnProperty.call(PUMP_LIMITS_MS, pump)) {
    errors.push('pump must be one of: main, A, B');
  }

  if (action !== 'pulse') {
    errors.push('action must be pulse');
  }

  if (!isPositiveInteger(durationMs)) {
    errors.push('durationMs must be a positive integer');
  } else if (Object.prototype.hasOwnProperty.call(PUMP_LIMITS_MS, pump) && durationMs > PUMP_LIMITS_MS[pump]) {
    errors.push(`durationMs exceeds max for pump ${pump}: ${PUMP_LIMITS_MS[pump]} ms`);
  }

  if (reason !== undefined && typeof reason !== 'string') {
    errors.push('reason must be a string when provided');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      deviceId,
      pump,
      action: 'pulse',
      durationMs,
      reason: typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'manual_dashboard',
    },
  };
}

module.exports = {
  PUMP_LIMITS_MS,
  validatePumpCommand,
};
