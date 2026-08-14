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
  assert.match(firmware, /!SERIAL_ACTUATOR_COMMANDS_ENABLED && isSerialActuatorCommand/);
  assert.match(firmware, /if \(ACTUATORS_LOCKED\)[\s\S]*enforceActuatorSafetyLock\(\)/);
  assert.match(pumps, /mainPumpEffectiveState\(on\)/);
  assert.match(pumps, /nutrientPumpEffectiveState\(on\)/);
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

test('Stage 2 profile permits only bounded main-pump actuation in a native host harness', (t) => {
  const compiler = spawnSync('g++', ['--version'], { encoding: 'utf8' });
  if (compiler.status !== 0) { t.skip('g++ is unavailable'); return; }
  const fixture = path.join(__dirname, 'fixtures', 'stage2_main_pump_lock_host_test.cpp');
  const executable = path.join(os.tmpdir(), `stage2-main-pump-lock-${process.pid}.exe`);
  const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', firmwareDir, fixture, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const run = spawnSync(executable, [], { encoding: 'utf8' });
  fs.rmSync(executable, { force: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('Stage 3 profile permits only bounded nutrient-pump actuation in a native host harness', (t) => {
  const compiler = spawnSync('g++', ['--version'], { encoding: 'utf8' });
  if (compiler.status !== 0) { t.skip('g++ is unavailable'); return; }
  const fixture = path.join(__dirname, 'fixtures', 'stage3_nutrient_pump_lock_host_test.cpp');
  const executable = path.join(os.tmpdir(), `stage3-nutrient-pump-lock-${process.pid}.exe`);
  const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', firmwareDir, fixture, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const run = spawnSync(executable, [], { encoding: 'utf8' });
  fs.rmSync(executable, { force: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('Stage 2 firmware rejects set, nutrient pumps, Serial ON, and pulses above 3000 ms', () => {
  const profile = fs.readFileSync(path.join(firmwareDir, 'BuildProfile.h'), 'utf8');
  const firmware = fs.readFileSync(path.join(firmwareDir, 'Hydroponic_Device001.ino'), 'utf8');
  const pumps = fs.readFileSync(path.join(firmwareDir, 'Pumps.cpp'), 'utf8');
  assert.match(profile, /USB_STAGE2_MAIN_PUMP[\s\S]*?MAIN_PUMP_ACTUATION_ENABLED = true/);
  assert.match(profile, /USB_STAGE2_MAIN_PUMP[\s\S]*?NUTRIENT_PUMP_ACTUATION_ENABLED = false/);
  assert.match(profile, /USB_STAGE2_MAIN_PUMP[\s\S]*?MAIN_PUMP_CONTINUOUS_ENABLED = false/);
  assert.match(profile, /USB_STAGE2_MAIN_PUMP[\s\S]*?PROFILE_MAIN_PUMP_MAX_DURATION_MS = 3000/);
  assert.match(firmware, /continuous main pump control is disabled by build profile/);
  assert.match(firmware, /pump is disabled by build profile/);
  assert.match(firmware, /!SERIAL_ACTUATOR_COMMANDS_ENABLED && isSerialActuatorCommand/);
  assert.match(pumps, /nutrientPumpEffectiveState\(on\)/);
  assert.match(pumps, /writePumpOutput\(PIN_PUMP_A, false\)/);
  assert.match(pumps, /writePumpOutput\(PIN_PUMP_B, false\)/);
});

test('Stage 3 firmware locks Main Pump and bounds Pump A/B pulses to 1000 ms', () => {
  const profile = fs.readFileSync(path.join(firmwareDir, 'BuildProfile.h'), 'utf8');
  const config = fs.readFileSync(path.join(firmwareDir, 'Config.h'), 'utf8');
  const mqttService = fs.readFileSync(path.join(firmwareDir, 'MqttService.cpp'), 'utf8');
  const firmware = fs.readFileSync(path.join(firmwareDir, 'Hydroponic_Device001.ino'), 'utf8');
  assert.match(profile, /USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?MAIN_PUMP_ACTUATION_ENABLED = false/);
  assert.match(profile, /USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?NUTRIENT_PUMP_ACTUATION_ENABLED = true/);
  assert.match(profile, /USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?SERIAL_ACTUATOR_COMMANDS_ENABLED = false/);
  assert.match(profile, /USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?MAIN_PUMP_CONTINUOUS_ENABLED = false/);
  assert.match(profile, /USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?PROFILE_NUTRIENT_PUMP_MAX_DURATION_MS = 1000/);
  assert.match(config, /hydroponic_device001_stage3_nutrient/);
  assert.match(mqttService, /HYDROPONIC_PROFILE_USB_STAGE3_NUTRIENT_PUMPS/);
  assert.match(firmware, /min\(MQTT_PUMP_A_MAX_DURATION_MS, PROFILE_NUTRIENT_PUMP_MAX_DURATION_MS\)/);
  assert.match(firmware, /min\(MQTT_PUMP_B_MAX_DURATION_MS, PROFILE_NUTRIENT_PUMP_MAX_DURATION_MS\)/);
  assert.match(firmware, /Rejected: continuous main pump control is disabled by build profile/);
  assert.match(firmware, /Rejected: pump is disabled by build profile/);
});

test('backend retains both pump command locks', () => {
  const mqttClient = fs.readFileSync(path.join(__dirname, '..', 'src', 'mqttClient.js'), 'utf8');
  const pumpService = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'pumpCommandService.js'), 'utf8');
  assert.match(mqttClient, /PUMP_COMMANDS_DISABLED/);
  assert.match(mqttClient, /Pump command publishing is disabled/);
  assert.match(pumpService, /pumpCommandsDisabled\(\)/);
  assert.match(pumpService, /pump_commands_disabled/);
});

test('Stage 2 readiness preflight is read-only, isolated, and cannot open the physical gate', () => {
  const preflight = fs.readFileSync(path.join(stage1Dir, 'checkStage2ActuatorReadiness.js'), 'utf8');
  assert.match(preflight, /http:\/\/127\.0\.0\.1:3101/);
  assert.match(preflight, /mongodb:\/\/127\.0\.0\.1:27019/);
  assert.match(preflight, /hydroponic_stage1_preflight/);
  assert.match(preflight, /physicalGateOpen: false/);
  assert.match(preflight, /aclPumpCommandWriteBlocked/);
  assert.match(preflight, /Received PUBLISH .*pump\\\/cmd/);
  assert.doesNotMatch(preflight, /\.publish\(|mqtt\.connect|updateOne|insertOne|deleteOne/);
});

test('Stage 3 readiness preflight is read-only, isolated, and keeps every command gate closed', () => {
  const preflight = fs.readFileSync(path.join(stage1Dir, 'checkStage3NutrientPumpReadiness.js'), 'utf8');
  assert.match(preflight, /http:\/\/127\.0\.0\.1:3101/);
  assert.match(preflight, /mongodb:\/\/127\.0\.0\.1:27019/);
  assert.match(preflight, /hydroponic_stage1_preflight/);
  assert.match(preflight, /READ_ONLY_STAGE3_NUTRIENT_PUMP_PREFLIGHT/);
  assert.match(preflight, /physicalGateOpen: false/);
  assert.match(preflight, /aclPumpCommandReadBlocked/);
  assert.match(preflight, /aclPumpCommandWriteBlocked/);
  assert.match(preflight, /zeroDosingRuns/);
  assert.match(preflight, /firmwareStage3Bounded/);
  assert.match(preflight, /name !== 'telemetryControlValid'/);
  assert.match(preflight, /tds_control_invalid_auto_dosing_remains_blocked/);
  assert.doesNotMatch(preflight, /\.publish\(|mqtt\.connect|updateOne|insertOne|deleteOne/);
});

test('Stage 3 physical plan requires clean-water isolation and one-second sequential pulses', () => {
  const plan = fs.readFileSync(
    path.join(projectRoot, '00_Docs', 'PHASE22B_STAGE3_NUTRIENT_PUMP_SAFETY_PLAN.md'),
    'utf8',
  );
  assert.match(plan, /12V pump supply is disconnected/);
  assert.match(plan, /Nutrient A and B bottles are disconnected/);
  assert.match(plan, /Main Pump is physically disconnected/);
  assert.match(plan, /1000 ms Pump A clean-water pulse/);
  assert.match(plan, /1000 ms Pump B clean-water pulse/);
  assert.match(plan, /SOFTWARE_PREPARATION_ONLY/);
});

test('Stage 2 main-pump preflight reports TDS as a dosing advisory, not a circulation interlock', () => {
  const preflight = fs.readFileSync(path.join(stage1Dir, 'checkStage2ActuatorReadiness.js'), 'utf8');
  assert.match(preflight, /name !== 'telemetryControlValid'/);
  assert.match(preflight, /tds_control_invalid_auto_dosing_remains_blocked/);
  assert.match(preflight, /waterLevelNormal/);
  assert.match(preflight, /waterTemperatureValid/);
  assert.match(preflight, /allPumpsOff/);
});

test('Stage 2 runtime preparation preserves backend lock and grants one narrow operator ACL', () => {
  const prepare = fs.readFileSync(path.join(stage1Dir, 'Prepare-Stage2-MainPumpRuntime.ps1'), 'utf8');
  assert.match(prepare, /CONFIRM STAGE2 PREPARE WITH 12V OFF/);
  assert.match(prepare, /topic write stage1\/hydroponic\/device001\/pump\/cmd/);
  assert.match(prepare, /Backend publisher remains disabled/);
  assert.doesNotMatch(prepare, /PUMP_COMMANDS_DISABLED='false'/);
  assert.doesNotMatch(prepare, /autoDosing|enabled\s*=\s*true/);
});

test('Stage 2 one-shot tool can publish only one fixed 1000 ms main-pump pulse', () => {
  const arm = fs.readFileSync(path.join(stage1Dir, 'Arm-Stage2-MainPumpPulse.ps1'), 'utf8');
  const pulse = fs.readFileSync(path.join(stage1Dir, 'runStage2MainPumpPulse.js'), 'utf8');
  assert.match(arm, /CONFIRM MAIN PUMP SUBMERGED AND 12V ON FOR ONE 1000MS PULSE/);
  assert.match(arm, /AddMinutes\(5\)/);
  assert.match(pulse, /const DURATION_MS = 1000/);
  assert.match(pulse, /pump: 'main'/);
  assert.match(pulse, /action: 'pulse'/);
  assert.match(pulse, /fs\.rmSync\(armPath, \{ force: true \}\)[\s\S]*operator\.publish/);
  assert.doesNotMatch(pulse, /pump: ['"]A['"]|pump: ['"]B['"]|action: ['"]set['"]/);
  assert.match(pulse, /dosingRunsAfter !== dosingRunsBefore/);
});

test('Stage 2 negative runtime tool sends only commands that the bounded profile must reject', () => {
  const negative = fs.readFileSync(path.join(stage1Dir, 'runStage2RejectedCommandChecks.js'), 'utf8');
  assert.match(negative, /pump: 'main', action: 'set', state: 'on'/);
  assert.match(negative, /pump: 'A', action: 'pulse', durationMs: 1000/);
  assert.match(negative, /pump: 'B', action: 'pulse', durationMs: 1000/);
  assert.match(negative, /pump: 'main', action: 'pulse', durationMs: 3001/);
  assert.match(negative, /accepted !== false \|\| status\.status !== 'rejected'/);
  assert.doesNotMatch(negative, /durationMs: 1000[^\n]+pump: 'main'/);
});

test('Stage 2 disable script removes command ACL and all expiring actuator markers', () => {
  const disable = fs.readFileSync(path.join(stage1Dir, 'Disable-Stage2-MainPumpRuntime.ps1'), 'utf8');
  assert.doesNotMatch(disable, /topic (read|write) stage1\/hydroponic\/device001\/pump\/cmd/);
  assert.match(disable, /stage2-main-pump-arm\.json/);
  assert.match(disable, /stage2-firmware-verified\.json/);
  assert.match(disable, /Stage2MainPumpOperatorPrepared -NotePropertyValue \$false/);
});

test('Stage 1 restore verifier requires every actuator path to be locked', () => {
  const verify = fs.readFileSync(path.join(stage1Dir, 'Verify-Stage1-Restore.ps1'), 'utf8');
  assert.match(verify, /Build profile: USB_STAGE1/);
  assert.match(verify, /MQTT pump command subscription: DISABLED/);
  assert.match(verify, /Main pump actuation: LOCKED OFF/);
  assert.match(verify, /Pump A\/B actuation: LOCKED OFF/);
  assert.match(verify, /Serial actuator commands: DISABLED/);
  assert.match(verify, /unexpectedly subscribed to the pump-command topic/);
});

test('Stage 1 TDS recovery check is read-only and observes every dosing lock', () => {
  const recovery = fs.readFileSync(path.join(stage1Dir, 'Run-Stage1-TdsRecoveryCheck.ps1'), 'utf8');
  assert.match(recovery, /READ_ONLY_STAGE1_TDS_RECOVERY/);
  assert.match(recovery, /http:\/\/127\.0\.0\.1:\$Stage1HttpPort/);
  assert.match(recovery, /mqttPumpCommandCountDuringObservation/);
  assert.match(recovery, /dosingRunCountBefore/);
  assert.match(recovery, /dosingRunCountAfter/);
  assert.match(recovery, /autoDosingEnabled/);
  assert.match(recovery, /phase22LockedOff/);
  assert.match(recovery, /latestAgeSec -ge -5/);
  assert.match(recovery, /DateTimeOffset/);
  assert.match(recovery, /Initial telemetry is stale or future-dated/);
  assert.match(recovery, /ESP32 boot changed during the TDS recovery check/);
  assert.match(recovery, /mqttConnectionEventCountDuringObservation/);
  assert.doesNotMatch(recovery, /Invoke-RestMethod\s+.*-Method\s+(Post|Put|Patch|Delete)/i);
  assert.doesNotMatch(recovery, /mosquitto_pub|\.publish\(|insertOne|updateOne|deleteOne/);
});

test('Stage 1 TDS recovery pass requires calibrated stable telemetry and pumps OFF', () => {
  const recovery = fs.readFileSync(path.join(stage1Dir, 'Run-Stage1-TdsRecoveryCheck.ps1'), 'utf8');
  for (const requiredGate of [
    'allWindowStable',
    'allTdsStable',
    'allControlValid',
    'allCalibrationInRange',
    'nullTdsPpmCount',
    'controlInvalidMeasurementCount',
    'allWaterTemperatureValid',
    'allWaterLevelNormal',
    'allPumpsOff',
    'latestControlValid',
  ]) {
    assert.match(recovery, new RegExp(`\\$result\\.${requiredGate}`));
  }
});
