// T10_EC_Power_Settling_Test.ino
// Purpose: Measure how SEN0244 GPIO34 settles after relay-controlled power-on.
// This test reports raw ADC diagnostics only. It does not calculate calibrated EC/TDS.
// Safety: Relay starts OFF and every measurement window is bounded to 30 seconds.

#define PIN_EC_POWER_RELAY 32
#define PIN_TDS_ADC 34

const bool RELAY_ACTIVE_HIGH = true;
const size_t SAMPLE_COUNT = 30;
const size_t ROBUST_TRIM_COUNT = 3;
const unsigned long SAMPLE_INTERVAL_MS = 40;
const unsigned long PRINT_INTERVAL_MS = 1000;
const unsigned long POWER_WINDOW_MS = 30000;
const unsigned long POWER_WATCHDOG_MS = 32000;

uint16_t samples[SAMPLE_COUNT] = {};
size_t sampleIndex = 0;
size_t samplesCollected = 0;
bool relayOn = false;
unsigned long relayOnAtMs = 0;
unsigned long lastSampleAtMs = 0;
unsigned long lastPrintAtMs = 0;
String serialCommand;

int relayLevel(bool on) {
  if (RELAY_ACTIVE_HIGH) {
    return on ? HIGH : LOW;
  }

  return on ? LOW : HIGH;
}

void resetSampleWindow() {
  sampleIndex = 0;
  samplesCollected = 0;

  for (size_t index = 0; index < SAMPLE_COUNT; index++) {
    samples[index] = 0;
  }
}

void setRelayPower(bool on) {
  digitalWrite(PIN_EC_POWER_RELAY, relayLevel(on));
  relayOn = on;

  if (on) {
    relayOnAtMs = millis();
    lastSampleAtMs = relayOnAtMs;
    lastPrintAtMs = relayOnAtMs;
    resetSampleWindow();
  }

  Serial.print("EC power relay: ");
  Serial.println(on ? "ON" : "OFF");
}

void sortSamples(uint16_t *values, size_t count) {
  for (size_t index = 1; index < count; index++) {
    const uint16_t value = values[index];
    size_t position = index;

    while (position > 0 && values[position - 1] > value) {
      values[position] = values[position - 1];
      position--;
    }

    values[position] = value;
  }
}

void printWindowDiagnostics(unsigned long nowMs) {
  if (samplesCollected < SAMPLE_COUNT) {
    Serial.print("SETTLING elapsedMs=");
    Serial.print(nowMs - relayOnAtMs);
    Serial.print(" samples=");
    Serial.println(samplesCollected);
    return;
  }

  uint16_t sorted[SAMPLE_COUNT];

  for (size_t index = 0; index < SAMPLE_COUNT; index++) {
    sorted[index] = samples[index];
  }

  sortSamples(sorted, SAMPLE_COUNT);

  const uint16_t rawMin = sorted[0];
  const uint16_t rawMax = sorted[SAMPLE_COUNT - 1];
  const uint16_t robustMin = sorted[ROBUST_TRIM_COUNT];
  const uint16_t robustMax = sorted[SAMPLE_COUNT - ROBUST_TRIM_COUNT - 1];
  const uint16_t rawMedian = static_cast<uint16_t>(
    (static_cast<unsigned long>(sorted[(SAMPLE_COUNT / 2) - 1])
      + sorted[SAMPLE_COUNT / 2]) / 2
  );
  const float voltage = rawMedian * 3.3f / 4095.0f;

  Serial.print("WINDOW elapsedMs=");
  Serial.print(nowMs - relayOnAtMs);
  Serial.print(" median=");
  Serial.print(rawMedian);
  Serial.print(" voltage=");
  Serial.print(voltage, 3);
  Serial.print(" min=");
  Serial.print(rawMin);
  Serial.print(" max=");
  Serial.print(rawMax);
  Serial.print(" spread=");
  Serial.print(rawMax - rawMin);
  Serial.print(" robustMin=");
  Serial.print(robustMin);
  Serial.print(" robustMax=");
  Serial.print(robustMax);
  Serial.print(" robustSpread=");
  Serial.println(robustMax - robustMin);
}

void startMeasurement() {
  if (relayOn) {
    Serial.println("MEASURE rejected: relay is already ON");
    return;
  }

  Serial.println("Starting bounded 30-second SEN0244 settling measurement");
  Serial.println("Columns: elapsedMs, median, voltage, min/max, full spread, robust spread");
  setRelayPower(true);
}

void printStatus() {
  Serial.print("Relay state: ");
  Serial.println(relayOn ? "ON" : "OFF");
  Serial.println("Allowed commands: MEASURE, OFF, STATUS");
}

void handleCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command.length() == 0) {
    return;
  }

  if (command == "MEASURE") {
    startMeasurement();
  } else if (command == "OFF") {
    setRelayPower(false);
  } else if (command == "STATUS") {
    printStatus();
  } else {
    Serial.println("Unknown command. Use MEASURE, OFF, or STATUS.");
  }
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char received = static_cast<char>(Serial.read());

    if (received == '\n' || received == '\r') {
      if (serialCommand.length() > 0) {
        handleCommand(serialCommand);
        serialCommand = "";
      }
      continue;
    }

    if (serialCommand.length() < 32) {
      serialCommand += received;
    }
  }
}

void collectSample(unsigned long nowMs) {
  if (nowMs - lastSampleAtMs < SAMPLE_INTERVAL_MS) {
    return;
  }

  lastSampleAtMs = nowMs;
  samples[sampleIndex] = static_cast<uint16_t>(analogRead(PIN_TDS_ADC));
  sampleIndex = (sampleIndex + 1) % SAMPLE_COUNT;

  if (samplesCollected < SAMPLE_COUNT) {
    samplesCollected++;
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_EC_POWER_RELAY, OUTPUT);
  digitalWrite(PIN_EC_POWER_RELAY, relayLevel(false));
  relayOn = false;

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TDS_ADC, ADC_11db);

  Serial.println();
  Serial.println("Hydroponic Device001 EC Power Settling Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T10_EC_Power_Settling_Test");
  Serial.println("Relay IN: GPIO32 active HIGH");
  Serial.println("TDS ADC: GPIO34, 12-bit, ADC_11db");
  Serial.println("Relay startup state: OFF");
  Serial.println("WARNING: Keep 12V pump power disconnected and Auto Dosing OFF.");
  Serial.println("Type MEASURE for one bounded 30-second raw ADC settling test.");
  printStatus();
}

void loop() {
  readSerialCommands();

  if (!relayOn) {
    return;
  }

  const unsigned long nowMs = millis();
  const unsigned long poweredForMs = nowMs - relayOnAtMs;

  collectSample(nowMs);

  if (nowMs - lastPrintAtMs >= PRINT_INTERVAL_MS) {
    lastPrintAtMs = nowMs;
    printWindowDiagnostics(nowMs);
  }

  if (poweredForMs >= POWER_WINDOW_MS) {
    Serial.println("Measurement window completed; forcing sensor power OFF");
    setRelayPower(false);
  } else if (poweredForMs >= POWER_WATCHDOG_MS) {
    Serial.println("WATCHDOG: forcing sensor power OFF");
    setRelayPower(false);
  }
}
