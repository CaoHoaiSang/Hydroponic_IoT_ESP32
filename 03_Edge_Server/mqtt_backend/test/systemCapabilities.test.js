const assert = require('node:assert/strict');
const test = require('node:test');

const { getSystemCapabilities } = require('../src/services/systemCapabilityService');

test('system capabilities default to fail-closed', () => {
  const result = getSystemCapabilities({});

  assert.equal(result.metadataVerified, false);
  assert.equal(result.actuatorsLocked, true);
  assert.equal(result.pumpCommandsEnabled, false);
  assert.equal(result.pumpMainCanSet, false);
  assert.equal(result.nutrientPumpCanPulse, false);
  assert.equal(result.autoDosingCanEnable, false);
  assert.match(result.autoDosingLockReason, /capability_metadata_unverified/);
});

test('individual environment flags cannot unlock actuator controls', () => {
  const result = getSystemCapabilities({
    ACTUATORS_LOCKED: 'false',
    PUMP_COMMANDS_DISABLED: 'false',
  });

  assert.equal(result.metadataVerified, false);
  assert.equal(result.actuatorsLocked, true);
  assert.equal(result.pumpCommandsEnabled, false);
});

test('verified operational metadata may expose manual pumps but never Phase 22 Auto Dosing', () => {
  const result = getSystemCapabilities({
    SYSTEM_BUILD_PROFILE: 'OPERATIONAL',
    CAPABILITY_METADATA_VERIFIED: 'true',
    ACTUATORS_LOCKED: 'false',
    PUMP_COMMANDS_DISABLED: 'false',
  });

  assert.equal(result.buildProfile, 'OPERATIONAL');
  assert.equal(result.actuatorsLocked, false);
  assert.equal(result.pumpCommandsEnabled, true);
  assert.equal(result.pumpMainCanSet, true);
  assert.equal(result.nutrientPumpCanPulse, true);
  assert.equal(result.autoDosingCanEnable, false);
  assert.match(result.autoDosingLockReason, /phase22_auto_dosing_locked_off/);
});
