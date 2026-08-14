#define HYDROPONIC_BUILD_PROFILE 3

#include <cassert>

#include "ActuatorSafety.h"

int main() {
  static_assert(!ACTUATORS_LOCKED, "Stage 3 needs the bounded nutrient-pump path");
  static_assert(MQTT_PUMP_COMMANDS_ENABLED, "Stage 3 must receive one-shot MQTT commands");
  static_assert(!SERIAL_ACTUATOR_COMMANDS_ENABLED, "Stage 3 must reject Serial actuator commands");
  static_assert(!MAIN_PUMP_ACTUATION_ENABLED, "Stage 3 must lock the Main Pump");
  static_assert(NUTRIENT_PUMP_ACTUATION_ENABLED, "Stage 3 must permit Pump A/B pulses");
  static_assert(!SPARE_ACTUATION_ENABLED, "Stage 3 must lock spare output");
  static_assert(!MAIN_PUMP_CONTINUOUS_ENABLED, "Stage 3 must reject continuous set commands");
  static_assert(PROFILE_MAIN_PUMP_MAX_DURATION_MS == 0, "Stage 3 must not pulse Main Pump");
  static_assert(PROFILE_NUTRIENT_PUMP_MAX_DURATION_MS == 1000, "Stage 3 nutrient hard cap must be 1000 ms");
  assert(!mainPumpEffectiveState(true));
  assert(nutrientPumpEffectiveState(true));
  assert(!spareEffectiveState(true));
  return 0;
}
