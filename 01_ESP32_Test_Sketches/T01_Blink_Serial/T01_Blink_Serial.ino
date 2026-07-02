// T01_Blink_Serial.ino
// Purpose: Verify Arduino IDE upload, Serial Monitor, and basic GPIO output.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - USB connection only
// - No sensors or pumps required
//
// Notes for beginners:
// - Open Serial Monitor at 115200 baud.
// - GPIO2 is used as the default LED pin for this test.
// - Some ESP32 boards may not have an onboard LED on GPIO2.
//   If the LED does not blink, the Serial output can still confirm the board works.
// - This sketch uses millis() for timing instead of delay().

const int LED_PIN = 2;

const unsigned long LED_BLINK_INTERVAL_MS = 500;
const unsigned long UPTIME_PRINT_INTERVAL_MS = 1000;

unsigned long previousBlinkMs = 0;
unsigned long previousUptimePrintMs = 0;

bool ledState = false;

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("Hydroponic Device001 Serial OK");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T01_Blink_Serial");
  Serial.println("Device ID: device001");
}

void loop() {
  unsigned long currentMs = millis();

  // Toggle GPIO2 every 500 ms. This only affects the LED if the board has one there.
  if (currentMs - previousBlinkMs >= LED_BLINK_INTERVAL_MS) {
    previousBlinkMs = currentMs;
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  }

  // Print uptime every 1 second so Serial Monitor can be verified.
  if (currentMs - previousUptimePrintMs >= UPTIME_PRINT_INTERVAL_MS) {
    previousUptimePrintMs = currentMs;

    Serial.print("Uptime: ");
    Serial.print(currentMs / 1000);
    Serial.println(" s");
  }
}
