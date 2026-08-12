process.env.NODE_ENV = 'test';
process.env.SHADOW_MODE_ENABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resetMongoForTests, setMongoForTests } = require('../src/mongoClient');
const { getDailyDoseUsage } = require('../src/services/autoDosingService');
const { processTelemetryPayload } = require('../src/services/telemetryPipelineService');
const { buildShadowContext } = require('../src/services/shadowDosingService');
const { resolveMeasurementTiming } = require('../src/services/sensorLogService');
const { FakeDatabase } = require('../testSupport/fakeMongo');

function calibrationPoint(voltage, ec) {
  return {
    deviceId: 'device001', calibrationSetId: 'set1', measuredVoltage25: voltage,
    measuredVoltage: voltage, measuredRaw: Math.round(voltage * 4095 / 3.3),
    referenceEcUsCm: ec, referenceTdsPpm: ec * 0.5, referenceScale: '500',
    tdsFactor: 0.5, waterTemp: 25, temperatureCompensated: true,
    temperatureReferenceC: 25, temperatureAlphaPerC: 0.02,
    temperatureFactorUsed: 1, method: 'piecewise_linear_ec',
  };
}

function seed() {
  return {
    devices: [{
      deviceId: 'device001', activeTdsCalibrationSetId: 'set1',
      latestCalibration: { pumpAFlowRateMlPerSec: 2, pumpBFlowRateMlPerSec: 1.8 },
    }],
    tds_calibration_sets: [{
      deviceId: 'device001', setId: 'set1', status: 'active', pointCount: 3,
      validationStatus: 'valid', activeLock: true,
    }],
    tds_calibrations: [
      calibrationPoint(0.5, 400), calibrationPoint(1, 1000), calibrationPoint(1.5, 2000),
    ],
    auto_dosing_settings: [{
      deviceId: 'device001', enabled: false, cropCode: 'cai_ngot', targetRangeConfirmed: true,
      targetMinPpm: 800, targetMaxPpm: 1200, stepDoseMlPerPump: 1,
      maxDoseMlPerPumpPerRun: 2, maxDailyDoseMlPerPump: 4, requireMainPumpOn: true,
    }],
    sensor_logs: [], shadow_dosing_decisions: [], dosing_runs: [],
    auto_dosing_events: [], alerts: [],
  };
}

function payload(seq, overrides = {}) {
  const bootId = overrides.bootId || 'bootfix001';
  return {
    schemaVersion: 2, deviceId: 'device001', bootId, measurementSeq: seq,
    measurementId: `device001:${bootId}:${seq}`, sampledAtUptimeMs: seq * 30000,
    tdsRaw: 1241, tdsVoltage: 1, tdsMin: 1231, tdsMax: 1251,
    tdsSampleCount: 30, tdsSpreadRaw: 20, tdsWindowStable: true,
    waterTemp: 25, waterTempValid: true, waterLevel: 'normal', pumpMain: true,
    pumpA: false, pumpB: false, pumpSpare: false, ph: null, uptimeMs: seq * 30000,
    ...overrides,
  };
}

test.afterEach(() => resetMongoForTests());

test('a delayed same-boot measurement is stale from the uptime anchor, not fresh from receive time', async () => {
  const data = seed();
  const oldReceivedAt = new Date('2026-08-10T01:00:00.000Z');
  data.devices[0].telemetrySession = {
    currentBootId: 'bootfix001', lastAcceptedSeq: 1, candidateBoot: null,
    retiredBootIds: [], revision: 1,
  };
  data.sensor_logs.push({
    ...payload(1), telemetryIdentityValid: true, telemetryDuplicate: false,
    telemetryOrderStatus: 'ACCEPTED', telemetryBootSessionValid: true,
    processingState: 'COMPLETED', measurementFreshnessVerified: true,
    measurementAt: oldReceivedAt, receivedAt: oldReceivedAt, createdAt: oldReceivedAt,
  });
  const database = new FakeDatabase(data); setMongoForTests(database);
  const retryReceivedAt = new Date('2026-08-10T04:00:00.000Z');

  const result = await processTelemetryPayload(payload(2), 'sensor/topic', retryReceivedAt);

  assert.equal(result.telemetry.accepted, true);
  assert.equal(result.telemetry.quality.tdsControlValid, false);
  assert.equal(result.telemetry.quality.tdsStabilityDistinctMeasurementCount, 0);
  assert.ok(result.telemetry.quality.tdsControlInvalidReasons.includes('tds_measurement_stale'));
  assert.equal(result.shadow.data.gates.find((gate) => gate.code === 'MEASUREMENT_FRESH').status, 'BLOCKED');
});

test('freshness timing handles the ESP32 millis rollover inside one boot', async () => {
  const anchorAt = new Date('2026-08-10T01:00:00.000Z');
  const data = seed();
  data.sensor_logs.push({
    deviceId: 'device001', bootId: 'bootfix001', measurementSeq: 10,
    measurementId: 'device001:bootfix001:10', sampledAtUptimeMs: 0xFFFFFF00,
    telemetryIdentityValid: true, measurementAt: anchorAt, receivedAt: anchorAt,
  });
  const database = new FakeDatabase(data); setMongoForTests(database);
  const now = new Date(anchorAt.getTime() + 768);

  const timing = await resolveMeasurementTiming(database, {
    deviceId: 'device001', bootId: 'bootfix001', measurementSeq: 11,
    measurementId: 'device001:bootfix001:11', sampledAtUptimeMs: 512,
  }, now);

  assert.equal(timing.measurementFreshnessVerified, true);
  assert.equal(timing.measurementAt.getTime(), now.getTime());
  assert.equal(timing.measurementAgeAtReceiptMs, 0);
});

test('a failed PROCESSING row is resumed on retry instead of being trapped as a duplicate', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  database.failOn('tds_calibration_sets.findOne', 1, new Error('injected calibration read failure'));
  const now = new Date('2026-08-10T01:00:00.000Z');

  await assert.rejects(processTelemetryPayload(payload(1), 'sensor/topic', now));
  assert.equal(database.data.sensor_logs.length, 1);
  assert.equal(database.data.sensor_logs[0].processingState, 'FAILED');

  const retried = await processTelemetryPayload(payload(1), 'sensor/topic', new Date(now.getTime() + 1000));

  assert.equal(retried.telemetry.accepted, true);
  assert.equal(retried.telemetry.duplicate, undefined);
  assert.equal(database.data.sensor_logs.length, 1);
  assert.equal(database.data.sensor_logs[0].processingState, 'COMPLETED');
});

test('a pre-Fix-1 stuck PROCESSING row can be claimed and completed safely', async () => {
  const data = seed();
  const row = payload(1);
  data.devices[0].telemetrySession = {
    currentBootId: row.bootId, lastAcceptedSeq: row.measurementSeq,
    candidateBoot: null, retiredBootIds: [], revision: 1,
  };
  data.sensor_logs.push({
    ...row,
    telemetryIdentityValid: true,
    telemetryDuplicate: false,
    telemetryOrderStatus: 'PROCESSING',
    telemetryBootSessionValid: false,
    controlEligible: false,
    receivedAt: new Date('2026-08-10T01:00:00.000Z'),
    measurementAt: new Date('2026-08-10T01:00:00.000Z'),
    createdAt: new Date('2026-08-10T01:00:00.000Z'),
  });
  const database = new FakeDatabase(data); setMongoForTests(database);

  const result = await processTelemetryPayload(row, 'sensor/topic', new Date('2026-08-10T01:01:00.000Z'));

  assert.equal(result.telemetry.accepted, true);
  assert.equal(database.data.sensor_logs.length, 1);
  assert.equal(database.data.sensor_logs[0].processingState, 'COMPLETED');
  assert.equal(database.data.sensor_logs[0].telemetryOrderStatus, 'ACCEPTED');
});

test('two concurrent retries cannot both claim an expired PROCESSING row', async () => {
  const data = seed();
  const row = payload(2);
  const now = new Date('2026-08-10T04:00:00.000Z');
  data.devices[0].telemetrySession = {
    currentBootId: row.bootId, lastAcceptedSeq: row.measurementSeq,
    candidateBoot: null, retiredBootIds: [], revision: 1,
  };
  data.sensor_logs.push({
    ...row,
    telemetryIdentityValid: true,
    telemetryDuplicate: false,
    telemetryOrderStatus: 'ACCEPTED',
    telemetryBootSessionValid: true,
    processingState: 'PROCESSING',
    processingStage: 'ORDER_CLASSIFIED',
    processingAttempt: 1,
    processingLeaseUntil: new Date(now.getTime() - 1),
    receivedAt: new Date('2026-08-10T03:00:00.000Z'),
    createdAt: new Date('2026-08-10T03:00:00.000Z'),
  });
  const database = new FakeDatabase(data); setMongoForTests(database);

  const results = await Promise.all([
    processTelemetryPayload(row, 'sensor/topic', now),
    processTelemetryPayload(row, 'sensor/topic', now),
  ]);

  assert.equal(results.filter((result) => result.telemetry.accepted === true).length, 1);
  assert.equal(results.filter((result) => result.telemetry.duplicate === true).length, 1);
  assert.equal(database.data.sensor_logs.length, 1);
  assert.equal(database.data.shadow_dosing_decisions.length, 1);
  assert.equal(database.data.dosing_runs.length, 0);
  assert.equal(database.data.sensor_logs[0].processingAttempt, 2);
  assert.equal(database.data.sensor_logs[0].processingState, 'COMPLETED');
});

test('Shadow daily dose uses the same reset window and active-run accounting as Phase 21', async () => {
  const data = seed();
  const now = new Date('2026-08-10T12:00:00.000Z');
  const resetAt = new Date('2026-08-10T10:00:00.000Z');
  data.auto_dosing_events.push({ deviceId: 'device001', eventType: 'manual_daily_reset', createdAt: resetAt });
  data.dosing_runs.push(
    { deviceId: 'device001', status: 'completed', doseMlPerPump: 1, createdAt: new Date('2026-08-10T09:00:00.000Z') },
    { deviceId: 'device001', status: 'in_progress', stepDoseMlPerPump: 1.5, createdAt: new Date('2026-08-10T11:00:00.000Z') },
  );
  data.devices[0].latest = { receivedAt: now, measurementAt: now };
  const database = new FakeDatabase(data); setMongoForTests(database);
  const telemetryResult = {
    identity: {
      schemaVersion: 2, telemetryIdentityValid: true, telemetryDuplicate: false,
      telemetryOrderStatus: 'ACCEPTED', telemetryBootSessionValid: true,
    },
  };

  const [usage, context] = await Promise.all([
    getDailyDoseUsage('device001', now),
    buildShadowContext('device001', telemetryResult, now),
  ]);

  assert.equal(usage.dailyDoseUsedMlPerPump, 1.5);
  assert.equal(context.dailyDoseUsedMlPerPump, usage.dailyDoseUsedMlPerPump);
});
