const { saveSensorPayload } = require('./sensorLogService');
const { evaluateAndSaveShadowDecision } = require('./shadowDosingService');

async function processTelemetryPayload(payload, topic, now = new Date()) {
  const telemetry = await saveSensorPayload(payload, topic, now);
  if (!telemetry.ok || telemetry.shadowEligible !== true) {
    return { telemetry, shadow: { ok: true, saved: false, reason: telemetry.reason } };
  }
  const shadow = await evaluateAndSaveShadowDecision(payload, telemetry, now);
  return { telemetry, shadow };
}

module.exports = { processTelemetryPayload };
