#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ---------------------------
// Hardware pins (ESP8266 GPIO)
// ---------------------------
#define ONE_WIRE_BUS 4
#define TDS_PIN A0
#define BUTTON_PIN 14
#define LED_GREEN 12
#define LED_YELLOW 13
#define LED_RED 5
#define BUZZER 16

// ---------------------------
// Network and backend settings
// ---------------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Production FastAPI ingestion endpoint deployed on Vercel.
const char* SERVER_URL = "https://26109-opal.vercel.app/api/readings";

// Leave empty when DEVICE_INGESTION_KEY is not set in the backend .env file.
// If it is configured, put the same value here.
const char* DEVICE_INGESTION_KEY = "";
const char* DEVICE_ID = "ESP8266-BARN-A";

// Change to 1.0 for a bare ESP8266 ADC. Many NodeMCU/Wemos boards scale A0 to 3.3 V.
const float ADC_REFERENCE_VOLTAGE = 3.3f;
const unsigned long SEND_INTERVAL_MS = 5000UL;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 30000UL;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature temperatureSensors(&oneWire);

struct Cow {
  const char* tag;
  const char* animalId;
};

// Real UUIDs from the project's Supabase animals table.
const Cow cows[] = {
  {"COW-100", "a7a4bf6d-c3b2-42f7-8e79-5d31d33892d8"},
  {"COW-101", "984d916f-cdee-4f8a-be77-78ef1e896de8"},
  {"COW-102", "0f35d4ad-7818-45fc-b0d3-06318d031777"}
};

const size_t COW_COUNT = sizeof(cows) / sizeof(cows[0]);
size_t currentCowIndex = 0;

int lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 300UL;

float temperatureCompensation(float ecRaw, float temperatureC) {
  const float alpha = 0.019f;
  const float referenceTemperatureC = 25.0f;
  return ecRaw / (1.0f + alpha * (temperatureC - referenceTemperatureC));
}

int getLocalRiskLevel(float correctedEc, float temperatureC, bool temperatureValid) {
  if (correctedEc > 5.5f || (temperatureValid && temperatureC > 39.5f)) {
    return 2;
  }

  if (correctedEc > 4.8f || (temperatureValid && temperatureC > 39.0f)) {
    return 1;
  }

  return 0;
}

void updateLocalIndicators(int riskLevel) {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  noTone(BUZZER);

  if (riskLevel == 0) {
    digitalWrite(LED_GREEN, HIGH);
  } else if (riskLevel == 1) {
    digitalWrite(LED_YELLOW, HIGH);
    tone(BUZZER, 1000, 100);
  } else {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER, 2000, 600);
  }
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  const unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');

    if (millis() - startTime >= WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println();
      Serial.println("Wi-Fi connection timed out.");
      return false;
    }
  }

  Serial.println();
  Serial.println("Wi-Fi connected.");
  Serial.print("ESP8266 IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal strength: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  return true;
}

void printHttpFailure(int responseCode) {
  Serial.print("HTTP request failed (code ");
  Serial.print(responseCode);
  Serial.print("): ");
  Serial.println(HTTPClient::errorToString(responseCode));

  if (responseCode == HTTPC_ERROR_CONNECTION_REFUSED) {
    Serial.println("Check Wi-Fi access and confirm that the Vercel backend URL is online.");
  } else if (responseCode == HTTPC_ERROR_CONNECTION_LOST) {
    Serial.println("The connection was lost. Check Wi-Fi signal strength and the backend process.");
  } else if (responseCode == HTTPC_ERROR_READ_TIMEOUT) {
    Serial.println("The backend did not respond before the timeout.");
  }
}

bool sendToBackend(
  const Cow& cow,
  float ecValue,
  float temperatureC,
  bool temperatureValid
) {
  if (!connectWiFi()) {
    Serial.println("Data was not sent because Wi-Fi is unavailable.");
    return false;
  }

  BearSSL::WiFiClientSecure client;
  // Prototype TLS mode. Replace with CA validation before production use.
  client.setInsecure();
  client.setTimeout(10000);

  HTTPClient http;
  http.setTimeout(10000);
  http.setReuse(false);

  Serial.print("POST ");
  Serial.println(SERVER_URL);

  if (!http.begin(client, SERVER_URL)) {
    Serial.println("HTTP initialization failed.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  if (DEVICE_INGESTION_KEY[0] != '\0') {
    http.addHeader("X-Device-Key", DEVICE_INGESTION_KEY);
  }

  JsonDocument document;
  JsonArray readings = document["readings"].to<JsonArray>();

  JsonObject ecReading = readings.add<JsonObject>();
  ecReading["animal_id"] = cow.animalId;
  ecReading["sensor_type"] = "EC";
  ecReading["value"] = ecValue;
  ecReading["unit"] = "mS/cm";
  ecReading["device_id"] = DEVICE_ID;
  ecReading["is_simulated"] = false;

  // The API accepts body-temperature readings only between 30 and 45 C.
  // Do not upload a fabricated fallback value when the sensor is disconnected.
  if (temperatureValid) {
    JsonObject temperatureReading = readings.add<JsonObject>();
    temperatureReading["animal_id"] = cow.animalId;
    temperatureReading["sensor_type"] = "TEMP";
    temperatureReading["value"] = temperatureC;
    temperatureReading["unit"] = "C";
    temperatureReading["device_id"] = DEVICE_ID;
    temperatureReading["is_simulated"] = false;
  }

  String requestBody;
  serializeJson(document, requestBody);

  Serial.print("Sending JSON: ");
  Serial.println(requestBody);

  const int responseCode = http.POST(requestBody);

  if (responseCode <= 0) {
    printHttpFailure(responseCode);
    http.end();
    return false;
  }

  const String responseBody = http.getString();
  Serial.print("HTTP response: ");
  Serial.println(responseCode);
  Serial.print("Server response: ");
  Serial.println(responseBody);

  const bool accepted = responseCode >= 200 && responseCode < 300;
  if (!accepted) {
    if (responseCode == 401) {
      Serial.println("Set DEVICE_INGESTION_KEY to the value configured by the backend.");
    } else if (responseCode == 422) {
      Serial.println("The server rejected the animal ID or a sensor value. See the response above.");
    }
  }

  http.end();
  return accepted;
}

void handleCowSelectionButton() {
  const int reading = digitalRead(BUTTON_PIN);

  if (
    reading == LOW &&
    lastButtonState == HIGH &&
    millis() - lastDebounceTime > DEBOUNCE_DELAY_MS
  ) {
    currentCowIndex = (currentCowIndex + 1) % COW_COUNT;
    lastDebounceTime = millis();

    Serial.print("Selected cow: ");
    Serial.println(cows[currentCowIndex].tag);
  }

  lastButtonState = reading;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER, LOW);

  temperatureSensors.begin();
  temperatureSensors.setWaitForConversion(true);

  Serial.println();
  Serial.println("================================");
  Serial.println("          HERD VITALS");
  Serial.println("      MILK QUALITY MONITOR");
  Serial.println("================================");

  connectWiFi();
}

void loop() {
  handleCowSelectionButton();

  temperatureSensors.requestTemperatures();
  const float measuredTemperatureC = temperatureSensors.getTempCByIndex(0);
  const bool temperatureValid =
    measuredTemperatureC != DEVICE_DISCONNECTED_C &&
    measuredTemperatureC != 85.0f &&
    measuredTemperatureC >= 30.0f &&
    measuredTemperatureC <= 45.0f;

  // Use 25 C only for local EC compensation when the temperature sensor is invalid.
  // This fallback is never uploaded as a real temperature measurement.
  const float compensationTemperatureC = temperatureValid ? measuredTemperatureC : 25.0f;

  const int rawAdc = analogRead(TDS_PIN);
  const float voltage = rawAdc * (ADC_REFERENCE_VOLTAGE / 1023.0f);
  float rawEc = voltage * 10.0f;
  rawEc = constrain(rawEc, 0.01f, 20.0f);

  float correctedEc = temperatureCompensation(rawEc, compensationTemperatureC);
  correctedEc = constrain(correctedEc, 0.01f, 12.0f);

  const int riskLevel = getLocalRiskLevel(
    correctedEc,
    measuredTemperatureC,
    temperatureValid
  );

  updateLocalIndicators(riskLevel);

  Serial.println();
  Serial.println("--------------------------------");
  Serial.print("Cow: ");
  Serial.println(cows[currentCowIndex].tag);

  if (temperatureValid) {
    Serial.print("Temperature: ");
    Serial.print(measuredTemperatureC, 2);
    Serial.println(" C");
  } else {
    Serial.print("Temperature sensor invalid: ");
    Serial.print(measuredTemperatureC);
    Serial.println(" C (TEMP reading will not be uploaded)");
  }

  Serial.print("ADC: ");
  Serial.println(rawAdc);
  Serial.print("Voltage: ");
  Serial.print(voltage, 3);
  Serial.println(" V");
  Serial.print("Corrected EC: ");
  Serial.print(correctedEc, 3);
  Serial.println(" mS/cm");
  Serial.print("Risk: ");
  Serial.println(riskLevel == 2 ? "HIGH" : (riskLevel == 1 ? "MODERATE" : "LOW"));

  const bool sent = sendToBackend(
    cows[currentCowIndex],
    correctedEc,
    measuredTemperatureC,
    temperatureValid
  );

  Serial.println(sent ? "Upload successful." : "Upload failed.");
  Serial.println("--------------------------------");

  const unsigned long waitStarted = millis();
  while (millis() - waitStarted < SEND_INTERVAL_MS) {
    handleCowSelectionButton();
    delay(10);
  }
}
