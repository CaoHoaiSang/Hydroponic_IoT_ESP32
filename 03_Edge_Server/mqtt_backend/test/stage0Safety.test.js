process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { publishPumpCommand } = require('../src/mqttClient');
const {
  sendMainPumpStateCommand,
  sendPumpCommand,
} = require('../src/services/pumpCommandService');

const originalPumpCommandsDisabled = process.env.PUMP_COMMANDS_DISABLED;

test.after(() => {
  if (originalPumpCommandsDisabled === undefined) {
    delete process.env.PUMP_COMMANDS_DISABLED;
  } else {
    process.env.PUMP_COMMANDS_DISABLED = originalPumpCommandsDisabled;
  }
});

test('Stage 0 environment blocks pulse and main pump API services before validation', async () => {
  process.env.PUMP_COMMANDS_DISABLED = 'true';

  const pulse = await sendPumpCommand('device001', {
    pump: 'A',
    action: 'pulse',
    durationMs: 500,
    reason: 'manual_test',
  });
  const main = await sendMainPumpStateCommand('device001', {
    state: 'on',
    reason: 'manual_test',
  });

  assert.equal(pulse.ok, false);
  assert.equal(pulse.error, 'pump_commands_disabled');
  assert.equal(main.ok, false);
  assert.equal(main.error, 'pump_commands_disabled');
});

test('Stage 0 environment blocks the MQTT pump publisher as a second safety layer', async () => {
  process.env.PUMP_COMMANDS_DISABLED = 'true';

  await assert.rejects(
    publishPumpCommand({ commandId: 'must_not_publish' }),
    (error) => error && error.code === 'PUMP_COMMANDS_DISABLED',
  );
});
