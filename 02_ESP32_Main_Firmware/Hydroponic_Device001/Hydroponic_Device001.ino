// Hydroponic_Device001.ino
// Purpose: Main ESP32 firmware V3 with sensor MQTT publish and safe pump commands.
//
// This version keeps Serial commands and periodic sensor publishing, then adds
// pulse-only MQTT pump commands. MQTT/API commands are validated again on ESP32
// before any pump output is changed.

#include "Config.h"
#include "MqttService.h"
#include "PayloadBuilder.h"
#include "Pumps.h"
#include "Sensors.h"
#include "TelemetryIdentity.h"
#include "TelemetryPublishState.h"

#include <ctype.h>

enum PulseTarget {
  PULSE_NONE,
  PULSE_MAIN,
  PULSE_A,
  PULSE_B
};

struct PumpCommand {
  String commandId;
  String deviceId;
  String pump;
  String action;
  String state;
  unsigned long durationMs;
  String reason;
  String source;
};

SensorData latestSensorData;
bool hasSensorData = false;

PulseTarget activePulse = PULSE_NONE;
unsigned long activePulseDurationMs = DEFAULT_PULSE_MS;
unsigned long pulseStartedMs = 0;
unsigned long previousStatusPrintMs = 0;
unsigned long previousMqttPublishMs = 0;

bool mqttCommandActive = false;
String activeCommandId = "";
String activeCommandPump = "";
String activeCommandAction = "pulse";
unsigned long activeCommandDurationMs = 0;

String serialCommand = "";
TelemetryPublishState<String> sensorPublishState;

void printPumpState(const char* pumpName, bool on);
void printHelp();
void readAndStoreSensors();
void printImmediateStatus();
void publishLatestSensorPayload();
void publishPumpCommandStatus(
  const String& commandId,
  const String& pump,
  const String& action,
  unsigned long durationMs,
  bool accepted,
  bool success,
  const String& status,
  const String& message,
  const String& state = ""
);
void cancelActivePulse(bool publishCancel, const String& message);
void startPulse(PulseTarget target, unsigned long durationMs, bool fromMqtt, const PumpCommand& command);
void updatePulse();
void handleCommand(String command);
void readSerialCommands();
void handleMqttMessage(const String& topic, const String& payload);
void handlePumpCommandPayload(const String& payload);

void printPumpState(const char* pumpName, bool on) {
  Serial.print(pumpName);
  Serial.print(": ");
  Serial.println(on ? "ON" : "OFF");
}

void printHelp() {
  Serial.println("Available commands:");
  Serial.println("  help");
  Serial.println("  status");
  Serial.println("  all_off");
  Serial.println("  main_on");
  Serial.println("  main_off");
  Serial.println("  a_on");
  Serial.println("  a_off");
  Serial.println("  b_on");
  Serial.println("  b_off");
  Serial.println("  spare_on");
  Serial.println("  spare_off");
  Serial.println("  pulse_main");
  Serial.println("  pulse_a");
  Serial.println("  pulse_b");
}

void readAndStoreSensors() {
  sensorsUpdate(millis());
  latestSensorData = readSensors();
  hasSensorData = true;
}

void printImmediateStatus() {
  readAndStoreSensors();
  printSensorStatus(latestSensorData);
}

void publishLatestSensorPayload() {
  if (!sensorPublishState.pending()) {
    if (!hasSensorData) {
      readAndStoreSensors();
    }

    const TelemetryIdentity identity = createTelemetryMeasurementIdentity(millis());
    sensorPublishState.begin(buildStatusPayload(latestSensorData, identity), identity.measurementId);
  }

  Serial.print("MQTT sensor measurement: ");
  Serial.println(sensorPublishState.measurementId());

  bool published = publishSensorPayload(sensorPublishState.payload());
  Serial.println(published ? "MQTT sensor publish: OK" : "MQTT sensor publish: FAILED");

  sensorPublishState.recordPublishResult(published);
  if (!published) {
    Serial.println("MQTT retry will keep the same measurement identity and payload.");
  }
}

void publishPumpCommandStatus(
  const String& commandId,
  const String& pump,
  const String& action,
  unsigned long durationMs,
  bool accepted,
  bool success,
  const String& status,
  const String& message,
  const String& state
) {
  String payload = buildPumpStatusPayload(
    commandId,
    pump,
    action,
    state,
    durationMs,
    accepted,
    success,
    status,
    message
  );

  Serial.println(payload);
  bool published = publishPumpStatusPayload(payload);
  Serial.println(published ? "MQTT pump status: OK" : "MQTT pump status: FAILED");
}

void setPulseTargetOff(PulseTarget target) {
  if (target == PULSE_MAIN) {
    setPumpMain(false);
    printPumpState("pumpMain", false);
  } else if (target == PULSE_A) {
    setPumpA(false);
    printPumpState("pumpA", false);
  } else if (target == PULSE_B) {
    setPumpB(false);
    printPumpState("pumpB", false);
  }
}

void setPulseTargetOn(PulseTarget target) {
  if (target == PULSE_MAIN) {
    setPumpMain(true);
    printPumpState("pumpMain", true);
  } else if (target == PULSE_A) {
    setPumpA(true);
    printPumpState("pumpA", true);
  } else if (target == PULSE_B) {
    setPumpB(true);
    printPumpState("pumpB", true);
  }
}

void clearMqttCommandState() {
  mqttCommandActive = false;
  activeCommandId = "";
  activeCommandPump = "";
  activeCommandAction = "pulse";
  activeCommandDurationMs = 0;
}

void cancelActivePulse(bool publishCancel, const String& message) {
  if (activePulse == PULSE_NONE) {
    return;
  }

  bool wasMqttCommand = mqttCommandActive;
  String commandId = activeCommandId;
  String pump = activeCommandPump;
  String action = activeCommandAction;
  unsigned long durationMs = activeCommandDurationMs;

  setPulseTargetOff(activePulse);
  activePulse = PULSE_NONE;
  activePulseDurationMs = DEFAULT_PULSE_MS;

  if (wasMqttCommand) {
    clearMqttCommandState();
  }

  if (publishCancel && wasMqttCommand) {
    publishPumpCommandStatus(
      commandId,
      pump,
      action,
      durationMs,
      true,
      false,
      "cancelled",
      message
    );
  }
}

PulseTarget pumpToPulseTarget(const String& pump) {
  if (pump == "main") {
    return PULSE_MAIN;
  }

  if (pump == "A") {
    return PULSE_A;
  }

  if (pump == "B") {
    return PULSE_B;
  }

  return PULSE_NONE;
}

unsigned long maxDurationForPump(const String& pump) {
  if (pump == "main") {
    return MQTT_PUMP_MAIN_MAX_DURATION_MS;
  }

  if (pump == "A") {
    return MQTT_PUMP_A_MAX_DURATION_MS;
  }

  if (pump == "B") {
    return MQTT_PUMP_B_MAX_DURATION_MS;
  }

  return 0;
}

String normalizePumpName(String pump) {
  pump.trim();

  if (pump == "main") {
    return "main";
  }

  if (pump.equalsIgnoreCase("A")) {
    return "A";
  }

  if (pump.equalsIgnoreCase("B")) {
    return "B";
  }

  return pump;
}

void startPulse(PulseTarget target, unsigned long durationMs, bool fromMqtt, const PumpCommand& command) {
  cancelActivePulse(!fromMqtt, "Pump command cancelled by Serial pulse command");

  setPulseTargetOn(target);

  activePulse = target;
  activePulseDurationMs = durationMs;
  pulseStartedMs = millis();

  if (fromMqtt) {
    mqttCommandActive = true;
    activeCommandId = command.commandId;
    activeCommandPump = command.pump;
    activeCommandAction = command.action;
    activeCommandDurationMs = command.durationMs;

    publishPumpCommandStatus(
      command.commandId,
      command.pump,
      command.action,
      command.durationMs,
      true,
      true,
      "started",
      "Pump command started"
    );
  }
}

void updatePulse() {
  if (activePulse == PULSE_NONE) {
    return;
  }

  if (millis() - pulseStartedMs < activePulseDurationMs) {
    return;
  }

  bool wasMqttCommand = mqttCommandActive;
  String commandId = activeCommandId;
  String pump = activeCommandPump;
  String action = activeCommandAction;
  unsigned long durationMs = activeCommandDurationMs;

  setPulseTargetOff(activePulse);
  activePulse = PULSE_NONE;
  activePulseDurationMs = DEFAULT_PULSE_MS;

  if (wasMqttCommand) {
    clearMqttCommandState();
    publishPumpCommandStatus(
      commandId,
      pump,
      action,
      durationMs,
      true,
      true,
      "completed",
      "Pump command completed"
    );
  }
}

bool readJsonString(const String& json, const char* key, String& value) {
  String pattern = "\"";
  pattern += key;
  pattern += "\"";

  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return false;
  }

  int startIndex = colonIndex + 1;
  while (startIndex < (int)json.length() && isspace(json.charAt(startIndex))) {
    startIndex++;
  }

  if (startIndex >= (int)json.length() || json.charAt(startIndex) != '"') {
    return false;
  }

  startIndex++;
  int endIndex = startIndex;
  while (endIndex < (int)json.length()) {
    if (json.charAt(endIndex) == '"' && json.charAt(endIndex - 1) != '\\') {
      value = json.substring(startIndex, endIndex);
      return true;
    }

    endIndex++;
  }

  return false;
}

bool readJsonUnsignedLong(const String& json, const char* key, unsigned long& value) {
  String pattern = "\"";
  pattern += key;
  pattern += "\"";

  int keyIndex = json.indexOf(pattern);
  if (keyIndex < 0) {
    return false;
  }

  int colonIndex = json.indexOf(':', keyIndex + pattern.length());
  if (colonIndex < 0) {
    return false;
  }

  int startIndex = colonIndex + 1;
  while (startIndex < (int)json.length() && isspace(json.charAt(startIndex))) {
    startIndex++;
  }

  int endIndex = startIndex;
  while (endIndex < (int)json.length() && isdigit(json.charAt(endIndex))) {
    endIndex++;
  }

  if (endIndex == startIndex) {
    return false;
  }

  value = json.substring(startIndex, endIndex).toInt();
  return true;
}

PumpCommand parsePumpCommandPayload(const String& payload) {
  PumpCommand command;
  command.commandId = "";
  command.deviceId = "";
  command.pump = "";
  command.action = "";
  command.state = "";
  command.durationMs = 0;
  command.reason = "";
  command.source = "";

  readJsonString(payload, "commandId", command.commandId);
  readJsonString(payload, "deviceId", command.deviceId);
  readJsonString(payload, "pump", command.pump);
  readJsonString(payload, "action", command.action);
  readJsonString(payload, "state", command.state);
  readJsonUnsignedLong(payload, "durationMs", command.durationMs);
  readJsonString(payload, "reason", command.reason);
  readJsonString(payload, "source", command.source);

  command.pump = normalizePumpName(command.pump);
  command.action.trim();
  command.action.toLowerCase();
  command.state.trim();
  command.state.toLowerCase();

  return command;
}

void rejectPumpCommand(const PumpCommand& command, const String& message) {
  String commandId = command.commandId.length() > 0 ? command.commandId : "unknown";
  String pump = command.pump.length() > 0 ? command.pump : "unknown";
  String action = command.action.length() > 0 ? command.action : "unknown";

  publishPumpCommandStatus(
    commandId,
    pump,
    action,
    command.durationMs,
    false,
    false,
    "rejected",
    message,
    command.state
  );
}

void handleMainPumpSetCommand(const PumpCommand& command) {
  if (command.pump != "main") {
    rejectPumpCommand(command, "Rejected: set action is only allowed for main pump");
    return;
  }

  if (command.state != "on" && command.state != "off") {
    rejectPumpCommand(command, "Rejected: state must be on or off");
    return;
  }

  if (command.state == "on") {
    readAndStoreSensors();

    if (String(latestSensorData.waterLevel) != "normal") {
      rejectPumpCommand(command, "Rejected: main pump can only turn on when water level is normal");
      return;
    }
  }

  if (activePulse == PULSE_MAIN) {
    cancelActivePulse(true, "Pump command cancelled by main set command");
  }

  bool turnOn = command.state == "on";
  setPumpMain(turnOn);
  printPumpState("pumpMain", turnOn);

  publishPumpCommandStatus(
    command.commandId,
    command.pump,
    command.action,
    0,
    true,
    true,
    turnOn ? "set_on" : "set_off",
    turnOn ? "Main pump turned on continuously" : "Main pump turned off",
    command.state
  );
}

void handlePumpCommandPayload(const String& payload) {
  Serial.println("MQTT pump command received");
  Serial.println(payload);

  PumpCommand command = parsePumpCommandPayload(payload);

  if (command.commandId.length() == 0) {
    command.commandId = "unknown";
  }

  if (command.deviceId != DEVICE_ID) {
    rejectPumpCommand(command, "Rejected: deviceId mismatch");
    return;
  }

  if (command.action == "set") {
    handleMainPumpSetCommand(command);
    return;
  }

  if (command.action != "pulse") {
    rejectPumpCommand(command, "Rejected: action must be pulse or set");
    return;
  }

  PulseTarget target = pumpToPulseTarget(command.pump);
  if (target == PULSE_NONE) {
    rejectPumpCommand(command, "Rejected: invalid pump");
    return;
  }

  unsigned long maxDurationMs = maxDurationForPump(command.pump);
  if (command.durationMs == 0) {
    rejectPumpCommand(command, "Rejected: durationMs must be greater than 0");
    return;
  }

  if (command.durationMs > maxDurationMs) {
    rejectPumpCommand(command, "Rejected: durationMs exceeds max");
    return;
  }

  if (activePulse != PULSE_NONE) {
    rejectPumpCommand(command, "Rejected: another command is active");
    return;
  }

  if (command.pump == "A" && getPumpB()) {
    rejectPumpCommand(command, "Rejected: Pump B is already running");
    return;
  }

  if (command.pump == "B" && getPumpA()) {
    rejectPumpCommand(command, "Rejected: Pump A is already running");
    return;
  }

  if (command.pump == "A" || command.pump == "B") {
    readAndStoreSensors();

    if (String(latestSensorData.waterLevel) == "low") {
      rejectPumpCommand(command, "Rejected: water level is low");
      return;
    }

    if (!latestSensorData.waterTempValid) {
      rejectPumpCommand(command, "Rejected: water temperature sensor is invalid");
      return;
    }
  }

  startPulse(target, command.durationMs, true, command);
}

void handleMqttMessage(const String& topic, const String& payload) {
  if (topic == MQTT_TOPIC_PUMP_CMD) {
    handlePumpCommandPayload(payload);
  }
}

void handleCommand(String command) {
  command.trim();
  command.toLowerCase();

  if (command.length() == 0) {
    return;
  }

  PumpCommand emptyCommand;
  emptyCommand.commandId = "";
  emptyCommand.pump = "";
  emptyCommand.action = "pulse";
  emptyCommand.state = "";
  emptyCommand.durationMs = DEFAULT_PULSE_MS;

  if (command == "help") {
    printHelp();
  } else if (command == "status") {
    printImmediateStatus();
  } else if (command == "all_off") {
    cancelActivePulse(true, "Pump command cancelled by all_off");
    turnAllPumpsOff();
    printPumpState("pumpMain", false);
    printPumpState("pumpA", false);
    printPumpState("pumpB", false);
    printPumpState("pumpSpare", false);
  } else if (command == "main_on") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpMain(true);
    printPumpState("pumpMain", true);
  } else if (command == "main_off") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpMain(false);
    printPumpState("pumpMain", false);
  } else if (command == "a_on") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    if (getPumpB()) {
      setPumpB(false);
      printPumpState("pumpB", false);
    }
    setPumpA(true);
    printPumpState("pumpA", true);
  } else if (command == "a_off") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpA(false);
    printPumpState("pumpA", false);
  } else if (command == "b_on") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    if (getPumpA()) {
      setPumpA(false);
      printPumpState("pumpA", false);
    }
    setPumpB(true);
    printPumpState("pumpB", true);
  } else if (command == "b_off") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpB(false);
    printPumpState("pumpB", false);
  } else if (command == "spare_on") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpSpare(true);
    printPumpState("pumpSpare", true);
  } else if (command == "spare_off") {
    cancelActivePulse(true, "Pump command cancelled by Serial command");
    setPumpSpare(false);
    printPumpState("pumpSpare", false);
  } else if (command == "pulse_main") {
    startPulse(PULSE_MAIN, DEFAULT_PULSE_MS, false, emptyCommand);
  } else if (command == "pulse_a") {
    if (getPumpB()) {
      setPumpB(false);
      printPumpState("pumpB", false);
    }
    startPulse(PULSE_A, DEFAULT_PULSE_MS, false, emptyCommand);
  } else if (command == "pulse_b") {
    if (getPumpA()) {
      setPumpA(false);
      printPumpState("pumpA", false);
    }
    startPulse(PULSE_B, DEFAULT_PULSE_MS, false, emptyCommand);
  } else {
    Serial.print("Unknown command: ");
    Serial.println(command);
    Serial.println("Type 'help' to show available commands.");
  }
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    char incoming = Serial.read();

    if (incoming == '\n' || incoming == '\r') {
      handleCommand(serialCommand);
      serialCommand = "";
    } else {
      serialCommand += incoming;
    }
  }
}

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  telemetryIdentityBegin();

  sensorsBegin();
  pumpsBegin();
  turnAllPumpsOff();

  readAndStoreSensors();

  Serial.println("Hydroponic Device001 Main Firmware V3");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Telemetry schema: ");
  Serial.println(TELEMETRY_SCHEMA_VERSION);
  Serial.print("Boot ID: ");
  Serial.println(getTelemetryBootId());
  Serial.println("Mode: Wi-Fi + MQTT Sensor Publish + Pump Command V2");
  Serial.print("MQTT sensor topic: ");
  Serial.println(MQTT_TOPIC_SENSOR);
  Serial.print("MQTT pump command topic: ");
  Serial.println(MQTT_TOPIC_PUMP_CMD);
  Serial.print("MQTT pump status topic: ");
  Serial.println(MQTT_TOPIC_PUMP_STATUS);
  Serial.println("Manual Serial commands are still enabled.");
  Serial.println("WARNING: Pump A/B MQTT/API commands are pulse-only.");
  Serial.println("WARNING: Main pump MQTT/API supports continuous set on/off.");
  Serial.println("WARNING: Use clean water only for Pump A/B tests.");
  Serial.println("WARNING: Main pump speed controller is hardware-only.");

  printHelp();
  setMqttMessageHandler(handleMqttMessage);
  mqttBegin();
}

void loop() {
  unsigned long currentMs = millis();

  readSerialCommands();
  updatePulse();
  mqttLoop();
  sensorsUpdate(currentMs);
  latestSensorData = readSensors();
  hasSensorData = true;

  if (currentMs - previousStatusPrintMs >= STATUS_PRINT_INTERVAL_MS) {
    previousStatusPrintMs = currentMs;

    if (!hasSensorData) {
      readAndStoreSensors();
    }

    printSensorStatus(latestSensorData);
  }

  if (currentMs - previousMqttPublishMs >= MQTT_PUBLISH_INTERVAL_MS) {
    previousMqttPublishMs = currentMs;
    publishLatestSensorPayload();
  }
}
