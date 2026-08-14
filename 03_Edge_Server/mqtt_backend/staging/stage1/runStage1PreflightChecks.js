const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const mqtt = require('mqtt');

const RUNTIME = path.join(__dirname, '.stage1_runtime');
function readRuntimeJson(fileName) {
  return JSON.parse(fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, ''));
}

const state = readRuntimeJson(path.join(RUNTIME, 'processes.json'));
const credentials = readRuntimeJson(path.join(RUNTIME, 'secrets', 'credentials.json'));
const TOPICS = Object.freeze({
  sensor: 'stage1/hydroponic/device001/sensor',
  pumpCommand: 'stage1/hydroponic/device001/pump/cmd',
  pumpStatus: 'stage1/hydroponic/device001/pump/status',
});

function connect(options) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(state.MqttLanUrl, { reconnectPeriod: 0, connectTimeout: 3000, ...options });
    client.once('connect', () => resolve(client));
    client.once('error', reject);
  });
}

function close(client) {
  return new Promise((resolve) => client.end(true, resolve));
}

async function assertAnonymousRejected() {
  await new Promise((resolve, reject) => {
    const client = mqtt.connect(state.MqttLanUrl, { reconnectPeriod: 0, connectTimeout: 2000 });
    let connected = false;
    client.once('connect', () => { connected = true; client.end(true); reject(new Error('Anonymous MQTT connection was accepted')); });
    client.once('error', () => { if (!connected) { client.end(true); resolve(); } });
    setTimeout(() => { client.end(true); connected ? reject(new Error('Anonymous connection unexpectedly connected')) : resolve(); }, 2500);
  });
}

async function assertTcpReachable(host, port) {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(2000);
    socket.once('connect', () => { socket.destroy(); resolve(); });
    socket.once('timeout', () => { socket.destroy(); reject(new Error(`Timeout reaching ${host}:${port}`)); });
    socket.once('error', reject);
  });
}

async function assertAclAndZeroCommandDelivery() {
  const auditor = await connect({ username: credentials.auditor.username, password: credentials.auditor.password });
  const device = await connect({ username: credentials.device.username, password: credentials.device.password });
  const backend = await connect({ username: credentials.backend.username, password: credentials.backend.password });
  let commandCount = 0;
  try {
    await new Promise((resolve, reject) => auditor.subscribe(TOPICS.pumpCommand, { qos: 1 }, (error) => error ? reject(error) : resolve()));
    auditor.on('message', (topic) => { if (topic === TOPICS.pumpCommand) commandCount += 1; });

    // Mosquitto 2.x may acknowledge the filter and enforce read ACL at delivery time.
    await new Promise((resolve, reject) => device.subscribe(TOPICS.pumpCommand, { qos: 1 }, (error) => error ? reject(error) : resolve()));

    const forbiddenPayload = JSON.stringify({ commandId: 'must_not_deliver', deviceId: 'device001', pump: 'A', action: 'pulse', durationMs: 500 });
    device.publish(TOPICS.pumpCommand, forbiddenPayload, { qos: 1 });
    backend.publish(TOPICS.pumpCommand, forbiddenPayload, { qos: 1 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(commandCount, 0);
  } finally {
    await Promise.all([close(auditor), close(device), close(backend)]);
  }
  return commandCount;
}

function assertTopicParityAndSafetyFiles() {
  const projectRoot = path.resolve(__dirname, '../../../..');
  const firmwareDir = path.join(projectRoot, '02_ESP32_Main_Firmware', 'Hydroponic_Device001');
  const config = fs.readFileSync(path.join(firmwareDir, 'Config.h'), 'utf8');
  const profile = fs.readFileSync(path.join(firmwareDir, 'BuildProfile.h'), 'utf8');
  const mqttSource = fs.readFileSync(path.join(firmwareDir, 'MqttService.cpp'), 'utf8');
  const pumpsSource = fs.readFileSync(path.join(firmwareDir, 'Pumps.cpp'), 'utf8');
  const firmware = fs.readFileSync(path.join(firmwareDir, 'Hydroponic_Device001.ino'), 'utf8');
  const acl = fs.readFileSync(path.join(RUNTIME, 'mosquitto.stage1.acl'), 'utf8');
  const brokerConfig = fs.readFileSync(path.join(RUNTIME, 'mosquitto.stage1.conf'), 'utf8');

  for (const topic of Object.values(TOPICS)) assert.ok(config.includes(`\"${topic}\"`), `Firmware topic missing: ${topic}`);
  assert.match(profile, /ACTUATORS_LOCKED = true/);
  assert.match(profile, /MQTT_PUMP_COMMANDS_ENABLED = false/);
  assert.match(mqttSource, /if \(MQTT_PUMP_COMMANDS_ENABLED\)/);
  assert.equal((mqttSource.match(/WiFi\.begin\(/g) || []).length, 1);
  assert.match(mqttSource, /WiFi\.setAutoReconnect\(true\)/);
  assert.match(mqttSource, /WiFi\.disconnect\(false, false\)/);
  assert.match(mqttSource, /WIFI_RETRY_SETTLE_MS/);
  assert.match(mqttSource, /wifi_sta_disconnected\.reason/);
  assert.match(config, /WIFI_RECONNECT_INTERVAL_MS = 30000/);
  assert.match(pumpsSource, /mainPumpEffectiveState/);
  assert.match(pumpsSource, /nutrientPumpEffectiveState/);
  assert.match(pumpsSource, /spareEffectiveState/);
  assert.match(pumpsSource, /enforceActuatorSafetyLock/);
  assert.match(firmware, /!SERIAL_ACTUATOR_COMMANDS_ENABLED && isSerialActuatorCommand/);
  assert.match(firmware, /if \(ACTUATORS_LOCKED\)[\s\S]*enforceActuatorSafetyLock\(\)/);
  assert.match(firmware, /if \(!MQTT_PUMP_COMMANDS_ENABLED\)/);
  assert.doesNotMatch(acl, /topic\s+write\s+stage1\/hydroponic\/device001\/pump\/cmd/);
  assert.match(brokerConfig, /allow_anonymous false/);
  assert.doesNotMatch(brokerConfig, /listener\s+\d+\s+(0\.0\.0\.0|::)/);
}

async function main() {
  assert.match(state.LanAddress, /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/);
  assert.equal(state.Authentication, true);
  assert.equal(state.PumpCommandsDisabled, true);
  assert.notEqual(new URL(state.MongoUri).port, '27017');
  assert.notEqual(new URL(state.MqttLanUrl).port, '1883');
  assertTopicParityAndSafetyFiles();
  await assertTcpReachable('127.0.0.1', 18885);
  await assertTcpReachable(state.LanAddress, 18885);
  await assertAnonymousRejected();
  const forbiddenPumpCommandsDelivered = await assertAclAndZeroCommandDelivery();

  process.env.STAGING_CHECK_NAME = 'stage1';
  process.env.STAGING_SERVICE_NAME = 'hydroponic-stage1-preflight-backend';
  process.env.STAGING_MONGO_URI = state.MongoUri;
  process.env.STAGING_DATABASE_NAME = state.Database;
  process.env.STAGING_MQTT_URL = state.MqttLanUrl;
  process.env.STAGING_MQTT_USERNAME = credentials.auditor.username;
  process.env.STAGING_MQTT_PASSWORD = credentials.auditor.password;
  process.env.STAGING_HTTP_URL = state.HttpUrl;
  process.env.STAGING_SENSOR_TOPIC = TOPICS.sensor;
  process.env.STAGING_PUMP_COMMAND_TOPIC = TOPICS.pumpCommand;

  const { main: runIntegrationChecks } = require('../runStage0Checks');
  await runIntegrationChecks();
  console.log(JSON.stringify({
    result: 'PASS',
    lanMqttEndpoint: state.MqttLanUrl,
    loopbackMqttEndpoint: state.MqttLoopbackUrl,
    database: state.Database,
    httpUrl: state.HttpUrl,
    topics: TOPICS,
    anonymousRejected: true,
    devicePumpCommandDeliveryDenied: true,
    forbiddenPumpCommandsDelivered,
    firmwareActuatorLockContract: 'PASS',
    productionEndpointsAccessed: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(`Phase 22B Stage 1 preflight check failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
