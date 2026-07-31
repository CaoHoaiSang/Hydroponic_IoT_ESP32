const crypto = require('crypto');

const { getDb } = require('../mongoClient');
const { validateNutrientResponseTest } = require('../validators/nutrientResponseTestValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PRELIMINARY_RESPONSE_RANGE = {
  min: 20,
  max: 40,
  unit: 'ppm per 1 ml A + 1 ml B pair at 16L',
};

function createTestId() {
  return `nutrient_response_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function average(values) {
  const numericValues = Array.isArray(values)
    ? values.filter((value) => typeof value === 'number' && Number.isFinite(value))
    : [];

  if (numericValues.length === 0) {
    return null;
  }

  const sum = numericValues.reduce((total, value) => total + value, 0);
  return Number((sum / numericValues.length).toFixed(2));
}

function subtractNullable(after, before) {
  if (
    typeof after !== 'number'
    || !Number.isFinite(after)
    || typeof before !== 'number'
    || !Number.isFinite(before)
  ) {
    return null;
  }

  return Number((after - before).toFixed(2));
}

function calculateResponseEstimate(result, dose) {
  const pairDoseMl = (dose.pumpAMl + dose.pumpBml) / 2;

  if (!Number.isFinite(pairDoseMl) || pairDoseMl <= 0) {
    return null;
  }

  const delta = [result.deltaDashboard, result.deltaPenMain, result.deltaPenSecondary]
    .find((value) => typeof value === 'number' && Number.isFinite(value));

  if (typeof delta !== 'number') {
    return null;
  }

  return Number((delta / pairDoseMl).toFixed(2));
}

function calculateDerivedFields(test) {
  const beforeDashboardAverage = average(test.before.dashboardValues);
  const after15DashboardAverage = average(test.after15min.dashboardValues);
  const result = {
    ...test.result,
    deltaDashboard: subtractNullable(after15DashboardAverage, beforeDashboardAverage),
    deltaPenMain: subtractNullable(test.after15min.penMainPpm, test.before.penMainPpm),
    deltaPenSecondary: subtractNullable(test.after15min.penSecondaryPpm, test.before.penSecondaryPpm),
  };

  result.estimatedResponsePpmPerMl = calculateResponseEstimate(result, test.dose);

  return {
    ...test,
    before: {
      ...test.before,
      dashboardAverage: beforeDashboardAverage,
    },
    after15min: {
      ...test.after15min,
      dashboardAverage: after15DashboardAverage,
    },
    result,
  };
}

async function saveNutrientResponseTest(deviceId, body) {
  const validation = validateNutrientResponseTest(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  const database = getDb();
  const now = new Date();
  const test = calculateDerivedFields({
    testId: createTestId(),
    ...validation.value,
    createdAt: now,
  });

  await database.collection('nutrient_response_tests').insertOne(test);

  return {
    ok: true,
    data: test,
  };
}

async function getNutrientResponseTests(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_LIMIT, MAX_LIMIT);

  return database
    .collection('nutrient_response_tests')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function getLatestNutrientResponseTest(deviceId) {
  const database = getDb();

  return database
    .collection('nutrient_response_tests')
    .findOne({ deviceId }, { sort: { createdAt: -1 } });
}

function averageNullable(values) {
  return average(values.filter((value) => typeof value === 'number' && Number.isFinite(value)));
}

async function getNutrientResponseSummary(deviceId) {
  const tests = await getNutrientResponseTests(deviceId, MAX_LIMIT);
  const deltaDashboardValues = tests.map((test) => test.result && test.result.deltaDashboard);
  const deltaPenMainValues = tests.map((test) => test.result && test.result.deltaPenMain);
  const deltaPenSecondaryValues = tests.map((test) => test.result && test.result.deltaPenSecondary);
  const responseValues = tests
    .map((test) => test.result && test.result.estimatedResponsePpmPerMl)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const recommendedResponseEstimateRange = responseValues.length > 0
    ? {
        min: Number(Math.min(...responseValues).toFixed(2)),
        max: Number(Math.max(...responseValues).toFixed(2)),
        unit: 'ppm per 1 ml A + 1 ml B pair',
        source: 'saved_tests',
      }
    : {
        ...PRELIMINARY_RESPONSE_RANGE,
        source: 'preliminary_tests_2_to_4',
      };

  return {
    deviceId,
    count: tests.length,
    averageDeltaDashboard: averageNullable(deltaDashboardValues),
    averageDeltaPenMain: averageNullable(deltaPenMainValues),
    averageDeltaPenSecondary: averageNullable(deltaPenSecondaryValues),
    averageResponseEstimatePpmPerMl: averageNullable(responseValues),
    recommendedResponseEstimateRange,
    preliminaryNote: 'At 16L with TDS sensor 5V, main pump ON, Auto Dosing OFF, 1 ml A + 1 ml B produced about +20 to +40 ppm after 15 minutes mixing.',
  };
}

module.exports = {
  saveNutrientResponseTest,
  getNutrientResponseTests,
  getLatestNutrientResponseTest,
  getNutrientResponseSummary,
};
