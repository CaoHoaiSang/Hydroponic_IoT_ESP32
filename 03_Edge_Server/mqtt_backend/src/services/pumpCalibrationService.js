const { getDb } = require('../mongoClient');
const { validatePumpCalibration } = require('../validators/pumpCalibrationValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

function normalizeCalibrationPump(value) {
  if (typeof value === 'string' && value.toUpperCase() === 'A') {
    return 'A';
  }

  if (typeof value === 'string' && value.toUpperCase() === 'B') {
    return 'B';
  }

  return null;
}

function buildLatestCalibrationUpdate(calibration) {
  if (calibration.pump === 'A') {
    return {
      'latestCalibration.pumpAFlowRateMlPerSec': calibration.flowRateMlPerSec,
      'latestCalibration.pumpACalibratedAt': calibration.createdAt,
    };
  }

  return {
    'latestCalibration.pumpBFlowRateMlPerSec': calibration.flowRateMlPerSec,
    'latestCalibration.pumpBCalibratedAt': calibration.createdAt,
  };
}

async function savePumpCalibration(deviceId, body) {
  const validation = validatePumpCalibration(deviceId, body || {});

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
  const flowRateMlPerSec = value.measuredMl / (value.durationMs / 1000);
  const calibration = {
    deviceId: value.deviceId,
    pump: value.pump,
    durationMs: value.durationMs,
    measuredMl: value.measuredMl,
    flowRateMlPerSec,
    method: value.method,
    note: value.note,
    createdAt: now,
  };

  await database.collection('pump_calibrations').insertOne(calibration);

  await database.collection('devices').updateOne(
    { deviceId: value.deviceId },
    {
      $set: {
        ...buildLatestCalibrationUpdate(calibration),
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

async function getLatestPumpCalibrations(deviceId) {
  const database = getDb();
  const collection = database.collection('pump_calibrations');
  const [pumpA, pumpB] = await Promise.all([
    collection.findOne({ deviceId, pump: 'A' }, { sort: { createdAt: -1 } }),
    collection.findOne({ deviceId, pump: 'B' }, { sort: { createdAt: -1 } }),
  ]);

  return {
    A: pumpA || null,
    B: pumpB || null,
  };
}

async function getPumpCalibrationHistory(deviceId, pump, limit) {
  const normalizedPump = normalizeCalibrationPump(pump);

  if (!normalizedPump) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: ['pump must be one of: A, B'],
    };
  }

  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
  const calibrations = await database
    .collection('pump_calibrations')
    .find({ deviceId, pump: normalizedPump })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();

  return {
    ok: true,
    pump: normalizedPump,
    data: calibrations,
  };
}

module.exports = {
  savePumpCalibration,
  getLatestPumpCalibrations,
  getPumpCalibrationHistory,
};
