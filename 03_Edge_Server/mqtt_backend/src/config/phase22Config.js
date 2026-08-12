function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

// Phase 22A is observation-only. This lock is intentionally not configurable.
const PHASE22_AUTO_DOSING_LOCKED_OFF = true;
const SHADOW_MODE_ENABLED = booleanFromEnv('SHADOW_MODE_ENABLED', false);
const TELEMETRY_SCHEMA_VERSION = 2;
const TELEMETRY_BOOT_CONFIRMATION_PACKETS = 2;
const SHADOW_ENGINE_VERSION = '22A.1';
const SHADOW_DECISION_SCHEMA_VERSION = 1;

module.exports = {
  PHASE22_AUTO_DOSING_LOCKED_OFF,
  SHADOW_MODE_ENABLED,
  TELEMETRY_SCHEMA_VERSION,
  TELEMETRY_BOOT_CONFIRMATION_PACKETS,
  SHADOW_ENGINE_VERSION,
  SHADOW_DECISION_SCHEMA_VERSION,
};
