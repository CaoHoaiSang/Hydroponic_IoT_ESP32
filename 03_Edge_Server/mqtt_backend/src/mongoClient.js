const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connectMongo() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGO_DB_NAME || 'hydroponic_iot';

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  console.log('MongoDB connected');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB is not connected');
  }

  return db;
}

function getMongoClient() {
  return client;
}

function setMongoForTests(database, mongoClient = null) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setMongoForTests is only available when NODE_ENV=test');
  }
  db = database;
  client = mongoClient;
}

function resetMongoForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetMongoForTests is only available when NODE_ENV=test');
  }
  db = null;
  client = null;
}

function isMongoConnected() {
  return Boolean(db);
}

async function ensureIndexes() {
  const database = getDb();

  await database.collection('sensor_logs').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('sensor_logs').createIndex(
    { deviceId: 1, measurementId: 1 },
    {
      unique: true,
      partialFilterExpression: { schemaVersion: 2, telemetryIdentityValid: true },
      name: 'unique_v2_measurement_per_device',
    },
  );
  await database.collection('sensor_logs').createIndex({
    deviceId: 1,
    bootId: 1,
    telemetryOrderStatus: 1,
    receivedAt: -1,
  });
  await database.collection('devices').createIndex({ deviceId: 1 }, { unique: true });
  await database.collection('alerts').createIndex({ deviceId: 1, status: 1, type: 1 });
  await database.collection('alerts').createIndex({ firstSeenAt: -1 });
  await database.collection('pump_logs').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('pump_logs').createIndex({ commandId: 1 });
  await database.collection('pump_calibrations').createIndex({ deviceId: 1, pump: 1, createdAt: -1 });
  await database.collection('tds_calibrations').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('tds_calibrations').createIndex({
    deviceId: 1,
    calibrationSetId: 1,
    measuredVoltage25: 1,
  });
  await database.collection('tds_calibration_sets').createIndex({ setId: 1 }, { unique: true });
  await database.collection('tds_calibration_sets').createIndex({
    deviceId: 1,
    status: 1,
    createdAt: -1,
  });
  await database.collection('devices').createIndex(
    { activeTdsCalibrationSetId: 1 },
    { sparse: true },
  );
  await database.collection('tds_calibration_sets').createIndex(
    { deviceId: 1, activeLock: 1 },
    {
      unique: true,
      partialFilterExpression: { activeLock: true },
      name: 'one_active_tds_calibration_set_per_device',
    },
  );
  await database.collection('nutrient_response_tests').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('nutrient_response_tests').createIndex({ testId: 1 }, { unique: true });
  await database.collection('auto_dosing_settings').createIndex({ deviceId: 1 }, { unique: true });
  await database.collection('dosing_runs').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('dosing_runs').createIndex({ runId: 1 }, { unique: true });
  await database.collection('dosing_runs').createIndex({ status: 1, deviceId: 1 });
  await database.collection('dosing_runs').createIndex(
    { deviceId: 1, activeLock: 1 },
    {
      unique: true,
      partialFilterExpression: { activeLock: true },
      name: 'one_active_dosing_run_per_device',
    },
  );
  await database.collection('auto_dosing_events').createIndex({ deviceId: 1, createdAt: -1 });
  await database.collection('auto_dosing_events').createIndex({ eventId: 1 }, { unique: true });
  await database.collection('auto_dosing_events').createIndex({
    deviceId: 1,
    eventType: 1,
    reason: 1,
    createdAt: -1,
  });
  await database.collection('shadow_dosing_decisions').createIndex(
    { deviceId: 1, measurementId: 1 },
    { unique: true, name: 'unique_shadow_decision_per_measurement' },
  );
  await database.collection('shadow_dosing_decisions').createIndex({ deviceId: 1, createdAt: -1 });

  console.log('MongoDB indexes ensured');
}

async function closeMongo() {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  db = null;

  console.log('MongoDB closed');
}

module.exports = {
  connectMongo,
  getDb,
  getMongoClient,
  isMongoConnected,
  closeMongo,
  ensureIndexes,
  setMongoForTests,
  resetMongoForTests,
};
