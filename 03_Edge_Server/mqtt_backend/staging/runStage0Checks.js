const assert = require('node:assert/strict');

const mqtt = require('mqtt');
const { MongoClient } = require('mongodb');

const CONFIG = Object.freeze({
  stageName: process.env.STAGING_CHECK_NAME || 'stage0',
  serviceName: process.env.STAGING_SERVICE_NAME || 'hydroponic-stage0-backend',
  mongoUri: process.env.STAGING_MONGO_URI || 'mongodb://127.0.0.1:27018',
  databaseName: process.env.STAGING_DATABASE_NAME || 'hydroponic_stage0',
  mqttUrl: process.env.STAGING_MQTT_URL || 'mqtt://127.0.0.1:18884',
  mqttUsername: process.env.STAGING_MQTT_USERNAME || '',
  mqttPassword: process.env.STAGING_MQTT_PASSWORD || '',
  httpUrl: process.env.STAGING_HTTP_URL || 'http://127.0.0.1:3100',
  sensorTopic: process.env.STAGING_SENSOR_TOPIC || 'stage0/hydroponic/device001/sensor',
  pumpCommandTopic: process.env.STAGING_PUMP_COMMAND_TOPIC || 'stage0/hydroponic/device001/pump/cmd',
});

const DEVICE_ID = 'device001';
const BOOT_A = 'stageboot0001';
const BOOT_B = 'stageboot0002';
const SET_ID = `${CONFIG.stageName}_ec_set`;
const COLLECTIONS = [
  'alerts',
  'auto_dosing_events',
  'auto_dosing_settings',
  'devices',
  'dosing_runs',
  'nutrient_response_tests',
  'pump_calibrations',
  'pump_logs',
  'sensor_logs',
  'shadow_dosing_decisions',
  'tds_calibration_sets',
  'tds_calibrations',
];

function assertIsolatedConfiguration() {
  assert.match(CONFIG.databaseName, /stage/i);
  assert.match(CONFIG.sensorTopic, /^stage\w*\/hydroponic\//);
  assert.match(CONFIG.pumpCommandTopic, /^stage\w*\/hydroponic\//);
  assert.notEqual(new URL(CONFIG.mongoUri).port, '27017');
  assert.notEqual(new URL(CONFIG.mqttUrl).port, '1883');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, description, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

function calibrationPoint(voltage, ecUsCm) {
  return {
    deviceId: DEVICE_ID,
    calibrationSetId: SET_ID,
    measuredRaw: Math.round(voltage * 4095 / 3.3),
    measuredVoltage: voltage,
    measuredVoltage25: voltage,
    referenceEcUsCm: ecUsCm,
    referenceTdsPpm: ecUsCm * 0.5,
    referenceScale: '500',
    tdsFactor: 0.5,
    waterTemp: 25,
    temperatureCompensated: true,
    temperatureReferenceC: 25,
    temperatureAlphaPerC: 0.02,
    temperatureFactorUsed: 1,
    method: 'piecewise_linear_ec',
    legacy: false,
    createdAt: new Date(),
  };
}

function sensorPayload(sequence, bootId = BOOT_A) {
  const sampledAtUptimeMs = sequence * 100;
  return {
    schemaVersion: 2,
    deviceId: DEVICE_ID,
    bootId,
    measurementSeq: sequence,
    measurementId: `${DEVICE_ID}:${bootId}:${sequence}`,
    sampledAtUptimeMs,
    tdsRaw: 1241,
    tdsVoltage: 1,
    tdsMin: 1231,
    tdsMax: 1251,
    tdsSampleCount: 30,
    tdsSpreadRaw: 20,
    tdsWindowStable: true,
    waterTemp: 25,
    waterTempValid: true,
    waterLevel: 'normal',
    pumpMain: true,
    pumpA: false,
    pumpB: false,
    pumpSpare: false,
    ph: null,
    uptimeMs: sampledAtUptimeMs + 1000,
  };
}

async function publish(client, topic, payload) {
  await new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${CONFIG.httpUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

async function seedStage0(database) {
  for (const name of COLLECTIONS) {
    await database.collection(name).deleteMany({});
  }
  const now = new Date();
  await database.collection('devices').insertOne({
    deviceId: DEVICE_ID,
    name: 'Phase 22B Stage 0 Device',
    status: 'staging',
    activeTdsCalibrationSetId: SET_ID,
    latestCalibration: {
      pumpAFlowRateMlPerSec: 2,
      pumpBFlowRateMlPerSec: 1.8,
    },
    createdAt: now,
    updatedAt: now,
  });
  await database.collection('tds_calibration_sets').insertOne({
    deviceId: DEVICE_ID,
    setId: SET_ID,
    status: 'active',
    activeLock: true,
    pointCount: 3,
    validationStatus: 'valid',
    minVoltage25: 0.5,
    maxVoltage25: 1.5,
    minReferenceEcUsCm: 400,
    maxReferenceEcUsCm: 2000,
    createdAt: now,
    updatedAt: now,
  });
  await database.collection('tds_calibrations').insertMany([
    calibrationPoint(0.5, 400),
    calibrationPoint(1, 1000),
    calibrationPoint(1.5, 2000),
  ]);
  await database.collection('auto_dosing_settings').insertOne({
    deviceId: DEVICE_ID,
    mode: 'closed_loop_step',
    enabled: false,
    cropCode: 'cai_ngot',
    targetRangeConfirmed: true,
    targetMinPpm: 800,
    targetMaxPpm: 900,
    stepDoseMlPerPump: 1,
    doseMlPerPump: 1,
    mixingDelayMs: 900000,
    cooldownMs: 900000,
    maxDoseMlPerPumpPerRun: 1,
    maxDailyDoseMlPerPump: 2,
    requireMainPumpOn: true,
    responseEstimatePpmPerMl: 30,
    responseEstimateWorkingLevelLiters: 16,
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  assertIsolatedConfiguration();

  const mongoClient = new MongoClient(CONFIG.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const mqttClient = mqtt.connect(CONFIG.mqttUrl, {
    clientId: `phase22b-${CONFIG.stageName}-check-${process.pid}`,
    clean: true,
    reconnectPeriod: 0,
    connectTimeout: 5000,
    username: CONFIG.mqttUsername || undefined,
    password: CONFIG.mqttPassword || undefined,
  });
  let pumpCommandCount = 0;

  try {
    const health = await waitFor(async () => {
      const result = await fetchJson('/health');
      return result.status === 200
        && result.body.service === CONFIG.serviceName
        && result.body.mongoConnected === true
        && result.body.mqttConnected === true
        ? result.body
        : null;
    }, 'isolated backend health');
    assert.equal(health.ok, true);

    await mongoClient.connect();
    const database = mongoClient.db(CONFIG.databaseName);
    assert.equal(database.databaseName, CONFIG.databaseName);
    await seedStage0(database);

    if (!mqttClient.connected) {
      await new Promise((resolve, reject) => {
        mqttClient.once('connect', resolve);
        mqttClient.once('error', reject);
      });
    }
    await new Promise((resolve, reject) => {
      mqttClient.subscribe(CONFIG.pumpCommandTopic, { qos: 1 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    mqttClient.on('message', (topic) => {
      if (topic === CONFIG.pumpCommandTopic) pumpCommandCount += 1;
    });

    for (const sequence of [1, 2, 3, 4]) {
      const payload = sensorPayload(sequence);
      await publish(mqttClient, CONFIG.sensorTopic, payload);
      await waitFor(
        () => database.collection('sensor_logs').findOne({ measurementId: payload.measurementId }),
        `sensor log ${payload.measurementId}`,
      );
    }

    const stableRow = await database.collection('sensor_logs').findOne({
      measurementId: `${DEVICE_ID}:${BOOT_A}:4`,
    });
    assert.equal(stableRow.telemetryOrderStatus, 'ACCEPTED');
    assert.equal(stableRow.tdsStabilityDistinctMeasurementCount, 3);
    assert.equal(stableRow.tdsStable, true);
    assert.equal(stableRow.tdsControlValid, true);

    const retryPayload = sensorPayload(4);
    await publish(mqttClient, CONFIG.sensorTopic, retryPayload);
    await publish(mqttClient, CONFIG.sensorTopic, retryPayload);
    await waitFor(async () => {
      const row = await database.collection('sensor_logs').findOne({ measurementId: retryPayload.measurementId });
      return row && Array.isArray(row.duplicateReceipts) && row.duplicateReceipts.length === 2 ? row : null;
    }, 'two idempotent duplicate receipts');
    assert.equal(await database.collection('sensor_logs').countDocuments({ measurementId: retryPayload.measurementId }), 1);
    assert.equal(await database.collection('shadow_dosing_decisions').countDocuments({ measurementId: retryPayload.measurementId }), 1);

    await publish(mqttClient, CONFIG.sensorTopic, sensorPayload(6));
    await waitFor(
      () => database.collection('sensor_logs').findOne({ measurementId: `${DEVICE_ID}:${BOOT_A}:6` }),
      'accepted sequence 6',
    );
    await publish(mqttClient, CONFIG.sensorTopic, sensorPayload(5));
    const outOfOrder = await waitFor(
      async () => {
        const row = await database.collection('sensor_logs').findOne({ measurementId: `${DEVICE_ID}:${BOOT_A}:5` });
        return row && row.processingState === 'COMPLETED' ? row : null;
      },
      'out-of-order sequence 5',
    );
    assert.equal(outOfOrder.telemetryOrderStatus, 'OUT_OF_ORDER');
    assert.equal(outOfOrder.controlEligible, false);
    const latestAfterOutOfOrder = await database.collection('devices').findOne({ deviceId: DEVICE_ID });
    assert.equal(latestAfterOutOfOrder.latest.measurementSeq, 6);

    const delayedAnchorAt = new Date(Date.now() - 180000);
    await database.collection('sensor_logs').updateOne(
      { measurementId: `${DEVICE_ID}:${BOOT_A}:6` },
      { $set: { measurementAt: delayedAnchorAt, receivedAt: delayedAnchorAt } },
    );
    await publish(mqttClient, CONFIG.sensorTopic, sensorPayload(7));
    const delayedRow = await waitFor(
      () => database.collection('sensor_logs').findOne({ measurementId: `${DEVICE_ID}:${BOOT_A}:7` }),
      'delayed sequence 7',
    );
    assert.equal(delayedRow.telemetryOrderStatus, 'ACCEPTED');
    assert.equal(delayedRow.measurementFreshnessVerified, true);
    assert.equal(delayedRow.tdsControlValid, false);
    assert.ok(delayedRow.tdsControlInvalidReasons.includes('tds_measurement_stale'));
    assert.equal(delayedRow.tdsStabilityDistinctMeasurementCount, 0);

    await publish(mqttClient, CONFIG.sensorTopic, sensorPayload(1, BOOT_B));
    const bootCandidate = await waitFor(
      async () => {
        const row = await database.collection('sensor_logs').findOne({ measurementId: `${DEVICE_ID}:${BOOT_B}:1` });
        return row && row.processingState === 'COMPLETED' ? row : null;
      },
      'unconfirmed boot transition',
    );
    assert.equal(bootCandidate.telemetryOrderStatus, 'BOOT_TRANSITION_UNCONFIRMED');
    assert.equal(bootCandidate.controlEligible, false);

    await publish(mqttClient, CONFIG.sensorTopic, sensorPayload(2, BOOT_B));
    const bootConfirmed = await waitFor(
      () => database.collection('sensor_logs').findOne({ measurementId: `${DEVICE_ID}:${BOOT_B}:2` }),
      'confirmed boot transition',
    );
    assert.equal(bootConfirmed.telemetryOrderStatus, 'ACCEPTED');
    assert.equal(bootConfirmed.telemetryBootSessionValid, true);
    const device = await database.collection('devices').findOne({ deviceId: DEVICE_ID });
    assert.equal(device.telemetrySession.currentBootId, BOOT_B);
    assert.ok(device.telemetrySession.retiredBootIds.includes(BOOT_A));

    const shadowStatus = await fetchJson(`/api/devices/${DEVICE_ID}/shadow-mode/status`);
    const shadowHistory = await fetchJson(`/api/devices/${DEVICE_ID}/shadow-mode/decisions?limit=20`);
    const latestApi = await fetchJson(`/api/devices/${DEVICE_ID}/latest`);
    const logsApi = await fetchJson(`/api/devices/${DEVICE_ID}/sensor-logs?limit=20`);
    const dashboard = await fetch(`${CONFIG.httpUrl}/`);
    const dashboardHtml = await dashboard.text();
    const dashboardApp = await fetch(`${CONFIG.httpUrl}/app.js`);
    const dashboardAppSource = await dashboardApp.text();
    const dashboardStyles = await fetch(`${CONFIG.httpUrl}/styles.css`);

    assert.equal(shadowStatus.status, 200);
    assert.equal(shadowStatus.body.data.enabled, true);
    assert.equal(shadowStatus.body.data.autoDosing, 'OFF');
    assert.equal(shadowStatus.body.data.autoDosingLockedOff, true);
    assert.equal(shadowHistory.status, 200);
    assert.ok(shadowHistory.body.count >= 7);
    assert.equal(latestApi.status, 200);
    assert.equal(latestApi.body.latest.bootId, BOOT_B);
    assert.equal(logsApi.status, 200);
    assert.equal(logsApi.body.count, 9);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboardApp.status, 200);
    assert.equal(dashboardStyles.status, 200);
    assert.match(dashboardHtml, /Hydroponic/i);
    assert.match(dashboardHtml, /Auto Dosing/i);
    assert.match(dashboardAppSource, /loadDashboard/);

    const pulseAttempt = await fetchJson(`/api/devices/${DEVICE_ID}/pump-command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pump: 'A', action: 'pulse', durationMs: 500, reason: 'manual_test' }),
    });
    const mainAttempt = await fetchJson(`/api/devices/${DEVICE_ID}/pumps/main/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'on', reason: 'manual_test' }),
    });
    assert.equal(pulseAttempt.status, 400);
    assert.equal(pulseAttempt.body.error, 'pump_commands_disabled');
    assert.equal(mainAttempt.status, 400);
    assert.equal(mainAttempt.body.error, 'pump_commands_disabled');

    const autoDosingAttempt = await fetchJson(`/api/devices/${DEVICE_ID}/auto-dosing/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'closed_loop_step',
        enabled: true,
        cropCode: 'cai_ngot',
        targetRangeConfirmed: true,
        targetMinPpm: 800,
        targetMaxPpm: 900,
        stepDoseMlPerPump: 1,
        mixingDelayMs: 900000,
        maxDoseMlPerPumpPerRun: 1,
        maxDailyDoseMlPerPump: 2,
        requireMainPumpOn: true,
        responseEstimatePpmPerMl: 30,
        responseEstimateWorkingLevelLiters: 16,
      }),
    });
    assert.equal(autoDosingAttempt.status, 409);
    assert.equal(autoDosingAttempt.body.error, 'phase22a_auto_dosing_locked_off');

    await delay(500);
    const settings = await database.collection('auto_dosing_settings').findOne({ deviceId: DEVICE_ID });
    const dosingRunCount = await database.collection('dosing_runs').countDocuments({});
    const pumpLogCount = await database.collection('pump_logs').countDocuments({});
    const shadowDecisionCount = await database.collection('shadow_dosing_decisions').countDocuments({});
    assert.equal(settings.enabled, false);
    assert.equal(pumpCommandCount, 0);
    assert.equal(dosingRunCount, 0);
    assert.equal(pumpLogCount, 0);

    const summary = {
      result: 'PASS',
      mongoUri: CONFIG.mongoUri,
      database: CONFIG.databaseName,
      mqttUrl: CONFIG.mqttUrl,
      httpUrl: CONFIG.httpUrl,
      sensorTopic: CONFIG.sensorTopic,
      pumpCommandTopic: CONFIG.pumpCommandTopic,
      sensorLogs: await database.collection('sensor_logs').countDocuments({}),
      shadowDecisions: shadowDecisionCount,
      stableDistinctMeasurements: stableRow.tdsStabilityDistinctMeasurementCount,
      delayedMeasurementReason: 'tds_measurement_stale',
      currentBootId: device.telemetrySession.currentBootId,
      autoDosingEnabled: settings.enabled,
      pumpCommandsObserved: pumpCommandCount,
      dosingRuns: dosingRunCount,
      pumpLogs: pumpLogCount,
      dashboardStatus: dashboard.status,
      dashboardAssetsStatus: [dashboardApp.status, dashboardStyles.status],
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await new Promise((resolve) => mqttClient.end(true, resolve));
    await mongoClient.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Phase 22B ${CONFIG.stageName} check failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
