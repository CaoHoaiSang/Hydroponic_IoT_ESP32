const { getDb } = require('../mongoClient');
const {
  PHASE22_AUTO_DOSING_LOCKED_OFF,
  SHADOW_DECISION_SCHEMA_VERSION,
  SHADOW_ENGINE_VERSION,
  SHADOW_MODE_ENABLED,
} = require('../config/phase22Config');
const { DEFAULT_SETTINGS, getDailyDoseUsage } = require('./autoDosingService');
const { evaluateShadowDosing } = require('./shadowDosingEngine');

function normalizeLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

async function buildShadowContext(deviceId, telemetryResult, now) {
  const database = getDb();
  const [device, storedSettings, activeRun] = await Promise.all([
    database.collection('devices').findOne({ deviceId }),
    database.collection('auto_dosing_settings').findOne({ deviceId }),
    database.collection('dosing_runs').findOne({ deviceId, status: { $in: ['in_progress', 'mixing_wait'] } }),
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...(storedSettings || {}), deviceId, enabled: false };
  const activeSet = device && device.activeTdsCalibrationSetId
    ? await database.collection('tds_calibration_sets').findOne({
      deviceId,
      setId: device.activeTdsCalibrationSetId,
      status: 'active',
    })
    : null;
  const latest = device && device.latest ? device.latest : {};
  const calibration = device && device.latestCalibration ? device.latestCalibration : {};
  const dailyUsage = await getDailyDoseUsage(deviceId, now, settings);
  return {
    shadowEnabled: SHADOW_MODE_ENABLED,
    autoDosingEnabled: false,
    autoDosingLockedOff: PHASE22_AUTO_DOSING_LOCKED_OFF,
    telemetry: { ...telemetryResult.identity, receivedAt: latest.receivedAt },
    measurement: latest,
    settings,
    activeSet,
    activeRun,
    pumpCalibration: calibration,
    dailyDoseUsedMlPerPump: dailyUsage.dailyDoseUsedMlPerPump,
  };
}

async function evaluateAndSaveShadowDecision(payload, telemetryResult, now = new Date()) {
  if (!telemetryResult || telemetryResult.shadowEligible !== true || !telemetryResult.identity) {
    return { ok: true, saved: false, reason: 'TELEMETRY_NOT_SHADOW_ELIGIBLE' };
  }
  const database = getDb();
  const existing = await database.collection('shadow_dosing_decisions').findOne({
    deviceId: payload.deviceId,
    measurementId: payload.measurementId,
  });
  if (existing) return { ok: true, saved: false, duplicate: true, data: existing };

  const context = await buildShadowContext(payload.deviceId, telemetryResult, now);
  const result = evaluateShadowDosing(context, now);
  const document = {
    shadowDecisionSchemaVersion: SHADOW_DECISION_SCHEMA_VERSION,
    shadowEngineVersion: SHADOW_ENGINE_VERSION,
    deviceId: payload.deviceId,
    measurementId: payload.measurementId,
    bootId: payload.bootId,
    measurementSeq: payload.measurementSeq,
    decision: result.decision,
    primaryReasonCode: result.primaryReasonCode,
    reasonCodes: result.reasonCodes,
    gates: result.gates,
    hypotheticalAction: result.hypotheticalAction,
    hypotheticalDoseMlPerPump: result.hypotheticalDoseMlPerPump,
    hypotheticalPumpADurationMs: result.hypotheticalPumpADurationMs,
    hypotheticalPumpBDurationMs: result.hypotheticalPumpBDurationMs,
    calibrationSetId: context.measurement.tdsCalibrationSetId || null,
    measurement: {
      ecUsCm: context.measurement.ecUsCm ?? null,
      tdsPpm: context.measurement.tdsPpm ?? null,
      tdsRaw: context.measurement.tdsRaw ?? null,
      tdsVoltage: context.measurement.tdsVoltage ?? null,
      measurementAt: context.measurement.measurementAt ?? null,
      receivedAt: context.measurement.receivedAt ?? null,
      measurementFreshnessVerified: context.measurement.measurementFreshnessVerified === true,
      measurementTimeSource: context.measurement.measurementTimeSource ?? null,
      measurementAgeAtReceiptMs: context.measurement.measurementAgeAtReceiptMs ?? null,
    },
    createdAt: now,
  };
  try {
    const insert = await database.collection('shadow_dosing_decisions').insertOne(document);
    return { ok: true, saved: true, insertedId: insert.insertedId, data: document };
  } catch (error) {
    if (error && (error.code === 11000 || error.codeName === 'DuplicateKey')) {
      return { ok: true, saved: false, duplicate: true };
    }
    throw error;
  }
}

async function getShadowModeStatus(deviceId) {
  const database = getDb();
  const latestDecision = await database.collection('shadow_dosing_decisions')
    .findOne({ deviceId }, { sort: { createdAt: -1 } });
  return {
    deviceId,
    enabled: SHADOW_MODE_ENABLED,
    autoDosing: 'OFF',
    autoDosingLockedOff: PHASE22_AUTO_DOSING_LOCKED_OFF,
    latestDecision,
  };
}

async function getShadowDecisions(deviceId, limit) {
  return getDb().collection('shadow_dosing_decisions')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizeLimit(limit))
    .toArray();
}

module.exports = {
  buildShadowContext,
  evaluateAndSaveShadowDecision,
  getShadowModeStatus,
  getShadowDecisions,
};
