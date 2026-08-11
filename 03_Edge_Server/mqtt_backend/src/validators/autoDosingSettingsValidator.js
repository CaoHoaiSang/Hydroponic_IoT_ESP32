const DEFAULT_MODE = 'closed_loop_step';

function parsePositiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function pickPositiveNumber(primary, fallback) {
  const parsedPrimary = parsePositiveNumber(primary);

  if (parsedPrimary !== null) {
    return parsedPrimary;
  }

  return parsePositiveNumber(fallback);
}

function validateAutoDosingSettings(deviceId, body) {
  const errors = [];
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const mode = typeof payload.mode === 'string' && payload.mode.trim().length > 0
    ? payload.mode.trim()
    : DEFAULT_MODE;
  const enabled = payload.enabled;
  const targetMinPpm = parsePositiveNumber(payload.targetMinPpm);
  const targetMaxPpm = parsePositiveNumber(payload.targetMaxPpm);
  const stepDoseMlPerPump = pickPositiveNumber(payload.stepDoseMlPerPump, payload.doseMlPerPump);
  const mixingDelayMs = pickPositiveNumber(payload.mixingDelayMs, payload.cooldownMs);
  const maxDoseMlPerPumpPerRun = parsePositiveNumber(payload.maxDoseMlPerPumpPerRun);
  const maxDailyDoseMlPerPump = parsePositiveNumber(payload.maxDailyDoseMlPerPump);
  const responseEstimatePpmPerMl = parsePositiveNumber(payload.responseEstimatePpmPerMl);
  const responseEstimateWorkingLevelLiters = parsePositiveNumber(payload.responseEstimateWorkingLevelLiters);
  const requireMainPumpOn = payload.requireMainPumpOn;
  const cropCode = payload.cropCode === undefined ? 'cai_ngot' : payload.cropCode;
  const targetRangeConfirmed = payload.targetRangeConfirmed === undefined
    ? false
    : payload.targetRangeConfirmed;

  if (normalizedDeviceId.length === 0) {
    errors.push('deviceId route parameter is required');
  }

  if (mode !== DEFAULT_MODE) {
    errors.push('mode must be closed_loop_step');
  }

  if (typeof enabled !== 'boolean') {
    errors.push('enabled must be boolean');
  }

  if (targetMinPpm === null) {
    errors.push('targetMinPpm must be a positive number');
  }

  if (targetMaxPpm === null) {
    errors.push('targetMaxPpm must be a positive number');
  } else if (targetMinPpm !== null && targetMaxPpm <= targetMinPpm) {
    errors.push('targetMaxPpm must be greater than targetMinPpm');
  }

  if (stepDoseMlPerPump === null) {
    errors.push('stepDoseMlPerPump must be a positive number');
  }

  if (mixingDelayMs === null) {
    errors.push('mixingDelayMs must be a positive number');
  } else if (mixingDelayMs < 60000) {
    errors.push('mixingDelayMs must be at least 60000 ms');
  }

  if (maxDoseMlPerPumpPerRun === null) {
    errors.push('maxDoseMlPerPumpPerRun must be a positive number');
  } else if (maxDoseMlPerPumpPerRun > 10) {
    errors.push('maxDoseMlPerPumpPerRun must be less than or equal to 10');
  }

  if (maxDailyDoseMlPerPump === null) {
    errors.push('maxDailyDoseMlPerPump must be a positive number');
  } else if (maxDailyDoseMlPerPump > 100) {
    errors.push('maxDailyDoseMlPerPump must be less than or equal to 100');
  }

  if (typeof requireMainPumpOn !== 'boolean') {
    errors.push('requireMainPumpOn must be boolean');
  }

  if (cropCode !== 'cai_ngot') {
    errors.push('cropCode must be cai_ngot');
  }

  if (typeof targetRangeConfirmed !== 'boolean') {
    errors.push('targetRangeConfirmed must be boolean');
  }

  if (responseEstimatePpmPerMl === null) {
    errors.push('responseEstimatePpmPerMl must be a positive number');
  }

  if (responseEstimateWorkingLevelLiters === null) {
    errors.push('responseEstimateWorkingLevelLiters must be a positive number');
  }

  if (
    stepDoseMlPerPump !== null
    && maxDoseMlPerPumpPerRun !== null
    && stepDoseMlPerPump > maxDoseMlPerPumpPerRun
  ) {
    errors.push('stepDoseMlPerPump must be less than or equal to maxDoseMlPerPumpPerRun');
  }

  if (
    stepDoseMlPerPump !== null
    && maxDailyDoseMlPerPump !== null
    && stepDoseMlPerPump > maxDailyDoseMlPerPump
  ) {
    errors.push('stepDoseMlPerPump must be less than or equal to maxDailyDoseMlPerPump');
  }

  if (
    maxDoseMlPerPumpPerRun !== null
    && maxDailyDoseMlPerPump !== null
    && maxDoseMlPerPumpPerRun > maxDailyDoseMlPerPump
  ) {
    errors.push('maxDoseMlPerPumpPerRun must be less than or equal to maxDailyDoseMlPerPump');
  }

  return {
    ok: errors.length === 0,
    value: {
      deviceId: normalizedDeviceId,
      mode,
      enabled,
      targetMinPpm,
      targetMaxPpm,
      stepDoseMlPerPump,
      doseMlPerPump: stepDoseMlPerPump,
      mixingDelayMs,
      cooldownMs: mixingDelayMs,
      maxDoseMlPerPumpPerRun,
      maxDailyDoseMlPerPump,
      requireMainPumpOn,
      responseEstimatePpmPerMl,
      responseEstimateWorkingLevelLiters,
      cropCode: 'cai_ngot',
      targetRangeConfirmed,
    },
    errors,
  };
}

module.exports = {
  validateAutoDosingSettings,
};
