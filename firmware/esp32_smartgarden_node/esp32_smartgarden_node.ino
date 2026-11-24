/*
 * SmartGarden ESP32-S3 Reference Telemetry Node
 * Sends capacitive soil moisture, DHT22 temperature/humidity, and BH1750 light lux
 * over HTTPS POST /api/sensors/ingest authenticated with X-Device-Key.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// Provisioned via Sensors Console (/dashboard/sensors)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* INGEST_URL    = "https://smartgarden-backend-6ie1.onrender.com/api/sensors/ingest";
const char* DEVICE_KEY    = "sg_live_replace_with_provisioned_device_key";

const int SOIL_ADC_PIN    = 34; // Capacitive soil moisture analog pin
const unsigned long SAMPLE_INTERVAL_MS = 60000;

float readSoilMoisturePct() {
  int raw = analogRead(SOIL_ADC_PIN);
  // Calibrate wet (~1350) vs dry (~3200) ADC range
  float pct = map(raw, 3200, 1350, 0, 100);
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[SmartGarden Node] WiFi connected.");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    float moisture = readSoilMoisturePct();
    float tempC = 22.4;      // Replace with DHT22 temperature read
    float humidity = 58.0;   // Replace with DHT22 humidity read
    float lux = 24000.0;     // Replace with BH1750 I2C lux read

    WiFiClientSecure client;
    client.setInsecure(); // Pin root CA in production firmware
    HTTPClient http;

    if (http.begin(client, INGEST_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Device-Key", DEVICE_KEY);

      String payload = String("{")
        + "\"soil_moisture\":" + String(moisture, 1) + ","
        + "\"temperature\":" + String(tempC, 1) + ","
        + "\"humidity\":" + String(humidity, 1) + ","
        + "\"light_lux\":" + String(lux, 0) + ","
        + "\"signal_rssi\":" + String(WiFi.RSSI())
        + "}";

      int status = http.POST(payload);
      Serial.printf("[SmartGarden Node] POST status: %d\n", status);
      http.end();
    }
  }
  delay(SAMPLE_INTERVAL_MS);
}
