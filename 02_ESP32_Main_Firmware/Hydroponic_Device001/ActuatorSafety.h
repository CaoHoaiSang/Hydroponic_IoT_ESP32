#ifndef ACTUATOR_SAFETY_H
#define ACTUATOR_SAFETY_H

#include "BuildProfile.h"

constexpr bool actuatorOnRequestAllowed(bool requestedOn) {
  return !requestedOn || !ACTUATORS_LOCKED;
}

constexpr bool actuatorEffectiveState(bool requestedOn) {
  return actuatorOnRequestAllowed(requestedOn) ? requestedOn : false;
}

constexpr bool mainPumpEffectiveState(bool requestedOn) {
  return requestedOn && MAIN_PUMP_ACTUATION_ENABLED;
}

constexpr bool nutrientPumpEffectiveState(bool requestedOn) {
  return requestedOn && NUTRIENT_PUMP_ACTUATION_ENABLED;
}

constexpr bool spareEffectiveState(bool requestedOn) {
  return requestedOn && SPARE_ACTUATION_ENABLED;
}

#endif
