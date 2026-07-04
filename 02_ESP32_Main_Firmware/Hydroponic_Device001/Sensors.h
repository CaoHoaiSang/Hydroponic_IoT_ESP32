#ifndef SENSORS_H
#define SENSORS_H

struct SensorData {
  int tdsRaw;
  float tdsVoltage;
  int tdsMin;
  int tdsMax;
  float waterTemp;
  bool waterTempValid;
  const char* waterLevel;
  int waterLevelRaw;
};

void sensorsBegin();
SensorData readSensors();

#endif
