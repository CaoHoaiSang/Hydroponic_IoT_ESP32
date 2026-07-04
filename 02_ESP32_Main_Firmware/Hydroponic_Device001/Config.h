#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define DEVICE_ID "device001"

const unsigned long SERIAL_BAUDRATE = 115200;

// Official sensor pins.
#define PIN_TDS_ADC 34
#define PIN_DS18B20_DATA 4
#define PIN_WATER_LEVEL 27

// Official MOSFET / pump pins.
#define PIN_PUMP_MAIN 25
#define PIN_PUMP_A 26
#define PIN_PUMP_B 14
#define PIN_PUMP_SPARE 33

// Sensor configuration.
const int TDS_SAMPLE_COUNT = 30;
const bool WATER_LEVEL_LOW_WHEN_GPIO_LOW = true;

// MOSFET module configuration.
const bool MOSFET_ACTIVE_HIGH = true;

// Main local firmware timing.
const unsigned long STATUS_PRINT_INTERVAL_MS = 30000;
const unsigned long SENSOR_READ_INTERVAL_MS = 2000;
const unsigned long DEFAULT_PULSE_MS = 5000;

// MQTT topics for device001.
#define MQTT_TOPIC_SENSOR "hydroponic/device001/sensor"
#define MQTT_TOPIC_PUMP_CMD "hydroponic/device001/pump/cmd"
#define MQTT_TOPIC_PUMP_STATUS "hydroponic/device001/pump/status"
#define MQTT_TOPIC_ALERT "hydroponic/device001/alert"

// MQTT timing and client identity.
const unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000;
const unsigned long MQTT_PUBLISH_INTERVAL_MS = 30000;
#define MQTT_CLIENT_ID "hydroponic_device001"

// Safe MQTT/API pump pulse limits.
const unsigned long MQTT_PUMP_MAIN_MAX_DURATION_MS = 10000;
const unsigned long MQTT_PUMP_A_MAX_DURATION_MS = 5000;
const unsigned long MQTT_PUMP_B_MAX_DURATION_MS = 5000;

#endif
