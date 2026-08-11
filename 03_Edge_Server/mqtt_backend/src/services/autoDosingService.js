const crypto = require('crypto');

const { getDb } = require('../mongoClient');
const { validateAutoDosingSettings } = require('../validators/autoDosingSettingsValidator');
const { logAutoDosingEvent } = require('./autoDosingEventService');
const { assessAutoDosingReadiness } = require('./autoDosingReadinessService');
const { getActiveTdsCalibrationSet } = require('./tdsCalibrationService');
const { normalizeLimit } = require('./deviceQueryService');
const { TDS_CONTROL_MAX_AGE_MS } = require('../config/tdsQualityConfig');
const { PHASE22_AUTO_DOSING_LOCKED_OFF } = require('../config/phase22Config');

const DEFAULT_SETTINGS = {
  mode: 'closed_loop_step',
  enabled: false,
  cropCode: 'cai_ngot',
  targetRangeConfirmed: false,
  targetMinPpm: 800,
  targetMaxPpm: 1200,
  stepDoseMlPerPump: 1.0,
  doseMlPerPump: 1.0,
  mixingDelayMs: 900000,
  cooldownMs: 900000,
  maxDoseMlPerPumpPerRun: 1.0,
  maxDailyDoseMlPerPump: 2.0,
  requireMainPumpOn: true,
  responseEstimatePpmPerMl: 30,
  responseEstimateWorkingLevelLiters: 16,
};

const PUMP_AB_MAX_DURATION_MS = 5000;
const DEFAULT_RUN_LIMIT = 20;
const MAX_RUN_LIMIT = 100;

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDuplicateKeyError(error) {
  return Boolean(error) && (error.code === 11000 || error.codeName === 'DuplicateKey');
}

function unwrapFindOneAndUpdateResult(result) {
  return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
}

function createRunId() {
  return `dose_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function createCommandId() {
  return `cmd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function safeLogAutoDosingEvent(fields) {
  try {
    return await logAutoDosingEvent(fields);
  } catch (error) {
    console.warn(`Auto dosing event log failed: ${error.message}`);
    return {
      ok: false,
      logged: false,
      reason: 'event_log_failed',
    };
  }
}

function pickPositive(value, fallback) {
  return isPositiveNumber(value) ? value : fallback;
}

function isPhase22LockBypassed(options) {
  return process.env.NODE_ENV === 'test' && options && options.bypassPhase22LockForRegression === true;
}

function normalizeSettings(settings, deviceId, options = {}) {
  const source = settings || {};
  const stepDoseMlPerPump = pickPositive(
    source.stepDoseMlPerPump,
    pickPositive(source.doseMlPerPump, DEFAULT_SETTINGS.stepDoseMlPerPump),
  );
  const mixingDelayMs = pickPositive(
    source.mixingDelayMs,
    pickPositive(source.cooldownMs, DEFAULT_SETTINGS.mixingDelayMs),
  );

  return {
    ...DEFAULT_SETTINGS,
    ...source,
    deviceId,
    mode: 'closed_loop_step',
    stepDoseMlPerPump,
    doseMlPerPump: stepDoseMlPerPump,
    mixingDelayMs,
    cooldownMs: mixingDelayMs,
    maxDoseMlPerPumpPerRun: pickPositive(
      source.maxDoseMlPerPumpPerRun,
      DEFAULT_SETTINGS.maxDoseMlPerPumpPerRun,
    ),
    maxDailyDoseMlPerPump: pickPositive(
      source.maxDailyDoseMlPerPump,
      DEFAULT_SETTINGS.maxDailyDoseMlPerPump,
    ),
    requireMainPumpOn: typeof source.requireMainPumpOn === 'boolean'
      ? source.requireMainPumpOn
      : DEFAULT_SETTINGS.requireMainPumpOn,
    cropCode: 'cai_ngot',
    targetRangeConfirmed: source.targetRangeConfirmed === true,
    enabled: PHASE22_AUTO_DOSING_LOCKED_OFF && !isPhase22LockBypassed(options) ? false : source.enabled === true,
    phase22LockedOff: PHASE22_AUTO_DOSING_LOCKED_OFF,
    responseEstimatePpmPerMl: pickPositive(
      source.responseEstimatePpmPerMl,
      DEFAULT_SETTINGS.responseEstimatePpmPerMl,
    ),
    responseEstimateWorkingLevelLiters: pickPositive(
      source.responseEstimateWorkingLevelLiters,
      DEFAULT_SETTINGS.responseEstimateWorkingLevelLiters,
    ),
  };
}

function buildDefaultSettings(deviceId, now) {
  return {
    deviceId,
    ...DEFAULT_SETTINGS,
    lastEvaluationAt: null,
    lastEvaluationReason: null,
    lastEvaluationTdsPpm: null,
    lastDailyDoseUsedMlPerPump: 0,
    updatedAt: now,
    createdAt: now,
  };
}

async function getAutoDosingSettings(deviceId, options = {}) {
  const database = getDb();
  const now = new Date();
  const result = await database.collection('auto_dosing_settings').findOneAndUpdate(
    { deviceId },
    {
      $setOnInsert: buildDefaultSettings(deviceId, now),
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  );

  return normalizeSettings(result.value || result, deviceId, options);
}

async function updateAutoDosingSettings(deviceId, body, options = {}) {
  const validation = validateAutoDosingSettings(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  if (PHASE22_AUTO_DOSING_LOCKED_OFF && !isPhase22LockBypassed(options) && validation.value.enabled === true) {
    return {
      ok: false,
      error: 'phase22a_auto_dosing_locked_off',
      errors: ['Auto Dosing is locked OFF during Phase 22A'],
    };
  }

  const database = getDb();
  const now = new Date();
  const value = validation.value;

  if (value.enabled) {
    const device = await database.collection('devices').findOne({ deviceId: value.deviceId });
    const activeSet = await getActiveTdsCalibrationSet(value.deviceId);
    const activeRun = await getActiveDosingRun(value.deviceId);
    const dailyUsage = await getDailyDoseUsage(value.deviceId, now, value);
    const readiness = assessAutoDosingReadiness({
      settings: value,
      device,
      activeSet,
      activeRun,
      dailyUsage,
      now,
    });
    if (!readiness.ready) {
      return { ok: false, error: 'auto_dosing_not_ready', errors: readiness.reasons, readiness };
    }
  }
  const result = await database.collection('auto_dosing_settings').findOneAndUpdate(
    { deviceId: value.deviceId },
    {
      $set: {
        mode: value.mode,
        enabled: value.enabled,
        targetMinPpm: value.targetMinPpm,
        targetMaxPpm: value.targetMaxPpm,
        stepDoseMlPerPump: value.stepDoseMlPerPump,
        doseMlPerPump: value.doseMlPerPump,
        mixingDelayMs: value.mixingDelayMs,
        cooldownMs: value.cooldownMs,
        maxDoseMlPerPumpPerRun: value.maxDoseMlPerPumpPerRun,
        maxDailyDoseMlPerPump: value.maxDailyDoseMlPerPump,
        requireMainPumpOn: value.requireMainPumpOn,
        responseEstimatePpmPerMl: value.responseEstimatePpmPerMl,
        responseEstimateWorkingLevelLiters: value.responseEstimateWorkingLevelLiters,
        cropCode: 'cai_ngot',
        targetRangeConfirmed: value.targetRangeConfirmed,
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId: value.deviceId,
        lastEvaluationAt: null,
        lastEvaluationReason: null,
        lastEvaluationTdsPpm: null,
        lastDailyDoseUsedMlPerPump: 0,
        createdAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  );

  const updatedSettings = normalizeSettings(result.value || result, value.deviceId, options);

  await safeLogAutoDosingEvent({
    deviceId: value.deviceId,
    eventType: 'settings_updated',
    mode: updatedSettings.mode,
    reason: updatedSettings.enabled ? 'enabled' : 'disabled',
    targetMinPpm: updatedSettings.targetMinPpm,
    targetMaxPpm: updatedSettings.targetMaxPpm,
    maxDailyDoseMlPerPump: updatedSettings.maxDailyDoseMlPerPump,
    message: 'Auto Dosing settings updated',
  });

  return {
    ok: true,
    data: updatedSettings,
  };
}

async function getAutoDosingReadiness(deviceId) {
  const settings = await getAutoDosingSettings(deviceId);
  const database = getDb();
  const now = new Date();
  const device = await database.collection('devices').findOne({ deviceId });
  const activeSet = await getActiveTdsCalibrationSet(deviceId);
  const activeRun = await getActiveDosingRun(deviceId);
  const dailyUsage = await getDailyDoseUsage(deviceId, now, settings);
  return assessAutoDosingReadiness({ settings, device, activeSet, activeRun, dailyUsage, now });
}

async function updateLastEvaluation(deviceId, reason, tdsPpm, extraFields = {}) {
  const database = getDb();
  const now = new Date();

  await database.collection('auto_dosing_settings').updateOne(
    { deviceId },
    {
      $set: {
        lastEvaluationAt: now,
        lastEvaluationReason: reason,
        lastEvaluationTdsPpm: isFiniteNumber(tdsPpm) ? tdsPpm : null,
        ...extraFields,
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId,
        ...DEFAULT_SETTINGS,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

async function getActiveDosingRun(deviceId) {
  const database = getDb();

  return database
    .collection('dosing_runs')
    .findOne(
      { deviceId, status: { $in: ['in_progress', 'mixing_wait'] } },
      { sort: { createdAt: -1 } },
    );
}

async function getDosingRuns(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT);

  return database
    .collection('dosing_runs')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

function getLatestPumpFlowRates(device) {
  const latestCalibration = device && device.latestCalibration ? device.latestCalibration : {};

  return {
    pumpAFlowRateMlPerSec: latestCalibration.pumpAFlowRateMlPerSec,
    pumpBFlowRateMlPerSec: latestCalibration.pumpBFlowRateMlPerSec,
  };
}

function calculatePumpDurationMs(doseMlPerPump, flowRateMlPerSec) {
  if (!isPositiveNumber(doseMlPerPump) || !isPositiveNumber(flowRateMlPerSec)) {
    return null;
  }

  return Math.round((doseMlPerPump / flowRateMlPerSec) * 1000);
}

function buildPumpCommand(commandId, deviceId, pump, durationMs) {
  return {
    commandId,
    deviceId,
    pump,
    action: 'pulse',
    durationMs,
    reason: 'auto_tds_low',
    source: 'auto_dosing',
    createdAt: new Date().toISOString(),
  };
}

function isFailurePumpStatus(payload) {
  if (payload.accepted === false) {
    return true;
  }

  if (payload.success === false && ['completed', 'rejected', 'failed', 'cancelled'].includes(payload.status)) {
    return true;
  }

  return ['rejected', 'failed', 'cancelled'].includes(payload.status);
}

function isCompletedPumpStatus(payload) {
  return payload.status === 'completed' && payload.success === true;
}

function getMixingMeasurementInvalidReasons(latest, run, device, activeSet, now = new Date()) {
  const reasons = [];
  if (!isFiniteNumber(latest.tdsPpm)) reasons.push('tds_ppm_missing');
  if (latest.tdsControlValid !== true) reasons.push('tds_control_invalid');
  if (latest.tdsStable !== true) reasons.push('tds_unstable');
  if (latest.tdsCalibrationInRange !== true) reasons.push('tds_outside_calibration_range');
  if (latest.tdsCalibrationWarning !== null) reasons.push('tds_calibration_warning');
  if (latest.tdsTemperatureCompensated !== true) reasons.push('tds_temperature_not_compensated');
  const measurementMs = latest.measurementAt ? new Date(latest.measurementAt).getTime() : Number.NaN;
  const mixingUntilMs = run && run.mixingUntil ? new Date(run.mixingUntil).getTime() : Number.NaN;
  const mixingStartedMs = run && run.mixingStartedAt ? new Date(run.mixingStartedAt).getTime() : Number.NaN;
  if (!Number.isFinite(measurementMs)) {
    reasons.push('tds_measurement_time_missing');
  } else {
    if (Number.isFinite(mixingUntilMs) && measurementMs <= mixingUntilMs) {
      reasons.push('tds_measurement_not_after_mixing');
    }
    if (Number.isFinite(mixingStartedMs) && measurementMs <= mixingStartedMs) {
      reasons.push('tds_measurement_not_after_mixing_start');
    }
  }
  if (!Number.isFinite(measurementMs) || now.getTime() - measurementMs > TDS_CONTROL_MAX_AGE_MS) {
    reasons.push('tds_measurement_stale');
  }
  const setIdAtStart = run && run.tdsCalibrationSetIdAtStart;
  if (!setIdAtStart) reasons.push('run_calibration_set_missing');
  if (setIdAtStart && latest.tdsCalibrationSetId !== setIdAtStart) {
    reasons.push('tds_calibration_set_mismatch_after_mixing');
  }
  if (setIdAtStart && (!device || device.activeTdsCalibrationSetId !== setIdAtStart)) {
    reasons.push('tds_calibration_set_changed_during_run');
  }
  if (!activeSet
    || activeSet.setId !== setIdAtStart
    || activeSet.status !== 'active'
    || activeSet.validationStatus !== 'valid'
    || activeSet.pointCount < 3) {
    reasons.push('tds_calibration_set_not_ready_after_mixing');
  }
  return [...new Set(reasons)];
}

function buildSkipResult(reason, tdsPpm, extraFields = {}) {
  return {
    ok: true,
    action: 'skipped',
    reason,
    tdsPpm: isFiniteNumber(tdsPpm) ? tdsPpm : null,
    ...extraFields,
  };
}

function getStartOfLocalDay(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function getLatestDailyReset(deviceId, startOfDay) {
  const database = getDb();

  return database.collection('auto_dosing_events').findOne(
    {
      deviceId,
      eventType: 'manual_daily_reset',
      createdAt: { $gte: startOfDay },
    },
    { sort: { createdAt: -1 } },
  );
}

async function getDailyDoseUsage(deviceId, now = new Date(), settingsOverride = null) {
  const database = getDb();
  const startOfDay = getStartOfLocalDay(now);
  const [latestReset, settings] = await Promise.all([
    getLatestDailyReset(deviceId, startOfDay),
    settingsOverride ? Promise.resolve(settingsOverride) : getAutoDosingSettings(deviceId),
  ]);
  const calculationWindowStartedAt = latestReset ? latestReset.createdAt : startOfDay;
  const createdAtFilter = latestReset
    ? { $gt: calculationWindowStartedAt }
    : { $gte: calculationWindowStartedAt };
  const runs = await database.collection('dosing_runs')
    .find({
      deviceId,
      createdAt: createdAtFilter,
      status: { $in: ['in_progress', 'mixing_wait', 'completed'] },
    })
    .toArray();

  const dailyDoseUsedMlPerPump = runs.reduce((total, run) => {
    const dose = pickPositive(run.stepDoseMlPerPump, pickPositive(run.doseMlPerPump, 0));
    return total + dose;
  }, 0);
  const used = Number(dailyDoseUsedMlPerPump.toFixed(2));
  const max = settings.maxDailyDoseMlPerPump;
  const remaining = Number(Math.max(0, max - used).toFixed(2));

  return {
    deviceId,
    localDate: formatLocalDate(now),
    dailyDoseUsedMlPerPump: used,
    maxDailyDoseMlPerPump: max,
    remainingDailyDoseMlPerPump: remaining,
    progressPercentage: max > 0 ? Number(Math.min(100, (used / max) * 100).toFixed(1)) : 0,
    isLimitReached: used >= max,
    calculationWindowStartedAt,
    lastDailyResetAt: latestReset ? latestReset.createdAt : null,
    runsCounted: runs.length,
  };
}

async function resetDailyDoseUsage(deviceId, body) {
  const confirmText = body && body.confirmText;
  const reason = body && typeof body.reason === 'string' ? body.reason.trim() : '';

  if (confirmText !== 'RESET DAILY DOSE') {
    return {
      ok: false,
      error: 'confirmation_failed',
      errors: ['confirmText must exactly match RESET DAILY DOSE'],
    };
  }

  if (reason.length === 0) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: ['reason is required'],
    };
  }

  const settings = await getAutoDosingSettings(deviceId);
  const beforeReset = await getDailyDoseUsage(deviceId, new Date(), settings);
  const now = new Date();

  await logAutoDosingEvent({
    deviceId,
    eventType: 'manual_daily_reset',
    mode: settings.mode,
    reason,
    dailyDoseUsedMlPerPump: beforeReset.dailyDoseUsedMlPerPump,
    maxDailyDoseMlPerPump: settings.maxDailyDoseMlPerPump,
    message: 'Prototype-only daily dose counter reset; physical nutrient is not removed',
    createdAt: now,
  });

  const usage = await getDailyDoseUsage(deviceId, new Date(now.getTime() + 1), settings);

  return {
    ok: true,
    data: usage,
  };
}

async function recordAutoDosingEvaluation({
  deviceId,
  reason,
  tdsPpm,
  settings,
  latest,
  activeRun,
  dailyDoseUsedMlPerPump,
  extraSettingsFields = {},
  message = '',
}) {
  await updateLastEvaluation(deviceId, reason, tdsPpm, extraSettingsFields);
  await safeLogAutoDosingEvent({
    deviceId,
    eventType: reason === 'daily_dose_limit_reached' ? 'daily_limit_reached' : 'skip',
    mode: settings.mode,
    reason,
    tdsPpm,
    targetMinPpm: settings.targetMinPpm,
    targetMaxPpm: settings.targetMaxPpm,
    mainPumpOn: latest.pumpMain,
    waterLevel: latest.waterLevel,
    waterTempValid: latest.waterTempValid,
    activeRunId: activeRun ? activeRun.runId : null,
    dailyDoseUsedMlPerPump,
    maxDailyDoseMlPerPump: settings.maxDailyDoseMlPerPump,
    message: message || reason.replace(/_/g, ' '),
  });
}

async function finalizeMixingRun(run, latest, tdsPpm) {
  const database = getDb();
  const now = new Date();
  const deltaTdsPpm = isFiniteNumber(run.tdsPpmAtStart)
    ? Number((tdsPpm - run.tdsPpmAtStart).toFixed(2))
    : null;

  const transition = await database.collection('dosing_runs').findOneAndUpdate(
    { runId: run.runId, status: 'mixing_wait' },
    {
      $set: {
        status: 'completed',
        currentStep: 'completed',
        tdsPpmAfterMixing: tdsPpm,
        deltaTdsPpm,
        waterLevelAfterMixing: latest.waterLevel,
        updatedAt: now,
        completedAt: now,
      },
      $unset: { activeLock: '' },
    },
    { returnDocument: 'after' },
  );
  if (!unwrapFindOneAndUpdateResult(transition)) {
    return buildSkipResult('mixing_already_finalized', tdsPpm, { runId: run.runId });
  }

  await safeLogAutoDosingEvent({
    deviceId: run.deviceId,
    eventType: 'run_completed',
    mode: run.mode || 'closed_loop_step',
    reason: 'mixing_completed',
    tdsPpm,
    targetMinPpm: run.targetMinPpm,
    targetMaxPpm: run.targetMaxPpm,
    mainPumpOn: latest.pumpMain,
    waterLevel: latest.waterLevel,
    waterTempValid: latest.waterTempValid,
    activeRunId: run.runId,
    dailyDoseUsedMlPerPump: Number(
      (pickPositive(run.dailyDoseUsedBefore, 0)
        + pickPositive(run.stepDoseMlPerPump, pickPositive(run.doseMlPerPump, 0))).toFixed(2),
    ),
    message: `Run completed after mixing; delta TDS ${deltaTdsPpm} ppm`,
  });

  return {
    ok: true,
    action: 'completed',
    reason: 'mixing_completed',
    runId: run.runId,
    tdsPpmAfterMixing: tdsPpm,
    deltaTdsPpm,
  };
}

async function evaluateAutoDosing(sensorPayload, publishPumpCommandFn, options = {}) {
  if (PHASE22_AUTO_DOSING_LOCKED_OFF && !isPhase22LockBypassed(options)) {
    return { ok: true, action: 'skipped', reason: 'phase22a_auto_dosing_locked_off' };
  }
  const deviceId = sensorPayload && sensorPayload.deviceId;
  const settings = await getAutoDosingSettings(deviceId, options);
  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId });
  const latest = device && device.latest ? device.latest : {};
  const tdsPpm = latest.tdsPpm;
  const activeRun = await getActiveDosingRun(deviceId);
  const now = new Date();
  let dailyDoseUsedForEvent = null;
  const recordEvaluation = (
    reason,
    evaluationTdsPpm = tdsPpm,
    extraSettingsFields = {},
    message = '',
  ) => recordAutoDosingEvaluation({
    deviceId,
    reason,
    tdsPpm: evaluationTdsPpm,
    settings,
    latest,
    activeRun,
    dailyDoseUsedMlPerPump: dailyDoseUsedForEvent,
    extraSettingsFields,
    message,
  });

  if (activeRun && activeRun.status === 'mixing_wait') {
    const mixingUntil = activeRun.mixingUntil ? new Date(activeRun.mixingUntil) : null;

    if (!mixingUntil || now < mixingUntil) {
      await recordEvaluation('mixing_wait_active');
      return buildSkipResult('mixing_wait_active', tdsPpm, {
        runId: activeRun.runId,
        mixingUntil: activeRun.mixingUntil,
      });
    }

    const activeCalibrationSetAfterMixing = await getActiveTdsCalibrationSet(deviceId);
    const mixingInvalidReasons = getMixingMeasurementInvalidReasons(
      latest,
      activeRun,
      device,
      activeCalibrationSetAfterMixing,
      now,
    );
    if (mixingInvalidReasons.length > 0) {
      await database.collection('dosing_runs').updateOne(
        { runId: activeRun.runId, status: 'mixing_wait' },
        {
          $set: {
            postMixingValidationStatus: 'waiting_for_valid_measurement',
            postMixingInvalidReasons: [...new Set(mixingInvalidReasons)],
            updatedAt: now,
          },
        },
      );
      await recordEvaluation('mixing_measurement_invalid', tdsPpm);
      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'skip',
        mode: settings.mode,
        reason: 'mixing_measurement_invalid',
        tdsPpm,
        activeRunId: activeRun.runId,
        message: `Mixing completion waits for valid control data: ${mixingInvalidReasons.join(', ')}`,
      });
      return buildSkipResult('mixing_measurement_invalid', tdsPpm, {
        runId: activeRun.runId,
        invalidReasons: [...new Set(mixingInvalidReasons)],
      });
    }

    const finalizeResult = await finalizeMixingRun(activeRun, latest, tdsPpm);
    await updateLastEvaluation(deviceId, 'mixing_completed', tdsPpm);
    return finalizeResult;
  }

  if (!settings.enabled) {
    await recordEvaluation('disabled', null);
    return buildSkipResult('disabled');
  }

  if (settings.cropCode !== 'cai_ngot' || settings.targetRangeConfirmed !== true) {
    await recordEvaluation('tds_target_range_unconfirmed');
    return buildSkipResult('tds_target_range_unconfirmed', tdsPpm);
  }

  const activeCalibrationSet = await getActiveTdsCalibrationSet(deviceId);
  if (!device || !device.activeTdsCalibrationSetId) {
    await recordEvaluation('tds_calibration_set_missing');
    return buildSkipResult('tds_calibration_set_missing', tdsPpm);
  }
  if (!activeCalibrationSet || activeCalibrationSet.status !== 'active') {
    await recordEvaluation('tds_calibration_set_inactive');
    return buildSkipResult('tds_calibration_set_inactive', tdsPpm);
  }
  if (activeCalibrationSet.validationStatus !== 'valid' || activeCalibrationSet.pointCount < 3) {
    await recordEvaluation('tds_calibration_insufficient_points');
    return buildSkipResult('tds_calibration_insufficient_points', tdsPpm);
  }
  if (latest.tdsCalibrationSetId !== device.activeTdsCalibrationSetId) {
    await recordEvaluation('tds_calibration_set_mismatch');
    return buildSkipResult('tds_calibration_set_mismatch', tdsPpm);
  }
  if (latest.tdsControlValid !== true) {
    await recordEvaluation('tds_control_invalid');
    return buildSkipResult('tds_control_invalid', tdsPpm, {
      invalidReasons: Array.isArray(latest.tdsControlInvalidReasons)
        ? latest.tdsControlInvalidReasons
        : [],
    });
  }
  if (latest.tdsCalibrationInRange !== true) {
    await recordEvaluation('tds_outside_calibration_range');
    return buildSkipResult('tds_outside_calibration_range', tdsPpm);
  }
  if (latest.tdsCalibrationWarning !== null) {
    await recordEvaluation('tds_calibration_warning');
    return buildSkipResult('tds_calibration_warning', tdsPpm);
  }
  if (latest.tdsTemperatureCompensated !== true) {
    await recordEvaluation('tds_temperature_not_compensated');
    return buildSkipResult('tds_temperature_not_compensated', tdsPpm);
  }
  if (settings.targetMinPpm < activeCalibrationSet.minReferenceTdsPpm
    || settings.targetMaxPpm > activeCalibrationSet.maxReferenceTdsPpm) {
    await recordEvaluation('tds_target_outside_calibrated_range');
    return buildSkipResult('tds_target_outside_calibrated_range', tdsPpm);
  }

  if (!isFiniteNumber(tdsPpm)) {
    await recordEvaluation('tds_ppm_missing', null);
    return buildSkipResult('tds_ppm_missing');
  }

  if (latest.waterLevel !== 'normal') {
    await recordEvaluation('water_level_low');
    return buildSkipResult('water_level_low', tdsPpm);
  }

  if (latest.waterTempValid !== true) {
    await recordEvaluation('water_temp_invalid');
    return buildSkipResult('water_temp_invalid', tdsPpm);
  }

  if (latest.tdsStable !== true) {
    await recordEvaluation('tds_unstable');
    return buildSkipResult('tds_unstable', tdsPpm);
  }

  if (settings.requireMainPumpOn && latest.pumpMain !== true) {
    await recordEvaluation('main_pump_not_running');
    return buildSkipResult('main_pump_not_running', tdsPpm);
  }

  const { pumpAFlowRateMlPerSec, pumpBFlowRateMlPerSec } = getLatestPumpFlowRates(device);

  if (!isPositiveNumber(pumpAFlowRateMlPerSec) || !isPositiveNumber(pumpBFlowRateMlPerSec)) {
    await recordEvaluation('pump_calibration_missing');
    return buildSkipResult('pump_calibration_missing', tdsPpm);
  }

  if (activeRun) {
    const reason = activeRun.currentStep === 'mixing_wait' ? 'mixing_wait_active' : 'dosing_run_active';
    await recordEvaluation(reason);
    return buildSkipResult(reason, tdsPpm, { runId: activeRun.runId });
  }

  const dailyUsage = await getDailyDoseUsage(deviceId, now, settings);
  const dailyDoseUsed = dailyUsage.dailyDoseUsedMlPerPump;
  dailyDoseUsedForEvent = dailyDoseUsed;

  if (dailyDoseUsed + settings.stepDoseMlPerPump > settings.maxDailyDoseMlPerPump) {
    await recordEvaluation('daily_dose_limit_reached', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    }, 'Daily dose limit blocks a new dosing step');
    return buildSkipResult('daily_dose_limit_reached', tdsPpm, {
      dailyDoseUsedMlPerPump: dailyDoseUsed,
    });
  }

  if (tdsPpm > settings.targetMaxPpm) {
    await recordEvaluation('above_target_range', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });
    return buildSkipResult('above_target_range', tdsPpm);
  }

  if (tdsPpm >= settings.targetMinPpm) {
    await recordEvaluation('within_target_range', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });
    return buildSkipResult('within_target_range', tdsPpm);
  }

  const durationMsA = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpAFlowRateMlPerSec);
  const durationMsB = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpBFlowRateMlPerSec);

  if (!durationMsA || !durationMsB || durationMsA <= 0 || durationMsB <= 0) {
    await recordEvaluation('duration_invalid');
    return buildSkipResult('duration_invalid', tdsPpm);
  }

  if (durationMsA > PUMP_AB_MAX_DURATION_MS || durationMsB > PUMP_AB_MAX_DURATION_MS) {
    await recordEvaluation('duration_exceeds_limit');
    return buildSkipResult('duration_exceeds_limit', tdsPpm);
  }

  const runId = createRunId();
  const pumpACommandId = createCommandId();
  const dosingRun = {
    runId,
    deviceId,
    mode: 'closed_loop_step',
    trigger: 'auto_tds_low',
    status: 'in_progress',
    activeLock: true,
    tdsPpmAtStart: tdsPpm,
    targetMinPpm: settings.targetMinPpm,
    targetMaxPpm: settings.targetMaxPpm,
    stepDoseMlPerPump: settings.stepDoseMlPerPump,
    doseMlPerPump: settings.stepDoseMlPerPump,
    mixingDelayMs: settings.mixingDelayMs,
    responseEstimatePpmPerMl: settings.responseEstimatePpmPerMl,
    responseEstimateWorkingLevelLiters: settings.responseEstimateWorkingLevelLiters,
    tdsCalibrationSetIdAtStart: device.activeTdsCalibrationSetId,
    dailyDoseUsedBefore: Number(dailyDoseUsed.toFixed(2)),
    pumpA: {
      commandId: pumpACommandId,
      durationMs: durationMsA,
      status: 'pending',
    },
    pumpB: {
      commandId: null,
      durationMs: durationMsB,
      status: 'pending',
    },
    currentStep: 'pumpA',
    reason: 'TDS below targetMinPpm; starting one closed-loop step',
    mixingStartedAt: null,
    mixingUntil: null,
    tdsPpmAfterMixing: null,
    deltaTdsPpm: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  try {
    await database.collection('dosing_runs').insertOne(dosingRun);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    await recordEvaluation('dosing_run_active', tdsPpm);
    return buildSkipResult('dosing_run_active', tdsPpm);
  }

  try {
    await publishPumpCommandFn(buildPumpCommand(pumpACommandId, deviceId, 'A', durationMsA));

    await database.collection('dosing_runs').updateOne(
      { runId },
      {
        $set: {
          'pumpA.status': 'published',
          updatedAt: new Date(),
        },
      },
    );

    await updateLastEvaluation(deviceId, 'dosing_step_started', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });

    await safeLogAutoDosingEvent({
      deviceId,
      eventType: 'run_started',
      mode: settings.mode,
      reason: 'tds_below_target',
      tdsPpm,
      targetMinPpm: settings.targetMinPpm,
      targetMaxPpm: settings.targetMaxPpm,
      mainPumpOn: latest.pumpMain,
      waterLevel: latest.waterLevel,
      waterTempValid: latest.waterTempValid,
      activeRunId: runId,
      dailyDoseUsedMlPerPump: dailyDoseUsed,
      maxDailyDoseMlPerPump: settings.maxDailyDoseMlPerPump,
      message: 'Closed-loop dosing step started with Pump A',
    });

    return {
      ok: true,
      action: 'started',
      reason: 'tds_below_target',
      runId,
      pumpACommandId,
      durationMsA,
      durationMsB,
    };
  } catch (error) {
    await database.collection('dosing_runs').updateOne(
      { runId },
      {
        $set: {
          status: 'failed',
          currentStep: 'failed',
          'pumpA.status': 'failed',
          failureReason: error.message,
          updatedAt: new Date(),
          completedAt: new Date(),
        },
        $unset: { activeLock: '' },
      },
    );

    await recordEvaluation(
      'pump_command_publish_failed',
      tdsPpm,
      {},
      `Pump command publish failed: ${error.message}`,
    );

    return {
      ok: false,
      action: 'failed',
      reason: 'pump_command_publish_failed',
      message: error.message,
      runId,
    };
  }
}

async function publishPumpBForRun(run, publishPumpCommandFn) {
  const database = getDb();
  const pumpBCommandId = createCommandId();
  const claimResult = await database.collection('dosing_runs').findOneAndUpdate(
    {
      runId: run.runId,
      status: 'in_progress',
      currentStep: 'pumpA',
      'pumpA.commandId': run.pumpA.commandId,
      'pumpA.status': { $in: ['published', 'started', 'completed'] },
      'pumpB.commandId': null,
      'pumpB.status': 'pending',
    },
    {
      $set: {
        'pumpA.status': 'completed',
        'pumpB.commandId': pumpBCommandId,
        'pumpB.status': 'publishing',
        currentStep: 'pumpB',
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  );
  const claimedRun = unwrapFindOneAndUpdateResult(claimResult);
  if (!claimedRun) return null;

  await publishPumpCommandFn(buildPumpCommand(pumpBCommandId, run.deviceId, 'B', run.pumpB.durationMs));

  const publishResult = await database.collection('dosing_runs').updateOne(
    {
      runId: run.runId,
      status: 'in_progress',
      currentStep: 'pumpB',
      'pumpB.commandId': pumpBCommandId,
      'pumpB.status': 'publishing',
    },
    { $set: { 'pumpB.status': 'published', updatedAt: new Date() } },
  );
  if (publishResult.matchedCount !== undefined && publishResult.matchedCount !== 1) {
    throw new Error('Pump B publish state could not be committed');
  }

  return pumpBCommandId;
}

async function failDosingRun(runId, pumpPath, status, reason, expectedStep = null) {
  const database = getDb();
  const filter = { runId, status: 'in_progress' };
  if (expectedStep) filter.currentStep = expectedStep;
  const result = await database.collection('dosing_runs').updateOne(
    filter,
    {
      $set: {
        status: 'failed',
        currentStep: 'failed',
        [`${pumpPath}.status`]: status,
        failureReason: reason,
        updatedAt: new Date(),
        completedAt: new Date(),
      },
      $unset: { activeLock: '' },
    },
  );
  return result.matchedCount === undefined || result.matchedCount === 1;
}

async function startMixingWait(run) {
  const database = getDb();
  const mixingStartedAt = new Date();
  const mixingDelayMs = pickPositive(run.mixingDelayMs, DEFAULT_SETTINGS.mixingDelayMs);
  const mixingUntil = new Date(mixingStartedAt.getTime() + mixingDelayMs);

  const transition = await database.collection('dosing_runs').findOneAndUpdate(
    {
      runId: run.runId,
      status: 'in_progress',
      currentStep: 'pumpB',
      'pumpB.commandId': run.pumpB.commandId,
      'pumpB.status': { $in: ['publishing', 'published', 'started'] },
    },
    {
      $set: {
        status: 'mixing_wait',
        currentStep: 'mixing_wait',
        'pumpB.status': 'completed',
        mixingStartedAt,
        mixingUntil,
        updatedAt: mixingStartedAt,
      },
    },
    { returnDocument: 'after' },
  );
  return unwrapFindOneAndUpdateResult(transition) ? mixingUntil : null;
}

async function handlePumpStatusForAutoDosing(pumpStatusPayload, publishPumpCommandFn, options = {}) {
  if (PHASE22_AUTO_DOSING_LOCKED_OFF && !isPhase22LockBypassed(options)) {
    return { ok: true, matched: false, reason: 'phase22a_auto_dosing_locked_off' };
  }
  const deviceId = pumpStatusPayload && pumpStatusPayload.deviceId;
  const commandId = pumpStatusPayload && pumpStatusPayload.commandId;

  if (typeof deviceId !== 'string' || typeof commandId !== 'string') {
    return {
      ok: true,
      matched: false,
      reason: 'missing_device_or_command_id',
    };
  }

  const run = await getActiveDosingRun(deviceId);

  if (!run || run.status !== 'in_progress') {
    return {
      ok: true,
      matched: false,
      reason: run ? 'run_not_waiting_for_pump_status' : 'no_active_run',
    };
  }

  const database = getDb();
  const status = pumpStatusPayload.status || 'unknown';

  if (commandId === run.pumpA.commandId) {
    if (run.currentStep !== 'pumpA') {
      return { ok: true, matched: true, action: 'duplicate_or_out_of_order_ignored', runId: run.runId, pump: 'A' };
    }
    if (isFailurePumpStatus(pumpStatusPayload)) {
      const failed = await failDosingRun(run.runId, 'pumpA', status, 'Pump A failed or rejected', 'pumpA');
      if (!failed) return { ok: true, matched: true, action: 'duplicate_or_out_of_order_ignored', runId: run.runId, pump: 'A' };
      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'skip',
        mode: run.mode,
        reason: 'pump_a_failed',
        tdsPpm: run.tdsPpmAtStart,
        targetMinPpm: run.targetMinPpm,
        targetMaxPpm: run.targetMaxPpm,
        activeRunId: run.runId,
        message: 'Pump A failed or was rejected; dosing run stopped',
      });
      return {
        ok: true,
        matched: true,
        action: 'failed',
        runId: run.runId,
        pump: 'A',
      };
    }

    if (isCompletedPumpStatus(pumpStatusPayload)) {
      let pumpBCommandId;

      try {
        pumpBCommandId = await publishPumpBForRun(run, publishPumpCommandFn);
      } catch (error) {
        await failDosingRun(run.runId, 'pumpB', 'failed', error.message, 'pumpB');
        await safeLogAutoDosingEvent({
          deviceId,
          eventType: 'skip',
          mode: run.mode,
          reason: 'pump_b_publish_failed',
          tdsPpm: run.tdsPpmAtStart,
          activeRunId: run.runId,
          message: error.message,
        });
        return {
          ok: false,
          matched: true,
          action: 'failed',
          runId: run.runId,
          pump: 'B',
          message: error.message,
        };
      }

      if (!pumpBCommandId) {
        return {
          ok: true,
          matched: true,
          action: 'duplicate_or_out_of_order_ignored',
          runId: run.runId,
          pump: 'A',
        };
      }

      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'pump_a_completed',
        mode: run.mode,
        reason: 'pump_a_completed',
        tdsPpm: run.tdsPpmAtStart,
        targetMinPpm: run.targetMinPpm,
        targetMaxPpm: run.targetMaxPpm,
        activeRunId: run.runId,
        message: 'Pump A completed; Pump B command was atomically claimed and published',
      });

      return {
        ok: true,
        matched: true,
        action: 'pumpB_published',
        runId: run.runId,
        pumpBCommandId,
      };
    }

    await database.collection('dosing_runs').updateOne(
      { runId: run.runId, status: 'in_progress', currentStep: 'pumpA', 'pumpA.commandId': commandId },
      {
        $set: {
          'pumpA.status': status,
          updatedAt: new Date(),
        },
      },
    );

    return {
      ok: true,
      matched: true,
      action: 'pumpA_status_updated',
      runId: run.runId,
      pump: 'A',
      status,
    };
  }

  if (commandId === run.pumpB.commandId) {
    if (run.currentStep !== 'pumpB') {
      return { ok: true, matched: true, action: 'duplicate_or_out_of_order_ignored', runId: run.runId, pump: 'B' };
    }
    if (isFailurePumpStatus(pumpStatusPayload)) {
      const failed = await failDosingRun(run.runId, 'pumpB', status, 'Pump B failed or rejected', 'pumpB');
      if (!failed) return { ok: true, matched: true, action: 'duplicate_or_out_of_order_ignored', runId: run.runId, pump: 'B' };
      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'skip',
        mode: run.mode,
        reason: 'pump_b_failed',
        tdsPpm: run.tdsPpmAtStart,
        targetMinPpm: run.targetMinPpm,
        targetMaxPpm: run.targetMaxPpm,
        activeRunId: run.runId,
        message: 'Pump B failed or was rejected; dosing run stopped',
      });
      return {
        ok: true,
        matched: true,
        action: 'failed',
        runId: run.runId,
        pump: 'B',
      };
    }

    if (isCompletedPumpStatus(pumpStatusPayload)) {
      const mixingUntil = await startMixingWait(run);
      if (!mixingUntil) {
        return { ok: true, matched: true, action: 'duplicate_or_out_of_order_ignored', runId: run.runId, pump: 'B' };
      }

      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'pump_b_completed',
        mode: run.mode,
        reason: 'pump_b_completed',
        tdsPpm: run.tdsPpmAtStart,
        targetMinPpm: run.targetMinPpm,
        targetMaxPpm: run.targetMaxPpm,
        activeRunId: run.runId,
        message: 'Pump B completed',
      });
      await safeLogAutoDosingEvent({
        deviceId,
        eventType: 'mixing_wait_started',
        mode: run.mode,
        reason: 'mixing_wait_active',
        tdsPpm: run.tdsPpmAtStart,
        targetMinPpm: run.targetMinPpm,
        targetMaxPpm: run.targetMaxPpm,
        activeRunId: run.runId,
        message: `Mixing wait started until ${mixingUntil.toISOString()}`,
      });

      return {
        ok: true,
        matched: true,
        action: 'mixing_wait_started',
        runId: run.runId,
        pump: 'B',
        mixingUntil,
      };
    }

    await database.collection('dosing_runs').updateOne(
      { runId: run.runId, status: 'in_progress', currentStep: 'pumpB', 'pumpB.commandId': commandId },
      {
        $set: {
          'pumpB.status': status,
          updatedAt: new Date(),
        },
      },
    );

    return {
      ok: true,
      matched: true,
      action: 'pumpB_status_updated',
      runId: run.runId,
      pump: 'B',
      status,
    };
  }

  return {
    ok: true,
    matched: false,
    reason: 'command_not_related_to_active_run',
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  getMixingMeasurementInvalidReasons,
  getAutoDosingSettings,
  getAutoDosingReadiness,
  updateAutoDosingSettings,
  evaluateAutoDosing,
  handlePumpStatusForAutoDosing,
  getDosingRuns,
  getActiveDosingRun,
  getDailyDoseUsage,
  resetDailyDoseUsage,
};
