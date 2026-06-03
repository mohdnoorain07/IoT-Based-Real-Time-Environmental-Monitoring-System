#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>

// 🔐 WiFi
#define WIFI_SSID "One Plus Nord Ce4"
#define WIFI_PASSWORD "rdj12345"

// 🔥 Firebase
#define API_KEY "AIzaSyCnklsvn47pT6DcxghupYN0X2_3Om-LRi4"
#define DATABASE_URL "https://iot-dashboard-58e0e-default-rtdb.firebaseio.com/"

// ✅ YOUR CREATED USER
#define USER_EMAIL "iotuser@gmail.com"
#define USER_PASSWORD "12345678"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(9600);

  Serial.println("ESP STARTED 🚀");

  // ✅ WiFi connect
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }

  Serial.println("\nWiFi Connected ✅");

  // ✅ Firebase setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 🔥 stability buffers
  fbdo.setBSSLBufferSize(1024, 1024);
  fbdo.setResponseSize(2048);

  Serial.println("Firebase Ready 🔥");
}

void loop() {

  if (Serial.available()) {

    String data = Serial.readStringUntil('\n');
    data.trim();

    Serial.println("Received: " + data);

    // 🔍 Parse CSV data
    int v1 = data.indexOf(',');
    int v2 = data.indexOf(',', v1 + 1);
    int v3 = data.indexOf(',', v2 + 1);
    int v4 = data.indexOf(',', v3 + 1);
    int v5 = data.indexOf(',', v4 + 1);

    if (v1 == -1 || v2 == -1 || v3 == -1 || v4 == -1 || v5 == -1) return;

    float temp = data.substring(0, v1).toFloat();
    float hum  = data.substring(v1 + 1, v2).toFloat();
    int mq135  = data.substring(v2 + 1, v3).toInt();
    int mq2    = data.substring(v3 + 1, v4).toInt();
    int mq6    = data.substring(v4 + 1, v5).toInt();
    int sound  = data.substring(v5 + 1).toInt();

    // 🚀 Send to Firebase
    if (Firebase.ready()) {

      bool ok = true;

      ok &= Firebase.RTDB.setFloat(&fbdo, "/sensor/temp", temp);
      ok &= Firebase.RTDB.setFloat(&fbdo, "/sensor/hum", hum);
      ok &= Firebase.RTDB.setInt(&fbdo, "/sensor/mq135", mq135);
      ok &= Firebase.RTDB.setInt(&fbdo, "/sensor/mq2", mq2);
      ok &= Firebase.RTDB.setInt(&fbdo, "/sensor/mq6", mq6);
      ok &= Firebase.RTDB.setInt(&fbdo, "/sensor/sound", sound);
      if (ok) {
        Serial.println("ALL DATA SENT ✅🔥");
      } else {
        Serial.println("FAILED ❌");
        Serial.println(fbdo.errorReason());
      }

    } else {
      Serial.println("Firebase not ready ⚠️");
    }
    Serial.println("----------------------");
  }
  delay(3000);  // stable interval
  yield();      // prevent crash
}
