// T09_EC_Power_Relay_Test.ino
// Purpose: Safely verify the 5V relay that switches SEN0244 sensor power.
// Hardware: Relay VCC = 5V, GND = common GND, IN = GPIO32, jumper = HIGH trigger.
// Safety: The relay starts OFF and can only run a bounded two-second test pulse.

#define PIN_EC_POWER_RELAY 32

const bool RELAY_ACTIVE_HIGH = true;
const unsigned long TEST_PULSE_MS = 2000;
const unsigned long MEASURE_PULSE_MS = 10000;
const unsigned long WATCHDOG_LIMIT_MS = 12000;

bool relayOn = false;
unsigned long relayOnAtMs = 0;
unsigned long activePulseDurationMs = TEST_PULSE_MS;
String serialCommand;

int relayLevel(bool on) {
  if (RELAY_ACTIVE_HIGH) {
    return on ? HIGH : LOW;
  }

  return on ? LOW : HIGH;
}

void setRelayPower(bool on) {
  digitalWrite(PIN_EC_POWER_RELAY, relayLevel(on));
  relayOn = on;

  if (on) {
    relayOnAtMs = millis();
  }

  Serial.print("EC power relay: ");
  Serial.println(on ? "ON" : "OFF");
}

void printStatus() {
  Serial.print("Relay state: ");
  Serial.println(relayOn ? "ON" : "OFF");
  Serial.println("Allowed commands: TEST, MEASURE, OFF, STATUS");
}

void handleCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command.length() == 0) {
    return;
  }

  if (command == "TEST") {
    if (relayOn) {
      Serial.println("TEST rejected: relay is already ON");
      return;
    }

    activePulseDurationMs = TEST_PULSE_MS;
    Serial.println("Starting bounded 2-second relay pulse");
    setRelayPower(true);
    return;
  }

  if (command == "MEASURE") {
    if (relayOn) {
      Serial.println("MEASURE rejected: relay is already ON");
      return;
    }

    activePulseDurationMs = MEASURE_PULSE_MS;
    Serial.println("Starting bounded 10-second measurement pulse");
    setRelayPower(true);
    return;
  }

  if (command == "OFF") {
    setRelayPower(false);
    return;
  }

  if (command == "STATUS") {
    printStatus();
    return;
  }

  Serial.println("Unknown command. Use TEST, MEASURE, OFF, or STATUS.");
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

void setup() {
  Serial.begin(115200);

  // The external 10k pull-down keeps IN low before setup starts.
  pinMode(PIN_EC_POWER_RELAY, OUTPUT);
  digitalWrite(PIN_EC_POWER_RELAY, relayLevel(false));
  relayOn = false;

  Serial.println();
  Serial.println("Hydroponic Device001 EC Power Relay Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T09_EC_Power_Relay_Test");
  Serial.println("Device ID: device001");
  Serial.println("Relay IN: GPIO32");
  Serial.println("Relay trigger: HIGH");
  Serial.println("Relay startup state: OFF");
  Serial.println("WARNING: Keep the SEN0244 disconnected for the relay-only test.");
  Serial.println("WARNING: Keep the 12V pump supply disconnected.");
  Serial.println("Type TEST to run one bounded 2-second pulse.");
  Serial.println("Type MEASURE to run one bounded 10-second voltage measurement pulse.");
  printStatus();
}

void loop() {
  readSerialCommands();

  if (!relayOn) {
    return;
  }

  const unsigned long elapsedMs = millis() - relayOnAtMs;

  if (elapsedMs >= activePulseDurationMs) {
    Serial.println("Test pulse completed");
    setRelayPower(false);
  } else if (elapsedMs >= WATCHDOG_LIMIT_MS) {
    // Defensive fallback if the pulse duration is changed incorrectly later.
    Serial.println("WATCHDOG: forcing relay OFF");
    setRelayPower(false);
  }
}
