#ifndef ACTUATOR_SAFETY_H
#define ACTUATOR_SAFETY_H

#include "BuildProfile.h"

constexpr bool actuatorOnRequestAllowed(bool requestedOn) {
  return !requestedOn || !ACTUATORS_LOCKED;
}

constexpr bool actuatorEffectiveState(bool requestedOn) {
  return actuatorOnRequestAllowed(requestedOn) ? requestedOn : false;
}

#endif
