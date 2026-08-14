const fs = require('node:fs');
const path = require('node:path');

const { MongoClient } = require('mongodb');

const API_ROOT = 'http://127.0.0.1:3101';
const MONGO_URL = 'mongodb://127.0.0.1:27019';
const DATABASE_NAME = 'hydroponic_stage1_preflight';
const DEVICE_ID = 'device001';
const MAX_TELEMETRY_AGE_MS = 90_000;

async function getJson(relativePath) {
  const response = await fetch(`${API_ROOT}${relativePath}`);
  if (!response.ok) throw new Error(`GET ${relativePath} failed with HTTP ${response.status}`);
  return response.json();
}

function countMatchingLines(filePath, pattern) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((line) => pattern.test(line)).length;
}

async function main() {
  const stage1Root = __dirname;
  const backendRoot = path.resolve(stage1Root, '..', '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const runtimeRoot = path.join(stage1Root, '.stage1_runtime');
  const secretsRoot = path.join(runtimeRoot, 'secrets');
  const aclPath = path.join(runtimeRoot, 'mosquitto.stage1.acl');
  const brokerLogPath = path.join(runtimeRoot, 'logs', 'mosquitto.stderr.log');
  const statePath = path.join(runtimeRoot, 'processes.json');
  const profilePath = path.join(
    projectRoot,
    '02_ESP32_Main_Firmware',
    'Hydroponic_Device001',
    'BuildProfile.h',
  );
  const startScriptPath = path.join(stage1Root, 'Start-Stage1-Preflight.ps1');

  const [health, latestResponse, settingsResponse, activeRunResponse] = await Promise.all([
    getJson('/health'),
    getJson(`/api/devices/${DEVICE_ID}/latest`),
    getJson(`/api/devices/${DEVICE_ID}/auto-dosing/settings`),
    getJson(`/api/devices/${DEVICE_ID}/auto-dosing/active-run`),
  ]);

  const latest = latestResponse.latest || {};
  const settings = settingsResponse.data || {};
  const receivedAtMs = Date.parse(latest.receivedAt);
  const telemetryAgeMs = Number.isFinite(receivedAtMs) ? Date.now() - receivedAtMs : null;
  const acl = fs.existsSync(aclPath) ? fs.readFileSync(aclPath, 'utf8') : '';
  const state = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''))
    : {};
  const profile = fs.readFileSync(profilePath, 'utf8');
  const startScript = fs.readFileSync(startScriptPath, 'utf8');

  const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3_000 });
  let dosingRunCount;
  let pumpLogCount;
  try {
    await client.connect();
    const database = client.db(DATABASE_NAME);
    [dosingRunCount, pumpLogCount] = await Promise.all([
      database.collection('dosing_runs').countDocuments({}),
      database.collection('pump_logs').countDocuments({}),
    ]);
  } finally {
    await client.close();
  }

  const checks = {
    isolatedApi: API_ROOT === 'http://127.0.0.1:3101',
    isolatedMongo: MONGO_URL === 'mongodb://127.0.0.1:27019'
      && DATABASE_NAME === 'hydroponic_stage1_preflight',
    backendHealthy: health.ok === true && health.mongoConnected === true && health.mqttConnected === true,
    telemetryFresh: telemetryAgeMs !== null && telemetryAgeMs >= -5_000 && telemetryAgeMs <= MAX_TELEMETRY_AGE_MS,
    telemetryControlValid: latest.tdsControlValid === true,
    waterLevelNormal: latest.waterLevel === 'normal',
    waterTemperatureValid: latest.waterTempValid === true,
    allPumpsOff: latest.pumpMain === false && latest.pumpA === false && latest.pumpB === false,
    autoDosingOff: settings.enabled === false,
    phase22LockOn: settings.phase22LockedOff === true,
    noActiveDosingRun: activeRunResponse.data === null,
    zeroDosingRuns: dosingRunCount === 0,
    firmwareStage1Locked: /HYDROPONIC_PROFILE_USB_STAGE1[\s\S]*?ACTUATORS_LOCKED = true;[\s\S]*?MQTT_PUMP_COMMANDS_ENABLED = false;/.test(profile),
    firmwareStage3Bounded: /HYDROPONIC_PROFILE_USB_STAGE3_NUTRIENT_PUMPS[\s\S]*?MAIN_PUMP_ACTUATION_ENABLED = false;[\s\S]*?NUTRIENT_PUMP_ACTUATION_ENABLED = true;[\s\S]*?SPARE_ACTUATION_ENABLED = false;[\s\S]*?MAIN_PUMP_CONTINUOUS_ENABLED = false;[\s\S]*?PROFILE_NUTRIENT_PUMP_MAX_DURATION_MS = 1000;/.test(profile),
    backendPublisherLocked: /PUMP_COMMANDS_DISABLED='true'/.test(startScript),
    aclPumpCommandReadBlocked: !/^\s*topic\s+read\s+.*pump\/cmd\s*$/m.test(acl),
    aclPumpCommandWriteBlocked: !/^\s*topic\s+write\s+.*pump\/cmd\s*$/m.test(acl),
    stage2RuntimeClosed: state.Stage2MainPumpOperatorPrepared !== true,
    noStage2ArmToken: !fs.existsSync(path.join(secretsRoot, 'stage2-main-pump-arm.json')),
    noStage2FirmwareMarker: !fs.existsSync(path.join(secretsRoot, 'stage2-firmware-verified.json')),
  };

  // TDS validity gates dosing, not a supervised clean-water mechanical pulse test.
  const requiredCheckNames = Object.keys(checks).filter((name) => name !== 'telemetryControlValid');
  const softwarePreflightPass = requiredCheckNames.every((name) => checks[name] === true);
  const advisories = [];
  if (!checks.telemetryControlValid) {
    advisories.push('tds_control_invalid_auto_dosing_remains_blocked');
  }
  const result = {
    checkedAt: new Date().toISOString(),
    scope: 'READ_ONLY_STAGE3_NUTRIENT_PUMP_PREFLIGHT',
    api: API_ROOT,
    mongo: '127.0.0.1:27019/hydroponic_stage1_preflight',
    mqttPort: 18885,
    deviceId: DEVICE_ID,
    measurementSeq: latest.measurementSeq ?? null,
    telemetryAgeMs,
    tdsPpm: latest.tdsPpm ?? null,
    dosingRunCount,
    historicalPumpLogCount: pumpLogCount,
    historicalPumpCommandMessageCount: countMatchingLines(
      brokerLogPath,
      /Received PUBLISH .*'stage1\/hydroponic\/device001\/pump\/cmd'/,
    ),
    checks,
    requiredCheckNames,
    advisories,
    softwarePreflightPass,
    physicalGateOpen: false,
    conclusion: softwarePreflightPass
      ? 'READY_FOR_STAGE3_PHYSICAL_CHECKLIST'
      : 'BLOCKED',
    nextGate: softwarePreflightPass
      ? 'Confirm 12V OFF, nutrient bottles disconnected, clean-water tubing, Main Pump disconnected, Pump A/B OFF, and emergency cutoff before any Stage 3 runtime preparation or upload.'
      : 'Resolve failed checks while keeping 12V pump power disconnected.',
  };

  console.log(JSON.stringify(result, null, 2));
  if (!softwarePreflightPass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    scope: 'READ_ONLY_STAGE3_NUTRIENT_PUMP_PREFLIGHT',
    conclusion: 'BLOCKED',
    error: error.message,
  }, null, 2));
  process.exitCode = 1;
});
