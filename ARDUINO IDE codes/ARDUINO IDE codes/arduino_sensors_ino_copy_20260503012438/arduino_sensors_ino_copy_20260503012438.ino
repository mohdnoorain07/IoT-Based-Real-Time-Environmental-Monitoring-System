#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

// LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);

// DHT
#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Sensors
#define MQ135 A0
#define MQ2   A1
#define MQ6   A2
#define SOUND A3

float temp, hum;
int mq135, mq2, mq6, sound;

void setup() {
  Serial.begin(9600);
  dht.begin();

  lcd.init();
  lcd.backlight();

  lcd.print("Starting...");
  delay(2000);
  lcd.clear();
}

void loop() {

  // Read sensors
  temp = dht.readTemperature();
  hum  = dht.readHumidity();

  if (isnan(temp) || isnan(hum)) {
    temp = 0;
    hum = 0;
  }

  mq135 = analogRead(MQ135);
  mq2   = analogRead(MQ2);
  mq6   = analogRead(MQ6);
  sound = analogRead(SOUND);

  // 📤 SEND CLEAN DATA TO ESP (ONLY THIS!!)
  Serial.print(temp); Serial.print(",");
  Serial.print(hum); Serial.print(",");
  Serial.print(mq135); Serial.print(",");
  Serial.print(mq2); Serial.print(",");
  Serial.print(mq6); Serial.print(",");
  Serial.println(sound);

  // LCD display
  lcd.clear();
  // LCD DISPLAY - MULTI SCREEN

// Screen 1 → Temp + Humidity
lcd.clear();
lcd.setCursor(0, 0);
lcd.print("T:"); lcd.print(temp); lcd.print("C");

lcd.setCursor(0, 1);
lcd.print("H:"); lcd.print(hum); lcd.print("%");
delay(2000);

// Screen 2 → MQ135 + MQ2
lcd.clear();
lcd.setCursor(0, 0);
lcd.print("MQ135:"); lcd.print(mq135);

lcd.setCursor(0, 1);
lcd.print("MQ2:"); lcd.print(mq2);
delay(2000);

// Screen 3 → MQ6 + Sound
lcd.clear();
lcd.setCursor(0, 0);
lcd.print("MQ6:"); lcd.print(mq6);

lcd.setCursor(0, 1);
lcd.print("S:"); lcd.print(sound);
delay(2000);
}