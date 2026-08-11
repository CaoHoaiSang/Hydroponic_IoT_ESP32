#include "TelemetryIdentity.h"

#include <esp_system.h>

#include "Config.h"
#include "TelemetrySequence.h"

namespace {
String bootId;
TelemetrySequenceCounter measurementSequence;
bool initialized = false;
}

void telemetryIdentityBegin() {
  if (initialized) {
    return;
  }

  char buffer[17];
  snprintf(
    buffer,
    sizeof(buffer),
    "%08lx%08lx",
    static_cast<unsigned long>(esp_random()),
    static_cast<unsigned long>(esp_random())
  );
  bootId = String(buffer);
  initialized = true;
}

const String& getTelemetryBootId() {
  telemetryIdentityBegin();
  return bootId;
}

TelemetryIdentity createTelemetryMeasurementIdentity(unsigned long sampledAtUptimeMs) {
  telemetryIdentityBegin();

  TelemetryIdentity identity;
  identity.schemaVersion = TELEMETRY_SCHEMA_VERSION;
  identity.bootId = bootId;
  identity.measurementSeq = measurementSequence.next();
  identity.measurementId = String(DEVICE_ID)
    + ":" + identity.bootId
    + ":" + String(identity.measurementSeq);
  identity.sampledAtUptimeMs = sampledAtUptimeMs;
  return identity;
}
