const crypto = require('crypto');

const { getDb } = require('../mongoClient');
const { validateAutoDosingSettings } = require('../validators/autoDosingSettingsValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_SETTINGS = {
  mode: 'closed_loop_step',
  enabled: false,
  targetMinPpm: 800,
  targetMaxPpm: 1200,
  stepDoseMlPerPump: 1.0,
  doseMlPerPump: 1.0,
  mixingDelayMs: 900000,
  cooldownMs: 900000,
  maxDoseMlPerPumpPerRun: 1.0,
  maxDailyDoseMlPerPump: 10.0,
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

function createRunId() {
  return `dose_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function createCommandId() {
  return `cmd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function pickPositive(value, fallback) {
  return isPositiveNumber(value) ? value : fallback;
}

function normalizeSettings(settings, deviceId) {
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

async function getAutoDosingSettings(deviceId) {
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

  return normalizeSettings(result.value || result, deviceId);
}

async function updateAutoDosingSettings(deviceId, body) {
  const validation = validateAutoDosingSettings(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  const database = getDb();
  const now = new Date();
  const value = validation.value;
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

  return {
    ok: true,
    data: normalizeSettings(result.value || result, value.deviceId),
  };
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

async function getDailyDoseUsedMlPerPump(deviceId, now) {
  const database = getDb();
  const runs = await database.collection('dosing_runs')
    .find({
      deviceId,
      createdAt: { $gte: getStartOfLocalDay(now) },
      status: { $in: ['in_progress', 'mixing_wait', 'completed'] },
    })
    .toArray();

  return runs.reduce((total, run) => {
    const dose = pickPositive(run.stepDoseMlPerPump, pickPositive(run.doseMlPerPump, 0));
    return total + dose;
  }, 0);
}

async function finalizeMixingRun(run, latest, tdsPpm) {
  const database = getDb();
  const now = new Date();
  const deltaTdsPpm = isFiniteNumber(run.tdsPpmAtStart)
    ? Number((tdsPpm - run.tdsPpmAtStart).toFixed(2))
    : null;

  await database.collection('dosing_runs').updateOne(
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
    },
  );

  return {
    ok: true,
    action: 'completed',
    reason: 'mixing_completed',
    runId: run.runId,
    tdsPpmAfterMixing: tdsPpm,
    deltaTdsPpm,
  };
}

async function evaluateAutoDosing(sensorPayload, publishPumpCommandFn) {
  const deviceId = sensorPayload && sensorPayload.deviceId;
  const settings = await getAutoDosingSettings(deviceId);
  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId });
  const latest = device && device.latest ? device.latest : {};
  const tdsPpm = latest.tdsPpm;
  const activeRun = await getActiveDosingRun(deviceId);
  const now = new Date();

  if (activeRun && activeRun.status === 'mixing_wait') {
    const mixingUntil = activeRun.mixingUntil ? new Date(activeRun.mixingUntil) : null;

    if (!mixingUntil || now < mixingUntil) {
      await updateLastEvaluation(deviceId, 'mixing_wait_active', tdsPpm);
      return buildSkipResult('mixing_wait_active', tdsPpm, {
        runId: activeRun.runId,
        mixingUntil: activeRun.mixingUntil,
      });
    }

    if (!isFiniteNumber(tdsPpm)) {
      await updateLastEvaluation(deviceId, 'tds_ppm_missing', null);
      return buildSkipResult('tds_ppm_missing');
    }

    const finalizeResult = await finalizeMixingRun(activeRun, latest, tdsPpm);
    await updateLastEvaluation(deviceId, 'mixing_completed', tdsPpm);
    return finalizeResult;
  }

  if (!settings.enabled) {
    await updateLastEvaluation(deviceId, 'disabled', null);
    return buildSkipResult('disabled');
  }

  if (!isFiniteNumber(tdsPpm)) {
    await updateLastEvaluation(deviceId, 'tds_ppm_missing', null);
    return buildSkipResult('tds_ppm_missing');
  }

  if (latest.waterLevel !== 'normal') {
    await updateLastEvaluation(deviceId, 'water_level_low', tdsPpm);
    return buildSkipResult('water_level_low', tdsPpm);
  }

  if (latest.waterTempValid !== true) {
    await updateLastEvaluation(deviceId, 'water_temp_invalid', tdsPpm);
    return buildSkipResult('water_temp_invalid', tdsPpm);
  }

  if (latest.tdsStable === false) {
    await updateLastEvaluation(deviceId, 'tds_unstable', tdsPpm);
    return buildSkipResult('tds_unstable', tdsPpm);
  }

  if (settings.requireMainPumpOn && latest.pumpMain !== true) {
    await updateLastEvaluation(deviceId, 'main_pump_not_running', tdsPpm);
    return buildSkipResult('main_pump_not_running', tdsPpm);
  }

  const { pumpAFlowRateMlPerSec, pumpBFlowRateMlPerSec } = getLatestPumpFlowRates(device);

  if (!isPositiveNumber(pumpAFlowRateMlPerSec) || !isPositiveNumber(pumpBFlowRateMlPerSec)) {
    await updateLastEvaluation(deviceId, 'pump_calibration_missing', tdsPpm);
    return buildSkipResult('pump_calibration_missing', tdsPpm);
  }

  if (activeRun) {
    const reason = activeRun.currentStep === 'mixing_wait' ? 'mixing_wait_active' : 'dosing_run_active';
    await updateLastEvaluation(deviceId, reason, tdsPpm);
    return buildSkipResult(reason, tdsPpm, { runId: activeRun.runId });
  }

  const dailyDoseUsed = await getDailyDoseUsedMlPerPump(deviceId, now);

  if (dailyDoseUsed + settings.stepDoseMlPerPump > settings.maxDailyDoseMlPerPump) {
    await updateLastEvaluation(deviceId, 'daily_dose_limit_reached', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });
    return buildSkipResult('daily_dose_limit_reached', tdsPpm, {
      dailyDoseUsedMlPerPump: dailyDoseUsed,
    });
  }

  if (tdsPpm > settings.targetMaxPpm) {
    await updateLastEvaluation(deviceId, 'above_target_range', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });
    return buildSkipResult('above_target_range', tdsPpm);
  }

  if (tdsPpm >= settings.targetMinPpm) {
    await updateLastEvaluation(deviceId, 'within_target_range', tdsPpm, {
      lastDailyDoseUsedMlPerPump: Number(dailyDoseUsed.toFixed(2)),
    });
    return buildSkipResult('within_target_range', tdsPpm);
  }

  const durationMsA = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpAFlowRateMlPerSec);
  const durationMsB = calculatePumpDurationMs(settings.stepDoseMlPerPump, pumpBFlowRateMlPerSec);

  if (!durationMsA || !durationMsB || durationMsA <= 0 || durationMsB <= 0) {
    await updateLastEvaluation(deviceId, 'duration_invalid', tdsPpm);
    return buildSkipResult('duration_invalid', tdsPpm);
  }

  if (durationMsA > PUMP_AB_MAX_DURATION_MS || durationMsB > PUMP_AB_MAX_DURATION_MS) {
    await updateLastEvaluation(deviceId, 'duration_exceeds_limit', tdsPpm);
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
    tdsPpmAtStart: tdsPpm,
    targetMinPpm: settings.targetMinPpm,
    targetMaxPpm: settings.targetMaxPpm,
    stepDoseMlPerPump: settings.stepDoseMlPerPump,
    doseMlPerPump: settings.stepDoseMlPerPump,
    mixingDelayMs: settings.mixingDelayMs,
    responseEstimatePpmPerMl: settings.responseEstimatePpmPerMl,
    responseEstimateWorkingLevelLiters: settings.responseEstimateWorkingLevelLiters,
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

  await database.collection('dosing_runs').insertOne(dosingRun);

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
      },
    );

    await updateLastEvaluation(deviceId, 'pump_command_publish_failed', tdsPpm);

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

  await publishPumpCommandFn(buildPumpCommand(pumpBCommandId, run.deviceId, 'B', run.pumpB.durationMs));

  await database.collection('dosing_runs').updateOne(
    { runId: run.runId, status: 'in_progress' },
    {
      $set: {
        'pumpA.status': 'completed',
        'pumpB.commandId': pumpBCommandId,
        'pumpB.status': 'published',
        currentStep: 'pumpB',
        updatedAt: new Date(),
      },
    },
  );

  return pumpBCommandId;
}

async function failDosingRun(runId, pumpPath, status, reason) {
  const database = getDb();

  await database.collection('dosing_runs').updateOne(
    { runId },
    {
      $set: {
        status: 'failed',
        currentStep: 'failed',
        [`${pumpPath}.status`]: status,
        failureReason: reason,
        updatedAt: new Date(),
        completedAt: new Date(),
      },
    },
  );
}

async function startMixingWait(run) {
  const database = getDb();
  const mixingStartedAt = new Date();
  const mixingDelayMs = pickPositive(run.mixingDelayMs, DEFAULT_SETTINGS.mixingDelayMs);
  const mixingUntil = new Date(mixingStartedAt.getTime() + mixingDelayMs);

  await database.collection('dosing_runs').updateOne(
    { runId: run.runId, status: 'in_progress' },
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
  );

  return mixingUntil;
}

async function handlePumpStatusForAutoDosing(pumpStatusPayload, publishPumpCommandFn) {
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
    if (isFailurePumpStatus(pumpStatusPayload)) {
      await failDosingRun(run.runId, 'pumpA', status, 'Pump A failed or rejected');
      return {
        ok: true,
        matched: true,
        action: 'failed',
        runId: run.runId,
        pump: 'A',
      };
    }

    if (isCompletedPumpStatus(pumpStatusPayload)) {
      if (run.pumpB.commandId) {
        await database.collection('dosing_runs').updateOne(
          { runId: run.runId },
          {
            $set: {
              'pumpA.status': 'completed',
              updatedAt: new Date(),
            },
          },
        );

        return {
          ok: true,
          matched: true,
          action: 'pumpA_completed_already_published_pumpB',
          runId: run.runId,
          pump: 'A',
        };
      }

      let pumpBCommandId;

      try {
        pumpBCommandId = await publishPumpBForRun(run, publishPumpCommandFn);
      } catch (error) {
        await failDosingRun(run.runId, 'pumpB', 'failed', error.message);
        return {
          ok: false,
          matched: true,
          action: 'failed',
          runId: run.runId,
          pump: 'B',
          message: error.message,
        };
      }

      return {
        ok: true,
        matched: true,
        action: 'pumpB_published',
        runId: run.runId,
        pumpBCommandId,
      };
    }

    await database.collection('dosing_runs').updateOne(
      { runId: run.runId },
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
    if (isFailurePumpStatus(pumpStatusPayload)) {
      await failDosingRun(run.runId, 'pumpB', status, 'Pump B failed or rejected');
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
      { runId: run.runId },
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
  getAutoDosingSettings,
  updateAutoDosingSettings,
  evaluateAutoDosing,
  handlePumpStatusForAutoDosing,
  getDosingRuns,
  getActiveDosingRun,
};
