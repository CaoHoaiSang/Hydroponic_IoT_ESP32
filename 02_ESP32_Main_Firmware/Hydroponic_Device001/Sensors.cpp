#include "Sensors.h"

#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

#include "Config.h"

OneWire oneWire(PIN_DS18B20_DATA);
DallasTemperature ds18b20(&oneWire);

static int tdsSamples[TDS_SAMPLE_COUNT];
static int tdsSampleIndex = 0;
static int tdsSamplesCollected = 0;
static unsigned long previousTdsSampleMs = 0;
static unsigned long ds18b20RequestMs = 0;
static unsigned long previousDs18b20CycleMs = 0;
static bool ds18b20ConversionPending = false;
static SensorData latestData;

static bool isValidWaterTemperature(float value) {
  return value != DEVICE_DISCONNECTED_C
    && value != 85.0
    && value >= WATER_TEMP_MIN_C
    && value <= WATER_TEMP_MAX_C;
}

static void updateWaterLevel() {
  latestData.waterLevelRaw = digitalRead(PIN_WATER_LEVEL);
  bool gpioLow = latestData.waterLevelRaw == LOW;
  bool waterLow = WATER_LEVEL_LOW_WHEN_GPIO_LOW ? gpioLow : !gpioLow;
  latestData.waterLevel = waterLow ? "low" : "normal";
}

static void updateTdsSummary() {
  int count = tdsSamplesCollected;
  if (count <= 0) {
    return;
  }

  int sorted[TDS_SAMPLE_COUNT];
  latestData.tdsMin = 4095;
  latestData.tdsMax = 0;

  for (int i = 0; i < count; i++) {
    sorted[i] = tdsSamples[i];
    if (sorted[i] < latestData.tdsMin) latestData.tdsMin = sorted[i];
    if (sorted[i] > latestData.tdsMax) latestData.tdsMax = sorted[i];
  }

  for (int i = 1; i < count; i++) {
    int value = sorted[i];
    int position = i - 1;
    while (position >= 0 && sorted[position] > value) {
      sorted[position + 1] = sorted[position];
      position--;
    }
    sorted[position + 1] = value;
  }

  float medianRaw;
  if (count % 2 == 0) {
    medianRaw = (sorted[count / 2 - 1] + sorted[count / 2]) / 2.0;
  } else {
    medianRaw = sorted[count / 2];
  }

  latestData.tdsRaw = (int)(medianRaw + 0.5);
  latestData.tdsVoltage = medianRaw * 3.3 / 4095.0;
  latestData.tdsSampleCount = count;
  latestData.tdsSpreadRaw = latestData.tdsMax - latestData.tdsMin;
  latestData.tdsRobustMin = latestData.tdsMin;
  latestData.tdsRobustMax = latestData.tdsMax;
  latestData.tdsTrimmedSampleCount = count;

  if (count == TDS_SAMPLE_COUNT
    && count > TDS_WINDOW_TRIM_COUNT_PER_SIDE * 2) {
    latestData.tdsRobustMin = sorted[TDS_WINDOW_TRIM_COUNT_PER_SIDE];
    latestData.tdsRobustMax = sorted[count - TDS_WINDOW_TRIM_COUNT_PER_SIDE - 1];
    latestData.tdsTrimmedSampleCount = count - TDS_WINDOW_TRIM_COUNT_PER_SIDE * 2;
  }

  latestData.tdsRobustSpreadRaw = latestData.tdsRobustMax - latestData.tdsRobustMin;
  // Ignore a small number of ADC outliers, but retain a hard full-window safety cap.
  latestData.tdsWindowStable = count == TDS_SAMPLE_COUNT
    && latestData.tdsRobustSpreadRaw <= TDS_WINDOW_MAX_ROBUST_SPREAD_RAW
    && latestData.tdsSpreadRaw <= TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW;
}

static void updateTdsSampling(unsigned long currentMs) {
  if (tdsSamplesCollected > 0 && currentMs - previousTdsSampleMs < TDS_SAMPLE_INTERVAL_MS) {
    return;
  }

  previousTdsSampleMs = currentMs;
  tdsSamples[tdsSampleIndex] = analogRead(PIN_TDS_ADC);
  tdsSampleIndex = (tdsSampleIndex + 1) % TDS_SAMPLE_COUNT;
  if (tdsSamplesCollected < TDS_SAMPLE_COUNT) tdsSamplesCollected++;
  updateTdsSummary();
}

static void requestWaterTemperature(unsigned long currentMs) {
  ds18b20.requestTemperatures();
  ds18b20RequestMs = currentMs;
  previousDs18b20CycleMs = currentMs;
  ds18b20ConversionPending = true;
}

static void updateWaterTemperature(unsigned long currentMs) {
  if (ds18b20ConversionPending && currentMs - ds18b20RequestMs >= DS18B20_CONVERSION_MS) {
    float value = ds18b20.getTempCByIndex(0);
    latestData.waterTempValid = isValidWaterTemperature(value);
    latestData.waterTemp = latestData.waterTempValid ? value : 0.0;
    ds18b20ConversionPending = false;
  }

  if (!ds18b20ConversionPending
    && currentMs - previousDs18b20CycleMs >= DS18B20_READ_INTERVAL_MS) {
    requestWaterTemperature(currentMs);
  }
}

void sensorsBegin() {
  pinMode(PIN_TDS_ADC, INPUT);
  pinMode(PIN_WATER_LEVEL, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_TDS_ADC, ADC_11db);

  latestData.tdsRaw = 0;
  latestData.tdsVoltage = 0;
  latestData.tdsMin = 0;
  latestData.tdsMax = 0;
  latestData.tdsSampleCount = 0;
  latestData.tdsSpreadRaw = 0;
  latestData.tdsRobustMin = 0;
  latestData.tdsRobustMax = 0;
  latestData.tdsRobustSpreadRaw = 0;
  latestData.tdsTrimmedSampleCount = 0;
  latestData.tdsWindowStable = false;
  latestData.waterTemp = 0;
  latestData.waterTempValid = false;
  latestData.waterLevel = "error";
  latestData.waterLevelRaw = HIGH;

  ds18b20.begin();
  ds18b20.setWaitForConversion(false);
  updateWaterLevel();
  requestWaterTemperature(millis());
}

void sensorsUpdate(unsigned long currentMs) {
  updateTdsSampling(currentMs);
  updateWaterTemperature(currentMs);
  updateWaterLevel();
}

SensorData readSensors() {
  return latestData;
}
