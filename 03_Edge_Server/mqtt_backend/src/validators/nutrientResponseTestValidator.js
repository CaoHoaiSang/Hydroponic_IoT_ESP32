function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumber(value) {
  const parsed = parseNumber(value);

  return parsed !== null && parsed > 0 ? parsed : null;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseNumber(value);
}

function parseBoolean(value, defaultValue) {
  if (typeof value === 'boolean') {
    return value;
  }

  return defaultValue;
}

function parseNumericArray(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(parseNumber);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => parseNumber(item.trim()))
      .filter((item) => item !== null);
  }

  return null;
}

function validateNumericArray(errors, fieldName, value) {
  const parsed = parseNumericArray(value);

  if (!Array.isArray(parsed) || parsed.some((item) => item === null)) {
    errors.push(`${fieldName} must be a numeric array`);
    return [];
  }

  return parsed;
}

function buildBeforeStage(errors, stage) {
  const payload = isPlainObject(stage) ? stage : {};

  return {
    dashboardValues: validateNumericArray(errors, 'before.dashboardValues', payload.dashboardValues),
    dashboardAverage: null,
    penMainPpm: parseOptionalNumber(payload.penMainPpm),
    penSecondaryPpm: parseOptionalNumber(payload.penSecondaryPpm),
    waterTempMainPen: parseOptionalNumber(payload.waterTempMainPen),
    waterTempSecondaryPen: parseOptionalNumber(payload.waterTempSecondaryPen),
    waterTempSensor: parseOptionalNumber(payload.waterTempSensor),
    waterLevel: typeof payload.waterLevel === 'string' && payload.waterLevel.length > 0
      ? payload.waterLevel
      : 'normal',
  };
}

function buildAfterStage(stage, allowDashboardValues) {
  const payload = isPlainObject(stage) ? stage : {};
  const value = {
    dashboardTdsPpm: parseOptionalNumber(payload.dashboardTdsPpm),
    penMainPpm: parseOptionalNumber(payload.penMainPpm),
    penSecondaryPpm: parseOptionalNumber(payload.penSecondaryPpm),
    waterTempMainPen: parseOptionalNumber(payload.waterTempMainPen),
    waterTempSecondaryPen: parseOptionalNumber(payload.waterTempSecondaryPen),
    waterTempSensor: parseOptionalNumber(payload.waterTempSensor),
  };

  if (allowDashboardValues) {
    value.dashboardValues = parseNumericArray(payload.dashboardValues) || [];
    value.dashboardAverage = null;
  }

  return value;
}

function validateNutrientResponseTest(deviceId, body) {
  const errors = [];
  const payload = isPlainObject(body) ? body : {};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const workingLevelLiters = parsePositiveNumber(payload.workingLevelLiters);
  const dosePayload = isPlainObject(payload.dose) ? payload.dose : {};
  const pumpAMl = parsePositiveNumber(dosePayload.pumpAMl);
  const pumpBml = parsePositiveNumber(dosePayload.pumpBml);
  const pumpADurationMs = parsePositiveNumber(dosePayload.pumpADurationMs);
  const pumpBDurationMs = parsePositiveNumber(dosePayload.pumpBDurationMs);

  if (normalizedDeviceId.length === 0) {
    errors.push('deviceId route parameter is required');
  }

  if (workingLevelLiters === null) {
    errors.push('workingLevelLiters must be a positive number');
  }

  if (pumpAMl === null) {
    errors.push('dose.pumpAMl must be a positive number');
  }

  if (pumpBml === null) {
    errors.push('dose.pumpBml must be a positive number');
  }

  if (dosePayload.pumpADurationMs !== undefined && pumpADurationMs === null) {
    errors.push('dose.pumpADurationMs must be a positive number when provided');
  }

  if (dosePayload.pumpBDurationMs !== undefined && pumpBDurationMs === null) {
    errors.push('dose.pumpBDurationMs must be a positive number when provided');
  }

  const before = buildBeforeStage(errors, payload.before);
  const after15min = buildAfterStage(payload.after15min, true);

  if (
    !Array.isArray(after15min.dashboardValues)
    || after15min.dashboardValues.some((item) => item === null)
  ) {
    errors.push('after15min.dashboardValues must be a numeric array');
    after15min.dashboardValues = [];
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      deviceId: normalizedDeviceId,
      workingLevelLiters,
      tdsSensorSupply: typeof payload.tdsSensorSupply === 'string' && payload.tdsSensorSupply.trim().length > 0
        ? payload.tdsSensorSupply.trim()
        : '5V',
      mainPumpOn: parseBoolean(payload.mainPumpOn, false),
      autoDosingEnabled: parseBoolean(payload.autoDosingEnabled, false),
      before,
      dose: {
        pumpAMl,
        pumpBml,
        pumpADurationMs,
        pumpBDurationMs,
        pumpACompleted: parseBoolean(dosePayload.pumpACompleted, true),
        pumpBCompleted: parseBoolean(dosePayload.pumpBCompleted, true),
      },
      after5min: buildAfterStage(payload.after5min, false),
      after10min: buildAfterStage(payload.after10min, false),
      after15min,
      result: {
        deltaDashboard: null,
        deltaPenMain: null,
        deltaPenSecondary: null,
        estimatedResponsePpmPerMl: null,
        mixingTimeUsedMin: parsePositiveNumber(payload.result && payload.result.mixingTimeUsedMin) || 15,
      },
      note: typeof payload.note === 'string' ? payload.note.trim() : '',
    },
  };
}

module.exports = {
  validateNutrientResponseTest,
};
