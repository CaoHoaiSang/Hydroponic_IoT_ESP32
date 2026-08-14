const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const mqtt = require('mqtt');
const { MongoClient } = require('mongodb');

const DEVICE_ID = 'device001';
const DURATION_MS = 1000;
const COMMAND_TOPIC = 'stage1/hydroponic/device001/pump/cmd';
const STATUS_TOPIC = 'stage1/hydroponic/device001/pump/status';
const API_ROOT = 'http://127.0.0.1:3101';
const MONGO_URL = 'mongodb://127.0.0.1:27019';
const DATABASE_NAME = 'hydroponic_stage1_preflight';
const runtimeRoot = path.join(__dirname, '.stage1_runtime');
const secretsRoot = path.join(runtimeRoot, 'secrets');

function readRuntimeJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

async function getJson(relativePath) {
  const response = await fetch(`${API_ROOT}${relativePath}`);
  if (!response.ok) throw new Error(`GET ${relativePath} failed with HTTP ${response.status}`);
  return response.json();
}

function connectMqtt(url, credentials) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(url, {
      username: credentials.username,
      password: credentials.password,
      reconnectPeriod: 0,
      connectTimeout: 3000,
    });
    client.once('connect', () => resolve(client));
    client.once('error', reject);
  });
}

function closeMqtt(client) {
  return new Promise((resolve) => client.end(true, resolve));
}

async function main() {
  const armPath = path.join(secretsRoot, 'stage2-main-pump-arm.json');
  const verificationPath = path.join(secretsRoot, 'stage2-firmware-verified.json');
  if (!fs.existsSync(armPath)) throw new Error('One-shot arm token is missing.');
  if (!fs.existsSync(verificationPath)) throw new Error('Verified Stage 2 firmware marker is missing.');

  const arm = readRuntimeJson(armPath);
  const verification = readRuntimeJson(verificationPath);
  if (arm.scope !== 'STAGE2_MAIN_PUMP_SINGLE_PULSE' || arm.deviceId !== DEVICE_ID || arm.durationMs !== DURATION_MS) {
    throw new Error('One-shot arm token is invalid.');
  }
  if (Date.parse(arm.expiresAtUtc) <= Date.now()) throw new Error('One-shot arm token has expired.');
  if (verification.profile !== 'USB_STAGE2_MAIN_PUMP' || Date.parse(verification.expiresAtUtc) <= Date.now()) {
    throw new Error('Stage 2 firmware verification is invalid or expired.');
  }

  const state = readRuntimeJson(path.join(runtimeRoot, 'processes.json'));
  const credentials = readRuntimeJson(path.join(secretsRoot, 'credentials.json'));
  if (state.Stage2MainPumpOperatorPrepared !== true || !credentials.operator) {
    throw new Error('Stage 2 operator runtime is not prepared.');
  }

  const [latestResponse, settingsResponse, activeRunResponse] = await Promise.all([
    getJson(`/api/devices/${DEVICE_ID}/latest`),
    getJson(`/api/devices/${DEVICE_ID}/auto-dosing/settings`),
    getJson(`/api/devices/${DEVICE_ID}/auto-dosing/active-run`),
  ]);
  const latest = latestResponse.latest || {};
  const settings = settingsResponse.data || {};
  if (latest.waterLevel !== 'normal' || latest.waterTempValid !== true) {
    throw new Error('Water-level or temperature interlock is not ready.');
  }
  if (latest.pumpMain !== false || latest.pumpA !== false || latest.pumpB !== false) {
    throw new Error('A pump is already reported ON.');
  }
  if (settings.enabled !== false || settings.phase22LockedOff !== true || activeRunResponse.data !== null) {
    throw new Error('Auto Dosing safety state is not locked OFF.');
  }

  const mongo = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
  await mongo.connect();
  const database = mongo.db(DATABASE_NAME);
  const dosingRunsBefore = await database.collection('dosing_runs').countDocuments({});
  if (dosingRunsBefore !== 0) {
    await mongo.close();
    throw new Error('dosing_runs is not empty; refusing the isolated first pulse.');
  }

  const commandId = `stage2_main_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const statuses = [];
  let auditor;
  let operator;
  try {
    auditor = await connectMqtt(state.MqttLoopbackUrl, credentials.auditor);
    operator = await connectMqtt(state.MqttLoopbackUrl, credentials.operator);
    await new Promise((resolve, reject) => auditor.subscribe(STATUS_TOPIC, { qos: 1 }, (error) => (
      error ? reject(error) : resolve()
    )));

    const completion = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for completed pump status.')), 15_000);
      auditor.on('message', (topic, message) => {
        if (topic !== STATUS_TOPIC) return;
        let payload;
        try { payload = JSON.parse(message.toString()); } catch { return; }
        if (payload.commandId !== commandId) return;
        statuses.push(payload);
        if (payload.status === 'rejected' || payload.status === 'failed') {
          clearTimeout(timeout);
          reject(new Error(`Firmware rejected the one-shot command: ${payload.message || payload.status}`));
        }
        if (payload.status === 'completed') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Consume the token before publishing so this process cannot retry an actuator command.
    fs.rmSync(armPath, { force: true });
    const command = {
      commandId,
      deviceId: DEVICE_ID,
      pump: 'main',
      action: 'pulse',
      durationMs: DURATION_MS,
      reason: 'supervised_stage2_main_pump_test',
      source: 'stage2_one_shot_operator',
      createdAt: new Date().toISOString(),
    };
    await new Promise((resolve, reject) => operator.publish(
      COMMAND_TOPIC,
      JSON.stringify(command),
      { qos: 1 },
      (error) => (error ? reject(error) : resolve()),
    ));
    await completion;
    await new Promise((resolve) => setTimeout(resolve, 750));

    const [matchingLogs, dosingRunsAfter] = await Promise.all([
      database.collection('pump_logs').countDocuments({ commandId }),
      database.collection('dosing_runs').countDocuments({}),
    ]);
    if (!statuses.some((row) => row.status === 'started') ||
        !statuses.some((row) => row.status === 'completed')) {
      throw new Error('Expected started and completed statuses were not both observed.');
    }
    if (dosingRunsAfter !== dosingRunsBefore) throw new Error('A dosing run appeared during manual pulse test.');

    console.log(JSON.stringify({
      result: 'PASS',
      commandId,
      pump: 'main',
      action: 'pulse',
      durationMs: DURATION_MS,
      statuses: statuses.map((row) => row.status),
      matchingPumpLogs: matchingLogs,
      dosingRunsBefore,
      dosingRunsAfter,
      armTokenConsumed: !fs.existsSync(armPath),
    }, null, 2));
  } finally {
    await Promise.all([
      auditor ? closeMqtt(auditor) : Promise.resolve(),
      operator ? closeMqtt(operator) : Promise.resolve(),
    ]);
    await mongo.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
});
