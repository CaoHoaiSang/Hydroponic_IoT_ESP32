const { getDb } = require('../mongoClient');
const { normalizeLimit } = require('./deviceQueryService');

const ALERT_RULES = [
  {
    type: 'water_level_low',
    level: 'warning',
    message: 'Water level is low',
    isActive: (payload) => payload.waterLevel === 'low',
    isResolved: (payload) => payload.waterLevel === 'normal',
  },
  {
    type: 'water_temp_invalid',
    level: 'warning',
    message: 'Water temperature sensor is invalid',
    isActive: (payload) => payload.waterTempValid === false || payload.waterTemp === null,
    isResolved: (payload) => payload.waterTempValid === true && typeof payload.waterTemp === 'number',
  },
  {
    type: 'tds_sensor_anomaly',
    level: 'warning',
    message: 'TDS sensor reading is abnormal',
    isActive: (payload) => payload.tdsRaw <= 50 || payload.tdsVoltage <= 0.05,
    isResolved: (payload) => payload.tdsRaw > 50 && payload.tdsVoltage > 0.05,
  },
];

function buildAlertSummary(rule, status) {
  return {
    type: rule.type,
    level: rule.level,
    message: rule.message,
    status,
  };
}

async function activateAlert(alertsCollection, payload, rule, now) {
  await alertsCollection.updateOne(
    {
      deviceId: payload.deviceId,
      type: rule.type,
      status: 'active',
    },
    {
      $set: {
        level: rule.level,
        message: rule.message,
        lastSeenAt: now,
        latestPayload: payload,
      },
      $setOnInsert: {
        deviceId: payload.deviceId,
        type: rule.type,
        status: 'active',
        firstSeenAt: now,
        createdAt: now,
        resolvedAt: null,
      },
    },
    { upsert: true },
  );

  return buildAlertSummary(rule, 'active');
}

async function resolveAlert(alertsCollection, payload, rule, now) {
  const result = await alertsCollection.updateOne(
    {
      deviceId: payload.deviceId,
      type: rule.type,
      status: 'active',
    },
    {
      $set: {
        status: 'resolved',
        resolvedAt: now,
        lastSeenAt: now,
        latestPayload: payload,
      },
    },
  );

  if (result.modifiedCount === 0) {
    return null;
  }

  return buildAlertSummary(rule, 'resolved');
}

async function evaluateAlerts(payload) {
  const database = getDb();
  const alertsCollection = database.collection('alerts');
  const now = new Date();
  const summary = {
    ok: true,
    active: [],
    resolved: [],
  };

  for (const rule of ALERT_RULES) {
    if (rule.isActive(payload)) {
      const activeAlert = await activateAlert(alertsCollection, payload, rule, now);
      summary.active.push(activeAlert);
    } else if (rule.isResolved(payload)) {
      const resolvedAlert = await resolveAlert(alertsCollection, payload, rule, now);

      if (resolvedAlert) {
        summary.resolved.push(resolvedAlert);
      }
    }
  }

  return summary;
}

async function getActiveAlerts() {
  const database = getDb();

  return database
    .collection('alerts')
    .find({ status: 'active' })
    .sort({ lastSeenAt: -1, firstSeenAt: -1 })
    .toArray();
}

async function getAlertsByDevice(deviceId, status, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit);
  const query = { deviceId };

  if (status) {
    query.status = status;
  }

  return database
    .collection('alerts')
    .find(query)
    .sort({ firstSeenAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function getLatestAlerts(limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit);

  return database
    .collection('alerts')
    .find({})
    .sort({ firstSeenAt: -1, createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

module.exports = {
  evaluateAlerts,
  getActiveAlerts,
  getAlertsByDevice,
  getLatestAlerts,
};
