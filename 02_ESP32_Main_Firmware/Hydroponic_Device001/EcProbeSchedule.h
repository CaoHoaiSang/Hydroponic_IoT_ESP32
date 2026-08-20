#ifndef EC_PROBE_SCHEDULE_H
#define EC_PROBE_SCHEDULE_H

inline bool shouldStartEcProbeScheduledMeasurement(
  bool measurementCompletedThisLoop,
  bool telemetryPending,
  bool scheduleDue
) {
  return !measurementCompletedThisLoop && !telemetryPending && scheduleDue;
}

#endif
