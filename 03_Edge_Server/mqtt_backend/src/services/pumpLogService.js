const { getDb } = require('../mongoClient');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validatePumpStatusPayload(payload) {
  const errors = [];

  if (!isObject(payload)) {
    return {
      ok: false,
      errors: ['payload must be an object'],
    };
  }

  if (typeof payload.commandId !== 'string' || payload.commandId.trim().length === 0) {
    errors.push('commandId must be a non-empty string');
  }

  if (typeof payload.deviceId !== 'string' || payload.deviceId.trim().length === 0) {
    errors.push('deviceId must be a non-empty string');
  }

  if (!['main', 'A', 'B'].includes(payload.pump)) {
    errors.push('pump must be one of: main, A, B');
  }

  if (!['pulse', 'set'].includes(payload.action)) {
    errors.push('action must be one of: pulse, set');
  }

  if (payload.action === 'set' && !['on', 'off'].includes(payload.state)) {
    errors.push('state must be one of: on, off for set action');
  }

  if (!isNumber(payload.durationMs)) {
    errors.push('durationMs must be a number');
  } else if (payload.action === 'pulse' && payload.durationMs <= 0) {
    errors.push('durationMs must be greater than 0 for pulse action');
  } else if (payload.action === 'set' && payload.durationMs < 0) {
    errors.push('durationMs must be 0 or greater for set action');
  }

  if (typeof payload.accepted !== 'boolean') {
    errors.push('accepted must be boolean');
  }

  if (typeof payload.success !== 'boolean') {
    errors.push('success must be boolean');
  }

  if (typeof payload.status !== 'string' || payload.status.trim().length === 0) {
    errors.push('status must be a non-empty string');
  }

  if (typeof payload.message !== 'string') {
    errors.push('message must be a string');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function buildPumpStateUpdate(payload) {
  const update = {};

  if (typeof payload.pumpMain === 'boolean') {
    update['latest.pumpMain'] = payload.pumpMain;
  }

  if (typeof payload.pumpA === 'boolean') {
    update['latest.pumpA'] = payload.pumpA;
  }

  if (typeof payload.pumpB === 'boolean') {
    update['latest.pumpB'] = payload.pumpB;
  }

  if (typeof payload.pumpSpare === 'boolean') {
    update['latest.pumpSpare'] = payload.pumpSpare;
  }

  if (isNumber(payload.uptimeMs)) {
    update['latest.uptimeMs'] = payload.uptimeMs;
  }

  return update;
}

async function savePumpStatusPayload(payload, topic) {
  const validation = validatePumpStatusPayload(payload);

  if (!validation.ok) {
    console.warn('Pump status validation failed:', validation.errors.join('; '));
    return {
      ok: false,
      reason: 'validation_failed',
      errors: validation.errors,
    };
  }

  const database = getDb();
  const now = new Date();
  const pumpLog = {
    commandId: payload.commandId,
    deviceId: payload.deviceId,
    pump: payload.pump,
    pumpType: payload.pump,
    action: payload.action,
    state: payload.state,
    durationMs: payload.durationMs,
    accepted: payload.accepted,
    success: payload.success,
    status: payload.status,
    message: payload.message,
    pumpMain: payload.pumpMain,
    pumpA: payload.pumpA,
    pumpB: payload.pumpB,
    pumpSpare: payload.pumpSpare,
    uptimeMs: payload.uptimeMs,
    topic,
    createdAt: now,
    rawPayload: payload,
  };

  const insertResult = await database.collection('pump_logs').insertOne(pumpLog);
  const pumpStateUpdate = buildPumpStateUpdate(payload);

  await database.collection('devices').updateOne(
    { deviceId: payload.deviceId },
    {
      $set: {
        ...pumpStateUpdate,
        lastPumpStatusAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId: payload.deviceId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    insertedId: insertResult.insertedId,
  };
}

module.exports = {
  savePumpStatusPayload,
};
