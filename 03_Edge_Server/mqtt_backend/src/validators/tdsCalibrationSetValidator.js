const {
  TDS_ADC_MAX,
  TDS_ADC_REFERENCE_VOLTAGE,
  TDS_ADC_VOLTAGE_TOLERANCE,
  TDS_FACTOR,
  TDS_REFERENCE_PPM_TOLERANCE,
  TDS_REFERENCE_SCALE,
  TDS_SENSOR_MAX_VOLTAGE,
  TDS_TEMPERATURE_ALPHA_PER_C,
  TDS_TEMPERATURE_REFERENCE_C,
} = require('../config/tdsQualityConfig');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isStoredNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function getModernCalibrationPointReasons(row) {
  const point = isObject(row) ? row : {};
  const reasons = [];
  const hasDeviceId = typeof point.deviceId === 'string' && point.deviceId.trim().length > 0;
  const hasSetId = typeof point.calibrationSetId === 'string'
    && point.calibrationSetId.trim().length > 0;
  const validRaw = Number.isInteger(point.measuredRaw)
    && point.measuredRaw >= 1
    && point.measuredRaw <= TDS_ADC_MAX;
  const validVoltage = isStoredNumber(point.measuredVoltage)
    && point.measuredVoltage > 0
    && point.measuredVoltage <= TDS_SENSOR_MAX_VOLTAGE;
  const validTemperature = isStoredNumber(point.waterTemp)
    && point.waterTemp >= 0
    && point.waterTemp <= 50
    && point.waterTemp !== 85;
  const validEc = isStoredNumber(point.referenceEcUsCm)
    && point.referenceEcUsCm > 0
    && point.referenceEcUsCm <= 2000;
  const validVoltage25 = isStoredNumber(point.measuredVoltage25)
    && point.measuredVoltage25 > 0;
  const validTemperatureFactor = isStoredNumber(point.temperatureFactorUsed)
    && point.temperatureFactorUsed > 0;

  if (!hasDeviceId) reasons.push('missing_or_invalid_device_id');
  if (!hasSetId) reasons.push('missing_calibration_set_id');
  if (!validRaw) reasons.push('missing_or_invalid_measured_raw');
  if (!validVoltage) reasons.push('missing_or_invalid_measured_voltage');
  if (validRaw && validVoltage) {
    const expectedVoltage = point.measuredRaw * TDS_ADC_REFERENCE_VOLTAGE / TDS_ADC_MAX;
    if (Math.abs(point.measuredVoltage - expectedVoltage) > TDS_ADC_VOLTAGE_TOLERANCE) {
      reasons.push('measured_raw_voltage_mismatch');
    }
  }
  if (!validEc) reasons.push('missing_reference_ec');
  if (point.referenceScale !== TDS_REFERENCE_SCALE) {
    reasons.push('missing_or_invalid_reference_scale');
  }
  if (!isStoredNumber(point.tdsFactor) || point.tdsFactor !== TDS_FACTOR) {
    reasons.push('missing_or_invalid_tds_factor');
  }
  if (!isStoredNumber(point.referenceTdsPpm)) {
    reasons.push('missing_or_invalid_reference_tds_ppm');
  } else if (
    validEc
    && Math.abs(point.referenceTdsPpm - point.referenceEcUsCm * TDS_FACTOR)
      > TDS_REFERENCE_PPM_TOLERANCE
  ) {
    reasons.push('reference_tds_ppm_mismatch');
  }
  if (!validTemperature) reasons.push('missing_or_invalid_water_temperature');
  if (!validVoltage25) reasons.push('missing_or_invalid_measured_voltage_25');
  if (point.temperatureCompensated !== true) reasons.push('temperature_compensation_not_confirmed');
  if (!validTemperatureFactor) {
    reasons.push('missing_or_invalid_temperature_factor');
  } else if (validTemperature) {
    const expectedFactor = 1 + TDS_TEMPERATURE_ALPHA_PER_C
      * (point.waterTemp - TDS_TEMPERATURE_REFERENCE_C);
    if (Math.abs(point.temperatureFactorUsed - expectedFactor) > 0.000001) {
      reasons.push('temperature_factor_mismatch');
    }
  }
  if (validVoltage && validVoltage25 && validTemperatureFactor) {
    const expectedVoltage25 = point.measuredVoltage / point.temperatureFactorUsed;
    if (Math.abs(point.measuredVoltage25 - expectedVoltage25) > 0.000001) {
      reasons.push('measured_voltage_25_mismatch');
    }
  }
  if (point.temperatureReferenceC !== TDS_TEMPERATURE_REFERENCE_C) {
    reasons.push('missing_or_invalid_temperature_reference');
  }
  if (point.temperatureAlphaPerC !== TDS_TEMPERATURE_ALPHA_PER_C) {
    reasons.push('missing_or_invalid_temperature_alpha');
  }
  if (point.method !== 'piecewise_linear_ec') reasons.push('missing_or_invalid_method');
  if (point.legacy === true || point.legacyReasons) reasons.push('legacy_marker_present');

  return [...new Set(reasons)];
}

function validateCalibrationSet(deviceId, body) {
  const errors = [];
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const payload = isObject(body) ? body : {};

  if (!normalizedDeviceId) {
    errors.push('deviceId route parameter is required');
  }

  if (payload.referenceScale !== undefined && payload.referenceScale !== TDS_REFERENCE_SCALE) {
    errors.push(`referenceScale must be ${TDS_REFERENCE_SCALE}`);
  }

  if (payload.tdsFactor !== undefined && Number(payload.tdsFactor) !== TDS_FACTOR) {
    errors.push(`tdsFactor must be ${TDS_FACTOR}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      deviceId: normalizedDeviceId,
      referenceMeter: optionalText(payload.referenceMeter),
      note: optionalText(payload.note),
      referenceScale: TDS_REFERENCE_SCALE,
      tdsFactor: TDS_FACTOR,
    },
  };
}

function validateCalibrationPoint(deviceId, calibrationSetId, body) {
  const errors = [];
  const payload = isObject(body) ? body : {};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  const normalizedSetId = typeof calibrationSetId === 'string' ? calibrationSetId.trim() : '';
  const measuredRaw = finiteNumber(payload.measuredRaw);
  const measuredVoltage = finiteNumber(payload.measuredVoltage);
  const waterTemp = finiteNumber(payload.waterTemp);
  const referenceEcUsCm = finiteNumber(payload.referenceEcUsCm);
  const clientReferenceTdsPpm = payload.referenceTdsPpm === undefined
    ? null
    : finiteNumber(payload.referenceTdsPpm);

  if (!normalizedDeviceId) errors.push('deviceId route parameter is required');
  if (!normalizedSetId) errors.push('calibrationSetId is required');

  if (!Number.isInteger(measuredRaw) || measuredRaw < 1 || measuredRaw > TDS_ADC_MAX) {
    errors.push(`measuredRaw must be an integer from 1 to ${TDS_ADC_MAX}`);
  }

  if (measuredVoltage === null || measuredVoltage <= 0 || measuredVoltage > TDS_SENSOR_MAX_VOLTAGE) {
    errors.push(`measuredVoltage must be greater than 0 and at most ${TDS_SENSOR_MAX_VOLTAGE}`);
  }

  if (waterTemp === null || waterTemp < 0 || waterTemp > 50 || waterTemp === 85) {
    errors.push('waterTemp must be a finite number from 0 to 50 and must not be 85');
  }

  if (referenceEcUsCm === null || referenceEcUsCm <= 0 || referenceEcUsCm > 2000) {
    errors.push('referenceEcUsCm must be greater than 0 and at most 2000');
  }

  if (payload.referenceScale !== undefined && payload.referenceScale !== TDS_REFERENCE_SCALE) {
    errors.push(`referenceScale must be ${TDS_REFERENCE_SCALE}`);
  }

  if (payload.tdsFactor !== undefined && Number(payload.tdsFactor) !== TDS_FACTOR) {
    errors.push(`tdsFactor must be ${TDS_FACTOR}`);
  }

  if (measuredRaw !== null && measuredVoltage !== null) {
    const expectedVoltage = measuredRaw * TDS_ADC_REFERENCE_VOLTAGE / TDS_ADC_MAX;
    if (Math.abs(measuredVoltage - expectedVoltage) > TDS_ADC_VOLTAGE_TOLERANCE) {
      errors.push(`measuredVoltage must match measuredRaw within ${TDS_ADC_VOLTAGE_TOLERANCE} V`);
    }
  }

  const referenceTdsPpm = referenceEcUsCm === null ? null : referenceEcUsCm * TDS_FACTOR;
  if (payload.referenceTdsPpm !== undefined) {
    if (clientReferenceTdsPpm === null) {
      errors.push('referenceTdsPpm must be a finite number when provided');
    } else if (
      referenceTdsPpm !== null
      && Math.abs(clientReferenceTdsPpm - referenceTdsPpm) > TDS_REFERENCE_PPM_TOLERANCE
    ) {
      errors.push('referenceTdsPpm must equal referenceEcUsCm multiplied by 0.5');
    }
  }

  const temperatureFactorUsed = waterTemp === null
    ? null
    : 1 + TDS_TEMPERATURE_ALPHA_PER_C * (waterTemp - TDS_TEMPERATURE_REFERENCE_C);
  const measuredVoltage25 = measuredVoltage === null || !temperatureFactorUsed
    ? null
    : measuredVoltage / temperatureFactorUsed;

  return {
    ok: errors.length === 0,
    errors,
    value: {
      calibrationSetId: normalizedSetId,
      deviceId: normalizedDeviceId,
      measuredRaw,
      measuredVoltage,
      measuredVoltage25,
      referenceEcUsCm,
      referenceTdsPpm,
      referenceScale: TDS_REFERENCE_SCALE,
      tdsFactor: TDS_FACTOR,
      waterTemp,
      temperatureCompensated: true,
      temperatureReferenceC: TDS_TEMPERATURE_REFERENCE_C,
      temperatureAlphaPerC: TDS_TEMPERATURE_ALPHA_PER_C,
      temperatureFactorUsed,
      method: 'piecewise_linear_ec',
      note: optionalText(payload.note),
    },
  };
}

module.exports = {
  getModernCalibrationPointReasons,
  validateCalibrationSet,
  validateCalibrationPoint,
};
