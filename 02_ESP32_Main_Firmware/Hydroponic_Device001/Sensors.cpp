#include "Sensors.h"

#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

#include "Config.h"

OneWire oneWire(PIN_DS18B20_DATA);
DallasTemperature ds18b20(&oneWire);

void sensorsBegin() {
  pinMode(PIN_TDS_ADC, INPUT);
  pinMode(PIN_WATER_LEVEL, INPUT_PULLUP);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TDS_ADC, ADC_11db);

  ds18b20.begin();
}

SensorData readSensors() {
  SensorData data;

  unsigned long sampleSum = 0;
  data.tdsMin = 4095;
  data.tdsMax = 0;

  for (int i = 0; i < TDS_SAMPLE_COUNT; i++) {
    int sample = analogRead(PIN_TDS_ADC);
    sampleSum += sample;

    if (sample < data.tdsMin) {
      data.tdsMin = sample;
    }

    if (sample > data.tdsMax) {
      data.tdsMax = sample;
    }
  }

  float averageRaw = sampleSum / (float)TDS_SAMPLE_COUNT;
  data.tdsRaw = (int)(averageRaw + 0.5);
  data.tdsVoltage = averageRaw * 3.3 / 4095.0;

  ds18b20.requestTemperatures();
  data.waterTemp = ds18b20.getTempCByIndex(0);
  data.waterTempValid = (data.waterTemp != DEVICE_DISCONNECTED_C);

  data.waterLevelRaw = digitalRead(PIN_WATER_LEVEL);
  bool gpioLow = (data.waterLevelRaw == LOW);
  bool waterLow = WATER_LEVEL_LOW_WHEN_GPIO_LOW ? gpioLow : !gpioLow;
  data.waterLevel = waterLow ? "low" : "normal";

  return data;
}
