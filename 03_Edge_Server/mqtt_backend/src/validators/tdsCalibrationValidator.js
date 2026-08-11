const { validateCalibrationPoint } = require('./tdsCalibrationSetValidator');

// Compatibility wrapper for the legacy endpoint. A set ID is mandatory so callers
// cannot append a point to an implicit "latest" calibration group.
function validateTdsCalibration(deviceId, body) {
  const calibrationSetId = body && body.calibrationSetId;
  return validateCalibrationPoint(deviceId, calibrationSetId, body || {});
}

module.exports = { validateTdsCalibration };
