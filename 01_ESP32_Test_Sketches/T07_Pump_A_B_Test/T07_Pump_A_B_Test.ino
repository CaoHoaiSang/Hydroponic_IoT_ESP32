// T07_Pump_A_B_Test.ino
// Purpose: Verify Pump A and Pump B ON/OFF control through MOSFET CH2 and CH3.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - Real 4-channel MOSFET module with IN+/IN- input pairs
// - Pump A 12V connected to OUT2+ / OUT2-
// - Pump B 12V connected to OUT3+ / OUT3-
//
// Important:
// - This test drives real peristaltic pumps A and B.
// - Use clean water only.
// - Do not connect nutrient A/B bottles yet.
// - Pump A and Pump B will not run at the same time in this test.
// - This sketch uses millis() for timing instead of delay().

#define PIN_PUMP_A 26
#define PIN_PUMP_B 14

const bool MOSFET_ACTIVE_HIGH = true;

const unsigned long PUMP_ON_TIME_MS = 5000;
const unsigned long BETWEEN_PUMPS_WAIT_MS = 3000;

enum TestStep {
  STEP_PUMP_A_ON,
  STEP_WAIT_AFTER_A,
  STEP_PUMP_B_ON,
  STEP_WAIT_AFTER_B
};

TestStep currentStep = STEP_WAIT_AFTER_B;
unsigned long stepStartedMs = 0;

void setPumpA(bool on) {
  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(PIN_PUMP_A, on ? HIGH : LOW);
  } else {
    digitalWrite(PIN_PUMP_A, on ? LOW : HIGH);
  }
}

void setPumpB(bool on) {
  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(PIN_PUMP_B, on ? HIGH : LOW);
  } else {
    digitalWrite(PIN_PUMP_B, on ? LOW : HIGH);
  }
}

void turnAllTestPumpsOff() {
  setPumpA(false);
  setPumpB(false);
}

void printPumpState(const char* pumpName, bool on) {
  Serial.print(pumpName);
  Serial.print(": ");
  Serial.println(on ? "ON" : "OFF");
}

void startPumpA() {
  turnAllTestPumpsOff();
  setPumpA(true);
  currentStep = STEP_PUMP_A_ON;
  stepStartedMs = millis();
  printPumpState("pumpA", true);
}

void stopPumpAAndWait() {
  setPumpA(false);
  currentStep = STEP_WAIT_AFTER_A;
  stepStartedMs = millis();
  printPumpState("pumpA", false);
}

void startPumpB() {
  turnAllTestPumpsOff();
  setPumpB(true);
  currentStep = STEP_PUMP_B_ON;
  stepStartedMs = millis();
  printPumpState("pumpB", true);
}

void stopPumpBAndWait() {
  setPumpB(false);
  currentStep = STEP_WAIT_AFTER_B;
  stepStartedMs = millis();
  printPumpState("pumpB", false);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_PUMP_A, OUTPUT);
  pinMode(PIN_PUMP_B, OUTPUT);

  // Always force both pumps OFF first before starting the test sequence.
  turnAllTestPumpsOff();

  Serial.println("Hydroponic Device001 Pump A/B Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T07_Pump_A_B_Test");
  Serial.println("Device ID: device001");
  Serial.println("Pump A: GPIO26 -> IN2+ -> OUT2");
  Serial.println("Pump B: GPIO14 -> IN3+ -> OUT3");
  Serial.println("WARNING: This test drives real Pump A and Pump B.");
  Serial.println("WARNING: Use clean water only. Do not connect nutrient A/B bottles yet.");
  Serial.println("WARNING: Pump A and Pump B will not run at the same time in this test.");

  // Make the first loop cycle start Pump A immediately after setup completes.
  stepStartedMs = millis() - BETWEEN_PUMPS_WAIT_MS;
}

void loop() {
  unsigned long currentMs = millis();

  switch (currentStep) {
    case STEP_PUMP_A_ON:
      if (currentMs - stepStartedMs >= PUMP_ON_TIME_MS) {
        stopPumpAAndWait();
      }
      break;

    case STEP_WAIT_AFTER_A:
      if (currentMs - stepStartedMs >= BETWEEN_PUMPS_WAIT_MS) {
        startPumpB();
      }
      break;

    case STEP_PUMP_B_ON:
      if (currentMs - stepStartedMs >= PUMP_ON_TIME_MS) {
        stopPumpBAndWait();
      }
      break;

    case STEP_WAIT_AFTER_B:
      if (currentMs - stepStartedMs >= BETWEEN_PUMPS_WAIT_MS) {
        startPumpA();
      }
      break;
  }
}
