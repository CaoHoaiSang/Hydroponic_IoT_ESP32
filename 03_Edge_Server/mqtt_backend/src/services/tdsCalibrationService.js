const crypto = require('crypto');

const { getDb, getMongoClient } = require('../mongoClient');
const {
  TDS_CALIBRATION_MIN_POINTS,
  TDS_FACTOR,
  TDS_REFERENCE_PPM_TOLERANCE,
  TDS_REFERENCE_SCALE,
  TDS_TEMPERATURE_ALPHA_PER_C,
  TDS_TEMPERATURE_REFERENCE_C,
} = require('../config/tdsQualityConfig');
const {
  getModernCalibrationPointReasons,
  validateCalibrationPoint,
  validateCalibrationSet,
} = require('../validators/tdsCalibrationSetValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function createSetId() {
  return `tds_set_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function calculateTemperatureFactor(waterTemp) {
  if (!isFiniteNumber(waterTemp) || waterTemp < 0 || waterTemp > 50 || waterTemp === 85) {
    return null;
  }

  return 1 + TDS_TEMPERATURE_ALPHA_PER_C * (waterTemp - TDS_TEMPERATURE_REFERENCE_C);
}

function calculateVoltage25(voltage, waterTemp) {
  const temperatureFactor = calculateTemperatureFactor(waterTemp);

  if (!isFiniteNumber(voltage) || voltage <= 0 || !temperatureFactor) {
    return {
      voltage25: null,
      temperatureCompensated: false,
      temperatureFactorUsed: temperatureFactor,
    };
  }

  return {
    voltage25: roundTo(voltage / temperatureFactor, 6),
    temperatureCompensated: true,
    temperatureFactorUsed: temperatureFactor,
  };
}

function buildSetValidation(points, expectedDeviceId, expectedSetId) {
  const errors = [];
  const warnings = [];
  const normalizedPoints = Array.isArray(points) ? [...points] : [];

  if (normalizedPoints.length < TDS_CALIBRATION_MIN_POINTS) {
    errors.push(`calibration set requires at least ${TDS_CALIBRATION_MIN_POINTS} valid points`);
  }

  for (const point of normalizedPoints) {
    const pointValidation = validateCalibrationPoint(expectedDeviceId, expectedSetId, point);
    const completenessReasons = getModernCalibrationPointReasons(point);
    if (!pointValidation.ok) {
      errors.push(...pointValidation.errors.map((error) => `point invalid: ${error}`));
    }
    if (completenessReasons.length > 0) {
      errors.push(...completenessReasons.map((reason) => `point metadata invalid: ${reason}`));
    }
    if (
      !isFiniteNumber(point.measuredVoltage25)
      || Math.abs(point.measuredVoltage25 - pointValidation.value.measuredVoltage25) > 0.000001
    ) {
      errors.push('stored measuredVoltage25 does not match voltage and temperature');
    }
    if (point.deviceId !== expectedDeviceId) errors.push('all points must match the set deviceId');
    if (point.calibrationSetId !== expectedSetId) errors.push('all points must match calibrationSetId');
    if (point.referenceScale !== TDS_REFERENCE_SCALE) errors.push('all points must use scale 500');
    if (point.tdsFactor !== TDS_FACTOR) errors.push('all points must use tdsFactor 0.5');
    if (!isFiniteNumber(point.waterTemp) || point.waterTemp < 0 || point.waterTemp > 50 || point.waterTemp === 85) {
      errors.push('all points must contain valid water temperature from 0 to 50 C');
    }
    if (point.temperatureCompensated !== true || !isFiniteNumber(point.measuredVoltage25)) {
      errors.push('all points must be temperature compensated to 25 C');
    }
    if (!isFiniteNumber(point.referenceEcUsCm) || point.referenceEcUsCm <= 0) {
      errors.push('all points must contain a valid EC reference');
    }
    if (
      !isFiniteNumber(point.referenceTdsPpm)
      || !isFiniteNumber(point.referenceEcUsCm)
      || Math.abs(point.referenceTdsPpm - point.referenceEcUsCm * TDS_FACTOR)
        > TDS_REFERENCE_PPM_TOLERANCE
    ) {
      errors.push('referenceTdsPpm must be derived from EC using factor 0.5');
    }
    if (point.legacy === true || point.legacyReasons) {
      errors.push('legacy calibration data cannot activate automatically');
    }
    if (point.method !== 'piecewise_linear_ec') errors.push('all points must use piecewise_linear_ec');
  }

  const sorted = normalizedPoints.sort((left, right) => left.measuredVoltage25 - right.measuredVoltage25);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.measuredVoltage25 === previous.measuredVoltage25) {
      errors.push('calibration voltages must be unique');
    } else if (current.measuredVoltage25 < previous.measuredVoltage25) {
      errors.push('measuredVoltage25 must increase strictly');
    }
    if (current.referenceEcUsCm === previous.referenceEcUsCm) {
      errors.push('reference EC values must be unique');
    } else if (current.referenceEcUsCm < previous.referenceEcUsCm) {
      errors.push('referenceEcUsCm must increase with measuredVoltage25');
    }
  }

  const uniqueErrors = [...new Set(errors)];
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;

  return {
    ok: uniqueErrors.length === 0,
    status: uniqueErrors.length === 0 ? 'valid' : 'invalid',
    errors: uniqueErrors,
    warnings,
    pointCount: sorted.length,
    minVoltage25: first ? first.measuredVoltage25 : null,
    maxVoltage25: last ? last.measuredVoltage25 : null,
    minReferenceEcUsCm: first ? first.referenceEcUsCm : null,
    maxReferenceEcUsCm: last ? last.referenceEcUsCm : null,
    minReferenceTdsPpm: first ? first.referenceTdsPpm : null,
    maxReferenceTdsPpm: last ? last.referenceTdsPpm : null,
    points: sorted,
  };
}

function interpolateEcWithinRange(voltage25, points) {
  if (!Array.isArray(points) || points.length < TDS_CALIBRATION_MIN_POINTS) return null;
  const sorted = [...points].sort((left, right) => left.measuredVoltage25 - right.measuredVoltage25);
  if (voltage25 < sorted[0].measuredVoltage25 || voltage25 > sorted[sorted.length - 1].measuredVoltage25) {
    return null;
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const lower = sorted[index];
    const upper = sorted[index + 1];
    if (voltage25 >= lower.measuredVoltage25 && voltage25 <= upper.measuredVoltage25) {
      const ratio = (voltage25 - lower.measuredVoltage25)
        / (upper.measuredVoltage25 - lower.measuredVoltage25);
      return lower.referenceEcUsCm
        + ratio * (upper.referenceEcUsCm - lower.referenceEcUsCm);
    }
  }

  return null;
}

function buildBaseCalibrationResult() {
  return {
    tdsVoltage25: null,
    ecUsCm: null,
    tdsPpm: null,
    tdsFactor: TDS_FACTOR,
    tdsScale: TDS_REFERENCE_SCALE,
    tdsCalibrationSetId: null,
    tdsCalibrationMode: 'none',
    tdsCalibrationPointCount: 0,
    tdsCalibrationInRange: false,
    tdsCalibrationWarning: 'tds_calibration_set_missing',
    tdsTemperatureCompensated: false,
    tdsTemperatureAlphaPerC: TDS_TEMPERATURE_ALPHA_PER_C,
    tdsTemperatureFactorUsed: null,
    tdsTemperatureReferenceC: TDS_TEMPERATURE_REFERENCE_C,
    tdsMeasurementValid: false,
    tdsMeasurementInvalidReasons: ['tds_calibration_set_missing'],
  };
}

async function createTdsCalibrationSet(deviceId, body) {
  const validation = validateCalibrationSet(deviceId, body || {});
  if (!validation.ok) return { ok: false, error: 'validation_failed', errors: validation.errors };

  const database = getDb();
  const now = new Date();
  const set = {
    setId: createSetId(),
    deviceId: validation.value.deviceId,
    status: 'draft',
    method: 'piecewise_linear_ec',
    referenceScale: TDS_REFERENCE_SCALE,
    tdsFactor: TDS_FACTOR,
    temperatureReferenceC: TDS_TEMPERATURE_REFERENCE_C,
    temperatureAlphaPerC: TDS_TEMPERATURE_ALPHA_PER_C,
    pointCount: 0,
    validationStatus: 'not_validated',
    validationErrors: [],
    validationWarnings: [],
    minVoltage25: null,
    maxVoltage25: null,
    minReferenceEcUsCm: null,
    maxReferenceEcUsCm: null,
    minReferenceTdsPpm: null,
    maxReferenceTdsPpm: null,
    referenceMeter: validation.value.referenceMeter,
    note: validation.value.note,
    lifecycleHistory: [{ action: 'created', fromStatus: null, toStatus: 'draft', at: now }],
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    retiredAt: null,
  };
  await database.collection('tds_calibration_sets').insertOne(set);
  return { ok: true, data: set };
}

async function getTdsCalibrationSets(deviceId, limit) {
  const database = getDb();
  return database.collection('tds_calibration_sets')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizeLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT))
    .toArray();
}

async function getTdsCalibrationSet(deviceId, setId) {
  const database = getDb();
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set) return null;
  const points = await database.collection('tds_calibrations')
    .find({ deviceId, calibrationSetId: setId })
    .sort({ measuredVoltage25: 1 })
    .toArray();
  return { ...set, points };
}

async function getActiveTdsCalibrationSet(deviceId) {
  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId });
  const setId = device && device.activeTdsCalibrationSetId;
  if (!setId) return null;
  const set = await getTdsCalibrationSet(deviceId, setId);
  return set && set.status === 'active' ? set : null;
}

async function refreshSetValidation(database, set, { session = null } = {}) {
  const options = session ? { session } : {};
  const points = await database.collection('tds_calibrations')
    .find({ deviceId: set.deviceId, calibrationSetId: set.setId }, options)
    .sort({ measuredVoltage25: 1 })
    .toArray();
  const validation = buildSetValidation(points, set.deviceId, set.setId);
  const now = new Date();
  const fields = {
    pointCount: validation.pointCount,
    validationStatus: validation.status,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    minVoltage25: validation.minVoltage25,
    maxVoltage25: validation.maxVoltage25,
    minReferenceEcUsCm: validation.minReferenceEcUsCm,
    maxReferenceEcUsCm: validation.maxReferenceEcUsCm,
    minReferenceTdsPpm: validation.minReferenceTdsPpm,
    maxReferenceTdsPpm: validation.maxReferenceTdsPpm,
    validatedAt: now,
    updatedAt: now,
  };
  await database.collection('tds_calibration_sets').updateOne({ setId: set.setId }, { $set: fields }, options);
  return { ...validation, fields };
}

async function addTdsCalibrationPoint(deviceId, setId, body) {
  const validation = validateCalibrationPoint(deviceId, setId, body || {});
  if (!validation.ok) return { ok: false, error: 'validation_failed', errors: validation.errors };
  const database = getDb();
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set) return { ok: false, error: 'not_found', errors: ['calibration set not found'] };
  if (set.status !== 'draft') {
    return { ok: false, error: 'lifecycle_conflict', errors: ['points can only be added to a draft set'] };
  }
  const point = { ...validation.value, measuredVoltage25: roundTo(validation.value.measuredVoltage25, 6), createdAt: new Date() };
  await database.collection('tds_calibrations').insertOne(point);
  const refreshed = await refreshSetValidation(database, set);
  return { ok: true, data: point, setValidation: refreshed };
}

async function validateTdsCalibrationSet(deviceId, setId) {
  const database = getDb();
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set) return { ok: false, error: 'not_found', errors: ['calibration set not found'] };
  const validation = await refreshSetValidation(database, set);
  return { ok: validation.ok, error: validation.ok ? null : 'validation_failed', data: validation, errors: validation.errors };
}

class CalibrationLifecycleError extends Error {
  constructor(code, message, validation = null) {
    super(message);
    this.name = 'CalibrationLifecycleError';
    this.code = code;
    this.validation = validation;
  }
}

function requireWriteApplied(result, label, { allowUpsert = false } = {}) {
  if (!result || result.matchedCount === undefined) return;
  const applied = result.matchedCount === 1 || (allowUpsert && result.upsertedCount === 1);
  if (!applied) throw new CalibrationLifecycleError('lifecycle_conflict', `${label} did not match the expected lifecycle state`);
}

function isTransactionUnsupported(error) {
  const message = error && error.message ? error.message : '';
  return Boolean(error) && (
    error.code === 20
    || error.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set member or mongos/i.test(message)
  );
}

async function runWithOptionalTransaction(work) {
  const mongoClient = getMongoClient();
  if (!mongoClient || typeof mongoClient.startSession !== 'function') {
    return { usedTransaction: false, result: null };
  }
  const session = mongoClient.startSession();
  try {
    const result = await session.withTransaction(() => work(session));
    return { usedTransaction: true, result };
  } catch (error) {
    if (isTransactionUnsupported(error)) return { usedTransaction: false, result: null };
    throw error;
  } finally {
    await session.endSession();
  }
}

async function performActivationWrites(database, deviceId, setId, now, session, state) {
  const options = session ? { session } : {};
  const set = await database.collection('tds_calibration_sets').findOne(
    { deviceId, setId, status: 'draft' },
    options,
  );
  if (!set) throw new CalibrationLifecycleError('lifecycle_conflict', 'only a draft set can be activated');
  const validation = await refreshSetValidation(database, set, { session });
  if (!validation.ok) {
    throw new CalibrationLifecycleError('validation_failed', 'calibration set validation failed', validation);
  }

  const device = await database.collection('devices').findOne({ deviceId }, options);
  const previousSetId = device && device.activeTdsCalibrationSetId;
  state.previousSetId = previousSetId || null;
  if (previousSetId && previousSetId !== setId) {
    const retireResult = await database.collection('tds_calibration_sets').updateOne(
      { deviceId, setId: previousSetId, status: 'active' },
      {
        $set: { status: 'retired', retiredAt: now, updatedAt: now },
        $unset: { activeLock: '' },
        $push: { lifecycleHistory: { action: 'retired_for_replacement', fromStatus: 'active', toStatus: 'retired', at: now } },
      },
      options,
    );
    requireWriteApplied(retireResult, 'retire previous active calibration set');
    state.previousRetired = true;
  }

  const activateResult = await database.collection('tds_calibration_sets').updateOne(
    { deviceId, setId, status: 'draft' },
    {
      $set: { status: 'active', activeLock: true, activatedAt: now, retiredAt: null, updatedAt: now },
      $push: { lifecycleHistory: { action: 'activated', fromStatus: 'draft', toStatus: 'active', at: now } },
    },
    options,
  );
  requireWriteApplied(activateResult, 'activate calibration set');
  state.targetActivated = true;

  const pointerResult = await database.collection('devices').updateOne(
    { deviceId },
    { $set: { activeTdsCalibrationSetId: setId, updatedAt: now }, $setOnInsert: { deviceId, createdAt: now } },
    { ...options, upsert: true },
  );
  requireWriteApplied(pointerResult, 'update active calibration pointer', { allowUpsert: true });
  state.pointerChanged = true;

  const settingsResult = await database.collection('auto_dosing_settings').updateOne(
    { deviceId },
    {
      $set: { enabled: false, lastEvaluationReason: 'tds_calibration_set_changed', updatedAt: now },
      $setOnInsert: { deviceId, createdAt: now },
    },
    { ...options, upsert: true },
  );
  requireWriteApplied(settingsResult, 'disable Auto Dosing after calibration activation', { allowUpsert: true });
  return { previousSetId: previousSetId || null, validation };
}

async function rollbackActivation(database, deviceId, setId, state, cause) {
  const rollbackAt = new Date();
  const errors = [];
  async function attempt(label, operation) {
    try {
      const result = await operation();
      if (result && result.matchedCount !== undefined && result.matchedCount !== 1) {
        errors.push(`${label}: rollback write did not match`);
      }
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  if (state.targetActivated) {
    await attempt('restore target draft', () => database.collection('tds_calibration_sets').updateOne(
      { deviceId, setId, status: 'active' },
      {
        $set: { status: 'draft', activatedAt: null, updatedAt: rollbackAt },
        $unset: { activeLock: '' },
        $push: { lifecycleHistory: { action: 'activation_rollback', fromStatus: 'active', toStatus: 'draft', at: rollbackAt, reason: cause.message } },
      },
    ));
  }
  if (state.previousRetired && state.previousSetId) {
    await attempt('restore previous active set', () => database.collection('tds_calibration_sets').updateOne(
      { deviceId, setId: state.previousSetId, status: 'retired' },
      { $set: { status: 'active', activeLock: true, retiredAt: null, updatedAt: rollbackAt } },
    ));
  }
  if (state.pointerChanged) {
    if (state.previousSetId) {
      await attempt('restore previous active pointer', () => database.collection('devices').updateOne(
        { deviceId, activeTdsCalibrationSetId: setId },
        { $set: { activeTdsCalibrationSetId: state.previousSetId, updatedAt: rollbackAt } },
      ));
    } else {
      await attempt('clear first activation pointer', () => database.collection('devices').updateOne(
        { deviceId, activeTdsCalibrationSetId: setId },
        { $unset: { activeTdsCalibrationSetId: '' }, $set: { updatedAt: rollbackAt } },
      ));
    }
  }
  if (errors.length > 0) {
    const rollbackError = new Error(`Calibration activation failed and rollback was incomplete: ${errors.join('; ')}`);
    rollbackError.cause = cause;
    throw rollbackError;
  }
}

async function activateTdsCalibrationSet(deviceId, setId) {
  const database = getDb();
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set) return { ok: false, error: 'not_found', errors: ['calibration set not found'] };
  if (set.status !== 'draft') {
    return { ok: false, error: 'lifecycle_conflict', errors: ['only a draft set can be activated'] };
  }
  const now = new Date();
  try {
    const transactionResult = await runWithOptionalTransaction((session) => (
      performActivationWrites(database, deviceId, setId, now, session, {})
    ));
    if (!transactionResult.usedTransaction) {
      const state = { previousSetId: null, previousRetired: false, targetActivated: false, pointerChanged: false };
      try {
        await performActivationWrites(database, deviceId, setId, now, null, state);
      } catch (error) {
        await rollbackActivation(database, deviceId, setId, state, error);
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof CalibrationLifecycleError) {
      return {
        ok: false,
        error: error.code,
        errors: error.validation ? error.validation.errors : [error.message],
        data: error.validation,
      };
    }
    if (error && error.code === 11000) {
      return { ok: false, error: 'lifecycle_conflict', errors: ['another calibration activation is in progress or active'] };
    }
    throw error;
  }
  return { ok: true, data: await getTdsCalibrationSet(deviceId, setId) };
}

async function performRetireWrites(database, deviceId, setId, now, session, state) {
  const options = session ? { session } : {};
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId }, options);
  if (!set) throw new CalibrationLifecycleError('not_found', 'calibration set not found');
  if (set.status === 'retired') return { alreadyRetired: true };
  if (!['draft', 'active'].includes(set.status)) {
    throw new CalibrationLifecycleError('lifecycle_conflict', 'calibration set cannot be retired from its current state');
  }
  const device = await database.collection('devices').findOne({ deviceId }, options);
  const wasActivePointer = Boolean(device && device.activeTdsCalibrationSetId === setId);
  state.previousStatus = set.status;
  state.wasActivePointer = wasActivePointer;

  const retireResult = await database.collection('tds_calibration_sets').updateOne(
    { deviceId, setId, status: set.status },
    {
      $set: { status: 'retired', retiredAt: now, updatedAt: now },
      $unset: { activeLock: '' },
      $push: { lifecycleHistory: { action: 'retired', fromStatus: set.status, toStatus: 'retired', at: now } },
    },
    options,
  );
  requireWriteApplied(retireResult, 'retire calibration set');
  state.setRetired = true;

  if (wasActivePointer) {
    const pointerResult = await database.collection('devices').updateOne(
      { deviceId, activeTdsCalibrationSetId: setId },
      { $unset: { activeTdsCalibrationSetId: '' }, $set: { updatedAt: now } },
      options,
    );
    requireWriteApplied(pointerResult, 'clear active calibration pointer');
    state.pointerCleared = true;
    const settingsResult = await database.collection('auto_dosing_settings').updateOne(
      { deviceId },
      {
        $set: { enabled: false, lastEvaluationReason: 'tds_calibration_set_inactive', updatedAt: now },
        $setOnInsert: { deviceId, createdAt: now },
      },
      { ...options, upsert: true },
    );
    requireWriteApplied(settingsResult, 'disable Auto Dosing after calibration retirement', { allowUpsert: true });
  }
  return { alreadyRetired: false };
}

async function rollbackRetirement(database, deviceId, setId, state, cause) {
  const rollbackAt = new Date();
  const errors = [];
  async function attempt(label, operation) {
    try {
      const result = await operation();
      if (result && result.matchedCount !== undefined && result.matchedCount !== 1) {
        errors.push(`${label}: rollback write did not match`);
      }
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
  if (state.setRetired) {
    await attempt('restore retired calibration set', () => database.collection('tds_calibration_sets').updateOne(
      { deviceId, setId, status: 'retired' },
      {
        $set: {
          status: state.previousStatus,
          ...(state.previousStatus === 'active' ? { activeLock: true } : {}),
          retiredAt: null,
          updatedAt: rollbackAt,
        },
        $push: { lifecycleHistory: { action: 'retirement_rollback', fromStatus: 'retired', toStatus: state.previousStatus, at: rollbackAt, reason: cause.message } },
      },
    ));
  }
  if (state.pointerCleared && state.wasActivePointer) {
    await attempt('restore retired active pointer', () => database.collection('devices').updateOne(
      { deviceId, activeTdsCalibrationSetId: { $exists: false } },
      { $set: { activeTdsCalibrationSetId: setId, updatedAt: rollbackAt } },
    ));
  }
  if (errors.length > 0) {
    const rollbackError = new Error(`Calibration retirement failed and rollback was incomplete: ${errors.join('; ')}`);
    rollbackError.cause = cause;
    throw rollbackError;
  }
}

async function retireTdsCalibrationSet(deviceId, setId) {
  const database = getDb();
  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set) return { ok: false, error: 'not_found', errors: ['calibration set not found'] };
  if (set.status === 'retired') return { ok: true, data: set };
  const now = new Date();
  try {
    const transactionResult = await runWithOptionalTransaction((session) => (
      performRetireWrites(database, deviceId, setId, now, session, {})
    ));
    if (!transactionResult.usedTransaction) {
      const state = {
        previousStatus: null,
        wasActivePointer: false,
        setRetired: false,
        pointerCleared: false,
      };
      try {
        await performRetireWrites(database, deviceId, setId, now, null, state);
      } catch (error) {
        await rollbackRetirement(database, deviceId, setId, state, error);
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof CalibrationLifecycleError) {
      return { ok: false, error: error.code, errors: [error.message] };
    }
    throw error;
  }
  return { ok: true, data: await getTdsCalibrationSet(deviceId, setId) };
}

async function applyTdsCalibration(deviceId, sensorPayload) {
  const result = buildBaseCalibrationResult();
  const temperature = calculateVoltage25(sensorPayload && sensorPayload.tdsVoltage, sensorPayload && sensorPayload.waterTemp);
  result.tdsVoltage25 = temperature.voltage25;
  result.tdsTemperatureCompensated = temperature.temperatureCompensated;
  result.tdsTemperatureFactorUsed = temperature.temperatureFactorUsed;
  if (!temperature.temperatureCompensated) {
    result.tdsCalibrationWarning = 'tds_temperature_not_compensated';
    result.tdsMeasurementInvalidReasons = ['tds_temperature_not_compensated'];
    return result;
  }

  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId });
  const setId = device && device.activeTdsCalibrationSetId;
  result.tdsCalibrationSetId = setId || null;
  if (!setId) return result;

  const set = await database.collection('tds_calibration_sets').findOne({ deviceId, setId });
  if (!set || set.status !== 'active') {
    result.tdsCalibrationWarning = 'tds_calibration_set_inactive';
    result.tdsMeasurementInvalidReasons = ['tds_calibration_set_inactive'];
    return result;
  }

  const points = await database.collection('tds_calibrations')
    .find({ deviceId, calibrationSetId: setId })
    .sort({ measuredVoltage25: 1 })
    .toArray();
  const validation = buildSetValidation(points, deviceId, setId);
  result.tdsCalibrationMode = 'piecewise_linear_ec';
  result.tdsCalibrationPointCount = validation.pointCount;
  if (!validation.ok) {
    result.tdsCalibrationWarning = 'tds_calibration_set_invalid';
    result.tdsMeasurementInvalidReasons = ['tds_calibration_set_invalid'];
    return result;
  }

  if (temperature.voltage25 < validation.minVoltage25) {
    result.tdsCalibrationWarning = 'tds_voltage_below_calibration_range';
    result.tdsMeasurementInvalidReasons = ['tds_outside_calibration_range'];
    return result;
  }
  if (temperature.voltage25 > validation.maxVoltage25) {
    result.tdsCalibrationWarning = 'tds_voltage_above_calibration_range';
    result.tdsMeasurementInvalidReasons = ['tds_outside_calibration_range'];
    return result;
  }

  const ecUsCm = interpolateEcWithinRange(temperature.voltage25, validation.points);
  if (!isFiniteNumber(ecUsCm)) {
    result.tdsCalibrationWarning = 'tds_interpolation_failed';
    result.tdsMeasurementInvalidReasons = ['tds_interpolation_failed'];
    return result;
  }

  result.ecUsCm = roundTo(ecUsCm, 2);
  result.tdsPpm = roundTo(ecUsCm * TDS_FACTOR, 2);
  result.tdsCalibrationInRange = true;
  result.tdsCalibrationWarning = null;
  result.tdsMeasurementValid = true;
  result.tdsMeasurementInvalidReasons = [];
  return result;
}

async function saveTdsCalibration(deviceId, body) {
  const setId = body && body.calibrationSetId;
  if (typeof setId !== 'string' || !setId.trim()) {
    return { ok: false, error: 'validation_failed', errors: ['calibrationSetId is required'] };
  }
  return addTdsCalibrationPoint(deviceId, setId.trim(), body);
}

async function getLatestTdsCalibration(deviceId) {
  const database = getDb();
  const calibration = await database.collection('tds_calibrations')
    .findOne({ deviceId }, { sort: { createdAt: -1 } });
  return calibration ? { ...calibration, legacy: !calibration.calibrationSetId, active: false } : null;
}

async function getTdsCalibrationHistory(deviceId, limit) {
  const database = getDb();
  const rows = await database.collection('tds_calibrations')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizeLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT))
    .toArray();
  return rows.map((row) => ({ ...row, legacy: !row.calibrationSetId, active: false }));
}

module.exports = {
  calculateTemperatureFactor,
  calculateVoltage25,
  buildSetValidation,
  interpolateEcWithinRange,
  buildBaseCalibrationResult,
  createTdsCalibrationSet,
  getTdsCalibrationSets,
  getTdsCalibrationSet,
  getActiveTdsCalibrationSet,
  addTdsCalibrationPoint,
  validateTdsCalibrationSet,
  activateTdsCalibrationSet,
  retireTdsCalibrationSet,
  applyTdsCalibration,
  saveTdsCalibration,
  getLatestTdsCalibration,
  getTdsCalibrationHistory,
};
