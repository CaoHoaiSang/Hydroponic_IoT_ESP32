const { MongoClient } = require('mongodb');

const CONFIG = Object.freeze({
  apiUrl: 'http://127.0.0.1:3100',
  mongoUri: 'mongodb://127.0.0.1:27018',
  databaseName: 'hydroponic_stage0',
});

async function getJson(pathname) {
  const response = await fetch(`${CONFIG.apiUrl}${pathname}`);
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${pathname}`);
  return body;
}

async function main() {
  const mongoUrl = new URL(CONFIG.mongoUri);
  if (mongoUrl.hostname !== '127.0.0.1' || mongoUrl.port !== '27018' || CONFIG.databaseName !== 'hydroponic_stage0') {
    throw new Error('phase23a_requires_isolated_stage0');
  }
  const client = new MongoClient(CONFIG.mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    const [health, capabilities, dashboard] = await Promise.all([
      getJson('/health'),
      getJson('/api/system/capabilities'),
      fetch(`${CONFIG.apiUrl}/overview`),
    ]);
    await client.connect();
    const database = client.db(CONFIG.databaseName);
    const [sensorLogs, shadowDecisions, pumpLogs, dosingRuns, enabledSettings] = await Promise.all([
      database.collection('sensor_logs').countDocuments({}),
      database.collection('shadow_dosing_decisions').countDocuments({}),
      database.collection('pump_logs').countDocuments({}),
      database.collection('dosing_runs').countDocuments({}),
      database.collection('auto_dosing_settings').countDocuments({ enabled: true }),
    ]);
    const checks = {
      backendHealthy: health.ok === true && health.mongoConnected === true && health.mqttConnected === true,
      dashboardAvailable: dashboard.status === 200,
      actuatorsLocked: capabilities.data?.actuatorsLocked === true,
      pumpCommandsDisabled: capabilities.data?.pumpCommandsEnabled === false,
      autoDosingUnavailable: capabilities.data?.autoDosingCanEnable === false && enabledSettings === 0,
      telemetryIdentityEvidence: sensorLogs >= 3,
      shadowEvidence: shadowDecisions >= 1,
      zeroPumpLogs: pumpLogs === 0,
      zeroDosingRuns: dosingRuns === 0,
    };
    const ok = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({
      ok,
      conclusion: ok ? 'READY_FOR_PHASE23A_DEMO' : 'PHASE23A_DEMO_NOT_READY',
      endpoints: { api: CONFIG.apiUrl, mongo: '127.0.0.1:27018/hydroponic_stage0', mqtt: '127.0.0.1:18884' },
      checks,
      counts: { sensorLogs, shadowDecisions, pumpLogs, dosingRuns, enabledSettings },
    }, null, 2));
    if (!ok) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CONFIG, main };
