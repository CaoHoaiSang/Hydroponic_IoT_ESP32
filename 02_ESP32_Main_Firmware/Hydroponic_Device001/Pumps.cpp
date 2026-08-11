#include "Pumps.h"

#include <Arduino.h>

#include "ActuatorSafety.h"
#include "Config.h"

bool pumpMainState = false;
bool pumpAState = false;
bool pumpBState = false;
bool pumpSpareState = false;

void writePumpOutput(int pin, bool on) {
  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(pin, on ? HIGH : LOW);
  } else {
    digitalWrite(pin, on ? LOW : HIGH);
  }
}

void pumpsBegin() {
  pinMode(PIN_PUMP_MAIN, OUTPUT);
  pinMode(PIN_PUMP_A, OUTPUT);
  pinMode(PIN_PUMP_B, OUTPUT);
  pinMode(PIN_PUMP_SPARE, OUTPUT);

  turnAllPumpsOff();
}

void setPumpMain(bool on) {
  const bool effectiveOn = actuatorEffectiveState(on);
  pumpMainState = effectiveOn;
  writePumpOutput(PIN_PUMP_MAIN, effectiveOn);
}

void setPumpA(bool on) {
  on = actuatorEffectiveState(on);
  if (on && pumpBState) {
    setPumpB(false);
  }

  pumpAState = on;
  writePumpOutput(PIN_PUMP_A, on);
}

void setPumpB(bool on) {
  on = actuatorEffectiveState(on);
  if (on && pumpAState) {
    setPumpA(false);
  }

  pumpBState = on;
  writePumpOutput(PIN_PUMP_B, on);
}

void setPumpSpare(bool on) {
  const bool effectiveOn = actuatorEffectiveState(on);
  pumpSpareState = effectiveOn;
  writePumpOutput(PIN_PUMP_SPARE, effectiveOn);
}

void turnAllPumpsOff() {
  setPumpMain(false);
  setPumpA(false);
  setPumpB(false);
  setPumpSpare(false);
}

void enforceActuatorSafetyLock() {
  if (!ACTUATORS_LOCKED) {
    return;
  }

  pumpMainState = false;
  pumpAState = false;
  pumpBState = false;
  pumpSpareState = false;
  writePumpOutput(PIN_PUMP_MAIN, false);
  writePumpOutput(PIN_PUMP_A, false);
  writePumpOutput(PIN_PUMP_B, false);
  writePumpOutput(PIN_PUMP_SPARE, false);
}

bool getPumpMain() {
  return pumpMainState;
}

bool getPumpA() {
  return pumpAState;
}

bool getPumpB() {
  return pumpBState;
}

bool getPumpSpare() {
  return pumpSpareState;
}
