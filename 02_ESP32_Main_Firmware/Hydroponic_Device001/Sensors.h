#ifndef SENSORS_H
#define SENSORS_H

struct SensorData {
  int tdsRaw;
  float tdsVoltage;
  int tdsMin;
  int tdsMax;
  int tdsSampleCount;
  int tdsSpreadRaw;
  int tdsRobustMin;
  int tdsRobustMax;
  int tdsRobustSpreadRaw;
  int tdsTrimmedSampleCount;
  bool tdsWindowStable;
  bool ecProbePowered;
  const char* ecProbeState;
  const char* ecProbeMeasurementTrigger;
  unsigned long ecProbeWarmupMs;
  unsigned long ecProbePoweredAtUptimeMs;
  unsigned long ecProbeMeasurementAtUptimeMs;
  float waterTemp;
  bool waterTempValid;
  const char* waterLevel;
  int waterLevelRaw;
};

void sensorsBegin();
void sensorsUpdate(unsigned long currentMs);
SensorData readSensors();
bool requestEcProbeMeasurement(unsigned long currentMs, const char* trigger);
bool ecProbeMeasurementReady();
bool ecProbeScheduledMeasurementDue(unsigned long currentMs);
unsigned long ecProbeOffTimeRemainingMs(unsigned long currentMs);
void finishEcProbeMeasurement(unsigned long currentMs);

#endif
