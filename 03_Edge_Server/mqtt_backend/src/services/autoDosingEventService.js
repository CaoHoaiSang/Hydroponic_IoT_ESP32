const crypto = require('crypto');

const { getDb } = require('../mongoClient');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_EVENT_LIMIT = 50;
const MAX_EVENT_LIMIT = 200;
const DEFAULT_DEDUP_INTERVAL_MS = 300000;
const REPEATED_EVENT_TYPES = new Set(['evaluation', 'skip', 'daily_limit_reached']);
const RUN_EVENT_TYPES = new Set([
  'run_started',
  'pump_a_completed',
  'pump_b_completed',
  'mixing_wait_started',
  'run_completed',
]);
const SAFETY_EVENT_TYPES = new Set(['skip', 'daily_limit_reached', 'manual_daily_reset']);

function createEventId() {
  return `auto_event_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeOptionalBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function getDedupIntervalMs() {
  const configured = Number(process.env.AUTO_DOSING_EVENT_DEDUP_MS);

  return Number.isFinite(configured) && configured >= 60000
    ? configured
    : DEFAULT_DEDUP_INTERVAL_MS;
}

async function shouldDeduplicateEvent(event) {
  if (!REPEATED_EVENT_TYPES.has(event.eventType)) {
    return false;
  }

  const database = getDb();
  const latest = await database.collection('auto_dosing_events').findOne(
    { deviceId: event.deviceId },
    { sort: { createdAt: -1 } },
  );

  if (!latest || latest.reason !== event.reason || latest.eventType !== event.eventType) {
    return false;
  }

  const latestTime = new Date(latest.createdAt).getTime();

  return Number.isFinite(latestTime)
    && event.createdAt.getTime() - latestTime < getDedupIntervalMs();
}

async function logAutoDosingEvent(fields) {
  const database = getDb();
  const now = fields.createdAt instanceof Date ? fields.createdAt : new Date();
  const event = {
    eventId: createEventId(),
    deviceId: fields.deviceId,
    eventType: fields.eventType || 'evaluation',
    mode: fields.mode || 'closed_loop_step',
    reason: fields.reason || null,
    tdsPpm: isFiniteNumber(fields.tdsPpm) ? fields.tdsPpm : null,
    targetMinPpm: isFiniteNumber(fields.targetMinPpm) ? fields.targetMinPpm : null,
    targetMaxPpm: isFiniteNumber(fields.targetMaxPpm) ? fields.targetMaxPpm : null,
    mainPumpOn: normalizeOptionalBoolean(fields.mainPumpOn),
    waterLevel: fields.waterLevel || null,
    waterTempValid: normalizeOptionalBoolean(fields.waterTempValid),
    activeRunId: fields.activeRunId || null,
    dailyDoseUsedMlPerPump: isFiniteNumber(fields.dailyDoseUsedMlPerPump)
      ? Number(fields.dailyDoseUsedMlPerPump.toFixed(2))
      : null,
    maxDailyDoseMlPerPump: isFiniteNumber(fields.maxDailyDoseMlPerPump)
      ? fields.maxDailyDoseMlPerPump
      : null,
    message: fields.message || '',
    createdAt: now,
  };

  if (await shouldDeduplicateEvent(event)) {
    return {
      ok: true,
      logged: false,
      reason: 'deduplicated',
    };
  }

  await database.collection('auto_dosing_events').insertOne(event);

  return {
    ok: true,
    logged: true,
    data: event,
  };
}

async function getAutoDosingEvents(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT);

  return database
    .collection('auto_dosing_events')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function getAutoDosingEventSummary(deviceId) {
  const database = getDb();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [latest, grouped] = await Promise.all([
    database.collection('auto_dosing_events').findOne(
      { deviceId },
      { sort: { createdAt: -1 } },
    ),
    database.collection('auto_dosing_events').aggregate([
      {
        $match: {
          deviceId,
          createdAt: { $gte: dayAgo },
        },
      },
      {
        $group: {
          _id: {
            eventType: '$eventType',
            reason: '$reason',
          },
          count: { $sum: 1 },
          lastAt: { $max: '$createdAt' },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray(),
  ]);

  return {
    deviceId,
    windowHours: 24,
    latest: latest || null,
    total: grouped.reduce((sum, item) => sum + item.count, 0),
    groups: grouped.map((item) => ({
      eventType: item._id.eventType,
      reason: item._id.reason,
      count: item.count,
      lastAt: item.lastAt,
    })),
  };
}

function getAutoDosingEventCategory(event) {
  if (event.eventType === 'settings_updated') {
    return 'settings';
  }

  if (RUN_EVENT_TYPES.has(event.eventType)) {
    return 'run';
  }

  if (SAFETY_EVENT_TYPES.has(event.eventType)) {
    return 'safety';
  }

  return event.eventType === 'skip' ? 'skip' : 'all';
}

module.exports = {
  getAutoDosingEventCategory,
  getAutoDosingEvents,
  getAutoDosingEventSummary,
  logAutoDosingEvent,
};
