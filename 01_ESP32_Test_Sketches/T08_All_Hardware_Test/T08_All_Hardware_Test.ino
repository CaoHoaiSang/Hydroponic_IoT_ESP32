// T08_All_Hardware_Test.ino
// Purpose: Final local hardware integration test before writing main firmware.
//
// This sketch reads all verified core sensors and lets the user manually control
// pump outputs from Serial Monitor. It does not use Wi-Fi, MQTT, backend, or DB.
//
// Required Arduino libraries:
// - OneWire
// - DallasTemperature
//
// Safety notes:
// - Use clean water only for Pump A/B.
// - Do not connect nutrient A/B bottles yet.
// - Pump A and Pump B are never allowed to run at the same time in this test.
// - Main pump speed controller is hardware-only in this phase.

#include <OneWire.h>
#include <DallasTemperature.h>

#define PIN_TDS_ADC 34
#define PIN_DS18B20_DATA 4
#define PIN_WATER_LEVEL 27

#define PIN_PUMP_MAIN 25
#define PIN_PUMP_A 26
#define PIN_PUMP_B 14
#define PIN_PUMP_SPARE 33

const bool WATER_LEVEL_LOW_WHEN_GPIO_LOW = true;
const bool MOSFET_ACTIVE_HIGH = true;

const int TDS_SAMPLE_COUNT = 30;
const unsigned long STATUS_INTERVAL_MS = 2000;
const unsigned long PULSE_DURATION_MS = 5000;

OneWire oneWire(PIN_DS18B20_DATA);
DallasTemperature tempSensors(&oneWire);

bool pumpMain = false;
bool pumpA = false;
bool pumpB = false;
bool pumpSpare = false;

bool pulseMainActive = false;
bool pulseAActive = false;
bool pulseBActive = false;
unsigned long pulseMainStartedMs = 0;
unsigned long pulseAStartedMs = 0;
unsigned long pulseBStartedMs = 0;

unsigned long previousStatusMs = 0;
String serialCommand = "";

struct TdsReading {
  float avgRaw;
  float voltage;
  int minSample;
  int maxSample;
};

void writeOutput(int pin, bool on) {
  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(pin, on ? HIGH : LOW);
  } else {
    digitalWrite(pin, on ? LOW : HIGH);
  }
}

void setPumpMain(bool on) {
  pumpMain = on;
  writeOutput(PIN_PUMP_MAIN, on);
}

void setPumpA(bool on) {
  if (on && pumpB) {
    setPumpB(false);
    pulseBActive = false;
    Serial.println("pumpB: OFF");
  }

  pumpA = on;
  writeOutput(PIN_PUMP_A, on);
}

void setPumpB(bool on) {
  if (on && pumpA) {
    setPumpA(false);
    pulseAActive = false;
    Serial.println("pumpA: OFF");
  }

  pumpB = on;
  writeOutput(PIN_PUMP_B, on);
}

void setPumpSpare(bool on) {
  pumpSpare = on;
  writeOutput(PIN_PUMP_SPARE, on);
}

void turnAllOutputsOff() {
  setPumpMain(false);
  setPumpA(false);
  setPumpB(false);
  setPumpSpare(false);
}

void cancelAllPulses() {
  pulseMainActive = false;
  pulseAActive = false;
  pulseBActive = false;
}

void printPumpState(const char* pumpName, bool on) {
  Serial.print(pumpName);
  Serial.print(": ");
  Serial.println(on ? "ON" : "OFF");
}

TdsReading readTds() {
  TdsReading reading;
  unsigned long sampleSum = 0;
  reading.minSample = 4095;
  reading.maxSample = 0;

  for (int i = 0; i < TDS_SAMPLE_COUNT; i++) {
    int sample = analogRead(PIN_TDS_ADC);
    sampleSum += sample;

    if (sample < reading.minSample) {
      reading.minSample = sample;
    }

    if (sample > reading.maxSample) {
      reading.maxSample = sample;
    }
  }

  reading.avgRaw = sampleSum / (float)TDS_SAMPLE_COUNT;
  reading.voltage = reading.avgRaw * 3.3 / 4095.0;
  return reading;
}

const char* readWaterLevel() {
  int rawState = digitalRead(PIN_WATER_LEVEL);
  bool gpioLow = (rawState == LOW);
  bool waterLow = WATER_LEVEL_LOW_WHEN_GPIO_LOW ? gpioLow : !gpioLow;

  return waterLow ? "low" : "normal";
}

float readWaterTempC() {
  tempSensors.requestTemperatures();
  return tempSensors.getTempCByIndex(0);
}

void printStatus() {
  TdsReading tds = readTds();
  float waterTempC = readWaterTempC();
  const char* waterLevel = readWaterLevel();

  Serial.println("{");
  Serial.println("  \"deviceId\": \"device001\",");

  Serial.print("  \"tdsRaw\": ");
  Serial.print(tds.avgRaw, 0);
  Serial.println(",");

  Serial.print("  \"tdsVoltage\": ");
  Serial.print(tds.voltage, 3);
  Serial.println(",");

  Serial.print("  \"tdsMin\": ");
  Serial.print(tds.minSample);
  Serial.println(",");

  Serial.print("  \"tdsMax\": ");
  Serial.print(tds.maxSample);
  Serial.println(",");

  Serial.print("  \"waterTemp\": ");
  if (waterTempC == DEVICE_DISCONNECTED_C) {
    Serial.print("null");
  } else {
    Serial.print(waterTempC, 2);
  }
  Serial.println(",");

  Serial.print("  \"waterLevel\": \"");
  Serial.print(waterLevel);
  Serial.println("\",");

  Serial.print("  \"pumpMain\": ");
  Serial.print(pumpMain ? "true" : "false");
  Serial.println(",");

  Serial.print("  \"pumpA\": ");
  Serial.print(pumpA ? "true" : "false");
  Serial.println(",");

  Serial.print("  \"pumpB\": ");
  Serial.print(pumpB ? "true" : "false");
  Serial.println(",");

  Serial.print("  \"pumpSpare\": ");
  Serial.print(pumpSpare ? "true" : "false");
  Serial.println(",");

  Serial.println("  \"ph\": null");
  Serial.println("}");
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

void handleCommand(String command) {
  command.trim();
  command.toLowerCase();

  if (command.length() == 0) {
    return;
  }

  if (command == "help") {
    printHelp();
  } else if (command == "status") {
    printStatus();
  } else if (command == "all_off") {
    cancelAllPulses();
    turnAllOutputsOff();
    printPumpState("pumpMain", false);
    printPumpState("pumpA", false);
    printPumpState("pumpB", false);
    printPumpState("pumpSpare", false);
  } else if (command == "main_on") {
    pulseMainActive = false;
    setPumpMain(true);
    printPumpState("pumpMain", true);
  } else if (command == "main_off") {
    pulseMainActive = false;
    setPumpMain(false);
    printPumpState("pumpMain", false);
  } else if (command == "a_on") {
    pulseAActive = false;
    setPumpA(true);
    printPumpState("pumpA", true);
  } else if (command == "a_off") {
    pulseAActive = false;
    setPumpA(false);
    printPumpState("pumpA", false);
  } else if (command == "b_on") {
    pulseBActive = false;
    setPumpB(true);
    printPumpState("pumpB", true);
  } else if (command == "b_off") {
    pulseBActive = false;
    setPumpB(false);
    printPumpState("pumpB", false);
  } else if (command == "spare_on") {
    setPumpSpare(true);
    printPumpState("pumpSpare", true);
  } else if (command == "spare_off") {
    setPumpSpare(false);
    printPumpState("pumpSpare", false);
  } else if (command == "pulse_main") {
    setPumpMain(true);
    pulseMainActive = true;
    pulseMainStartedMs = millis();
    printPumpState("pumpMain", true);
  } else if (command == "pulse_a") {
    if (pumpB) {
      setPumpB(false);
      printPumpState("pumpB", false);
    }
    pulseBActive = false;
    setPumpA(true);
    pulseAActive = true;
    pulseAStartedMs = millis();
    printPumpState("pumpA", true);
  } else if (command == "pulse_b") {
    if (pumpA) {
      setPumpA(false);
      printPumpState("pumpA", false);
    }
    pulseAActive = false;
    setPumpB(true);
    pulseBActive = true;
    pulseBStartedMs = millis();
    printPumpState("pumpB", true);
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

void updatePulses() {
  unsigned long currentMs = millis();

  if (pulseMainActive && currentMs - pulseMainStartedMs >= PULSE_DURATION_MS) {
    pulseMainActive = false;
    setPumpMain(false);
    printPumpState("pumpMain", false);
  }

  if (pulseAActive && currentMs - pulseAStartedMs >= PULSE_DURATION_MS) {
    pulseAActive = false;
    setPumpA(false);
    printPumpState("pumpA", false);
  }

  if (pulseBActive && currentMs - pulseBStartedMs >= PULSE_DURATION_MS) {
    pulseBActive = false;
    setPumpB(false);
    printPumpState("pumpB", false);
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_TDS_ADC, INPUT);
  pinMode(PIN_WATER_LEVEL, INPUT_PULLUP);

  pinMode(PIN_PUMP_MAIN, OUTPUT);
  pinMode(PIN_PUMP_A, OUTPUT);
  pinMode(PIN_PUMP_B, OUTPUT);
  pinMode(PIN_PUMP_SPARE, OUTPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TDS_ADC, ADC_11db);

  tempSensors.begin();

  turnAllOutputsOff();
  cancelAllPulses();

  Serial.println("Hydroponic Device001 All Hardware Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T08_All_Hardware_Test");
  Serial.println("Device ID: device001");
  Serial.println("Sensors: TDS GPIO34, DS18B20 GPIO4, Water Level GPIO27");
  Serial.println("Pumps: Main GPIO25, Pump A GPIO26, Pump B GPIO14, Spare GPIO33");
  Serial.println("WARNING: Local hardware test only. No MQTT/backend/database.");
  Serial.println("WARNING: Use clean water only for Pump A/B. Do not connect nutrient bottles yet.");
  Serial.println("WARNING: Main pump speed controller is hardware-only.");
  Serial.println("Type 'help' to show available commands.");
}

void loop() {
  unsigned long currentMs = millis();

  readSerialCommands();
  updatePulses();

  if (currentMs - previousStatusMs >= STATUS_INTERVAL_MS) {
    previousStatusMs = currentMs;
    printStatus();
  }
}
