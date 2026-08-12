function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getPath(object, path) {
  return path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  let current = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (!current[keys[index]] || typeof current[keys[index]] !== 'object') current[keys[index]] = {};
    current = current[keys[index]];
  }
  current[keys[keys.length - 1]] = clone(value);
}

function unsetPath(object, path) {
  const keys = path.split('.');
  let current = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (!current[keys[index]] || typeof current[keys[index]] !== 'object') return;
    current = current[keys[index]];
  }
  delete current[keys[keys.length - 1]];
}

function matchesCondition(value, condition) {
  if (!condition || typeof condition !== 'object' || condition instanceof Date || Array.isArray(condition)) {
    return value === condition;
  }
  return Object.entries(condition).every(([operator, expected]) => {
    if (operator === '$in') return expected.includes(value);
    if (operator === '$exists') return expected ? value !== undefined : value === undefined;
    if (operator === '$gte') return value >= expected;
    if (operator === '$gt') return value > expected;
    if (operator === '$lt') return value < expected;
    if (operator === '$lte') return value <= expected;
    if (operator === '$type') return expected === 'number' ? typeof value === 'number' : true;
    if (operator === '$ne') return value !== expected;
    return false;
  });
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([path, condition]) => matchesCondition(getPath(document, path), condition));
}

function applyUpdate(document, update, inserted = false) {
  if (inserted && update.$setOnInsert) {
    for (const [path, value] of Object.entries(update.$setOnInsert)) setPath(document, path, value);
  }
  if (update.$set) {
    for (const [path, value] of Object.entries(update.$set)) setPath(document, path, value);
  }
  if (update.$unset) {
    for (const path of Object.keys(update.$unset)) unsetPath(document, path);
  }
  if (update.$push) {
    for (const [path, value] of Object.entries(update.$push)) {
      const current = getPath(document, path);
      if (!Array.isArray(current)) setPath(document, path, []);
      getPath(document, path).push(clone(value));
    }
  }
}

class FakeCursor {
  constructor(rows) {
    this.rows = rows;
  }

  sort(spec) {
    const entries = Object.entries(spec || {});
    this.rows.sort((left, right) => {
      for (const [path, direction] of entries) {
        const leftValue = getPath(left, path);
        const rightValue = getPath(right, path);
        if (leftValue < rightValue) return -1 * direction;
        if (leftValue > rightValue) return direction;
      }
      return 0;
    });
    return this;
  }

  limit(count) {
    this.rows = this.rows.slice(0, count);
    return this;
  }

  async toArray() {
    return clone(this.rows);
  }
}

class FakeCollection {
  constructor(database, name) {
    this.database = database;
    this.name = name;
  }

  before(method) {
    this.database.before(`${this.name}.${method}`);
  }

  rows() {
    if (!this.database.data[this.name]) this.database.data[this.name] = [];
    return this.database.data[this.name];
  }

  enforceActiveLock(candidate, ignoredDocument = null) {
    if (candidate.activeLock !== true || !['dosing_runs', 'tds_calibration_sets'].includes(this.name)) return;
    const duplicate = this.rows().find((row) => row !== ignoredDocument
      && row.deviceId === candidate.deviceId && row.activeLock === true);
    if (duplicate) {
      const error = new Error('duplicate active lock');
      error.code = 11000;
      error.codeName = 'DuplicateKey';
      throw error;
    }
  }

  enforceTelemetryIdentity(candidate, ignoredDocument = null) {
    const uniqueV2Sensor = this.name === 'sensor_logs'
      && candidate.schemaVersion === 2
      && candidate.telemetryIdentityValid === true;
    const uniqueShadow = this.name === 'shadow_dosing_decisions';
    if (!uniqueV2Sensor && !uniqueShadow) return;
    const duplicate = this.rows().find((row) => row !== ignoredDocument
      && row.deviceId === candidate.deviceId
      && row.measurementId === candidate.measurementId);
    if (duplicate) {
      const error = new Error('duplicate telemetry identity');
      error.code = 11000;
      error.codeName = 'DuplicateKey';
      throw error;
    }
  }

  async findOne(filter, options = {}) {
    this.before('findOne');
    let rows = this.rows().filter((row) => matches(row, filter));
    if (options.sort) rows = new FakeCursor(rows).sort(options.sort).rows;
    return rows.length ? clone(rows[0]) : null;
  }

  find(filter = {}) {
    this.before('find');
    return new FakeCursor(this.rows().filter((row) => matches(row, filter)).map(clone));
  }

  async insertOne(document) {
    this.before('insertOne');
    this.enforceActiveLock(document);
    this.enforceTelemetryIdentity(document);
    this.rows().push(clone(document));
    return { insertedId: document._id || document.runId || document.setId || this.rows().length };
  }

  async updateOne(filter, update, options = {}) {
    this.before('updateOne');
    let document = this.rows().find((row) => matches(row, filter));
    let inserted = false;
    if (!document && options.upsert) {
      document = {};
      for (const [path, value] of Object.entries(filter)) {
        if (!path.startsWith('$') && (!value || typeof value !== 'object' || value instanceof Date)) {
          setPath(document, path, value);
        }
      }
      this.rows().push(document);
      inserted = true;
    }
    if (!document) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    const candidate = clone(document);
    applyUpdate(candidate, update, inserted);
    this.enforceActiveLock(candidate, document);
    this.enforceTelemetryIdentity(candidate, document);
    Object.keys(document).forEach((key) => delete document[key]);
    Object.assign(document, candidate);
    return {
      matchedCount: inserted ? 0 : 1,
      modifiedCount: 1,
      upsertedCount: inserted ? 1 : 0,
    };
  }

  async findOneAndUpdate(filter, update, options = {}) {
    this.before('findOneAndUpdate');
    let document = this.rows().find((row) => matches(row, filter));
    let inserted = false;
    if (!document && options.upsert) {
      document = {};
      for (const [path, value] of Object.entries(filter)) {
        if (!path.startsWith('$') && (!value || typeof value !== 'object' || value instanceof Date)) {
          setPath(document, path, value);
        }
      }
      this.rows().push(document);
      inserted = true;
    }
    if (!document) return null;
    const before = clone(document);
    const candidate = clone(document);
    applyUpdate(candidate, update, inserted);
    this.enforceActiveLock(candidate, document);
    this.enforceTelemetryIdentity(candidate, document);
    Object.keys(document).forEach((key) => delete document[key]);
    Object.assign(document, candidate);
    return clone(options.returnDocument === 'before' ? before : document);
  }

  async createIndex() {
    return `${this.name}_fake_index`;
  }
}

class FakeDatabase {
  constructor(seed = {}) {
    this.data = clone(seed);
    this.failures = new Map();
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection(this, name));
    return this.collections.get(name);
  }

  failOn(key, occurrence = 1, error = new Error(`injected failure: ${key}`)) {
    this.failures.set(key, { occurrence, calls: 0, error });
  }

  before(key) {
    const failure = this.failures.get(key);
    if (!failure) return;
    failure.calls += 1;
    if (failure.calls === failure.occurrence) throw failure.error;
  }

  snapshot() {
    return clone(this.data);
  }

  restore(snapshot) {
    this.data = clone(snapshot);
  }
}

class FakeSession {
  constructor(database) {
    this.database = database;
  }

  async withTransaction(work) {
    const snapshot = this.database.snapshot();
    try {
      return await work();
    } catch (error) {
      this.database.restore(snapshot);
      throw error;
    }
  }

  async endSession() {}
}

class FakeMongoClient {
  constructor(database) {
    this.database = database;
  }

  startSession() {
    return new FakeSession(this.database);
  }
}

module.exports = {
  FakeDatabase,
  FakeMongoClient,
  getPath,
  matches,
};
