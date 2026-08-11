const { getDb } = require('../mongoClient');

const DOSING_RUN_FIELDS = [
  'createdAt',
  'runId',
  'mode',
  'status',
  'tdsPpmAtStart',
  'tdsPpmAfterMixing',
  'deltaTdsPpm',
  'stepDoseMlPerPump',
  'doseMlPerPump',
  'mixingDelayMs',
  'dailyDoseUsedBefore',
  'pumpA.durationMs',
  'pumpA.status',
  'pumpB.durationMs',
  'pumpB.status',
  'mixingStartedAt',
  'mixingUntil',
  'completedAt',
  'waterLevelAfterMixing',
];

const NUTRIENT_RESPONSE_FIELDS = [
  'createdAt',
  'testId',
  'workingLevelLiters',
  'tdsSensorSupply',
  'mainPumpOn',
  'autoDosingEnabled',
  'before.dashboardAverage',
  'before.penMainPpm',
  'before.penSecondaryPpm',
  'after15min.dashboardAverage',
  'after15min.penMainPpm',
  'after15min.penSecondaryPpm',
  'result.deltaDashboard',
  'result.deltaPenMain',
  'result.deltaPenSecondary',
  'result.estimatedResponsePpmPerMl',
  'result.mixingTimeUsedMin',
  'note',
];

const AUTO_DOSING_EVENT_FIELDS = [
  'createdAt',
  'eventType',
  'reason',
  'tdsPpm',
  'targetMinPpm',
  'targetMaxPpm',
  'mainPumpOn',
  'waterLevel',
  'activeRunId',
  'dailyDoseUsedMlPerPump',
  'maxDailyDoseMlPerPump',
  'message',
];

function getNestedValue(document, path) {
  return path.split('.').reduce(
    (value, key) => (value !== null && value !== undefined ? value[key] : undefined),
    document,
  );
}

function normalizeCsvValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsvValue(value) {
  const normalized = normalizeCsvValue(value);

  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildCsv(documents, fields) {
  const lines = [fields.map(escapeCsvValue).join(',')];

  documents.forEach((document) => {
    lines.push(fields.map((field) => escapeCsvValue(getNestedValue(document, field))).join(','));
  });

  return `${lines.join('\r\n')}\r\n`;
}

async function queryForExport(collectionName, deviceId) {
  const database = getDb();

  return database
    .collection(collectionName)
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .toArray();
}

async function buildDosingRunsCsv(deviceId) {
  return buildCsv(await queryForExport('dosing_runs', deviceId), DOSING_RUN_FIELDS);
}

async function buildNutrientResponseTestsCsv(deviceId) {
  return buildCsv(
    await queryForExport('nutrient_response_tests', deviceId),
    NUTRIENT_RESPONSE_FIELDS,
  );
}

async function buildAutoDosingEventsCsv(deviceId) {
  return buildCsv(
    await queryForExport('auto_dosing_events', deviceId),
    AUTO_DOSING_EVENT_FIELDS,
  );
}

module.exports = {
  buildAutoDosingEventsCsv,
  buildDosingRunsCsv,
  buildNutrientResponseTestsCsv,
};
