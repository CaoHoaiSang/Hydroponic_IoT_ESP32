#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#include "BuildProfile.h"

#define DEVICE_ID "device001"
const uint8_t TELEMETRY_SCHEMA_VERSION = 2;

const unsigned long SERIAL_BAUDRATE = 115200;

// Official sensor pins.
#define PIN_TDS_ADC 34
#define PIN_DS18B20_DATA 4
#define PIN_WATER_LEVEL 27
#define PIN_EC_POWER_RELAY 32

// Official MOSFET / pump pins.
#define PIN_PUMP_MAIN 25
#define PIN_PUMP_A 26
#define PIN_PUMP_B 14
#define PIN_PUMP_SPARE 33

// Sensor configuration.
const int TDS_SAMPLE_COUNT = 30;
const unsigned long TDS_SAMPLE_INTERVAL_MS = 40;
const int TDS_WINDOW_TRIM_COUNT_PER_SIDE = 3;
const int TDS_WINDOW_MAX_ROBUST_SPREAD_RAW = 50;
const int TDS_WINDOW_MAX_ABSOLUTE_SPREAD_RAW = 80;
const bool EC_POWER_RELAY_ACTIVE_HIGH = true;
const unsigned long EC_PROBE_WARMUP_MS = 30000;
const unsigned long EC_PROBE_MEASUREMENT_INTERVAL_MS = 900000;
const unsigned long EC_PROBE_MIN_OFF_MS = 60000;
const unsigned long EC_PROBE_MAX_ON_MS = 35000;
const float WATER_TEMP_MIN_C = 0.0;
const float WATER_TEMP_MAX_C = 50.0;
const unsigned long DS18B20_READ_INTERVAL_MS = 2000;
const unsigned long DS18B20_CONVERSION_MS = 750;
const bool WATER_LEVEL_LOW_WHEN_GPIO_LOW = true;

// MOSFET module configuration.
const bool MOSFET_ACTIVE_HIGH = true;

// Main local firmware timing.
const unsigned long STATUS_PRINT_INTERVAL_MS = 30000;
const unsigned long SENSOR_READ_INTERVAL_MS = 2000;
const unsigned long DEFAULT_PULSE_MS = 5000;

// MQTT topics are isolated by build profile. Operational topics remain unchanged.
#if HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE1
#define MQTT_TOPIC_SENSOR "stage1/hydroponic/device001/sensor"
#define MQTT_TOPIC_PUMP_CMD "stage1/hydroponic/device001/pump/cmd"
#define MQTT_TOPIC_PUMP_STATUS "stage1/hydroponic/device001/pump/status"
// Reserved identity only. USB Stage 1 neither publishes nor subscribes to alerts.
#define MQTT_TOPIC_ALERT "stage1/hydroponic/device001/alert"
#define MQTT_CLIENT_ID "hydroponic_device001_stage1"
#elif HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE2_MAIN_PUMP
#define MQTT_TOPIC_SENSOR "stage1/hydroponic/device001/sensor"
#define MQTT_TOPIC_PUMP_CMD "stage1/hydroponic/device001/pump/cmd"
#define MQTT_TOPIC_PUMP_STATUS "stage1/hydroponic/device001/pump/status"
#define MQTT_TOPIC_ALERT "stage1/hydroponic/device001/alert"
#define MQTT_CLIENT_ID "hydroponic_device001_stage2_main"
#elif HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE3_NUTRIENT_PUMPS
#define MQTT_TOPIC_SENSOR "stage1/hydroponic/device001/sensor"
#define MQTT_TOPIC_PUMP_CMD "stage1/hydroponic/device001/pump/cmd"
#define MQTT_TOPIC_PUMP_STATUS "stage1/hydroponic/device001/pump/status"
#define MQTT_TOPIC_ALERT "stage1/hydroponic/device001/alert"
#define MQTT_CLIENT_ID "hydroponic_device001_stage3_nutrient"
#else
#define MQTT_TOPIC_SENSOR "hydroponic/device001/sensor"
#define MQTT_TOPIC_PUMP_CMD "hydroponic/device001/pump/cmd"
#define MQTT_TOPIC_PUMP_STATUS "hydroponic/device001/pump/status"
#define MQTT_TOPIC_ALERT "hydroponic/device001/alert"
#define MQTT_CLIENT_ID "hydroponic_device001"
#endif

// MQTT timing and client identity.
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 30000;
const unsigned long WIFI_RETRY_SETTLE_MS = 1000;
const unsigned long MQTT_PUBLISH_INTERVAL_MS = 30000;
const uint16_t MQTT_PACKET_BUFFER_SIZE = 1024;
// Safe MQTT/API pump pulse limits.
const unsigned long MQTT_PUMP_MAIN_MAX_DURATION_MS = 10000;
const unsigned long MQTT_PUMP_A_MAX_DURATION_MS = 5000;
const unsigned long MQTT_PUMP_B_MAX_DURATION_MS = 5000;

#endif
