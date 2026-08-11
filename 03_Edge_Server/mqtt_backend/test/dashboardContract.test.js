const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createDashboardHarness() {
  const elements = new Map();
  class FakeElement {
    constructor() {
      this.textContent = '';
      this.children = [];
      this.className = '';
      this.hidden = false;
      this.colSpan = 1;
      this.classList = {
        values: new Set(),
        add: (...names) => names.forEach((name) => this.classList.values.add(name)),
        remove: (...names) => names.forEach((name) => this.classList.values.delete(name)),
      };
    }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener() {}
    contains() { return false; }
  }
  const document = {
    activeElement: null,
    createElement: () => new FakeElement(),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    },
  };
  const context = vm.createContext({
    console,
    document,
    fetch: async () => { throw new Error('network disabled in dashboard render test'); },
    setTimeout,
    clearTimeout,
    window: { addEventListener() {}, setTimeout, setInterval() {} },
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'public/app.js' });
  return { context, elements };
}

test('dashboard contains every element referenced by byId', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const ids = [...app.matchAll(/byId\('([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});

test('dashboard exposes EC-first lifecycle controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  for (const id of ['tdsSetCreateForm', 'tdsSetSelect', 'tdsPointForm', 'validateTdsSetButton', 'activateTdsSetButton', 'retireTdsSetButton']) {
    assert.ok(html.includes(`id="${id}"`));
  }
});

test('dashboard requires cải ngọt target confirmation', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.ok(html.includes('id="autoTargetConfirmedInput"'));
  assert.ok(app.includes("cropCode: 'cai_ngot'"));
  assert.ok(app.includes('targetRangeConfirmed'));
});

test('dashboard exposes Telemetry Identity V2 and Shadow observation fields', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  for (const id of [
    'phase22AutoDosingValue', 'shadowModeValue', 'telemetrySchemaValue',
    'telemetryMeasurementIdValue', 'telemetryBootIdValue', 'telemetrySeqValue',
    'telemetryOrderValue', 'telemetryDistinctCountValue', 'shadowDecisionValue',
    'shadowPrimaryReasonValue', 'shadowGatesBody', 'shadowDecisionsBody',
  ]) assert.ok(html.includes(`id="${id}"`));
});

test('dashboard keeps Phase 22A Auto Dosing enable control disabled', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.match(html, /id="autoDosingEnabledInput"[^>]*disabled/);
  assert.ok(app.includes("byId('autoDosingEnabledInput').disabled = true"));
});

test('dashboard executes V2 and legacy identity rendering with safe text fallbacks', () => {
  const { context, elements } = createDashboardHarness();
  context.latestData = {
    deviceId: 'device001',
    latest: {
      schemaVersion: 2, measurementId: 'device001:boot1:3', bootId: 'boot1',
      measurementSeq: 3, sampledAtUptimeMs: 90000, telemetryOrderStatus: 'ACCEPTED',
      telemetryIdentityValid: true, telemetryDuplicate: false, controlEligible: true,
      tdsRaw: 1200, tdsVoltage: 0.967, ecUsCm: 900, tdsPpm: 450,
      tdsCalibrationSetId: 'set1', tdsSampleCount: 30,
      tdsStabilityDistinctMeasurementCount: 3, tdsStable: true,
    },
  };
  context.logsData = { data: [context.latestData.latest] };
  vm.runInContext('renderTelemetryIdentity(latestData, logsData)', context);
  assert.equal(elements.get('telemetrySchemaValue').textContent, '2');
  assert.equal(elements.get('telemetryOrderValue').textContent, 'ACCEPTED');
  assert.equal(elements.get('telemetryMeasurementIdValue').textContent, 'device001:boot1:3');

  context.latestData = { deviceId: 'device001', latest: {} };
  context.logsData = { data: [{ telemetryOrderStatus: 'LEGACY_NO_IDENTITY' }] };
  vm.runInContext('renderTelemetryIdentity(latestData, logsData)', context);
  assert.equal(elements.get('telemetrySchemaValue').textContent, 'Legacy');
  assert.equal(elements.get('telemetryMeasurementIdValue').textContent, 'N/A');
  assert.equal(elements.get('telemetryOrderValue').textContent, 'LEGACY_NO_IDENTITY');
  assert.match(elements.get('telemetryLegacyStatus').textContent, /excluded from stability/);
});

test('dashboard executes Shadow rendering without undefined dose values', () => {
  const { context, elements } = createDashboardHarness();
  context.statusData = {
    data: {
      enabled: true, autoDosing: 'OFF',
      latestDecision: {
        decision: 'INSUFFICIENT_DATA', primaryReasonCode: 'UNCONFIRMED_TARGET',
        reasonCodes: ['UNCONFIRMED_TARGET'], hypotheticalAction: 'WAIT',
        hypotheticalDoseMlPerPump: null, gates: [], createdAt: null,
      },
    },
  };
  context.decisionsData = { data: [] };
  vm.runInContext('renderShadowData(statusData, decisionsData)', context);
  assert.equal(elements.get('phase22AutoDosingValue').textContent, 'OFF');
  assert.equal(elements.get('shadowModeValue').textContent, 'ON');
  assert.equal(elements.get('shadowDoseValue').textContent, 'N/A');
  assert.equal(elements.get('shadowPrimaryReasonValue').textContent, 'UNCONFIRMED_TARGET');
});

test('dashboard refresh loads Shadow status and decision history every cycle', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.ok(app.includes('loadShadowData()'));
  assert.ok(app.includes('/shadow-mode/status'));
  assert.ok(app.includes('/shadow-mode/decisions?limit=20'));
});
