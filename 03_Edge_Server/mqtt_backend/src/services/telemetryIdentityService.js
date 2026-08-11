const { getDb } = require('../mongoClient');
const { TELEMETRY_SCHEMA_VERSION } = require('../config/phase22Config');

const ORDER_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  DUPLICATE: 'DUPLICATE',
  OUT_OF_ORDER: 'OUT_OF_ORDER',
  OLD_BOOT_PACKET: 'OLD_BOOT_PACKET',
  BOOT_TRANSITION_UNCONFIRMED: 'BOOT_TRANSITION_UNCONFIRMED',
  LEGACY_NO_IDENTITY: 'LEGACY_NO_IDENTITY',
});

function isV2Telemetry(payload) {
  return payload && payload.schemaVersion === TELEMETRY_SCHEMA_VERSION;
}

function initialSession() {
  return {
    revision: 0,
    currentBootId: null,
    latestAcceptedSeq: null,
    latestAcceptedMeasurementId: null,
    pendingBoot: null,
    retiredBootIds: [],
  };
}

function classifyTelemetryOrder(sessionInput, identity, now = new Date()) {
  const session = { ...initialSession(), ...(sessionInput || {}) };
  session.retiredBootIds = Array.isArray(session.retiredBootIds)
    ? [...session.retiredBootIds]
    : [];

  if (session.retiredBootIds.includes(identity.bootId)) {
    return { status: ORDER_STATUS.OLD_BOOT_PACKET, accepted: false, bootSessionValid: false, session };
  }

  if (!session.currentBootId) {
    const pending = session.pendingBoot;
    if (pending && pending.bootId === identity.bootId && identity.measurementSeq > pending.latestSeq) {
      session.currentBootId = identity.bootId;
      session.latestAcceptedSeq = identity.measurementSeq;
      session.latestAcceptedMeasurementId = identity.measurementId;
      session.pendingBoot = null;
      session.confirmedAt = now;
      return { status: ORDER_STATUS.ACCEPTED, accepted: true, bootSessionValid: true, session };
    }
    if (!pending && session.retiredBootIds.length === 0) {
      session.currentBootId = identity.bootId;
      session.latestAcceptedSeq = identity.measurementSeq;
      session.latestAcceptedMeasurementId = identity.measurementId;
      session.confirmedAt = now;
      return { status: ORDER_STATUS.ACCEPTED, accepted: true, bootSessionValid: true, session };
    }
    session.pendingBoot = {
      bootId: identity.bootId,
      firstSeq: identity.measurementSeq,
      latestSeq: identity.measurementSeq,
      firstSeenAt: now,
    };
    return { status: ORDER_STATUS.BOOT_TRANSITION_UNCONFIRMED, accepted: false, bootSessionValid: false, session };
  }

  if (identity.bootId === session.currentBootId) {
    session.pendingBoot = null;
    if (identity.measurementSeq <= session.latestAcceptedSeq) {
      return { status: ORDER_STATUS.OUT_OF_ORDER, accepted: false, bootSessionValid: true, session };
    }
    session.latestAcceptedSeq = identity.measurementSeq;
    session.latestAcceptedMeasurementId = identity.measurementId;
    return { status: ORDER_STATUS.ACCEPTED, accepted: true, bootSessionValid: true, session };
  }

  const pending = session.pendingBoot;
  if (pending && pending.bootId === identity.bootId && identity.measurementSeq > pending.latestSeq) {
    session.retiredBootIds = [...new Set([...session.retiredBootIds, session.currentBootId])];
    session.currentBootId = identity.bootId;
    session.latestAcceptedSeq = identity.measurementSeq;
    session.latestAcceptedMeasurementId = identity.measurementId;
    session.pendingBoot = null;
    session.confirmedAt = now;
    return { status: ORDER_STATUS.ACCEPTED, accepted: true, bootSessionValid: true, session };
  }

  session.pendingBoot = {
    bootId: identity.bootId,
    firstSeq: identity.measurementSeq,
    latestSeq: identity.measurementSeq,
    firstSeenAt: now,
  };
  return { status: ORDER_STATUS.BOOT_TRANSITION_UNCONFIRMED, accepted: false, bootSessionValid: false, session };
}

async function classifyAndPersistTelemetryOrder(payload, now = new Date()) {
  const database = getDb();
  const devices = database.collection('devices');
  await devices.updateOne(
    { deviceId: payload.deviceId },
    {
      $setOnInsert: {
        deviceId: payload.deviceId,
        telemetrySession: initialSession(),
        createdAt: now,
      },
    },
    { upsert: true },
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const device = await devices.findOne({ deviceId: payload.deviceId });
    const session = device && device.telemetrySession ? device.telemetrySession : initialSession();
    const result = classifyTelemetryOrder(session, payload, now);
    const nextSession = { ...result.session, revision: (session.revision || 0) + 1, updatedAt: now };
    const revisionFilter = device && device.telemetrySession
      ? { 'telemetrySession.revision': session.revision || 0 }
      : { telemetrySession: { $exists: false } };
    const update = await devices.updateOne(
      { deviceId: payload.deviceId, ...revisionFilter },
      { $set: { telemetrySession: nextSession, updatedAt: now } },
    );
    if (update.matchedCount === 1 || update.modifiedCount === 1) {
      return { ...result, session: nextSession };
    }
  }
  throw new Error('telemetry_session_concurrency_conflict');
}

module.exports = {
  ORDER_STATUS,
  isV2Telemetry,
  initialSession,
  classifyTelemetryOrder,
  classifyAndPersistTelemetryOrder,
};
