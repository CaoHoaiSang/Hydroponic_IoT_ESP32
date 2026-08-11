#ifndef PAYLOAD_BUILDER_H
#define PAYLOAD_BUILDER_H

#include <Arduino.h>

#include "Sensors.h"
#include "TelemetryIdentity.h"

String buildStatusPayload(const SensorData& data, const TelemetryIdentity& identity);
String buildPumpStatusPayload(
  const String& commandId,
  const String& pump,
  const String& action,
  const String& state,
  unsigned long durationMs,
  bool accepted,
  bool success,
  const String& status,
  const String& message
);
void printSensorStatus(const SensorData& data);

#endif
