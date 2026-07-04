#include "Pumps.h"

#include <Arduino.h>

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
  pumpMainState = on;
  writePumpOutput(PIN_PUMP_MAIN, on);
}

void setPumpA(bool on) {
  if (on && pumpBState) {
    setPumpB(false);
  }

  pumpAState = on;
  writePumpOutput(PIN_PUMP_A, on);
}

void setPumpB(bool on) {
  if (on && pumpAState) {
    setPumpA(false);
  }

  pumpBState = on;
  writePumpOutput(PIN_PUMP_B, on);
}

void setPumpSpare(bool on) {
  pumpSpareState = on;
  writePumpOutput(PIN_PUMP_SPARE, on);
}

void turnAllPumpsOff() {
  setPumpMain(false);
  setPumpA(false);
  setPumpB(false);
  setPumpSpare(false);
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
