// T02_TDS_SEN0244_Test.ino
// Purpose: Verify raw ADC readings from the DFRobot SEN0244 TDS sensor.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - SEN0244 VCC -> ESP32 3V3
// - SEN0244 GND -> ESP32 GND
// - SEN0244 AOUT -> ESP32 GPIO34
//
// Notes for beginners:
// - Open Serial Monitor at 115200 baud.
// - This test only checks raw analog readings and estimated voltage.
// - TDS ppm calibration is NOT implemented here.
// - Do not treat any ppm value as accurate in this test.
// - This sketch uses millis() for timing instead of delay().

#define PIN_TDS_ADC 34

const int SAMPLE_COUNT = 30;
const unsigned long PRINT_INTERVAL_MS = 500;

unsigned long previousPrintMs = 0;

void setup() {
  Serial.begin(115200);

  // ESP32 ADC reads from 0 to 4095 when using 12-bit resolution.
  analogReadResolution(12);

  // ADC_11db allows a wider input voltage range on ESP32 ADC pins.
  // The SEN0244 signal must still stay within ESP32-safe voltage levels.
  analogSetPinAttenuation(PIN_TDS_ADC, ADC_11db);

  Serial.println("Hydroponic Device001 TDS Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T02_TDS_SEN0244_Test");
  Serial.println("Device ID: device001");
  Serial.println("TDS ADC Pin: GPIO34");
}

void loop() {
  unsigned long currentMs = millis();

  if (currentMs - previousPrintMs >= PRINT_INTERVAL_MS) {
    previousPrintMs = currentMs;

    unsigned long sampleSum = 0;
    int minSample = 4095;
    int maxSample = 0;

    // Read multiple samples to reduce noise before printing one result line.
    for (int i = 0; i < SAMPLE_COUNT; i++) {
      int sample = analogRead(PIN_TDS_ADC);

      sampleSum += sample;

      if (sample < minSample) {
        minSample = sample;
      }

      if (sample > maxSample) {
        maxSample = sample;
      }
    }

    float avgRaw = sampleSum / (float)SAMPLE_COUNT;
    float voltage = avgRaw * 3.3 / 4095.0;

    Serial.print("Raw ADC avg: ");
    Serial.print(avgRaw, 0);
    Serial.print(" | Voltage: ");
    Serial.print(voltage, 3);
    Serial.print(" V | Min: ");
    Serial.print(minSample);
    Serial.print(" | Max: ");
    Serial.println(maxSample);
  }
}
