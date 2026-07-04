#ifndef MQTT_SERVICE_H
#define MQTT_SERVICE_H

#include <Arduino.h>

typedef void (*MqttMessageHandler)(const String& topic, const String& payload);

void setMqttMessageHandler(MqttMessageHandler handler);

void mqttBegin();
void mqttLoop();

bool isWifiConnected();
bool isMqttConnected();
bool publishSensorPayload(const String& payload);
bool publishPumpStatusPayload(const String& payload);

#endif
