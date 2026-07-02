// T04_Water_Level_Float_Test.ino
// Purpose: Verify water level float switch readings on GPIO27.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - Float switch wire 1 -> ESP32 GND
// - Float switch wire 2 -> ESP32 GPIO27
//
// Notes for beginners:
// - Open Serial Monitor at 115200 baud.
// - GPIO27 uses INPUT_PULLUP, so the pin reads HIGH when the switch is open.
// - The float switch direction can vary by model or mounting direction.
// - Change WATER_LEVEL_LOW_WHEN_GPIO_LOW if the meaning is reversed.
// - This sketch uses millis() for timing instead of delay().

#define PIN_WATER_LEVEL 27

const bool WATER_LEVEL_LOW_WHEN_GPIO_LOW = true;
const unsigned long PRINT_INTERVAL_MS = 500;

unsigned long previousPrintMs = 0;

void setup() {
  Serial.begin(115200);

  pinMode(PIN_WATER_LEVEL, INPUT_PULLUP);

  Serial.println("Hydroponic Device001 Water Level Float Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T04_Water_Level_Float_Test");
  Serial.println("Device ID: device001");
  Serial.println("Water Level Pin: GPIO27");
}

void loop() {
  unsigned long currentMs = millis();

  if (currentMs - previousPrintMs >= PRINT_INTERVAL_MS) {
    previousPrintMs = currentMs;

    int rawState = digitalRead(PIN_WATER_LEVEL);
    bool isRawLow = (rawState == LOW);

    bool isWaterLow;
    if (WATER_LEVEL_LOW_WHEN_GPIO_LOW) {
      isWaterLow = isRawLow;
    } else {
      isWaterLow = !isRawLow;
    }

    const char* rawStateText = (rawState == HIGH) ? "HIGH" : "LOW";
    const char* waterLevelText = isWaterLow ? "low" : "normal";

    Serial.print("Raw GPIO: ");
    Serial.print(rawStateText);
    Serial.print(" | waterLevel: ");
    Serial.println(waterLevelText);
  }
}
