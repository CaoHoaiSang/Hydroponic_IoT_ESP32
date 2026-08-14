const express = require('express');

const { isMongoConnected } = require('../mongoClient');
const { isMqttConnected } = require('../mqttClient');
const {
  getActiveAlerts,
  getAlertsByDevice,
  getLatestAlerts,
} = require('../services/alertService');
const {
  getActiveDosingRun,
  getAutoDosingReadiness,
  getAutoDosingSettings,
  getDailyDoseUsage,
  getDosingRuns,
  resetDailyDoseUsage,
  updateAutoDosingSettings,
} = require('../services/autoDosingService');
const {
  getAutoDosingEvents,
  getAutoDosingEventSummary,
} = require('../services/autoDosingEventService');
const {
  getAllDevices,
  getDeviceById,
  getLatestSensorLogs,
  getSensorLogsByDevice,
} = require('../services/deviceQueryService');
const {
  getLatestPumpCalibrations,
  getPumpCalibrationHistory,
  savePumpCalibration,
} = require('../services/pumpCalibrationService');
const {
  getShadowDecisions,
  getShadowModeStatus,
} = require('../services/shadowDosingService');
const {
  getLatestNutrientResponseTest,
  getNutrientResponseSummary,
  getNutrientResponseTests,
  saveNutrientResponseTest,
} = require('../services/nutrientResponseService');
const {
  sendMainPumpStateCommand,
  sendPumpCommand,
} = require('../services/pumpCommandService');
const {
  buildAutoDosingEventsCsv,
  buildDosingRunsCsv,
  buildNutrientResponseTestsCsv,
} = require('../services/exportService');
const {
  activateTdsCalibrationSet,
  addTdsCalibrationPoint,
  createTdsCalibrationSet,
  getActiveTdsCalibrationSet,
  getLatestTdsCalibration,
  getTdsCalibrationSet,
  getTdsCalibrationSets,
  getTdsCalibrationHistory,
  retireTdsCalibrationSet,
  saveTdsCalibration,
  validateTdsCalibrationSet,
} = require('../services/tdsCalibrationService');
const { getSystemCapabilities } = require('../services/systemCapabilityService');

const router = express.Router();

function sendInternalServerError(response, error) {
  response.status(500).json({
    ok: false,
    error: 'internal_server_error',
    message: error.message,
  });
}

function sendCsv(response, filename, csv) {
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.send(csv);
}

function sendTdsCalibrationResult(response, result, successStatus = 200) {
  if (result.ok) {
    response.status(successStatus).json(result);
    return;
  }

  const status = result.error === 'not_found'
    ? 404
    : result.error === 'lifecycle_conflict'
      ? 409
      : 400;
  response.status(status).json(result);
}

router.get('/health', (request, response) => {
  response.json({
    ok: true,
    service: process.env.SERVICE_NAME || 'hydroponic-mqtt-backend',
    mongoConnected: isMongoConnected(),
    mqttConnected: isMqttConnected(),
    uptimeSec: Math.floor(process.uptime()),
  });
});

router.get('/api/system/capabilities', (request, response) => {
  response.json({
    ok: true,
    data: getSystemCapabilities(),
  });
});

router.get('/api/alerts/active', async (request, response) => {
  try {
    const alerts = await getActiveAlerts();

    response.json({
      ok: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/alerts/latest', async (request, response) => {
  try {
    const alerts = await getLatestAlerts(request.query.limit);

    response.json({
      ok: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices', async (request, response) => {
  try {
    const devices = await getAllDevices();

    response.json({
      ok: true,
      count: devices.length,
      data: devices,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId', async (request, response) => {
  try {
    const device = await getDeviceById(request.params.deviceId);

    if (!device) {
      response.status(404).json({
        ok: false,
        error: 'device_not_found',
      });
      return;
    }

    response.json({
      ok: true,
      data: device,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/alerts', async (request, response) => {
  try {
    const alerts = await getAlertsByDevice(
      request.params.deviceId,
      request.query.status,
      request.query.limit,
    );

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/pump-command', async (request, response) => {
  try {
    const result = await sendPumpCommand(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/pumps/main/state', async (request, response) => {
  try {
    const result = await sendMainPumpStateCommand(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/pump-calibration', async (request, response) => {
  try {
    const result = await savePumpCalibration(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/pump-calibrations/latest', async (request, response) => {
  try {
    const calibrations = await getLatestPumpCalibrations(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: calibrations,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/pump-calibrations/:pump', async (request, response) => {
  try {
    const result = await getPumpCalibrationHistory(
      request.params.deviceId,
      request.params.pump,
      request.query.limit,
    );

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      pump: result.pump,
      count: result.data.length,
      data: result.data,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration-sets', async (request, response) => {
  try {
    const result = await createTdsCalibrationSet(request.params.deviceId, request.body);
    sendTdsCalibrationResult(response, result, 201);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/tds-calibration-sets', async (request, response) => {
  try {
    const rows = await getTdsCalibrationSets(request.params.deviceId, request.query.limit);
    response.json({ ok: true, deviceId: request.params.deviceId, count: rows.length, data: rows });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/tds-calibration-sets/active', async (request, response) => {
  try {
    const set = await getActiveTdsCalibrationSet(request.params.deviceId);
    response.json({ ok: true, deviceId: request.params.deviceId, data: set });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/tds-calibration-sets/:setId', async (request, response) => {
  try {
    const set = await getTdsCalibrationSet(request.params.deviceId, request.params.setId);
    if (!set) {
      response.status(404).json({ ok: false, error: 'not_found', errors: ['calibration set not found'] });
      return;
    }
    response.json({ ok: true, deviceId: request.params.deviceId, data: set });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration-sets/:setId/points', async (request, response) => {
  try {
    const result = await addTdsCalibrationPoint(request.params.deviceId, request.params.setId, request.body);
    sendTdsCalibrationResult(response, result, 201);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration-sets/:setId/validate', async (request, response) => {
  try {
    const result = await validateTdsCalibrationSet(request.params.deviceId, request.params.setId);
    sendTdsCalibrationResult(response, result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration-sets/:setId/activate', async (request, response) => {
  try {
    const result = await activateTdsCalibrationSet(request.params.deviceId, request.params.setId);
    sendTdsCalibrationResult(response, result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration-sets/:setId/retire', async (request, response) => {
  try {
    const result = await retireTdsCalibrationSet(request.params.deviceId, request.params.setId);
    sendTdsCalibrationResult(response, result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/tds-calibration', async (request, response) => {
  try {
    const result = await saveTdsCalibration(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/tds-calibrations/latest', async (request, response) => {
  try {
    const calibration = await getLatestTdsCalibration(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: calibration || null,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/tds-calibrations', async (request, response) => {
  try {
    const calibrations = await getTdsCalibrationHistory(
      request.params.deviceId,
      request.query.limit,
    );

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: calibrations.length,
      data: calibrations,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/nutrient-response-tests', async (request, response) => {
  try {
    const result = await saveNutrientResponseTest(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json(result);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/nutrient-response-tests', async (request, response) => {
  try {
    const tests = await getNutrientResponseTests(request.params.deviceId, request.query.limit);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: tests.length,
      data: tests,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/nutrient-response-tests/latest', async (request, response) => {
  try {
    const test = await getLatestNutrientResponseTest(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: test || null,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/nutrient-response-summary', async (request, response) => {
  try {
    const summary = await getNutrientResponseSummary(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: summary,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/settings', async (request, response) => {
  try {
    const settings = await getAutoDosingSettings(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: settings,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.put('/api/devices/:deviceId/auto-dosing/settings', async (request, response) => {
  try {
    const result = await updateAutoDosingSettings(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(['auto_dosing_not_ready', 'phase22a_auto_dosing_locked_off'].includes(result.error) ? 409 : 400).json(result);
      return;
    }

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: result.data,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/shadow-mode/status', async (request, response) => {
  try {
    const data = await getShadowModeStatus(request.params.deviceId);
    response.json({ ok: true, deviceId: request.params.deviceId, data });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/shadow-mode/decisions', async (request, response) => {
  try {
    const rows = await getShadowDecisions(request.params.deviceId, request.query.limit);
    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/readiness', async (request, response) => {
  try {
    const readiness = await getAutoDosingReadiness(request.params.deviceId);
    response.json({ ok: true, deviceId: request.params.deviceId, data: readiness });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/runs', async (request, response) => {
  try {
    const runs = await getDosingRuns(request.params.deviceId, request.query.limit);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: runs.length,
      data: runs,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/active-run', async (request, response) => {
  try {
    const activeRun = await getActiveDosingRun(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: activeRun || null,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/events', async (request, response) => {
  try {
    const events = await getAutoDosingEvents(request.params.deviceId, request.query.limit);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: events.length,
      data: events,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/events/summary', async (request, response) => {
  try {
    const summary = await getAutoDosingEventSummary(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: summary,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/auto-dosing/daily-usage', async (request, response) => {
  try {
    const usage = await getDailyDoseUsage(request.params.deviceId);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      ...usage,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.post('/api/devices/:deviceId/auto-dosing/daily-usage/reset', async (request, response) => {
  try {
    const result = await resetDailyDoseUsage(request.params.deviceId, request.body);

    if (!result.ok) {
      response.status(400).json(result);
      return;
    }

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      data: result.data,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/export/dosing-runs.csv', async (request, response) => {
  try {
    const csv = await buildDosingRunsCsv(request.params.deviceId);
    sendCsv(response, `${request.params.deviceId}-dosing-runs.csv`, csv);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/export/nutrient-response-tests.csv', async (request, response) => {
  try {
    const csv = await buildNutrientResponseTestsCsv(request.params.deviceId);
    sendCsv(response, `${request.params.deviceId}-nutrient-response-tests.csv`, csv);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/export/auto-dosing-events.csv', async (request, response) => {
  try {
    const csv = await buildAutoDosingEventsCsv(request.params.deviceId);
    sendCsv(response, `${request.params.deviceId}-auto-dosing-events.csv`, csv);
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/latest', async (request, response) => {
  try {
    const device = await getDeviceById(request.params.deviceId);

    if (!device) {
      response.status(404).json({
        ok: false,
        error: 'device_not_found',
      });
      return;
    }

    response.json({
      ok: true,
      deviceId: device.deviceId,
      lastSeenAt: device.lastSeenAt,
      updatedAt: device.updatedAt,
      latest: device.latest,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/devices/:deviceId/sensor-logs', async (request, response) => {
  try {
    const logs = await getSensorLogsByDevice(request.params.deviceId, request.query.limit);

    response.json({
      ok: true,
      deviceId: request.params.deviceId,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

router.get('/api/sensor-logs/latest', async (request, response) => {
  try {
    const logs = await getLatestSensorLogs(request.query.limit);

    response.json({
      ok: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    sendInternalServerError(response, error);
  }
});

module.exports = router;
