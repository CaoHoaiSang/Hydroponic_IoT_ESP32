#include "MqttService.h"

#include <PubSubClient.h>
#include <WiFi.h>

#include "Config.h"
#if HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE1 || \
    HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE2_MAIN_PUMP || \
    HYDROPONIC_BUILD_PROFILE == HYDROPONIC_PROFILE_USB_STAGE3_NUTRIENT_PUMPS
#include "SecretsStage1.h"
#else
#include "Secrets.h"
#endif

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long previousWifiAttemptMs = 0;
unsigned long previousMqttAttemptMs = 0;
bool wifiBeginCalled = false;
bool wifiConnectedMessagePrinted = false;
bool wifiRetryPending = false;
unsigned long wifiRetryStartedMs = 0;
MqttMessageHandler mqttMessageHandler = nullptr;

static void handleMqttMessage(char* topic, byte* payload, unsigned int length) {
  String topicText = String(topic);
  String payloadText;
  payloadText.reserve(length + 1);

  for (unsigned int i = 0; i < length; i++) {
    payloadText += (char)payload[i];
  }

  if (mqttMessageHandler != nullptr) {
    mqttMessageHandler(topicText, payloadText);
  }
}

void setMqttMessageHandler(MqttMessageHandler handler) {
  mqttMessageHandler = handler;
}

bool isWifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

bool isMqttConnected() {
  return mqttClient.connected();
}

static void startWifiConnection() {
  Serial.println("WiFi connecting");

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  wifiBeginCalled = true;
  wifiRetryPending = false;
  wifiConnectedMessagePrinted = false;
  previousWifiAttemptMs = millis();
}

static void scheduleWifiRetry() {
  Serial.println("WiFi connection timeout, resetting STA before retry");
  WiFi.disconnect(false, false);
  wifiBeginCalled = false;
  wifiRetryPending = true;
  wifiRetryStartedMs = millis();
}

static void connectMqttIfNeeded() {
  if (!isWifiConnected() || isMqttConnected()) {
    return;
  }

  unsigned long currentMs = millis();
  if (previousMqttAttemptMs > 0 && currentMs - previousMqttAttemptMs < MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }

  previousMqttAttemptMs = currentMs;
  Serial.println("MQTT connecting");

  bool connected = false;
  if (MQTT_USERNAME[0] == '\0') {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  }

  if (connected) {
    Serial.println("MQTT connected");
    if (MQTT_PUMP_COMMANDS_ENABLED) {
      if (mqttClient.subscribe(MQTT_TOPIC_PUMP_CMD)) {
        Serial.print("Subscribed to ");
        Serial.println(MQTT_TOPIC_PUMP_CMD);
      } else {
        Serial.println("MQTT subscribe failed");
      }
    } else {
      Serial.println("MQTT pump command subscription: DISABLED BY BUILD PROFILE");
    }
  } else {
    Serial.print("MQTT connect failed, state: ");
    Serial.println(mqttClient.state());
  }
}

void mqttBegin() {
  WiFi.onEvent(
    [](WiFiEvent_t event, WiFiEventInfo_t info) {
      Serial.print("WiFi disconnected, reason: ");
      Serial.println(info.wifi_sta_disconnected.reason);
    },
    WiFiEvent_t::ARDUINO_EVENT_WIFI_STA_DISCONNECTED
  );
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(handleMqttMessage);
  mqttClient.setBufferSize(MQTT_PACKET_BUFFER_SIZE);
  startWifiConnection();
}

void mqttLoop() {
  unsigned long currentMs = millis();

  if (!isWifiConnected()) {
    wifiConnectedMessagePrinted = false;

    if (wifiRetryPending) {
      if (currentMs - wifiRetryStartedMs >= WIFI_RETRY_SETTLE_MS) {
        startWifiConnection();
      }
    } else if (!wifiBeginCalled) {
      startWifiConnection();
    } else if (currentMs - previousWifiAttemptMs >= WIFI_RECONNECT_INTERVAL_MS) {
      // Let the driver settle before writing the STA configuration for the next attempt.
      scheduleWifiRetry();
    }

    return;
  }

  if (!wifiConnectedMessagePrinted) {
    Serial.print("WiFi connected, IP address: ");
    Serial.println(WiFi.localIP());
    wifiConnectedMessagePrinted = true;
  }

  connectMqttIfNeeded();

  if (isMqttConnected()) {
    mqttClient.loop();
  }
}

bool publishSensorPayload(const String& payload) {
  if (!isWifiConnected() || !isMqttConnected()) {
    Serial.println("MQTT publish failed");
    return false;
  }

  bool published = mqttClient.publish(MQTT_TOPIC_SENSOR, payload.c_str());

  if (published) {
    Serial.println("MQTT publish OK");
  } else {
    Serial.println("MQTT publish failed");
  }

  return published;
}

bool publishPumpStatusPayload(const String& payload) {
  if (!isWifiConnected() || !isMqttConnected()) {
    Serial.println("MQTT pump status publish failed");
    return false;
  }

  bool published = mqttClient.publish(MQTT_TOPIC_PUMP_STATUS, payload.c_str());

  if (published) {
    Serial.println("MQTT pump status publish OK");
  } else {
    Serial.println("MQTT pump status publish failed");
  }

  return published;
}
