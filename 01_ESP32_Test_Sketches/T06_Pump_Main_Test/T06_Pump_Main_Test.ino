// T06_Pump_Main_Test.ino
// Purpose: Verify the real main circulation pump through MOSFET CH1 on GPIO25.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - Real 4-channel MOSFET module with IN+/IN- input pairs
// - Main circulation pump 12V connected to OUT1+ / OUT1- only
//
// Important:
// - This test drives the real main circulation pump.
// - Keep the pump in water if it is a submersible pump.
// - Do not run the pump dry.
// - Keep Pump A and Pump B disconnected during this test.
// - This sketch uses millis() for timing instead of delay().

#define PIN_PUMP_MAIN 25

const bool MOSFET_ACTIVE_HIGH = true;

const unsigned long PUMP_ON_TIME_MS = 5000;
const unsigned long PUMP_OFF_TIME_MS = 5000;

bool pumpMainOn = false;
unsigned long stateStartedMs = 0;

void setPumpMain(bool on) {
  pumpMainOn = on;

  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(PIN_PUMP_MAIN, on ? HIGH : LOW);
  } else {
    digitalWrite(PIN_PUMP_MAIN, on ? LOW : HIGH);
  }
}

void printPumpState(bool on) {
  Serial.print("pumpMain: ");
  Serial.println(on ? "ON" : "OFF");
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_PUMP_MAIN, OUTPUT);

  // Always force the pump OFF first before printing or starting the test loop.
  setPumpMain(false);

  Serial.println("Hydroponic Device001 Main Pump Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T06_Pump_Main_Test");
  Serial.println("Device ID: device001");
  Serial.println("Pump Main: GPIO25 -> IN1+ -> OUT1");
  Serial.println("WARNING: This test drives the real main circulation pump.");
  Serial.println("WARNING: Do not run a submersible pump dry.");
  Serial.println("WARNING: Keep Pump A and Pump B disconnected during this test.");

  // Make the first loop cycle turn the main pump ON after setup completes.
  stateStartedMs = millis() - PUMP_OFF_TIME_MS;
}

void loop() {
  unsigned long currentMs = millis();

  if (pumpMainOn && currentMs - stateStartedMs >= PUMP_ON_TIME_MS) {
    setPumpMain(false);
    stateStartedMs = currentMs;
    printPumpState(false);
    return;
  }

  if (!pumpMainOn && currentMs - stateStartedMs >= PUMP_OFF_TIME_MS) {
    setPumpMain(true);
    stateStartedMs = currentMs;
    printPumpState(true);
  }
}
