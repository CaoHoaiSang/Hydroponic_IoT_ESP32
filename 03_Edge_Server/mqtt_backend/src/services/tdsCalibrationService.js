const { getDb } = require('../mongoClient');
const { validateTdsCalibration } = require('../validators/tdsCalibrationValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function saveTdsCalibration(deviceId, body) {
  const validation = validateTdsCalibration(deviceId, body || {});

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
  const calibrationFactor = value.referenceTdsPpm / value.measuredVoltage;
  const calibration = {
    deviceId: value.deviceId,
    measuredRaw: value.measuredRaw,
    measuredVoltage: value.measuredVoltage,
    referenceTdsPpm: value.referenceTdsPpm,
    waterTemp: value.waterTemp,
    calibrationFactor,
    method: value.method,
    note: value.note,
    createdAt: now,
  };

  await database.collection('tds_calibrations').insertOne(calibration);

  await database.collection('devices').updateOne(
    { deviceId: value.deviceId },
    {
      $set: {
        latestTdsCalibration: {
          calibrationFactor: calibration.calibrationFactor,
          referenceTdsPpm: calibration.referenceTdsPpm,
          measuredVoltage: calibration.measuredVoltage,
          measuredRaw: calibration.measuredRaw,
          calibratedAt: calibration.createdAt,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId: value.deviceId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    data: calibration,
  };
}

async function getLatestTdsCalibration(deviceId) {
  const database = getDb();

  return database
    .collection('tds_calibrations')
    .findOne({ deviceId }, { sort: { createdAt: -1 } });
}

async function getTdsCalibrationHistory(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);

  return database
    .collection('tds_calibrations')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function applyTdsCalibration(deviceId, sensorPayload) {
  const latestCalibration = await getLatestTdsCalibration(deviceId);

  if (!latestCalibration) {
    return {
      tdsPpm: null,
      tdsCalibrationFactorUsed: null,
      tdsCalibrationId: null,
    };
  }

  const tdsVoltage = sensorPayload && sensorPayload.tdsVoltage;

  if (typeof tdsVoltage !== 'number' || !Number.isFinite(tdsVoltage)) {
    return {
      tdsPpm: null,
      tdsCalibrationFactorUsed: latestCalibration.calibrationFactor,
      tdsCalibrationId: latestCalibration._id,
    };
  }

  return {
    tdsPpm: roundTo(tdsVoltage * latestCalibration.calibrationFactor, 2),
    tdsCalibrationFactorUsed: latestCalibration.calibrationFactor,
    tdsCalibrationId: latestCalibration._id,
  };
}

module.exports = {
  saveTdsCalibration,
  getLatestTdsCalibration,
  getTdsCalibrationHistory,
  applyTdsCalibration,
};
