// T05_MOSFET_4CH_Test.ino
// Purpose: Verify ESP32 control of each MOSFET input channel one by one.
//
// Hardware target:
// - ESP32-WROOM-32U DevKitC V4
// - Real 4-channel MOSFET module with IN+/IN- input pairs
// - Real 4-channel MOSFET module with OUT+/OUT- output pairs
//
// Important:
// - This is NOT a pump test yet.
// - Do NOT connect real pumps during the first MOSFET channel test.
// - Use a multimeter or a small safe 12V load to verify output switching.
// - This sketch uses millis() for timing instead of delay().

#define PIN_MOSFET_CH1 25
#define PIN_MOSFET_CH2 26
#define PIN_MOSFET_CH3 14
#define PIN_MOSFET_CH4 33

const bool MOSFET_ACTIVE_HIGH = true;

const unsigned long CHANNEL_ON_TIME_MS = 2000;
const unsigned long CHANNEL_OFF_WAIT_MS = 1000;

const int CHANNEL_COUNT = 4;
const int MOSFET_PINS[CHANNEL_COUNT] = {
  PIN_MOSFET_CH1,
  PIN_MOSFET_CH2,
  PIN_MOSFET_CH3,
  PIN_MOSFET_CH4
};

int currentChannelIndex = 0;
bool currentChannelOn = false;
unsigned long stateStartedMs = 0;

void writeMosfetChannel(int pin, bool on) {
  if (MOSFET_ACTIVE_HIGH) {
    digitalWrite(pin, on ? HIGH : LOW);
  } else {
    digitalWrite(pin, on ? LOW : HIGH);
  }
}

void turnAllChannelsOff() {
  for (int i = 0; i < CHANNEL_COUNT; i++) {
    writeMosfetChannel(MOSFET_PINS[i], false);
  }
}

void printChannelState(int channelNumber, int pin, bool on) {
  Serial.print("CH");
  Serial.print(channelNumber);
  Serial.print(" GPIO");
  Serial.print(pin);
  Serial.print(" -> ");
  Serial.println(on ? "ON" : "OFF");
}

void startCurrentChannel() {
  int pin = MOSFET_PINS[currentChannelIndex];
  int channelNumber = currentChannelIndex + 1;

  writeMosfetChannel(pin, true);
  currentChannelOn = true;
  stateStartedMs = millis();
  printChannelState(channelNumber, pin, true);
}

void stopCurrentChannel() {
  int pin = MOSFET_PINS[currentChannelIndex];
  int channelNumber = currentChannelIndex + 1;

  writeMosfetChannel(pin, false);
  currentChannelOn = false;
  stateStartedMs = millis();
  printChannelState(channelNumber, pin, false);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_MOSFET_CH1, OUTPUT);
  pinMode(PIN_MOSFET_CH2, OUTPUT);
  pinMode(PIN_MOSFET_CH3, OUTPUT);
  pinMode(PIN_MOSFET_CH4, OUTPUT);

  turnAllChannelsOff();

  Serial.println("Hydroponic Device001 MOSFET 4CH Test");
  Serial.println("Project: Hydroponic_IoT_ESP32");
  Serial.println("Test: T05_MOSFET_4CH_Test");
  Serial.println("Device ID: device001");
  Serial.println("MOSFET module type: IN+/IN- input pair type");
  Serial.println("CH1: GPIO25 -> IN1+");
  Serial.println("CH2: GPIO26 -> IN2+");
  Serial.println("CH3: GPIO14 -> IN3+");
  Serial.println("CH4: GPIO33 -> IN4+");
  Serial.println("All IN- terminals -> ESP32 GND / common GND");
  Serial.println("Central 正 -> Adapter +12V");
  Serial.println("Central 负 -> Adapter GND / common GND");
  Serial.println("WARNING: Do NOT connect real pumps during the first MOSFET channel test.");
  Serial.println("WARNING: Do NOT connect +12V to ESP32 GPIO.");

  startCurrentChannel();
}

void loop() {
  unsigned long currentMs = millis();

  if (currentChannelOn && currentMs - stateStartedMs >= CHANNEL_ON_TIME_MS) {
    stopCurrentChannel();
    return;
  }

  if (!currentChannelOn && currentMs - stateStartedMs >= CHANNEL_OFF_WAIT_MS) {
    currentChannelIndex++;

    if (currentChannelIndex >= CHANNEL_COUNT) {
      currentChannelIndex = 0;
    }

    startCurrentChannel();
  }
}
