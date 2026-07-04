const { getDb } = require('../mongoClient');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function normalizeLimit(value, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

async function getAllDevices() {
  const database = getDb();

  return database
    .collection('devices')
    .find({})
    .sort({ lastSeenAt: -1 })
    .toArray();
}

async function getDeviceById(deviceId) {
  const database = getDb();

  return database.collection('devices').findOne({ deviceId });
}

async function getLatestSensorLogs(limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit);

  return database
    .collection('sensor_logs')
    .find({})
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function getSensorLogsByDevice(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit);

  return database
    .collection('sensor_logs')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

module.exports = {
  normalizeLimit,
  getAllDevices,
  getDeviceById,
  getLatestSensorLogs,
  getSensorLogsByDevice,
};
