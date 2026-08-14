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
  float waterTemp;
  bool waterTempValid;
  const char* waterLevel;
  int waterLevelRaw;
};

void sensorsBegin();
void sensorsUpdate(unsigned long currentMs);
SensorData readSensors();

#endif
