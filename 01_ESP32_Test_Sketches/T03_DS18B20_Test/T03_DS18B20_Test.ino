// T03_DS18B20_Test.ino
// Purpose: Verify water temperature readings from a DS18B20 sensor on GPIO4.
//
// Required Arduino libraries:
// - OneWire
// - DallasTemperature
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - DS18B20 VCC -> ESP32 3V3
// - DS18B20 GND -> ESP32 GND
// - DS18B20 DATA -> ESP32 GPIO4
// - 4.7k ohm pull-up resistor between DATA and 3V3
//
// Notes for beginners:
// - Open Serial Monitor at 115200 baud.
// - This test only checks DS18B20 temperature reading.
// - Water level, pumps, MQTT, and backend are not used here.
// - This sketch uses millis() for timing instead of delay().

#include <OneWire.h>
#include <DallasTemperature.h>

#define PIN_DS18B20_DATA 4

const unsigned long TEMPERATURE_READ_INTERVAL_MS = 1000;

OneWire oneWire(PIN_DS18B20_DATA);
DallasTemperature sensors(&oneWire);

unsigned long previousReadMs = 0;
int sensorCount = 0;

void setup() {
  Serial.begin(115200);

  sensors.begin();
  sensorCount = sensors.getDeviceCount();

  Serial.println("Hydroponic Device001 DS18B20 Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T03_DS18B20_Test");
  Serial.println("Device ID: device001");
  Serial.println("DS18B20 DATA Pin: GPIO4");
  Serial.print("DS18B20 sensor count: ");
  Serial.println(sensorCount);

  if (sensorCount == 0) {
    Serial.println("ERROR: No DS18B20 sensor found. Check DATA wiring, 3V3, GND, and 4.7k ohm pull-up resistor.");
  }
}

void loop() {
  unsigned long currentMs = millis();

  if (currentMs - previousReadMs >= TEMPERATURE_READ_INTERVAL_MS) {
    previousReadMs = currentMs;

    if (sensorCount == 0) {
      Serial.println("ERROR: No DS18B20 sensor found on GPIO4.");
      return;
    }

    sensors.requestTemperatures();
    float waterTempC = sensors.getTempCByIndex(0);

    if (waterTempC == DEVICE_DISCONNECTED_C) {
      Serial.println("ERROR: DS18B20 temperature reading is invalid or sensor is disconnected.");
      return;
    }

    Serial.print("Water Temp: ");
    Serial.print(waterTempC, 2);
    Serial.println(" \xC2\xB0" "C");
  }
}
