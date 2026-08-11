const { getDb } = require('../mongoClient');
const { evaluateAlerts } = require('./alertService');
const { applyTdsCalibration } = require('./tdsCalibrationService');
const { buildControlValidity, evaluateTdsStability } = require('./tdsQualityService');
const {
  ORDER_STATUS,
  classifyAndPersistTelemetryOrder,
  isV2Telemetry,
} = require('./telemetryIdentityService');
const { validateSensorPayload } = require('../validators/sensorPayloadValidator');

const TELEMETRY_PROCESSING_LEASE_MS = 30000;
const TELEMETRY_MAX_FUTURE_SKEW_MS = 5000;
const ESP32_MILLIS_MODULUS = 0x100000000;

function isDuplicateKeyError(error) {
  return Boolean(error) && (error.code === 11000 || error.codeName === 'DuplicateKey');
}

function buildQualityFields(payload, calibration, stability, control) {
  return {
    tdsRaw: payload.tdsRaw,
    tdsVoltage: payload.tdsVoltage,
    tdsMin: payload.tdsMin,
    tdsMax: payload.tdsMax,
    tdsSampleCount: payload.tdsSampleCount,
    tdsSpreadRaw: payload.tdsSpreadRaw,
    tdsWindowStable: payload.tdsWindowStable,
    tdsVoltage25: calibration.tdsVoltage25,
    ecUsCm: calibration.ecUsCm,
    tdsPpm: calibration.tdsPpm,
    tdsFactor: calibration.tdsFactor,
    tdsScale: calibration.tdsScale,
    tdsCalibrationSetId: calibration.tdsCalibrationSetId,
    tdsCalibrationMode: calibration.tdsCalibrationMode,
    tdsCalibrationPointCount: calibration.tdsCalibrationPointCount,
    tdsCalibrationInRange: calibration.tdsCalibrationInRange,
    tdsCalibrationWarning: calibration.tdsCalibrationWarning,
    tdsTemperatureCompensated: calibration.tdsTemperatureCompensated,
    tdsTemperatureAlphaPerC: calibration.tdsTemperatureAlphaPerC,
    tdsTemperatureFactorUsed: calibration.tdsTemperatureFactorUsed,
    tdsTemperatureReferenceC: calibration.tdsTemperatureReferenceC,
    tdsMeasurementValid: calibration.tdsMeasurementValid,
    tdsStable: stability.tdsStable,
    tdsStabilitySampleCount: stability.tdsStabilitySampleCount,
    tdsStabilityDistinctMeasurementCount: stability.tdsStabilityDistinctMeasurementCount,
    tdsStabilitySpreadPpm: stability.tdsStabilitySpreadPpm,
    tdsStabilityThresholdPpm: stability.tdsStabilityThresholdPpm,
    tdsStabilityReason: stability.tdsStabilityReason,
    tdsControlValid: control.tdsControlValid,
    tdsControlInvalidReasons: control.tdsControlInvalidReasons,
  };
}

function buildIdentityFields(payload, orderStatus, bootSessionValid, timing = null) {
  return {
    schemaVersion: payload.schemaVersion,
    bootId: payload.bootId,
    measurementSeq: payload.measurementSeq,
    measurementId: payload.measurementId,
    sampledAtUptimeMs: payload.sampledAtUptimeMs,
    telemetryIdentityValid: true,
    telemetryDuplicate: false,
    telemetryOrderStatus: orderStatus,
    telemetryBootSessionValid: bootSessionValid,
    measurementFreshnessVerified: timing ? timing.measurementFreshnessVerified : false,
    measurementTimeSource: timing ? timing.measurementTimeSource : 'UNVERIFIED',
    measurementAgeAtReceiptMs: timing ? timing.measurementAgeAtReceiptMs : null,
  };
}

function buildLatestStatus(payload, quality, identity, measurementAt, receivedAt) {
  return {
    ...quality,
    ...identity,
    measurementAt,
    receivedAt,
    controlEligible: quality.tdsControlValid === true,
    controlExclusionReasons: quality.tdsControlInvalidReasons,
    waterTemp: payload.waterTemp,
    waterTempValid: payload.waterTempValid,
    waterLevel: payload.waterLevel,
    pumpMain: payload.pumpMain,
    pumpA: payload.pumpA,
    pumpB: payload.pumpB,
    pumpSpare: payload.pumpSpare,
    ph: payload.ph,
    uptimeMs: payload.uptimeMs,
  };
}

function processingErrorCode(error) {
  if (error && typeof error.code === 'string') return error.code.slice(0, 80);
  if (error && typeof error.code === 'number') return String(error.code);
  if (error && typeof error.name === 'string') return error.name.slice(0, 80);
  return 'TELEMETRY_PROCESSING_ERROR';
}

async function resolveMeasurementTiming(database, payload, now) {
  const anchor = await database.collection('sensor_logs').findOne(
    {
      deviceId: payload.deviceId,
      bootId: payload.bootId,
      measurementSeq: { $lt: payload.measurementSeq },
      telemetryIdentityValid: true,
    },
    { sort: { measurementSeq: -1 } },
  );
  if (!anchor) {
    return {
      measurementAt: now,
      measurementFreshnessVerified: false,
      measurementTimeSource: 'NO_SAME_BOOT_UPTIME_ANCHOR',
      measurementAgeAtReceiptMs: null,
    };
  }

  const anchorAt = new Date(anchor.measurementAt || anchor.receivedAt || 0).getTime();
  let uptimeDeltaMs = payload.sampledAtUptimeMs - anchor.sampledAtUptimeMs;
  if (uptimeDeltaMs <= 0
    && payload.sampledAtUptimeMs <= 0xFFFFFFFF
    && anchor.sampledAtUptimeMs <= 0xFFFFFFFF) {
    uptimeDeltaMs += ESP32_MILLIS_MODULUS;
  }
  const estimatedAtMs = anchorAt + uptimeDeltaMs;
  const ageMs = now.getTime() - estimatedAtMs;
  const verified = Number.isFinite(anchorAt)
    && Number.isSafeInteger(uptimeDeltaMs)
    && uptimeDeltaMs > 0
    && Number.isFinite(estimatedAtMs)
    && ageMs >= -TELEMETRY_MAX_FUTURE_SKEW_MS;

  return {
    measurementAt: verified ? new Date(estimatedAtMs) : now,
    measurementFreshnessVerified: verified,
    measurementTimeSource: verified ? 'SAME_BOOT_UPTIME_ANCHOR' : 'INVALID_SAME_BOOT_UPTIME_ANCHOR',
    measurementAgeAtReceiptMs: verified ? Math.max(0, ageMs) : null,
  };
}

async function saveLegacyPayload(payload, topic, now) {
  const database = getDb();
  const document = {
    ...payload,
    telemetryIdentityValid: false,
    telemetryDuplicate: false,
    telemetryOrderStatus: ORDER_STATUS.LEGACY_NO_IDENTITY,
    telemetryBootSessionValid: false,
    measurementFreshnessVerified: false,
    measurementTimeSource: 'LEGACY_NO_IDENTITY',
    measurementAgeAtReceiptMs: null,
    controlEligible: false,
    controlExclusionReasons: ['legacy_telemetry_no_identity'],
    receivedAt: now,
    measurementAt: now,
    topic,
    createdAt: now,
    rawPayload: payload,
  };
  const result = await database.collection('sensor_logs').insertOne(document);
  return {
    ok: true,
    accepted: false,
    legacy: true,
    reason: ORDER_STATUS.LEGACY_NO_IDENTITY,
    insertedId: result.insertedId,
    shadowEligible: false,
  };
}

async function markDuplicate(database, payload, now) {
  await database.collection('sensor_logs').updateOne(
    { deviceId: payload.deviceId, measurementId: payload.measurementId },
    {
      $set: { lastDuplicateReceivedAt: now },
      $push: { duplicateReceipts: { receivedAt: now } },
    },
  );
  return {
    ok: true,
    accepted: false,
    duplicate: true,
    idempotent: true,
    reason: ORDER_STATUS.DUPLICATE,
    measurementId: payload.measurementId,
    shadowEligible: false,
  };
}

async function saveSensorPayload(payload, topic, receivedAt = new Date()) {
  const validation = validateSensorPayload(payload);
  if (!validation.ok) {
    console.warn('Sensor payload validation failed:', validation.errors.join('; '));
    return { ok: false, accepted: false, reason: 'validation_failed', errors: validation.errors };
  }

  const database = getDb();
  const now = receivedAt;
  if (!isV2Telemetry(payload)) return saveLegacyPayload(payload, topic, now);

  let existing = await database.collection('sensor_logs').findOne({
    deviceId: payload.deviceId,
    measurementId: payload.measurementId,
  });
  let insertedId = existing && existing._id ? existing._id : null;
  const leaseUntil = new Date(now.getTime() + TELEMETRY_PROCESSING_LEASE_MS);

  if (existing) {
    const failed = existing.processingState === 'FAILED';
    const expired = existing.processingState === 'PROCESSING'
      && existing.processingLeaseUntil instanceof Date
      && existing.processingLeaseUntil <= now;
    const legacyStuck = existing.processingState === undefined
      && existing.telemetryOrderStatus === 'PROCESSING';
    if (!failed && !expired && !legacyStuck) return markDuplicate(database, payload, now);

    let claimFilter;
    if (legacyStuck) {
      claimFilter = {
        deviceId: payload.deviceId,
        measurementId: payload.measurementId,
        processingState: { $exists: false },
        telemetryOrderStatus: 'PROCESSING',
      };
    } else if (failed) {
      claimFilter = {
        deviceId: payload.deviceId,
        measurementId: payload.measurementId,
        processingState: 'FAILED',
      };
    } else {
      claimFilter = {
        deviceId: payload.deviceId,
        measurementId: payload.measurementId,
        processingState: 'PROCESSING',
        processingLeaseUntil: { $lte: now },
      };
    }
    if (!legacyStuck && Number.isInteger(existing.processingAttempt)) {
      claimFilter.processingAttempt = existing.processingAttempt;
    }
    const claim = await database.collection('sensor_logs').updateOne(
      claimFilter,
      {
        $set: {
          processingState: 'PROCESSING',
          processingLeaseUntil: leaseUntil,
          processingResumedAt: now,
          processingAttempt: (existing.processingAttempt || 1) + 1,
          lastDuplicateReceivedAt: now,
        },
        $unset: { processingErrorCode: '', processingFailedAt: '' },
      },
    );
    if (claim.matchedCount !== 1) return markDuplicate(database, payload, now);
    if (legacyStuck) {
      const device = await database.collection('devices').findOne({ deviceId: payload.deviceId });
      const session = device && device.telemetrySession;
      if (session && session.currentBootId === payload.bootId
        && session.lastAcceptedSeq === payload.measurementSeq) {
        await database.collection('sensor_logs').updateOne(
          { deviceId: payload.deviceId, measurementId: payload.measurementId },
          {
            $set: {
              telemetryOrderStatus: ORDER_STATUS.ACCEPTED,
              telemetryBootSessionValid: true,
              processingStage: 'ORDER_CLASSIFIED',
            },
          },
        );
      }
    }
    existing = await database.collection('sensor_logs').findOne({
      deviceId: payload.deviceId,
      measurementId: payload.measurementId,
    });
  } else {
    const identityBase = buildIdentityFields(payload, 'PROCESSING', false);
    const auditLog = {
      ...payload,
      ...identityBase,
      processingState: 'PROCESSING',
      processingStage: 'ORDER_PENDING',
      processingAttempt: 1,
      processingLeaseUntil: leaseUntil,
      controlEligible: false,
      controlExclusionReasons: ['telemetry_processing'],
      receivedAt: now,
      measurementAt: null,
      topic,
      createdAt: now,
      rawPayload: payload,
    };
    try {
      const insertResult = await database.collection('sensor_logs').insertOne(auditLog);
      insertedId = insertResult.insertedId;
      existing = auditLog;
    } catch (error) {
      if (isDuplicateKeyError(error)) return markDuplicate(database, payload, now);
      throw error;
    }
  }

  try {
    const hasPersistedOrder = existing.telemetryOrderStatus
      && existing.telemetryOrderStatus !== 'PROCESSING';
    const order = hasPersistedOrder
      ? {
        status: existing.telemetryOrderStatus,
        accepted: existing.telemetryOrderStatus === ORDER_STATUS.ACCEPTED,
        bootSessionValid: existing.telemetryBootSessionValid === true,
      }
      : await classifyAndPersistTelemetryOrder(payload, now);
    let identity = buildIdentityFields(payload, order.status, order.bootSessionValid);
    await database.collection('sensor_logs').updateOne(
      { deviceId: payload.deviceId, measurementId: payload.measurementId },
      { $set: { ...identity, processingStage: 'ORDER_CLASSIFIED' } },
    );

    if (!order.accepted) {
      const exclusions = [order.status.toLowerCase()];
      await database.collection('sensor_logs').updateOne(
        { deviceId: payload.deviceId, measurementId: payload.measurementId },
        {
          $set: {
            ...identity,
            processingState: 'COMPLETED',
            processingStage: 'ORDER_REJECTED',
            processingLeaseUntil: null,
            processingCompletedAt: now,
            controlEligible: false,
            controlExclusionReasons: exclusions,
          },
        },
      );
      return {
        ok: true,
        accepted: false,
        reason: order.status,
        insertedId,
        measurementId: payload.measurementId,
        shadowEligible: false,
      };
    }

    const timing = await resolveMeasurementTiming(database, payload, now);
    identity = buildIdentityFields(payload, order.status, order.bootSessionValid, timing);
    const calibration = await applyTdsCalibration(payload.deviceId, payload);
    const currentCandidate = {
      ...calibration,
      ...identity,
      measurementAt: timing.measurementAt,
      tdsWindowStable: payload.tdsWindowStable,
      tdsSampleCount: payload.tdsSampleCount,
      tdsSpreadRaw: payload.tdsSpreadRaw,
    };
    const stability = await evaluateTdsStability(payload.deviceId, currentCandidate, now);
    const control = buildControlValidity(
      payload,
      calibration,
      stability,
      timing.measurementAt,
      now,
      identity,
    );
    const quality = buildQualityFields(payload, calibration, stability, control);
    const controlEligible = control.tdsControlValid === true;
    const completedLog = {
      ...identity,
      ...quality,
      measurementAt: timing.measurementAt,
      processingState: 'COMPLETED',
      processingStage: 'COMPLETED',
      processingLeaseUntil: null,
      processingCompletedAt: now,
      controlEligible,
      controlExclusionReasons: control.tdsControlInvalidReasons,
    };
    await database.collection('sensor_logs').updateOne(
      { deviceId: payload.deviceId, measurementId: payload.measurementId },
      { $set: completedLog },
    );
    await database.collection('devices').updateOne(
      { deviceId: payload.deviceId },
      {
        $set: {
          lastSeenAt: now,
          latest: buildLatestStatus(payload, quality, identity, timing.measurementAt, now),
          updatedAt: now,
        },
        $setOnInsert: { deviceId: payload.deviceId, createdAt: now },
      },
      { upsert: true },
    );
    const alerts = await evaluateAlerts(payload);
    return {
      ok: true,
      accepted: true,
      reason: ORDER_STATUS.ACCEPTED,
      insertedId,
      alerts,
      quality,
      identity,
      shadowEligible: true,
    };
  } catch (error) {
    await database.collection('sensor_logs').updateOne(
      { deviceId: payload.deviceId, measurementId: payload.measurementId },
      {
        $set: {
          processingState: 'FAILED',
          processingLeaseUntil: null,
          processingFailedAt: now,
          processingErrorCode: processingErrorCode(error),
          controlEligible: false,
        },
      },
    );
    throw error;
  }
}

module.exports = {
  buildQualityFields,
  buildIdentityFields,
  resolveMeasurementTiming,
  saveSensorPayload,
};
