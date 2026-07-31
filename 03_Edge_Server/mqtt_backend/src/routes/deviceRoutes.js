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
  getAutoDosingSettings,
  getDosingRuns,
  updateAutoDosingSettings,
} = require('../services/autoDosingService');
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
  getLatestTdsCalibration,
  getTdsCalibrationHistory,
  saveTdsCalibration,
} = require('../services/tdsCalibrationService');

const router = express.Router();

function sendInternalServerError(response, error) {
  response.status(500).json({
    ok: false,
    error: 'internal_server_error',
    message: error.message,
  });
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
