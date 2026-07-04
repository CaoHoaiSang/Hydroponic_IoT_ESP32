const { getDb } = require('../mongoClient');
const { evaluateAlerts } = require('./alertService');
const { applyTdsCalibration } = require('./tdsCalibrationService');
const { validateSensorPayload } = require('../validators/sensorPayloadValidator');

function buildLatestStatus(payload, tdsCalibrationResult) {
  return {
    tdsRaw: payload.tdsRaw,
    tdsVoltage: payload.tdsVoltage,
    tdsPpm: tdsCalibrationResult.tdsPpm,
    tdsCalibrationFactorUsed: tdsCalibrationResult.tdsCalibrationFactorUsed,
    tdsCalibrationId: tdsCalibrationResult.tdsCalibrationId,
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

async function saveSensorPayload(payload, topic) {
  const validation = validateSensorPayload(payload);

  if (!validation.ok) {
    console.warn('Sensor payload validation failed:', validation.errors.join('; '));
    return {
      ok: false,
      reason: 'validation_failed',
    };
  }

  const database = getDb();
  const now = new Date();
  const tdsCalibrationResult = await applyTdsCalibration(payload.deviceId, payload);

  const sensorLog = {
    deviceId: payload.deviceId,
    tdsRaw: payload.tdsRaw,
    tdsVoltage: payload.tdsVoltage,
    tdsPpm: tdsCalibrationResult.tdsPpm,
    tdsCalibrationFactorUsed: tdsCalibrationResult.tdsCalibrationFactorUsed,
    tdsCalibrationId: tdsCalibrationResult.tdsCalibrationId,
    tdsMin: payload.tdsMin,
    tdsMax: payload.tdsMax,
    waterTemp: payload.waterTemp,
    waterTempValid: payload.waterTempValid,
    waterLevel: payload.waterLevel,
    pumpMain: payload.pumpMain,
    pumpA: payload.pumpA,
    pumpB: payload.pumpB,
    pumpSpare: payload.pumpSpare,
    ph: payload.ph,
    uptimeMs: payload.uptimeMs,
    topic,
    createdAt: now,
    rawPayload: payload,
  };

  const insertResult = await database.collection('sensor_logs').insertOne(sensorLog);

  await database.collection('devices').updateOne(
    { deviceId: payload.deviceId },
    {
      $set: {
        lastSeenAt: now,
        latest: buildLatestStatus(payload, tdsCalibrationResult),
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId: payload.deviceId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const alerts = await evaluateAlerts(payload);

  return {
    ok: true,
    insertedId: insertResult.insertedId,
    alerts,
  };
}

module.exports = {
  saveSensorPayload,
};
