const crypto = require('crypto');

const { getDb } = require('../mongoClient');
const { publishPumpCommand } = require('../mqttClient');
const {
  validateMainPumpStateCommand,
  validatePumpCommand,
} = require('../validators/pumpCommandValidator');

function createCommandId() {
  return `cmd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function validateAgainstLatestDeviceState(command) {
  const errors = [];

  if (command.pump === 'main') {
    return errors;
  }

  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId: command.deviceId });
  const latest = device && device.latest ? device.latest : null;

  if (!latest) {
    errors.push('latest device status is unavailable');
    return errors;
  }

  if (latest.waterLevel === 'low') {
    errors.push('water level is low');
  }

  if (latest.waterTempValid === false) {
    errors.push('water temperature sensor is invalid');
  }

  if (command.pump === 'A' && latest.pumpB === true) {
    errors.push('Pump B is currently running');
  }

  if (command.pump === 'B' && latest.pumpA === true) {
    errors.push('Pump A is currently running');
  }

  return errors;
}

async function validateMainPumpStateAgainstLatest(command) {
  const errors = [];

  if (command.state === 'off') {
    return errors;
  }

  const database = getDb();
  const device = await database.collection('devices').findOne({ deviceId: command.deviceId });
  const latest = device && device.latest ? device.latest : null;

  if (!latest) {
    errors.push('latest device status is unavailable');
    return errors;
  }

  if (latest.waterLevel !== 'normal') {
    errors.push('main pump can only be turned on when water level is normal');
  }

  return errors;
}

async function sendPumpCommand(deviceId, body) {
  const validation = validatePumpCommand(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  const command = validation.value;
  const stateErrors = await validateAgainstLatestDeviceState(command);

  if (stateErrors.length > 0) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: stateErrors,
    };
  }

  const commandPayload = {
    commandId: createCommandId(),
    deviceId: command.deviceId,
    pump: command.pump,
    action: 'pulse',
    durationMs: command.durationMs,
    reason: command.reason,
    source: 'dashboard',
    createdAt: new Date().toISOString(),
  };

  await publishPumpCommand(commandPayload);

  return {
    ok: true,
    command: commandPayload,
  };
}

async function sendMainPumpStateCommand(deviceId, body) {
  const validation = validateMainPumpStateCommand(deviceId, body || {});

  if (!validation.ok) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: validation.errors,
    };
  }

  const command = validation.value;
  const stateErrors = await validateMainPumpStateAgainstLatest(command);

  if (stateErrors.length > 0) {
    return {
      ok: false,
      error: 'validation_failed',
      errors: stateErrors,
    };
  }

  const commandPayload = {
    commandId: createCommandId(),
    deviceId: command.deviceId,
    pump: 'main',
    action: 'set',
    state: command.state,
    reason: command.reason,
    source: 'dashboard',
    createdAt: new Date().toISOString(),
  };

  await publishPumpCommand(commandPayload);

  return {
    ok: true,
    command: commandPayload,
  };
}

module.exports = {
  sendPumpCommand,
  sendMainPumpStateCommand,
};
