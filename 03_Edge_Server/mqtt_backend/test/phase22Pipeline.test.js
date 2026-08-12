process.env.NODE_ENV = 'test';
process.env.SHADOW_MODE_ENABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');

const { processTelemetryPayload } = require('../src/services/telemetryPipelineService');
const { saveSensorPayload } = require('../src/services/sensorLogService');
const { getShadowModeStatus, getShadowDecisions } = require('../src/services/shadowDosingService');
const { startHttpServer, closeHttpServer } = require('../src/httpServer');
const { resetMongoForTests, setMongoForTests } = require('../src/mongoClient');
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
      maxDoseMlPerPumpPerRun: 1, maxDailyDoseMlPerPump: 2, requireMainPumpOn: true,
    }],
    sensor_logs: [], shadow_dosing_decisions: [], dosing_runs: [], alerts: [],
  };
}

function payload(seq, overrides = {}) {
  const bootId = overrides.bootId || 'bootpipe01';
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

test.afterEach(async () => {
  await closeHttpServer();
  resetMongoForTests();
});

test('production pipeline reaches stable Shadow eligibility after three distinct measurements', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  const results = [];
  const bootStartedAt = new Date('2026-08-10T01:00:00.000Z');
  for (const seq of [1, 2, 3, 4]) {
    results.push(await processTelemetryPayload(
      payload(seq),
      'sensor/topic',
      new Date(bootStartedAt.getTime() + seq * 30000),
    ));
  }
  assert.equal(results.every((result) => result.telemetry.accepted), true);
  assert.equal(results[3].telemetry.quality.tdsStable, true);
  assert.equal(results[3].shadow.data.decision, 'ELIGIBLE');
  assert.equal(results[3].shadow.data.hypotheticalAction, 'DOSE_STEP');
  assert.equal(database.data.sensor_logs.length, 4);
  assert.equal(database.data.shadow_dosing_decisions.length, 4);
  assert.equal(database.data.dosing_runs.length, 0);
});

test('three retries of one identity create one log and one Shadow decision', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  const row = payload(1);
  const results = await Promise.all([
    processTelemetryPayload(row, 'sensor/topic'),
    processTelemetryPayload(row, 'sensor/topic'),
    processTelemetryPayload(row, 'sensor/topic'),
  ]);
  assert.equal(database.data.sensor_logs.length, 1);
  assert.equal(database.data.shadow_dosing_decisions.length, 1);
  assert.equal(results.filter((result) => result.telemetry.duplicate).length, 2);
  assert.equal(database.data.sensor_logs[0].tdsStabilityDistinctMeasurementCount, 0);
});

test('out-of-order telemetry is audit-only and does not move latest', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  await processTelemetryPayload(payload(1), 'sensor/topic');
  await processTelemetryPayload(payload(3), 'sensor/topic');
  const latestBefore = database.data.devices[0].latest.measurementId;
  const result = await processTelemetryPayload(payload(2), 'sensor/topic');
  assert.equal(result.telemetry.reason, 'OUT_OF_ORDER');
  assert.equal(database.data.devices[0].latest.measurementId, latestBefore);
  assert.equal(database.data.shadow_dosing_decisions.length, 2);
  assert.equal(database.data.sensor_logs.find((row) => row.measurementSeq === 2).controlEligible, false);
});

test('legacy payload is stored but cannot update latest or create Shadow decision', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  const legacy = payload(1);
  for (const field of ['schemaVersion', 'bootId', 'measurementSeq', 'measurementId', 'sampledAtUptimeMs']) delete legacy[field];
  const result = await processTelemetryPayload(legacy, 'sensor/topic');
  assert.equal(result.telemetry.reason, 'LEGACY_NO_IDENTITY');
  assert.equal(database.data.sensor_logs[0].controlEligible, false);
  assert.equal(database.data.devices[0].latest, undefined);
  assert.equal(database.data.shadow_dosing_decisions.length, 0);
});

test('invalid V2 identity is rejected before persistence and Shadow', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  const result = await processTelemetryPayload(payload(1, { measurementId: 'wrong' }), 'sensor/topic');
  assert.equal(result.telemetry.reason, 'validation_failed');
  assert.equal(database.data.sensor_logs.length, 0);
  assert.equal(database.data.shadow_dosing_decisions.length, 0);
});

test('boot transition requires a second increasing packet and rejects retired boot', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  await processTelemetryPayload(payload(1), 'sensor/topic');
  const firstNew = await processTelemetryPayload(payload(1, { bootId: 'bootpipe02' }), 'sensor/topic');
  assert.equal(firstNew.telemetry.reason, 'BOOT_TRANSITION_UNCONFIRMED');
  const confirmed = await processTelemetryPayload(payload(2, { bootId: 'bootpipe02' }), 'sensor/topic');
  assert.equal(confirmed.telemetry.reason, 'ACCEPTED');
  const old = await processTelemetryPayload(payload(3), 'sensor/topic');
  assert.equal(old.telemetry.reason, 'OLD_BOOT_PACKET');
  assert.equal(database.data.devices[0].telemetrySession.currentBootId, 'bootpipe02');
});

test('missing calibration persists a blocked Shadow decision and never a dosing run', async () => {
  const data = seed();
  delete data.devices[0].activeTdsCalibrationSetId;
  data.tds_calibration_sets = [];
  data.tds_calibrations = [];
  const database = new FakeDatabase(data); setMongoForTests(database);
  const result = await processTelemetryPayload(payload(1), 'sensor/topic');
  assert.equal(result.shadow.data.decision, 'INSUFFICIENT_DATA');
  assert.ok(result.shadow.data.reasonCodes.includes('NO_ACTIVE_CALIBRATION'));
  assert.equal(database.data.dosing_runs.length, 0);
});

test('Mongo duplicate-key path returns an idempotent result', async () => {
  const database = new FakeDatabase(seed()); setMongoForTests(database);
  const duplicateError = new Error('duplicate'); duplicateError.code = 11000;
  database.failOn('sensor_logs.insertOne', 1, duplicateError);
  const result = await saveSensorPayload(payload(1), 'sensor/topic');
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(result.idempotent, true);
  assert.equal(database.data.shadow_dosing_decisions.length, 0);
});

test('Shadow status and decisions services expose read-only contracts', async () => {
  const data = seed();
  data.shadow_dosing_decisions.push({
    deviceId: 'device001', measurementId: 'm1', decision: 'BLOCKED', createdAt: new Date(),
  });
  const database = new FakeDatabase(data); setMongoForTests(database);
  const status = await getShadowModeStatus('device001');
  const rows = await getShadowDecisions('device001', 20);
  assert.equal(status.enabled, true);
  assert.equal(status.autoDosing, 'OFF');
  assert.equal(status.autoDosingLockedOff, true);
  assert.equal(rows.length, 1);
});

test('real Express routes return Shadow status and history from fake database', async () => {
  const data = seed();
  data.shadow_dosing_decisions.push({
    deviceId: 'device001', measurementId: 'm1', decision: 'BLOCKED', createdAt: new Date(),
  });
  setMongoForTests(new FakeDatabase(data));
  process.env.HTTP_PORT = '0';
  const server = startHttpServer();
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const [statusResponse, rowsResponse] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/api/devices/device001/shadow-mode/status`),
    fetch(`http://127.0.0.1:${port}/api/devices/device001/shadow-mode/decisions?limit=10`),
  ]);
  const status = await statusResponse.json();
  const rows = await rowsResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(status.data.autoDosing, 'OFF');
  assert.equal(rowsResponse.status, 200);
  assert.equal(rows.count, 1);
});
