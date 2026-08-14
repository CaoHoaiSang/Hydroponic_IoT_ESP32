const { PHASE22_AUTO_DOSING_LOCKED_OFF } = require('../config/phase22Config');

function booleanFromEnv(env, name, fallback) {
  const value = String(env[name] ?? '').trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function getSystemCapabilities(env = process.env) {
  const metadataVerified = booleanFromEnv(env, 'CAPABILITY_METADATA_VERIFIED', false);
  const firmwareActuatorsLocked = booleanFromEnv(env, 'ACTUATORS_LOCKED', true);
  const backendPumpCommandsDisabled = booleanFromEnv(env, 'PUMP_COMMANDS_DISABLED', true);
  const pumpCommandsEnabled = metadataVerified
    && !firmwareActuatorsLocked
    && !backendPumpCommandsDisabled;
  const buildProfile = String(env.SYSTEM_BUILD_PROFILE || '').trim() || null;

  const lockReasons = [];
  if (!metadataVerified) lockReasons.push('capability_metadata_unverified');
  if (firmwareActuatorsLocked) lockReasons.push('firmware_actuators_locked');
  if (backendPumpCommandsDisabled) lockReasons.push('backend_pump_commands_disabled');
  if (PHASE22_AUTO_DOSING_LOCKED_OFF) lockReasons.push('phase22_auto_dosing_locked_off');

  return {
    buildProfile,
    metadataVerified,
    actuatorsLocked: !pumpCommandsEnabled,
    pumpCommandsEnabled,
    pumpMainCanSet: pumpCommandsEnabled,
    nutrientPumpCanPulse: pumpCommandsEnabled,
    autoDosingCanEnable: false,
    autoDosingLockReason: lockReasons.join(',') || 'auto_dosing_not_enabled_for_ui',
  };
}

module.exports = {
  getSystemCapabilities,
};
