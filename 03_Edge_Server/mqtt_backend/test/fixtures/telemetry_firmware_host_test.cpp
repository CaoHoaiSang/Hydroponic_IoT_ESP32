#include <cassert>
#include <cstdint>
#include <string>

#include "TelemetryPublishState.h"
#include "TelemetrySequence.h"
#include "EcProbeSchedule.h"

int main() {
  assert(!shouldStartEcProbeScheduledMeasurement(true, false, true));
  assert(!shouldStartEcProbeScheduledMeasurement(false, true, true));
  assert(!shouldStartEcProbeScheduledMeasurement(false, false, false));
  assert(shouldStartEcProbeScheduledMeasurement(false, false, true));

  TelemetrySequenceCounter sequence;
  assert(sequence.next() == 1);
  assert(sequence.next() == 2);

  TelemetrySequenceCounter rollover(UINT32_MAX);
  assert(rollover.next() == 1);

  TelemetryPublishState<std::string> pending;
  assert(pending.begin("payload-v2", "device001:boot:1"));
  assert(!pending.begin("different", "device001:boot:2"));
  pending.recordPublishResult(false);
  assert(pending.pending());
  assert(pending.payload() == "payload-v2");
  assert(pending.measurementId() == "device001:boot:1");
  pending.recordPublishResult(true);
  assert(!pending.pending());
  assert(pending.payload().empty());
  assert(pending.measurementId().empty());
  return 0;
}
