#define HYDROPONIC_BUILD_PROFILE 2

#include <cassert>

#include "ActuatorSafety.h"

int main() {
  static_assert(!ACTUATORS_LOCKED, "Stage 2 needs the bounded main-pump path");
  static_assert(MQTT_PUMP_COMMANDS_ENABLED, "Stage 2 must receive the one-shot MQTT command");
  static_assert(!SERIAL_ACTUATOR_COMMANDS_ENABLED, "Stage 2 must reject Serial actuator commands");
  static_assert(MAIN_PUMP_ACTUATION_ENABLED, "Stage 2 must permit only the main pump");
  static_assert(!NUTRIENT_PUMP_ACTUATION_ENABLED, "Stage 2 must lock Pump A/B");
  static_assert(!SPARE_ACTUATION_ENABLED, "Stage 2 must lock spare output");
  static_assert(!MAIN_PUMP_CONTINUOUS_ENABLED, "Stage 2 must reject indefinite main-pump ON");
  static_assert(PROFILE_MAIN_PUMP_MAX_DURATION_MS == 3000, "Stage 2 hard cap must be 3000 ms");
  assert(mainPumpEffectiveState(true));
  assert(!nutrientPumpEffectiveState(true));
  assert(!spareEffectiveState(true));
  return 0;
}
