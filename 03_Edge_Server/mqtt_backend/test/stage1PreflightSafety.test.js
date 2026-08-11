process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '../../..');
const firmwareDir = path.join(projectRoot, '02_ESP32_Main_Firmware', 'Hydroponic_Device001');
const stage1Dir = path.join(__dirname, '..', 'staging', 'stage1');

test('USB Stage 1 topics match backend staging topics', () => {
  const config = fs.readFileSync(path.join(firmwareDir, 'Config.h'), 'utf8');
  const envExample = fs.readFileSync(path.join(stage1Dir, '.env.stage1.example'), 'utf8');
  for (const topic of [
    'stage1/hydroponic/device001/sensor',
    'stage1/hydroponic/device001/pump/cmd',
    'stage1/hydroponic/device001/pump/status',
    'stage1/hydroponic/device001/alert',
  ]) {
    assert.ok(config.includes(topic));
    assert.ok(envExample.includes(topic));
  }
});

test('USB Stage 1 alert topic is reserved and unused', () => {
  const config = fs.readFileSync(path.join(firmwareDir, 'Config.h'), 'utf8');
  const mqttService = fs.readFileSync(path.join(firmwareDir, 'MqttService.cpp'), 'utf8');
  const stageReadme = fs.readFileSync(path.join(stage1Dir, 'README.md'), 'utf8');
  assert.match(config, /Reserved identity only/);
  assert.doesNotMatch(mqttService, /publish\(MQTT_TOPIC_ALERT|subscribe\(MQTT_TOPIC_ALERT/);
  assert.match(stageReadme, /RESERVED\/UNUSED/);
});

test('Stage 1 broker template requires authentication and has no wildcard bind', () => {
  const broker = fs.readFileSync(path.join(stage1Dir, 'mosquitto.stage1.conf.example'), 'utf8');
  assert.match(broker, /allow_anonymous false/);
  assert.match(broker, /listener 18885 127\.0\.0\.1/);
  assert.match(broker, /listener 18885 PRIVATE_LAN_IPV4/);
  assert.doesNotMatch(broker, /0\.0\.0\.0|listener\s+\d+\s+::/);
});

test('firmware source contains independent subscription, Serial, local, and GPIO locks', () => {
  const profile = fs.readFileSync(path.join(firmwareDir, 'BuildProfile.h'), 'utf8');
  const mqttService = fs.readFileSync(path.join(firmwareDir, 'MqttService.cpp'), 'utf8');
  const pumps = fs.readFileSync(path.join(firmwareDir, 'Pumps.cpp'), 'utf8');
  const firmware = fs.readFileSync(path.join(firmwareDir, 'Hydroponic_Device001.ino'), 'utf8');
  assert.match(profile, /ACTUATORS_LOCKED = true/);
  assert.match(profile, /MQTT_PUMP_COMMANDS_ENABLED = false/);
  assert.match(mqttService, /if \(MQTT_PUMP_COMMANDS_ENABLED\)/);
  assert.match(firmware, /ACTUATORS_LOCKED && isSerialActuatorCommand/);
  assert.match(firmware, /if \(ACTUATORS_LOCKED\)[\s\S]*enforceActuatorSafetyLock\(\)/);
  assert.match(pumps, /actuatorEffectiveState\(on\)/);
  assert.match(pumps, /writePumpOutput\(PIN_PUMP_MAIN, false\)/);
  assert.match(pumps, /writePumpOutput\(PIN_PUMP_A, false\)/);
  assert.match(pumps, /writePumpOutput\(PIN_PUMP_B, false\)/);
});

test('Stage 1 actuator lock executes in a native host harness', (t) => {
  const compiler = spawnSync('g++', ['--version'], { encoding: 'utf8' });
  if (compiler.status !== 0) { t.skip('g++ is unavailable'); return; }
  const fixture = path.join(__dirname, 'fixtures', 'stage1_actuator_lock_host_test.cpp');
  const executable = path.join(os.tmpdir(), `stage1-actuator-lock-${process.pid}.exe`);
  const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', firmwareDir, fixture, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const run = spawnSync(executable, [], { encoding: 'utf8' });
  fs.rmSync(executable, { force: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('backend retains both pump command locks', () => {
  const mqttClient = fs.readFileSync(path.join(__dirname, '..', 'src', 'mqttClient.js'), 'utf8');
  const pumpService = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'pumpCommandService.js'), 'utf8');
  assert.match(mqttClient, /PUMP_COMMANDS_DISABLED/);
  assert.match(mqttClient, /Pump command publishing is disabled/);
  assert.match(pumpService, /pumpCommandsDisabled\(\)/);
  assert.match(pumpService, /pump_commands_disabled/);
});
