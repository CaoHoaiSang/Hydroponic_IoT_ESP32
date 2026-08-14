const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  CONFIG,
  assertIsolatedConfig,
  parseArgs,
  validateBackupDocument,
} = require('../staging/stage0Backup');

const root = path.resolve(__dirname, '../../..');

test('Stage 0 backup is fixed to the isolated loopback database', () => {
  assert.equal(assertIsolatedConfig(), true);
  assert.equal(CONFIG.mongoUri, 'mongodb://127.0.0.1:27018');
  assert.equal(CONFIG.databaseName, 'hydroponic_stage0');
  assert.throws(() => assertIsolatedConfig({ ...CONFIG, mongoUri: 'mongodb://127.0.0.1:27017' }), /requires_127/);
  assert.throws(() => assertIsolatedConfig({ ...CONFIG, databaseName: 'hydroponic_iot' }), /requires_hydroponic_stage0/);
});

test('restore requires explicit input and confirmation arguments', () => {
  assert.deepEqual(parseArgs(['restore', '--input', 'backup.ejson', '--confirm', CONFIG.restoreConfirmation]), {
    mode: 'restore', values: { input: 'backup.ejson', confirm: CONFIG.restoreConfirmation },
  });
  assert.throws(() => parseArgs(['restore', '--input']), /invalid_backup_arguments/);
});

test('backup validation rejects production identity, system collections, and incorrect counts', () => {
  const valid = { format: CONFIG.format, source: { host: '127.0.0.1', port: 27018, database: 'hydroponic_stage0' }, collectionCount: 1, documentCount: 1, collections: [{ name: 'sensor_logs', count: 1, documents: [{ value: 1 }] }] };
  assert.equal(validateBackupDocument(valid), valid);
  assert.throws(() => validateBackupDocument({ ...valid, source: { host: 'example.com', port: 27017, database: 'production' } }), /invalid_stage0_backup_source/);
  assert.throws(() => validateBackupDocument({ ...valid, collections: [{ name: 'system.users', count: 1, documents: [{}] }] }), /invalid_stage0_backup_collection_name/);
  assert.throws(() => validateBackupDocument({ ...valid, collections: [{ name: 'sensor_logs', count: 2, documents: [{}] }] }), /invalid_stage0_backup_collection_count/);
  assert.throws(() => validateBackupDocument({ ...valid, collectionCount: 2 }), /invalid_stage0_backup_collection_total/);
  assert.throws(() => validateBackupDocument({ ...valid, documentCount: 2 }), /invalid_stage0_backup_document_total/);
});

test('local launcher requires API, MongoDB, and MQTT before reporting ready', () => {
  const source = fs.readFileSync(path.join(root, 'START_FULL_LOCAL.ps1'), 'utf8');
  assert.match(source, /mongoConnected -eq \$true/);
  assert.match(source, /mqttConnected -eq \$true/);
  assert.match(source, /Backend is responding but dependencies are not ready/);
  assert.match(source, /PUMP_COMMANDS_DISABLED = 'true'/);
  assert.match(source, /ACTUATORS_LOCKED = 'true'/);
});

test('Phase 23A readiness checker is isolated and read-only', () => {
  const source = fs.readFileSync(path.join(__dirname, '../staging/verifyPhase23aReadiness.js'), 'utf8');
  assert.match(source, /127\.0\.0\.1:27018/);
  assert.match(source, /hydroponic_stage0/);
  assert.doesNotMatch(source, /publish\s*\(/);
  assert.doesNotMatch(source, /insert|update|delete|replace|dropDatabase/i);
});
