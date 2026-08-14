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
  const bool effectiveOn = mainPumpEffectiveState(on);
  pumpMainState = effectiveOn;
  writePumpOutput(PIN_PUMP_MAIN, effectiveOn);
}

void setPumpA(bool on) {
  on = nutrientPumpEffectiveState(on);
  if (on && pumpBState) {
    setPumpB(false);
  }

  pumpAState = on;
  writePumpOutput(PIN_PUMP_A, on);
}

void setPumpB(bool on) {
  on = nutrientPumpEffectiveState(on);
  if (on && pumpAState) {
    setPumpA(false);
  }

  pumpBState = on;
  writePumpOutput(PIN_PUMP_B, on);
}

void setPumpSpare(bool on) {
  const bool effectiveOn = spareEffectiveState(on);
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
  if (!MAIN_PUMP_ACTUATION_ENABLED) {
    pumpMainState = false;
    writePumpOutput(PIN_PUMP_MAIN, false);
  }

  if (!NUTRIENT_PUMP_ACTUATION_ENABLED) {
    pumpAState = false;
    pumpBState = false;
    writePumpOutput(PIN_PUMP_A, false);
    writePumpOutput(PIN_PUMP_B, false);
  }

  if (!SPARE_ACTUATION_ENABLED) {
    pumpSpareState = false;
    writePumpOutput(PIN_PUMP_SPARE, false);
  }
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
