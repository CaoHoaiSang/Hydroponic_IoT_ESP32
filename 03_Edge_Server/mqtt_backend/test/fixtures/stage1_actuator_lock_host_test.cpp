#define HYDROPONIC_BUILD_PROFILE 1

#include <cassert>

#include "ActuatorSafety.h"

int main() {
  static_assert(ACTUATORS_LOCKED, "USB Stage 1 must lock actuators");
  static_assert(!MQTT_PUMP_COMMANDS_ENABLED, "USB Stage 1 must not subscribe pump commands");
  static_assert(!SERIAL_ACTUATOR_COMMANDS_ENABLED, "USB Stage 1 must reject Serial actuator commands");
  static_assert(!MAIN_PUMP_ACTUATION_ENABLED, "USB Stage 1 must lock the main pump");
  static_assert(!NUTRIENT_PUMP_ACTUATION_ENABLED, "USB Stage 1 must lock nutrient pumps");
  static_assert(!actuatorOnRequestAllowed(true), "ON requests must fail closed");
  static_assert(!actuatorEffectiveState(true), "ON requests must resolve to OFF");
  static_assert(actuatorOnRequestAllowed(false), "OFF requests remain safe");
  assert(!actuatorEffectiveState(true));
  assert(!actuatorEffectiveState(false));
  assert(!mainPumpEffectiveState(true));
  assert(!nutrientPumpEffectiveState(true));
  assert(!spareEffectiveState(true));
  return 0;
}
