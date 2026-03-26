# 🌍 IoT-Based Real-Time Environmental Monitoring System

> A compact, smart IoT system that monitors indoor environmental conditions in real time — with local LCD display, remote dashboard access, and actionable health suggestions.

---

## 📌 Overview

This project is an IoT-based environmental monitoring system that continuously tracks indoor air quality, gas levels, temperature, and humidity. It provides **dual-mode visualization** — a local LCD display and a remote interactive dashboard accessible from any smartphone or laptop.

Unlike conventional monitoring systems that only show raw sensor values, this system **interprets the data** and provides plain-language safety suggestions, making it ideal for non-technical home users.

---

## 🎯 Objectives

- Monitor temperature, humidity, LPG gas leakage, and AQI in real time
- Display readings locally on an LCD screen integrated with the device
- Provide remote dashboard access via smartphone or laptop
- Generate intelligent, user-friendly suggestions based on sensor readings
- Enable remote safety monitoring for homes, especially for elderly individuals or patients with respiratory conditions

---

## 🛠️ Components Used

### 🔹 Hardware

| Component | Purpose |
|---|---|
| ESP8266 / ESP32 | Wi-Fi microcontroller |
| DHT11 / DHT22 | Temperature & Humidity sensor |
| MQ-135 | Air Quality (AQI) sensor |
| MQ-6 / MQ-2 | LPG Gas Leakage sensor |
| 16x2 LCD Display | Local data display |
| Buzzer | Alert on critical conditions |
| Breadboard & Jumper Wires | Connections |
| Power Supply | 5V DC |

### 🔹 Software

- Arduino IDE
- Embedded C / Arduino Code
- Cloud Platform (ThingSpeak / Blynk / Firebase)
- Dashboard (Web or Mobile App)

---

## 🧠 System Architecture

```
[Sensors] --> [ESP8266/ESP32] --> [LCD Display] (Local)
                    |
                    v
              [Cloud Platform]
                    |
                    v
          [Remote Dashboard] (Smartphone / Laptop)
```

---

## 📊 Parameters Monitored

| Parameter | Sensor | Unit | Normal Range |
|---|---|---|---|
| Temperature | DHT11/DHT22 | °C | 20–35°C |
| Humidity | DHT11/DHT22 | % RH | 30–60% |
| Air Quality (AQI) | MQ-135 | PPM / AQI | 0–100 (Good) |
| LPG Gas Level | MQ-6 / MQ-2 | PPM | < 200 PPM (Safe) |

---

## 💡 Intelligent Suggestion System

Instead of showing only raw numbers, the dashboard provides simple, actionable insights:

**Air Quality:**
- ✅ `AQI 0–50` → *"Air quality is Good – safe to go outside"*
- ⚠️ `AQI 51–100` → *"Air quality is Moderate – consider wearing a mask"*
- 🔴 `AQI 101–200` → *"Air quality is Poor – avoid going outside or limit exposure"*
- 🚨 `AQI > 200` → *"Air quality is Hazardous – stay indoors immediately"*

**Gas Leakage:**
- 🚨 Gas detected → *"Warning: Gas leakage detected! Ventilate area and check appliances immediately"*

---

## 🔄 Working Flow

```
1. Sensors collect real-time environmental data
2. ESP32 processes and reads sensor values
3. Data displayed on local LCD screen
4. Data transmitted to cloud via Wi-Fi
5. Remote dashboard updates in real time
6. Suggestion engine interprets data and shows health advice
7. Buzzer/alert triggered on critical conditions (gas leak / hazardous AQI)
```

---

## 📡 Key Features

- 📈 **Real-time monitoring** of 4 environmental parameters
- 🖥️ **Dual-mode display** — LCD (local) + Dashboard (remote)
- 🧠 **Smart suggestion engine** — human-readable health advisories
- 🚨 **Instant alerts** for gas leakage and hazardous AQI
- 👴 **Remote caregiving support** — monitor home conditions for elderly or asthmatic individuals from anywhere
- ☁️ Cloud data storage and historical graphs
- 📱 Accessible from smartphone, tablet, or laptop

---

## 🚀 Installation & Setup

1. Install **Arduino IDE** on your system
2. Install required libraries:
   - `DHT sensor library`
   - `ESP8266WiFi` or `WiFi` (for ESP32)
   - `ThingSpeak` or `BlynkSimpleEsp8266`
   - `LiquidCrystal_I2C`
3. Connect sensors to ESP32/ESP8266 as per circuit diagram
4. Open the project `.ino` file in Arduino IDE
5. Update your **Wi-Fi credentials** in the code:
   ```cpp
   const char* ssid = "Your_WiFi_Name";
   const char* password = "Your_WiFi_Password";
   ```
6. Upload the code to the board
7. Open the dashboard link on your smartphone or laptop

---

## 📷 Circuit Diagram

*(Add your circuit diagram image here)*

---

## 📈 Future Scope

- Integration with a dedicated mobile app (Android/iOS)
- Machine learning for pollution prediction and trend analysis
- Adding PM2.5 / PM10 particulate matter sensor
- Voice alert system for visually impaired users
- Solar-powered version for outdoor deployment
- Smart city integration

---

## 📚 Applications

- 🏠 Home safety monitoring (especially for elderly / patients)
- 🏥 Hospital and healthcare facility monitoring
- 🏭 Industrial indoor safety monitoring
- 🌆 Smart city infrastructure
- 🏫 Schools and office buildings

---

## ⚠️ Limitations & Challenges

- Sensor calibration required for accurate AQI readings
- Wi-Fi dependent — limited to areas with network coverage
- MQ sensors need warm-up time (~30 seconds) after power on
- Battery backup not included in current version

---

## 👨‍💻 Team

| Name | Role |
|---|---|
| **Vaishnavi Chaubey** | Project Lead & System Designer |
| Mohd Noorain | Data Analyst & Integration|
| Priyanshu Pandey | IoT Hardware Developer 1 |
| Navneet Sharma |IoT Hardware Developer 2 |
| Priyanshu Kumari | Backend Developer |

**Institution:** IILM University, Greater Noida

---

## 📄 References

1. Zafar et al. — IoT-Based Environmental Monitoring Using Arduino and ThingSpeak (2018)
2. ESP32-based Air Quality Monitoring with MQ135 and DHT22 — IJFMR (2024)
3. IoT-Enabled Multi-Sensor System for Smart Environmental Monitoring — IEEE (2022)
4. Remote Health Monitoring for Elderly Using IoT Sensors — Springer (2023)

---

## 📄 License

This project is developed for **educational and research purposes** at IILM University, Greater Noida.

---

> 💬 *"This system goes beyond conventional monitoring by combining real-time sensing, remote accessibility, and intelligent data interpretation — ensuring enhanced safety and convenience."*
