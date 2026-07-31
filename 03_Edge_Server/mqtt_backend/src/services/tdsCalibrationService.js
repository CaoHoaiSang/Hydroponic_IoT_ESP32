const { getDb } = require('../mongoClient');
const { validateTdsCalibration } = require('../validators/tdsCalibrationValidator');
const { normalizeLimit } = require('./deviceQueryService');

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;
const DEFAULT_POINT_LIMIT = 10;
const TDS_TEMP_REFERENCE_C = 25;
const TDS_TEMP_COEFFICIENT = 0.02;

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function combineWarnings(...warnings) {
  const filtered = warnings.filter((warning) => typeof warning === 'string' && warning.length > 0);
  return filtered.length > 0 ? filtered.join('; ') : null;
}

function calculateTemperatureCoefficient(waterTemp) {
  if (!isFiniteNumber(waterTemp)) {
    return null;
  }

  const coefficient = 1 + TDS_TEMP_COEFFICIENT * (waterTemp - TDS_TEMP_REFERENCE_C);
  return Number.isFinite(coefficient) && coefficient > 0 ? coefficient : null;
}

function calculateVoltage25(voltage, waterTemp) {
  if (!isFiniteNumber(voltage)) {
    return {
      voltage25: null,
      temperatureCompensated: false,
      temperatureReferenceC: TDS_TEMP_REFERENCE_C,
      temperatureCoefficient: TDS_TEMP_COEFFICIENT,
      warning: 'tds_voltage_invalid',
    };
  }

  const temperatureCoefficient = calculateTemperatureCoefficient(waterTemp);

  if (temperatureCoefficient === null) {
    return {
      voltage25: voltage,
      temperatureCompensated: false,
      temperatureReferenceC: TDS_TEMP_REFERENCE_C,
      temperatureCoefficient: TDS_TEMP_COEFFICIENT,
      warning: 'water_temp_missing_for_tds_compensation',
    };
  }

  return {
    voltage25: roundTo(voltage / temperatureCoefficient, 6),
    temperatureCompensated: true,
    temperatureReferenceC: TDS_TEMP_REFERENCE_C,
    temperatureCoefficient: TDS_TEMP_COEFFICIENT,
    warning: null,
  };
}

function isUsableCalibrationPoint(point) {
  return point
    && isFiniteNumber(point.measuredVoltage25)
    && point.measuredVoltage25 > 0
    && isFiniteNumber(point.referenceTdsPpm)
    && point.referenceTdsPpm >= 0;
}

function getCalibrationFactor(point) {
  return point.referenceTdsPpm / point.measuredVoltage25;
}

function normalizeCalibrationPoint(point) {
  if (!point || !isFiniteNumber(point.measuredVoltage) || point.measuredVoltage <= 0) {
    return null;
  }

  if (!isFiniteNumber(point.referenceTdsPpm) || point.referenceTdsPpm < 0) {
    return null;
  }

  if (isFiniteNumber(point.measuredVoltage25) && point.measuredVoltage25 > 0) {
    return {
      ...point,
      calibrationFactor: point.referenceTdsPpm / point.measuredVoltage25,
      temperatureCompensated: point.temperatureCompensated === true,
      temperatureReferenceC: point.temperatureReferenceC || TDS_TEMP_REFERENCE_C,
      temperatureCoefficient: point.temperatureCoefficient || TDS_TEMP_COEFFICIENT,
      pointWarning: null,
    };
  }

  if (isFiniteNumber(point.waterTemp)) {
    const voltage25Info = calculateVoltage25(point.measuredVoltage, point.waterTemp);

    return {
      ...point,
      measuredVoltage25: voltage25Info.voltage25,
      calibrationFactor: point.referenceTdsPpm / voltage25Info.voltage25,
      temperatureCompensated: voltage25Info.temperatureCompensated,
      temperatureReferenceC: voltage25Info.temperatureReferenceC,
      temperatureCoefficient: voltage25Info.temperatureCoefficient,
      pointWarning: voltage25Info.warning,
    };
  }

  return {
    ...point,
    measuredVoltage25: point.measuredVoltage,
    calibrationFactor: point.referenceTdsPpm / point.measuredVoltage,
    temperatureCompensated: false,
    temperatureReferenceC: TDS_TEMP_REFERENCE_C,
    temperatureCoefficient: TDS_TEMP_COEFFICIENT,
    pointWarning: 'legacy_calibration_without_temperature_compensation',
  };
}

function normalizeCalibrationPoints(points) {
  return points
    .map(normalizeCalibrationPoint)
    .filter(Boolean);
}

function getPointWarnings(points) {
  return points
    .map((point) => point.pointWarning)
    .filter((warning, index, warnings) => warning && warnings.indexOf(warning) === index);
}

function buildNoCalibrationResult() {
  return {
    tdsPpm: null,
    tdsVoltage25: null,
    tdsTemperatureCompensated: false,
    tdsTemperatureCoefficientUsed: TDS_TEMP_COEFFICIENT,
    tdsTemperatureReferenceC: TDS_TEMP_REFERENCE_C,
    tdsCalibrationFactorUsed: null,
    tdsCalibrationId: null,
    tdsCalibrationMode: 'none',
    tdsCalibrationPointCount: 0,
    tdsCalibrationInRange: null,
    tdsCalibrationPointIds: [],
    tdsCalibrationWarning: null,
  };
}

function buildOnePointResult(voltage25, point, pointWarnings = []) {
  const calibrationFactor = getCalibrationFactor(point);

  return {
    tdsPpm: roundTo(Math.max(0, voltage25 * calibrationFactor), 2),
    tdsCalibrationFactorUsed: calibrationFactor,
    tdsCalibrationId: point._id,
    tdsCalibrationMode: 'one_point_voltage_factor',
    tdsCalibrationPointCount: 1,
    tdsCalibrationInRange: false,
    tdsCalibrationPointIds: [point._id],
    tdsCalibrationWarning: combineWarnings('one_point_calibration_only', ...pointWarnings),
  };
}

function findInterpolationPair(voltage25, points) {
  if (voltage25 < points[0].measuredVoltage25) {
    return {
      point1: points[0],
      point2: points[1],
      inRange: false,
      warning: 'tds_voltage_below_calibration_range',
    };
  }

  const lastIndex = points.length - 1;

  if (voltage25 > points[lastIndex].measuredVoltage25) {
    return {
      point1: points[lastIndex - 1],
      point2: points[lastIndex],
      inRange: false,
      warning: 'tds_voltage_above_calibration_range',
    };
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const point1 = points[index];
    const point2 = points[index + 1];

    if (voltage25 >= point1.measuredVoltage25 && voltage25 <= point2.measuredVoltage25) {
      return {
        point1,
        point2,
        inRange: true,
        warning: null,
      };
    }
  }

  return {
    point1: points[0],
    point2: points[1],
    inRange: false,
    warning: 'tds_voltage_outside_calibration_range',
  };
}

function calculatePiecewiseTdsPpm(voltage25, points) {
  const normalizedPoints = normalizeCalibrationPoints(points);
  const pointWarnings = getPointWarnings(normalizedPoints);
  const sortedPoints = normalizedPoints
    .filter(isUsableCalibrationPoint)
    .sort((left, right) => left.measuredVoltage25 - right.measuredVoltage25);

  if (sortedPoints.length === 0) {
    return buildNoCalibrationResult();
  }

  if (sortedPoints.length === 1) {
    return buildOnePointResult(voltage25, sortedPoints[0], pointWarnings);
  }

  const pair = findInterpolationPair(voltage25, sortedPoints);
  const voltage1 = pair.point1.measuredVoltage25;
  const voltage2 = pair.point2.measuredVoltage25;

  if (voltage1 === voltage2) {
    const fallback = buildOnePointResult(voltage25, pair.point1, pointWarnings);
    fallback.tdsCalibrationPointCount = sortedPoints.length;
    fallback.tdsCalibrationWarning = combineWarnings('duplicate_calibration_voltage', ...pointWarnings);
    return fallback;
  }

  const ppm1 = pair.point1.referenceTdsPpm;
  const ppm2 = pair.point2.referenceTdsPpm;
  const slope = (ppm2 - ppm1) / (voltage2 - voltage1);
  const intercept = ppm1 - slope * voltage1;
  const tdsPpm = Math.max(0, slope * voltage25 + intercept);

  return {
    tdsPpm: roundTo(tdsPpm, 2),
    tdsCalibrationFactorUsed: roundTo(slope, 6),
    tdsCalibrationId: pair.point2._id,
    tdsCalibrationMode: 'piecewise_linear',
    tdsCalibrationPointCount: sortedPoints.length,
    tdsCalibrationInRange: pair.inRange,
    tdsCalibrationPointIds: [pair.point1._id, pair.point2._id],
    tdsCalibrationWarning: combineWarnings(pair.warning, ...pointWarnings),
  };
}

async function saveTdsCalibration(deviceId, body) {
  const validation = validateTdsCalibration(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  const database = getDb();
  const now = new Date();
  const value = validation.value;
  const voltage25Info = calculateVoltage25(value.measuredVoltage, value.waterTemp);
  const calibrationFactor = value.referenceTdsPpm / voltage25Info.voltage25;
  const calibration = {
    deviceId: value.deviceId,
    measuredRaw: value.measuredRaw,
    measuredVoltage: value.measuredVoltage,
    measuredVoltage25: voltage25Info.voltage25,
    referenceTdsPpm: value.referenceTdsPpm,
    waterTemp: value.waterTemp,
    temperatureCompensated: voltage25Info.temperatureCompensated,
    temperatureReferenceC: voltage25Info.temperatureReferenceC,
    temperatureCoefficient: voltage25Info.temperatureCoefficient,
    calibrationFactor,
    method: value.method,
    note: value.note,
    createdAt: now,
  };

  await database.collection('tds_calibrations').insertOne(calibration);

  await database.collection('devices').updateOne(
    { deviceId: value.deviceId },
    {
      $set: {
        latestTdsCalibration: {
          calibrationFactor: calibration.calibrationFactor,
          referenceTdsPpm: calibration.referenceTdsPpm,
          measuredVoltage: calibration.measuredVoltage,
          measuredVoltage25: calibration.measuredVoltage25,
          measuredRaw: calibration.measuredRaw,
          waterTemp: calibration.waterTemp,
          temperatureCompensated: calibration.temperatureCompensated,
          temperatureReferenceC: calibration.temperatureReferenceC,
          temperatureCoefficient: calibration.temperatureCoefficient,
          calibratedAt: calibration.createdAt,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        deviceId: value.deviceId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    data: calibration,
  };
}

function enrichCalibrationForDisplay(point) {
  const normalizedPoint = normalizeCalibrationPoint(point);
  return normalizedPoint || point;
}

async function getLatestTdsCalibration(deviceId) {
  const database = getDb();

  const calibration = await database
    .collection('tds_calibrations')
    .findOne({ deviceId }, { sort: { createdAt: -1 } });

  return calibration ? enrichCalibrationForDisplay(calibration) : null;
}

async function getTdsCalibrationHistory(deviceId, limit) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);

  const calibrations = await database
    .collection('tds_calibrations')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();

  return calibrations.map(enrichCalibrationForDisplay);
}

async function getRecentTdsCalibrationPoints(deviceId, limit = DEFAULT_POINT_LIMIT) {
  const database = getDb();
  const normalizedLimit = normalizeLimit(limit, DEFAULT_POINT_LIMIT, MAX_HISTORY_LIMIT);

  return database
    .collection('tds_calibrations')
    .find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .toArray();
}

async function applyTdsCalibration(deviceId, sensorPayload) {
  const points = await getRecentTdsCalibrationPoints(deviceId);
  const tdsVoltage = sensorPayload && sensorPayload.tdsVoltage;
  const voltage25Info = calculateVoltage25(tdsVoltage, sensorPayload && sensorPayload.waterTemp);

  if (voltage25Info.voltage25 === null) {
    const result = buildNoCalibrationResult();
    result.tdsCalibrationPointCount = normalizeCalibrationPoints(points).filter(isUsableCalibrationPoint).length;
    result.tdsCalibrationWarning = voltage25Info.warning;
    return result;
  }

  const result = points.length === 0
    ? buildNoCalibrationResult()
    : calculatePiecewiseTdsPpm(voltage25Info.voltage25, points);

  return {
    ...result,
    tdsVoltage25: voltage25Info.voltage25,
    tdsTemperatureCompensated: voltage25Info.temperatureCompensated,
    tdsTemperatureCoefficientUsed: voltage25Info.temperatureCoefficient,
    tdsTemperatureReferenceC: voltage25Info.temperatureReferenceC,
    tdsCalibrationWarning: combineWarnings(result.tdsCalibrationWarning, voltage25Info.warning),
  };
}

module.exports = {
  TDS_TEMP_REFERENCE_C,
  TDS_TEMP_COEFFICIENT,
  calculateTemperatureCoefficient,
  calculateVoltage25,
  saveTdsCalibration,
  getLatestTdsCalibration,
  getTdsCalibrationHistory,
  getRecentTdsCalibrationPoints,
  calculatePiecewiseTdsPpm,
  applyTdsCalibration,
};
