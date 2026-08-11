#ifndef TELEMETRY_IDENTITY_H
#define TELEMETRY_IDENTITY_H

#include <Arduino.h>

struct TelemetryIdentity {
  uint8_t schemaVersion;
  String bootId;
  uint32_t measurementSeq;
  String measurementId;
  unsigned long sampledAtUptimeMs;
};

void telemetryIdentityBegin();
const String& getTelemetryBootId();
TelemetryIdentity createTelemetryMeasurementIdentity(unsigned long sampledAtUptimeMs);

#endif
