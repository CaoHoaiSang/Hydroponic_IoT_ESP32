#include "PayloadBuilder.h"

#include <Arduino.h>

#include "Config.h"
#include "Pumps.h"

static const char* boolText(bool value) {
  return value ? "true" : "false";
}

static String escapeJsonString(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);

  for (unsigned int i = 0; i < value.length(); i++) {
    char c = value.charAt(i);

    if (c == '"' || c == '\\') {
      escaped += '\\';
      escaped += c;
    } else if (c == '\n') {
      escaped += "\\n";
    } else if (c == '\r') {
      escaped += "\\r";
    } else {
      escaped += c;
    }
  }

  return escaped;
}

String buildStatusPayload(const SensorData& data, const TelemetryIdentity& identity) {
  String payload;
  payload.reserve(896);

  payload += "{\n";
  payload += "  \"schemaVersion\": ";
  payload += String(identity.schemaVersion);
  payload += ",\n";

  payload += "  \"deviceId\": \"";
  payload += DEVICE_ID;
  payload += "\",\n";

  payload += "  \"bootId\": \"";
  payload += escapeJsonString(identity.bootId);
  payload += "\",\n";

  payload += "  \"measurementSeq\": ";
  payload += String(identity.measurementSeq);
  payload += ",\n";

  payload += "  \"measurementId\": \"";
  payload += escapeJsonString(identity.measurementId);
  payload += "\",\n";

  payload += "  \"sampledAtUptimeMs\": ";
  payload += identity.sampledAtUptimeMs;
  payload += ",\n";

  payload += "  \"tdsRaw\": ";
  payload += data.tdsRaw;
  payload += ",\n";

  payload += "  \"tdsVoltage\": ";
  payload += String(data.tdsVoltage, 3);
  payload += ",\n";

  payload += "  \"tdsMin\": ";
  payload += data.tdsMin;
  payload += ",\n";

  payload += "  \"tdsMax\": ";
  payload += data.tdsMax;
  payload += ",\n";

  payload += "  \"tdsSampleCount\": ";
  payload += data.tdsSampleCount;
  payload += ",\n";

  payload += "  \"tdsSpreadRaw\": ";
  payload += data.tdsSpreadRaw;
  payload += ",\n";

  payload += "  \"tdsRobustMin\": ";
  payload += data.tdsRobustMin;
  payload += ",\n";

  payload += "  \"tdsRobustMax\": ";
  payload += data.tdsRobustMax;
  payload += ",\n";

  payload += "  \"tdsRobustSpreadRaw\": ";
  payload += data.tdsRobustSpreadRaw;
  payload += ",\n";

  payload += "  \"tdsTrimmedSampleCount\": ";
  payload += data.tdsTrimmedSampleCount;
  payload += ",\n";

  payload += "  \"tdsWindowStable\": ";
  payload += boolText(data.tdsWindowStable);
  payload += ",\n";

  payload += "  \"waterTemp\": ";
  if (data.waterTempValid) {
    payload += String(data.waterTemp, 2);
  } else {
    payload += "null";
  }
  payload += ",\n";

  payload += "  \"waterTempValid\": ";
  payload += boolText(data.waterTempValid);
  payload += ",\n";

  payload += "  \"waterLevel\": \"";
  payload += data.waterLevel;
  payload += "\",\n";

  payload += "  \"pumpMain\": ";
  payload += boolText(getPumpMain());
  payload += ",\n";

  payload += "  \"pumpA\": ";
  payload += boolText(getPumpA());
  payload += ",\n";

  payload += "  \"pumpB\": ";
  payload += boolText(getPumpB());
  payload += ",\n";

  payload += "  \"pumpSpare\": ";
  payload += boolText(getPumpSpare());
  payload += ",\n";

  payload += "  \"ph\": null,\n";

  payload += "  \"uptimeMs\": ";
  payload += identity.sampledAtUptimeMs;
  payload += "\n";
  payload += "}";

  return payload;
}

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
) {
  String payload;
  payload.reserve(512);

  payload += "{\n";
  payload += "  \"commandId\": \"";
  payload += escapeJsonString(commandId);
  payload += "\",\n";

  payload += "  \"deviceId\": \"";
  payload += DEVICE_ID;
  payload += "\",\n";

  payload += "  \"pump\": \"";
  payload += escapeJsonString(pump);
  payload += "\",\n";

  payload += "  \"action\": \"";
  payload += escapeJsonString(action);
  payload += "\",\n";

  if (state.length() > 0) {
    payload += "  \"state\": \"";
    payload += escapeJsonString(state);
    payload += "\",\n";
  }

  payload += "  \"durationMs\": ";
  payload += durationMs;
  payload += ",\n";

  payload += "  \"accepted\": ";
  payload += boolText(accepted);
  payload += ",\n";

  payload += "  \"success\": ";
  payload += boolText(success);
  payload += ",\n";

  payload += "  \"status\": \"";
  payload += escapeJsonString(status);
  payload += "\",\n";

  payload += "  \"message\": \"";
  payload += escapeJsonString(message);
  payload += "\",\n";

  payload += "  \"pumpMain\": ";
  payload += boolText(getPumpMain());
  payload += ",\n";

  payload += "  \"pumpA\": ";
  payload += boolText(getPumpA());
  payload += ",\n";

  payload += "  \"pumpB\": ";
  payload += boolText(getPumpB());
  payload += ",\n";

  payload += "  \"pumpSpare\": ";
  payload += boolText(getPumpSpare());
  payload += ",\n";

  payload += "  \"uptimeMs\": ";
  payload += millis();
  payload += "\n";
  payload += "}";

  return payload;
}

void printSensorStatus(const SensorData& data) {
  Serial.print("TDS raw: ");
  Serial.print(data.tdsRaw);
  Serial.print(" | voltage: ");
  Serial.print(data.tdsVoltage, 3);
  Serial.print(" V | samples: ");
  Serial.print(data.tdsSampleCount);
  Serial.print(" | spread: ");
  Serial.print(data.tdsSpreadRaw);
  Serial.print(" | water temp: ");
  if (data.waterTempValid) {
    Serial.print(data.waterTemp, 2);
    Serial.print(" C");
  } else {
    Serial.print("invalid");
  }
  Serial.print(" | water level: ");
  Serial.println(data.waterLevel);
}
