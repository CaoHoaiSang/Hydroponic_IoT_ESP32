#ifndef PAYLOAD_BUILDER_H
#define PAYLOAD_BUILDER_H

#include <Arduino.h>

#include "Sensors.h"

String buildStatusPayload(const SensorData& data);
String buildPumpStatusPayload(
  const String& commandId,
  const String& pump,
  const String& action,
  unsigned long durationMs,
  bool accepted,
  bool success,
  const String& status,
  const String& message
);
void printStatusPayload(const SensorData& data);

#endif
