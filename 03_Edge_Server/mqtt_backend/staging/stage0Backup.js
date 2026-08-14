const fs = require('fs/promises');
const path = require('path');
const { EJSON } = require('bson');
const { MongoClient } = require('mongodb');

const CONFIG = Object.freeze({
  mongoUri: 'mongodb://127.0.0.1:27018',
  databaseName: 'hydroponic_stage0',
  format: 'hydroponic_stage0_ejson_v1',
  restoreConfirmation: 'RESTORE_EMPTY_STAGE0',
});

function assertIsolatedConfig(config = CONFIG) {
  const url = new URL(config.mongoUri);
  if (url.hostname !== '127.0.0.1' || url.port !== '27018') {
    throw new Error('stage0_backup_requires_127.0.0.1_27018');
  }
  if (config.databaseName !== 'hydroponic_stage0') {
    throw new Error('stage0_backup_requires_hydroponic_stage0');
  }
  return true;
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error('invalid_backup_arguments');
    values[key.slice(2)] = value;
  }
  return { mode, values };
}

function buildDefaultBackupPath(now = new Date()) {
  const stamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  return path.join(__dirname, '.stage0_backups', `hydroponic_stage0_${stamp}.ejson`);
}

function validateBackupDocument(document) {
  if (!document || document.format !== CONFIG.format) throw new Error('invalid_stage0_backup_format');
  if (document.source?.host !== '127.0.0.1' || document.source?.port !== 27018 || document.source?.database !== CONFIG.databaseName) {
    throw new Error('invalid_stage0_backup_source');
  }
  if (!Array.isArray(document.collections)) throw new Error('invalid_stage0_backup_collections');
  if (document.collectionCount !== document.collections.length) throw new Error('invalid_stage0_backup_collection_total');
  const documentCount = document.collections.reduce((sum, collection) => sum + (Array.isArray(collection?.documents) ? collection.documents.length : 0), 0);
  if (document.documentCount !== documentCount) throw new Error('invalid_stage0_backup_document_total');
  for (const collection of document.collections) {
    if (!collection || typeof collection.name !== 'string' || collection.name.startsWith('system.')) {
      throw new Error('invalid_stage0_backup_collection_name');
    }
    if (!Array.isArray(collection.documents) || collection.count !== collection.documents.length) {
      throw new Error('invalid_stage0_backup_collection_count');
    }
  }
  return document;
}

async function listCollectionDocuments(database) {
  const collectionNames = (await database.listCollections({}, { nameOnly: true }).toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  const collections = [];
  for (const name of collectionNames) {
    const documents = await database.collection(name).find({}).toArray();
    collections.push({ name, count: documents.length, documents });
  }
  return collections;
}

async function assertDatabaseEmpty(database) {
  const collections = await listCollectionDocuments(database);
  const documentCount = collections.reduce((sum, collection) => sum + collection.count, 0);
  if (documentCount !== 0) throw new Error(`stage0_restore_requires_empty_database:${documentCount}`);
}

async function backup(outputPath = buildDefaultBackupPath()) {
  assertIsolatedConfig();
  const resolvedOutput = path.resolve(outputPath);
  const client = new MongoClient(CONFIG.mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const collections = await listCollectionDocuments(client.db(CONFIG.databaseName));
    const document = {
      format: CONFIG.format,
      createdAt: new Date(),
      source: { host: '127.0.0.1', port: 27018, database: CONFIG.databaseName },
      collectionCount: collections.length,
      documentCount: collections.reduce((sum, collection) => sum + collection.count, 0),
      collections,
    };
    await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
    await fs.writeFile(resolvedOutput, EJSON.stringify(document, null, 2, { relaxed: false }), { encoding: 'utf8', flag: 'wx' });
    return { outputPath: resolvedOutput, collectionCount: document.collectionCount, documentCount: document.documentCount };
  } finally {
    await client.close();
  }
}

async function restore(inputPath, confirmation) {
  assertIsolatedConfig();
  if (confirmation !== CONFIG.restoreConfirmation) throw new Error('stage0_restore_confirmation_required');
  if (!inputPath) throw new Error('stage0_restore_input_required');
  const document = validateBackupDocument(EJSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')));
  const client = new MongoClient(CONFIG.mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const database = client.db(CONFIG.databaseName);
    await assertDatabaseEmpty(database);
    for (const collection of document.collections) {
      if (collection.documents.length > 0) await database.collection(collection.name).insertMany(collection.documents, { ordered: true });
    }
    return { collectionCount: document.collectionCount, documentCount: document.documentCount };
  } finally {
    await client.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const { mode, values } = parseArgs(argv);
  if (mode === 'backup') {
    const result = await backup(values.output || buildDefaultBackupPath());
    console.log(JSON.stringify({ ok: true, mode, ...result }, null, 2));
    return;
  }
  if (mode === 'restore') {
    const result = await restore(values.input, values.confirm);
    console.log(JSON.stringify({ ok: true, mode, ...result }, null, 2));
    return;
  }
  throw new Error('usage: stage0Backup.js backup [--output path] | restore --input path --confirm RESTORE_EMPTY_STAGE0');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG,
  assertDatabaseEmpty,
  assertIsolatedConfig,
  backup,
  buildDefaultBackupPath,
  listCollectionDocuments,
  main,
  parseArgs,
  restore,
  validateBackupDocument,
};
