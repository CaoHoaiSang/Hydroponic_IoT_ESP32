process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resetMongoForTests,
  setMongoForTests,
} = require('../src/mongoClient');
const {
  DEFAULT_SETTINGS,
  evaluateAutoDosing,
  handlePumpStatusForAutoDosing,
  updateAutoDosingSettings,
} = require('../src/services/autoDosingService');
const {
  activateTdsCalibrationSet,
  retireTdsCalibrationSet,
} = require('../src/services/tdsCalibrationService');
const { saveSensorPayload } = require('../src/services/sensorLogService');
const { FakeDatabase, FakeMongoClient } = require('../testSupport/fakeMongo');
const PHASE21_REGRESSION_OPTIONS = { bypassPhase22LockForRegression: true };

test.afterEach(() => {
  resetMongoForTests();
});

function calibrationPoint(voltage25, ec) {
  return {
    deviceId: 'device001',
    calibrationSetId: 'set1',
    measuredVoltage25: voltage25,
    measuredVoltage: voltage25,
    measuredRaw: Math.round(voltage25 * 4095 / 3.3),
    referenceEcUsCm: ec,
    referenceTdsPpm: ec * 0.5,
    referenceScale: '500',
    tdsFactor: 0.5,
    waterTemp: 25,
    temperatureCompensated: true,
    temperatureReferenceC: 25,
    temperatureAlphaPerC: 0.02,
    temperatureFactorUsed: 1,
    method: 'piecewise_linear_ec',
  };
}

function activeCalibrationSet() {
  return {
    deviceId: 'device001',
    setId: 'set1',
    status: 'active',
    activeLock: true,
    validationStatus: 'valid',
    pointCount: 3,
    minReferenceTdsPpm: 200,
    maxReferenceTdsPpm: 1500,
    lifecycleHistory: [],
  };
}

function validLatest(measurementAt = new Date()) {
  return {
    measurementAt,
    tdsCalibrationSetId: 'set1',
    tdsPpm: 700,
    tdsControlValid: true,
    tdsStable: true,
    tdsCalibrationInRange: true,
    tdsCalibrationWarning: null,
    tdsTemperatureCompensated: true,
    waterLevel: 'normal',
    waterTempValid: true,
    pumpMain: true,
    pumpA: false,
    pumpB: false,
  };
}

function settings(overrides = {}) {
  return {
    deviceId: 'device001',
    ...DEFAULT_SETTINGS,
    enabled: true,
    targetRangeConfirmed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseSeed(overrides = {}) {
  const now = new Date();
  return {
    auto_dosing_settings: [settings()],
    devices: [{
      deviceId: 'device001',
      activeTdsCalibrationSetId: 'set1',
      lastSeenAt: now,
      latest: validLatest(now),
      latestCalibration: { pumpAFlowRateMlPerSec: 2, pumpBFlowRateMlPerSec: 1.8 },
    }],
    tds_calibration_sets: [activeCalibrationSet()],
    tds_calibrations: [
      calibrationPoint(0.5, 400),
      calibrationPoint(1.0, 1000),
      calibrationPoint(1.5, 2000),
    ],
    dosing_runs: [],
    auto_dosing_events: [],
    ...overrides,
  };
}

test('post-mixing service keeps run waiting when measurement predates mixingUntil', async () => {
  const now = new Date();
  const mixingUntil = new Date(now.getTime() - 1000);
  const seed = baseSeed();
  seed.devices[0].latest = validLatest(new Date(mixingUntil.getTime() - 60000));
  seed.dosing_runs.push({
    runId: 'run_mixing_old_measurement', deviceId: 'device001', status: 'mixing_wait', activeLock: true,
    currentStep: 'mixing_wait', tdsPpmAtStart: 650, tdsCalibrationSetIdAtStart: 'set1',
    mixingStartedAt: new Date(mixingUntil.getTime() - 10000), mixingUntil,
    tdsPpmAfterMixing: null, deltaTdsPpm: null,
  });
  const database = new FakeDatabase(seed);
  setMongoForTests(database);
  let publishes = 0;

  const result = await evaluateAutoDosing({ deviceId: 'device001' }, async () => { publishes += 1; }, PHASE21_REGRESSION_OPTIONS);
  const run = database.data.dosing_runs[0];

  assert.equal(result.reason, 'mixing_measurement_invalid');
  assert.ok(result.invalidReasons.includes('tds_measurement_not_after_mixing'));
  assert.equal(run.status, 'mixing_wait');
  assert.equal(run.tdsPpmAfterMixing, null);
  assert.equal(run.deltaTdsPpm, null);
  assert.equal(publishes, 0);
});

test('sensor persistence stores one explicit measurementAt in sensor_logs and devices.latest', async () => {
  const database = new FakeDatabase(baseSeed({ sensor_logs: [], alerts: [] }));
  setMongoForTests(database);
  const payload = {
    schemaVersion: 2, bootId: 'boottest01', measurementSeq: 1,
    measurementId: 'device001:boottest01:1', sampledAtUptimeMs: 1000,
    deviceId: 'device001', tdsRaw: 1241, tdsVoltage: 1.0,
    tdsMin: 1231, tdsMax: 1251, tdsSampleCount: 30, tdsSpreadRaw: 20,
    tdsWindowStable: true, waterTemp: 25, waterTempValid: true, waterLevel: 'normal',
    pumpMain: true, pumpA: false, pumpB: false, pumpSpare: false, ph: null, uptimeMs: 1000,
  };

  const result = await saveSensorPayload(payload, 'hydroponic/device001/sensor');

  assert.equal(result.ok, true);
  assert.ok(database.data.sensor_logs[0].measurementAt instanceof Date);
  assert.equal(
    database.data.devices[0].latest.measurementAt.getTime(),
    database.data.sensor_logs[0].measurementAt.getTime(),
  );
});

test('post-mixing service completes only with a fresh measurement from the original active set', async () => {
  const now = new Date();
  const mixingUntil = new Date(now.getTime() - 2000);
  const seed = baseSeed();
  seed.devices[0].latest = { ...validLatest(now), tdsPpm: 730 };
  seed.dosing_runs.push({
    runId: 'run_mixing_fresh_measurement', deviceId: 'device001', status: 'mixing_wait', activeLock: true,
    currentStep: 'mixing_wait', mode: 'closed_loop_step', tdsPpmAtStart: 700,
    tdsCalibrationSetIdAtStart: 'set1', mixingStartedAt: new Date(mixingUntil.getTime() - 10000),
    mixingUntil, tdsPpmAfterMixing: null, deltaTdsPpm: null,
  });
  const database = new FakeDatabase(seed);
  setMongoForTests(database);

  const result = await evaluateAutoDosing({ deviceId: 'device001' }, async () => {
    throw new Error('no pump publish is allowed during mixing completion');
  }, PHASE21_REGRESSION_OPTIONS);
  const run = database.data.dosing_runs[0];

  assert.equal(result.action, 'completed');
  assert.equal(run.status, 'completed');
  assert.equal(run.deltaTdsPpm, 30);
  assert.equal(run.activeLock, undefined);
});

test('concurrent fresh post-mixing payloads finalize a run exactly once', async () => {
  const now = new Date();
  const mixingUntil = new Date(now.getTime() - 2000);
  const seed = baseSeed();
  seed.devices[0].latest = { ...validLatest(now), tdsPpm: 730 };
  seed.dosing_runs.push({
    runId: 'run_mixing_concurrent', deviceId: 'device001', status: 'mixing_wait', activeLock: true,
    currentStep: 'mixing_wait', mode: 'closed_loop_step', tdsPpmAtStart: 700,
    tdsCalibrationSetIdAtStart: 'set1', mixingStartedAt: new Date(mixingUntil.getTime() - 10000),
    mixingUntil, tdsPpmAfterMixing: null, deltaTdsPpm: null,
  });
  const database = new FakeDatabase(seed);
  setMongoForTests(database);

  const results = await Promise.all([
    evaluateAutoDosing({ deviceId: 'device001' }, async () => { throw new Error('must not publish'); }, PHASE21_REGRESSION_OPTIONS),
    evaluateAutoDosing({ deviceId: 'device001' }, async () => { throw new Error('must not publish'); }, PHASE21_REGRESSION_OPTIONS),
  ]);

  assert.equal(results.filter((result) => result.action === 'completed').length, 1);
  assert.equal(results.filter((result) => result.reason === 'mixing_already_finalized').length, 1);
  assert.equal(database.data.dosing_runs[0].deltaTdsPpm, 30);
  assert.equal(database.data.auto_dosing_events.filter((event) => event.eventType === 'run_completed').length, 1);
});

test('duplicate Pump A completed callbacks publish Pump B exactly once', async () => {
  const seed = baseSeed();
  seed.dosing_runs.push({
    runId: 'run_duplicate_a', deviceId: 'device001', status: 'in_progress', activeLock: true,
    currentStep: 'pumpA', mode: 'closed_loop_step', tdsPpmAtStart: 700,
    targetMinPpm: 800, targetMaxPpm: 1200, mixingDelayMs: 60000,
    pumpA: { commandId: 'cmd_a', durationMs: 500, status: 'published' },
    pumpB: { commandId: null, durationMs: 556, status: 'pending' },
  });
  const database = new FakeDatabase(seed);
  setMongoForTests(database);
  const published = [];
  const payload = { deviceId: 'device001', commandId: 'cmd_a', status: 'completed', success: true };

  const results = await Promise.all([
    handlePumpStatusForAutoDosing(payload, async (command) => { published.push(command); }, PHASE21_REGRESSION_OPTIONS),
    handlePumpStatusForAutoDosing(payload, async (command) => { published.push(command); }, PHASE21_REGRESSION_OPTIONS),
  ]);

  assert.equal(published.length, 1);
  assert.equal(published[0].pump, 'B');
  assert.equal(database.data.dosing_runs[0].currentStep, 'pumpB');
  assert.equal(database.data.dosing_runs[0].pumpB.status, 'published');
  assert.equal(results.filter((result) => result.action === 'pumpB_published').length, 1);
  assert.equal(results.filter((result) => result.action === 'duplicate_or_out_of_order_ignored').length, 1);
});

test('out-of-order Pump A failure cannot fail a run after Pump B was claimed', async () => {
  const seed = baseSeed();
  seed.dosing_runs.push({
    runId: 'run_out_of_order', deviceId: 'device001', status: 'in_progress', activeLock: true,
    currentStep: 'pumpB', mode: 'closed_loop_step',
    pumpA: { commandId: 'cmd_a', durationMs: 500, status: 'completed' },
    pumpB: { commandId: 'cmd_b', durationMs: 556, status: 'published' },
  });
  const database = new FakeDatabase(seed);
  setMongoForTests(database);

  const result = await handlePumpStatusForAutoDosing({
    deviceId: 'device001', commandId: 'cmd_a', status: 'failed', success: false,
  }, async () => { throw new Error('must not publish'); }, PHASE21_REGRESSION_OPTIONS);

  assert.equal(result.action, 'duplicate_or_out_of_order_ignored');
  assert.equal(database.data.dosing_runs[0].status, 'in_progress');
  assert.equal(database.data.dosing_runs[0].currentStep, 'pumpB');
});

test('concurrent evaluations reserve only one active run and publish one Pump A command', async () => {
  const database = new FakeDatabase(baseSeed());
  setMongoForTests(database);
  const published = [];
  const publish = async (command) => { published.push(command); };

  const results = await Promise.all([
    evaluateAutoDosing({ deviceId: 'device001' }, publish, PHASE21_REGRESSION_OPTIONS),
    evaluateAutoDosing({ deviceId: 'device001' }, publish, PHASE21_REGRESSION_OPTIONS),
  ]);

  assert.equal(database.data.dosing_runs.length, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].pump, 'A');
  assert.equal(results.filter((result) => result.action === 'started').length, 1);
  assert.equal(results.filter((result) => result.reason === 'dosing_run_active').length, 1);
});

test('updateAutoDosingSettings rejects enabled target outside the active EC set range', async () => {
  const seed = baseSeed();
  seed.auto_dosing_settings[0].enabled = false;
  const database = new FakeDatabase(seed);
  setMongoForTests(database);
  const body = settings({ enabled: true, targetMinPpm: 800, targetMaxPpm: 1600 });

  const result = await updateAutoDosingSettings('device001', body, PHASE21_REGRESSION_OPTIONS);

  assert.equal(result.ok, false);
  assert.equal(result.error, 'auto_dosing_not_ready');
  assert.ok(result.errors.includes('tds_target_outside_calibrated_range'));
  assert.equal(database.data.auto_dosing_settings[0].enabled, false);
});

function draftLifecycleSeed({ previousActive = false } = {}) {
  const draft = {
    deviceId: 'device001', setId: 'set1', status: 'draft', lifecycleHistory: [],
    validationStatus: 'not_validated', pointCount: 0,
  };
  const sets = [draft];
  const devices = [{ deviceId: 'device001' }];
  if (previousActive) {
    sets.push({
      deviceId: 'device001', setId: 'set0', status: 'active', activeLock: true,
      lifecycleHistory: [], validationStatus: 'valid', pointCount: 3,
    });
    devices[0].activeTdsCalibrationSetId = 'set0';
  }
  return {
    devices,
    auto_dosing_settings: [settings({ enabled: true })],
    tds_calibration_sets: sets,
    tds_calibrations: [
      calibrationPoint(0.5, 400),
      calibrationPoint(1.0, 1000),
      calibrationPoint(1.5, 2000),
    ],
  };
}

test('calibration activation uses transaction path and keeps Auto Dosing disabled', async () => {
  const database = new FakeDatabase(draftLifecycleSeed({ previousActive: true }));
  setMongoForTests(database, new FakeMongoClient(database));

  const result = await activateTdsCalibrationSet('device001', 'set1');

  assert.equal(result.ok, true);
  assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set0').status, 'retired');
  assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set1').status, 'active');
  assert.equal(database.data.devices[0].activeTdsCalibrationSetId, 'set1');
  assert.equal(database.data.auto_dosing_settings[0].enabled, false);
});

test('calibration activation service rejects one-point and two-point draft sets', async () => {
  for (const pointCount of [1, 2]) {
    const seed = draftLifecycleSeed();
    seed.tds_calibrations = seed.tds_calibrations.slice(0, pointCount);
    const database = new FakeDatabase(seed);
    setMongoForTests(database, new FakeMongoClient(database));

    const result = await activateTdsCalibrationSet('device001', 'set1');

    assert.equal(result.ok, false);
    assert.equal(result.error, 'validation_failed');
    assert.equal(database.data.tds_calibration_sets[0].status, 'draft');
    assert.equal(database.data.devices[0].activeTdsCalibrationSetId, undefined);
    assert.equal(database.data.auto_dosing_settings[0].enabled, true);
    resetMongoForTests();
  }
});

test('transaction failure injection rolls back each activation write stage', async () => {
  const cases = [
    ['tds_calibration_sets.updateOne', 2],
    ['tds_calibration_sets.updateOne', 3],
    ['devices.updateOne', 1],
    ['auto_dosing_settings.updateOne', 1],
  ];
  for (const [operation, occurrence] of cases) {
    const database = new FakeDatabase(draftLifecycleSeed({ previousActive: true }));
    database.failOn(operation, occurrence);
    setMongoForTests(database, new FakeMongoClient(database));

    await assert.rejects(() => activateTdsCalibrationSet('device001', 'set1'), /injected failure/);

    assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set0').status, 'active');
    assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set1').status, 'draft');
    assert.equal(database.data.devices[0].activeTdsCalibrationSetId, 'set0');
    assert.equal(database.data.auto_dosing_settings[0].enabled, true);
    resetMongoForTests();
  }
});

test('fallback failure on first activation clears the pointer and restores draft state', async () => {
  const database = new FakeDatabase(draftLifecycleSeed());
  database.failOn('auto_dosing_settings.updateOne');
  setMongoForTests(database);

  await assert.rejects(() => activateTdsCalibrationSet('device001', 'set1'), /injected failure/);

  assert.equal(database.data.tds_calibration_sets[0].status, 'draft');
  assert.equal(database.data.tds_calibration_sets[0].activeLock, undefined);
  assert.equal(database.data.devices[0].activeTdsCalibrationSetId, undefined);
});

test('fallback failure restores the previous active set and pointer', async () => {
  const database = new FakeDatabase(draftLifecycleSeed({ previousActive: true }));
  database.failOn('auto_dosing_settings.updateOne');
  setMongoForTests(database);

  await assert.rejects(() => activateTdsCalibrationSet('device001', 'set1'), /injected failure/);

  assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set0').status, 'active');
  assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set0').activeLock, true);
  assert.equal(database.data.tds_calibration_sets.find((set) => set.setId === 'set1').status, 'draft');
  assert.equal(database.data.devices[0].activeTdsCalibrationSetId, 'set0');
});

test('retirement transaction clears pointer, active lock, and disables Auto Dosing', async () => {
  const seed = draftLifecycleSeed();
  seed.tds_calibration_sets[0] = activeCalibrationSet();
  seed.devices[0].activeTdsCalibrationSetId = 'set1';
  const database = new FakeDatabase(seed);
  setMongoForTests(database, new FakeMongoClient(database));

  const result = await retireTdsCalibrationSet('device001', 'set1');

  assert.equal(result.ok, true);
  assert.equal(database.data.tds_calibration_sets[0].status, 'retired');
  assert.equal(database.data.tds_calibration_sets[0].activeLock, undefined);
  assert.equal(database.data.devices[0].activeTdsCalibrationSetId, undefined);
  assert.equal(database.data.auto_dosing_settings[0].enabled, false);
});

test('retirement transaction failure restores active set and pointer', async () => {
  const seed = draftLifecycleSeed();
  seed.tds_calibration_sets[0] = activeCalibrationSet();
  seed.devices[0].activeTdsCalibrationSetId = 'set1';
  const database = new FakeDatabase(seed);
  database.failOn('auto_dosing_settings.updateOne');
  setMongoForTests(database, new FakeMongoClient(database));

  await assert.rejects(() => retireTdsCalibrationSet('device001', 'set1'), /injected failure/);

  assert.equal(database.data.tds_calibration_sets[0].status, 'active');
  assert.equal(database.data.tds_calibration_sets[0].activeLock, true);
  assert.equal(database.data.devices[0].activeTdsCalibrationSetId, 'set1');
  assert.equal(database.data.auto_dosing_settings[0].enabled, true);
});
