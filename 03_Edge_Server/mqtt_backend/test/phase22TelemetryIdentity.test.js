process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateSensorPayload } = require('../src/validators/sensorPayloadValidator');
const {
  ORDER_STATUS,
  classifyTelemetryOrder,
  initialSession,
} = require('../src/services/telemetryIdentityService');
const { calculateTdsStability } = require('../src/services/tdsQualityService');
const {
  DEFAULT_SETTINGS,
  evaluateAutoDosing,
  handlePumpStatusForAutoDosing,
  updateAutoDosingSettings,
} = require('../src/services/autoDosingService');
const { FakeDatabase } = require('../testSupport/fakeMongo');
const { resetMongoForTests, setMongoForTests } = require('../src/mongoClient');

function payload(overrides = {}) {
  return {
    schemaVersion: 2,
    deviceId: 'device001',
    bootId: 'bootabcd01',
    measurementSeq: 1,
    measurementId: 'device001:bootabcd01:1',
    sampledAtUptimeMs: 1000,
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
    uptimeMs: 1000,
    ...overrides,
  };
}

function identity(bootId, measurementSeq) {
  return {
    bootId,
    measurementSeq,
    measurementId: `device001:${bootId}:${measurementSeq}`,
  };
}

function stableSample(measurementId, overrides = {}) {
  return {
    schemaVersion: 2,
    measurementId,
    telemetryIdentityValid: true,
    telemetryDuplicate: false,
    telemetryOrderStatus: 'ACCEPTED',
    telemetryBootSessionValid: true,
    measurementFreshnessVerified: true,
    measurementAt: new Date(),
    tdsWindowStable: true,
    tdsSampleCount: 30,
    tdsRaw: 100,
    tdsMin: 90,
    tdsMax: 110,
    tdsSpreadRaw: 20,
    tdsPpm: 500,
    tdsMeasurementValid: true,
    ...overrides,
  };
}

test.afterEach(() => resetMongoForTests());

test('V2 payload validates with all identity fields', () => assert.equal(validateSensorPayload(payload()).ok, true));

for (const [name, mutation, expected] of [
  ['missing bootId fails closed', (row) => { delete row.bootId; }, 'bootId'],
  ['missing measurementSeq fails closed', (row) => { delete row.measurementSeq; }, 'measurementSeq'],
  ['missing measurementId fails closed', (row) => { delete row.measurementId; }, 'measurementId'],
  ['missing sampledAtUptimeMs fails closed', (row) => { delete row.sampledAtUptimeMs; }, 'sampledAtUptimeMs'],
  ['negative sequence fails closed', (row) => { row.measurementSeq = -1; }, 'measurementSeq'],
  ['non-finite sampled uptime fails closed', (row) => { row.sampledAtUptimeMs = Number.NaN; }, 'sampledAtUptimeMs'],
  ['wrong schema version fails closed', (row) => { row.schemaVersion = 3; }, 'schemaVersion'],
  ['identity mismatch fails closed', (row) => { row.measurementId = 'device001:wrong:1'; }, 'measurementId'],
  ['sample uptime after uptime fails closed', (row) => { row.sampledAtUptimeMs = 1001; }, 'sampledAtUptimeMs'],
]) {
  test(name, () => {
    const row = payload(); mutation(row);
    const result = validateSensorPayload(row);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)));
  });
}

test('legacy payload remains syntactically compatible', () => {
  const row = payload();
  for (const field of ['schemaVersion', 'bootId', 'measurementSeq', 'measurementId', 'sampledAtUptimeMs']) delete row[field];
  assert.equal(validateSensorPayload(row).ok, true);
});

test('first observed boot is accepted', () => {
  const result = classifyTelemetryOrder(initialSession(), identity('boot000001', 1));
  assert.equal(result.status, ORDER_STATUS.ACCEPTED);
  assert.equal(result.bootSessionValid, true);
});

test('same boot increasing sequence is accepted', () => {
  const first = classifyTelemetryOrder(initialSession(), identity('boot000001', 1));
  const second = classifyTelemetryOrder(first.session, identity('boot000001', 2));
  assert.equal(second.status, ORDER_STATUS.ACCEPTED);
  assert.equal(second.session.latestAcceptedSeq, 2);
});

test('same boot lower sequence is out of order', () => {
  const first = classifyTelemetryOrder(initialSession(), identity('boot000001', 3));
  assert.equal(classifyTelemetryOrder(first.session, identity('boot000001', 2)).status, ORDER_STATUS.OUT_OF_ORDER);
});

test('new boot first packet is unconfirmed', () => {
  const first = classifyTelemetryOrder(initialSession(), identity('boot000001', 3));
  assert.equal(classifyTelemetryOrder(first.session, identity('boot000002', 1)).status, ORDER_STATUS.BOOT_TRANSITION_UNCONFIRMED);
});

test('new boot second increasing packet confirms transition', () => {
  const first = classifyTelemetryOrder(initialSession(), identity('boot000001', 3));
  const pending = classifyTelemetryOrder(first.session, identity('boot000002', 1));
  const confirmed = classifyTelemetryOrder(pending.session, identity('boot000002', 2));
  assert.equal(confirmed.status, ORDER_STATUS.ACCEPTED);
  assert.equal(confirmed.session.currentBootId, 'boot000002');
  assert.ok(confirmed.session.retiredBootIds.includes('boot000001'));
});

test('packet from retired boot cannot become current again', () => {
  const first = classifyTelemetryOrder(initialSession(), identity('boot000001', 3));
  const pending = classifyTelemetryOrder(first.session, identity('boot000002', 1));
  const confirmed = classifyTelemetryOrder(pending.session, identity('boot000002', 2));
  const old = classifyTelemetryOrder(confirmed.session, identity('boot000001', 4));
  assert.equal(old.status, ORDER_STATUS.OLD_BOOT_PACKET);
  assert.equal(old.session.currentBootId, 'boot000002');
});

test('current boot packet cancels an unconfirmed stray boot candidate', () => {
  const current = classifyTelemetryOrder(initialSession(), identity('boot000001', 3));
  const stray = classifyTelemetryOrder(current.session, identity('boot000002', 1));
  const resumed = classifyTelemetryOrder(stray.session, identity('boot000001', 4));
  assert.equal(resumed.status, ORDER_STATUS.ACCEPTED);
  assert.equal(resumed.session.pendingBoot, null);
});

test('three distinct accepted identities can become stable', () => {
  const result = calculateTdsStability([
    stableSample('m1', { tdsPpm: 500 }),
    stableSample('m2', { tdsPpm: 505 }),
    stableSample('m3', { tdsPpm: 510 }),
  ], { requireIdentity: true });
  assert.equal(result.tdsStable, true);
  assert.equal(result.tdsStabilityDistinctMeasurementCount, 3);
});

test('three copies of one identity cannot become stable', () => {
  const sample = stableSample('same');
  const result = calculateTdsStability([sample, sample, sample], { requireIdentity: true });
  assert.equal(result.tdsStable, false);
  assert.equal(result.tdsStabilityDistinctMeasurementCount, 1);
});

for (const [name, overrides] of [
  ['legacy stability row is excluded', { schemaVersion: undefined, telemetryIdentityValid: false }],
  ['out-of-order stability row is excluded', { telemetryOrderStatus: 'OUT_OF_ORDER' }],
  ['duplicate stability row is excluded', { telemetryDuplicate: true }],
  ['unconfirmed boot stability row is excluded', { telemetryBootSessionValid: false }],
  ['zero firmware samples are excluded', { tdsSampleCount: 0, tdsWindowStable: false }],
]) {
  test(name, () => {
    const result = calculateTdsStability([
      stableSample('m1'), stableSample('m2'), stableSample('m3', overrides),
    ], { requireIdentity: true });
    assert.equal(result.tdsStable, false);
    assert.equal(result.tdsStabilityDistinctMeasurementCount, 2);
  });
}

test('production Auto Dosing settings reject enable during Phase 22A', async () => {
  setMongoForTests(new FakeDatabase({ auto_dosing_settings: [] }));
  const result = await updateAutoDosingSettings('device001', {
    ...DEFAULT_SETTINGS, enabled: true, targetRangeConfirmed: true,
  });
  assert.equal(result.error, 'phase22a_auto_dosing_locked_off');
});

test('production Auto Dosing evaluator exits before publisher', async () => {
  let calls = 0;
  const result = await evaluateAutoDosing({ deviceId: 'device001' }, async () => { calls += 1; });
  assert.equal(result.reason, 'phase22a_auto_dosing_locked_off');
  assert.equal(calls, 0);
});

test('production pump status handler cannot continue Auto Dosing sequence', async () => {
  let calls = 0;
  const result = await handlePumpStatusForAutoDosing({ deviceId: 'device001', commandId: 'cmd' }, async () => { calls += 1; });
  assert.equal(result.reason, 'phase22a_auto_dosing_locked_off');
  assert.equal(calls, 0);
});

test('firmware source keeps all official GPIO assignments', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../../02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h'), 'utf8');
  for (const line of ['PIN_TDS_ADC 34', 'PIN_DS18B20_DATA 4', 'PIN_WATER_LEVEL 27', 'PIN_PUMP_MAIN 25', 'PIN_PUMP_A 26', 'PIN_PUMP_B 14', 'PIN_PUMP_SPARE 33']) {
    assert.ok(source.includes(line));
  }
});

test('firmware source defines schema V2 and the tested 1024-byte packet budget', () => {
  const config = fs.readFileSync(path.join(__dirname, '../../../02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h'), 'utf8');
  assert.ok(config.includes('TELEMETRY_SCHEMA_VERSION = 2'));
  assert.ok(config.includes('MQTT_PACKET_BUFFER_SIZE = 1024'));
});

test('firmware sequence and retry state execute in a native host harness', (t) => {
  const compiler = spawnSync('g++', ['--version'], { encoding: 'utf8' });
  if (compiler.status !== 0) {
    t.skip('g++ is unavailable for the firmware host harness');
    return;
  }
  const firmwareDir = path.join(__dirname, '../../../02_ESP32_Main_Firmware/Hydroponic_Device001');
  const fixture = path.join(__dirname, 'fixtures/telemetry_firmware_host_test.cpp');
  const executable = path.join(os.tmpdir(), `telemetry-firmware-host-${process.pid}`);
  const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', firmwareDir, fixture, '-o', executable], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const run = spawnSync(executable, [], { encoding: 'utf8' });
  fs.rmSync(executable, { force: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('representative maximum V2 payload plus MQTT topic fits the 1024-byte buffer', () => {
  const bootId = 'ffffffffffffffff';
  const row = {
    schemaVersion: 2, deviceId: 'device001', bootId, measurementSeq: 4294967295,
    measurementId: `device001:${bootId}:4294967295`, sampledAtUptimeMs: 4294967295,
    tdsRaw: 4095, tdsVoltage: 2.3, tdsMin: 4095, tdsMax: 4095,
    tdsSampleCount: 30, tdsSpreadRaw: 50, tdsRobustMin: 4095, tdsRobustMax: 4095,
    tdsRobustSpreadRaw: 0, tdsTrimmedSampleCount: 24, tdsWindowStable: true,
    waterTemp: 50, waterTempValid: true, waterLevel: 'normal', pumpMain: true,
    pumpA: false, pumpB: false, pumpSpare: false, ph: null, uptimeMs: 4294967295,
  };
  const payloadBytes = Buffer.byteLength(JSON.stringify(row, null, 2));
  const topicBytes = Buffer.byteLength('hydroponic/device001/sensor');
  assert.ok(payloadBytes + topicBytes + 8 < 1024, `${payloadBytes} payload bytes exceed MQTT budget`);
});
