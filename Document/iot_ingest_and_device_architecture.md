# Smart Gardening System — IoT Ingestion & Device Architecture

**Document Version:** 1.1  
**Status:** Approved Hardware & Ingestion Architecture Specification  
**Target Hardware:** "SmartGarden Pro" (ESP32-S3 SoC) & Standalone Node.js Sensor Simulator  

---

## 1. Dual Device Ingestion Architecture Overview

The Smart Gardening System ingestion tier is engineered to decouple device hardware communication from core business logic, supporting both simulated software sensor feeds and production-grade physical IoT microcontrollers.

### 1.1 Ingestion Abstraction Layer

```text
+-----------------------------------------------------------------------------------------+
|                                    DEVICE LAYER                                         |
|   +------------------------------------+       +------------------------------------+   |
|   |  Node.js Software CLI Simulator    |       |   "SmartGarden Pro" ESP32-S3 HW    |   |
|   |  - Simulated Diurnal Sine Waves    |       |   - Dual-Depth Soil Capacitive     |   |
|   |  - Soil Moisture Linear Decay      |       |   - SHT40 Temp/Humidity Sensor     |   |
|   |  - Watering Pulse Response         |       |   - BH1750 Ambient Lux Sensor      |   |
|   |  - HTTP Client (Axios/fetch)       |       |   - LiFePO4 Battery + Solar PMIC   |   |
|   +-----------------+------------------+       +-----------------+------------------+   |
+---------------------|--------------------------------------------|----------------------+
                      | HTTP POST (/api/sensors/ingest)            | HTTP POST (or MQTT)
                      | Header: X-Device-Key: sg_live_...          | Header: X-Device-Key: sg_live_...
                      v                                            v
+-----------------------------------------------------------------------------------------+
|                              INGESTION GATEWAY & VALIDATION                             |
|  1. Fastify Rate Limiter (Max 60 requests/min per device key)                           |
|  2. verifyDeviceKey Hook: Fast prefix lookup (16-char) + constant-time SHA-256 match    |
|  3. JSON Schema Validation (Ajv): Bounds checking & clock-skew sanitization             |
+--------------------------------------------+--------------------------------------------+
                                             | Validated DeviceContext & Metrics
                                             v
+-----------------------------------------------------------------------------------------+
|                                    INGEST SERVICE                                       |
|  - IngestService.processTelemetry(device, metrics, timestamp)                           |
|    ├─► Asynchronous Write to MariaDB `sensor_readings` (Composite Indexed)              |
|    ├─► Update `devices.last_seen_at = NOW()` & `ip_address`                             |
|    ├─► Dispatch WebSocket `SENSOR_UPDATE` to channel `garden:<gardenId>`                 |
|    └─► Evaluate Instant Alert Thresholds (`alert_configs`)                              |
+--------------------------------------------+--------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                               FUTURE EXTENSION: PROTOCOL BRIDGE                         |
|  - IngestService is decoupled from HTTP transport.                                      |
|  - An MQTT Broker (e.g. Aedes / Mosquitto) subscribing to `smartgarden/+/telemetry`     |
|    invokes `IngestService.processTelemetry()` directly with identical business logic.  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Telemetry Ingest Protocol & JSON Schema

### 2.1 HTTP REST Ingestion Endpoint
* **Endpoint:** `POST /api/sensors/ingest`
* **Transport:** HTTPS (TLS 1.3)
* **Required Headers:**
  * `Content-Type: application/json`
  * `X-Device-Key: sg_live_<48_hex_entropy>`
* **HTTP Status Codes:**
  * `201 Created`: Telemetry successfully ingested, validated, and persisted.
  * `400 Bad Request`: JSON payload malformed or metrics exceed physical bounds.
  * `401 Unauthorized`: Device API key missing, invalid, or revoked.
  * `429 Too Many Requests`: Rate limit exceeded ($> 60$ submissions per minute).

### 2.2 Unified Telemetry JSON Schema

The ingestion gateway accepts both structured hardware payloads (including hardware UID, diagnostics, and battery health) and flat simulator payloads:

#### Production Hardware Payload ("SmartGarden Pro" ESP32-S3)
```json
{
  "deviceUid": "SG-PRO-001A2B3C",
  "timestamp": 1778980500,
  "metrics": {
    "soilMoisture": 38.4,
    "temperature": 22.5,
    "humidity": 58.2,
    "lightLux": 1850.0,
    "batteryPercent": 92.5,
    "signalRssi": -65
  },
  "firmwareVersion": "v1.2.0"
}
```

#### Legacy / Simulator Flat Payload
```json
{
  "soilMoisture": 38.4,
  "temperature": 22.5,
  "humidity": 58.2,
  "lightLux": 1850.0
}
```

### 2.3 Metric Validation & Physical Boundary Ranges

| Metric Key | Unit | Valid Physical Range | Validation & Normalization Rules |
| :--- | :---: | :---: | :--- |
| `soilMoisture` | % | $0.0 - 100.0$ | Clamped to range; capacitive sensor calibration. $< 5\%$ triggers dry alert. |
| `temperature` | °C | $-40.0 - +85.0$ | Ambient air temperature. Values $> 50^\circ\text{C}$ flag extreme heat warning. |
| `humidity` | % | $0.0 - 100.0$ | Relative humidity. $< 20\%$ or $> 90\%$ triggers mold/desiccation alerts. |
| `lightLux` | lux | $0.0 - 120,000.0$ | Full darkness ($0$) to peak direct sunlight ($100,000+$). |
| `batteryPercent`| % | $0.0 - 100.0$ | Optional. Derived from PMIC voltage curve ($3.0\text{V} - 4.2\text{V}$). $< 15\%$ flags low battery. |
| `signalRssi` | dBm | $-120 - 0$ | Optional. Wi-Fi RSSI. $<-85\text{ dBm}$ indicates weak signal. |

### 2.4 Clock Skew Sanitization Algorithm
Edge IoT microcontrollers frequently experience clock drift or lack reliable battery-backed RTC chips upon cold boot.
* **Algorithm:**
  1. Inspect `payload.timestamp` (if provided as Unix epoch seconds or milliseconds).
  2. Compute delta against current server UTC time:
     $$\Delta t = |\text{Date.now()} - \text{payload.timestamp}|$$
  3. If $\Delta t \le 900,000\text{ ms}$ (15 minutes): Accept the device's hardware timestamp to preserve accurate microsecond sensor reading intervals.
  4. If $\Delta t > 900,000\text{ ms}$ or timestamp is missing/year 1970: The server overrides the timestamp with `new Date()` (current server UTC time) and logs an informational telemetry warning: *"Clock skew detected on device 'SG-PRO-001A2B3C' ($\Delta t = 48\text{ hrs}$). Overridden with server time."*

---

## 3. Physical Hardware Architecture ("SmartGarden Pro" ESP32-S3)

### 3.1 Hardware Specifications
* **Core Microcontroller:** Espressif **ESP32-S3** Dual-Core Xtensa LX7 (240 MHz), 8MB Flash, 512KB SRAM, 2.4 GHz Wi-Fi (802.11 b/g/n) + Bluetooth 5 (LE).
* **Sensor Suite:**
  1. **Capacitive Soil Moisture Probe:** Corrosion-resistant immersion PCB probe measuring dielectric permittivity (immune to electrolytic copper degradation).
  2. **Sensirion SHT40:** Precision digital relative humidity ($\pm 1.5\%$) and ambient temperature ($\pm 0.1^\circ\text{C}$) over I2C.
  3. **ROHM BH1750:** High-resolution 16-bit digital ambient light sensor ($1 - 65,535\text{ lux}$) over I2C.
* **Power Management:**
  * Powered by a 3.7V 2000mAh 18650 LiFePO4 battery paired with a 5V 1W monocrystalline solar harvesting panel and TP4056 charge controller.
  * Utilizes ESP32 Deep Sleep ($10\mu\text{A}$ sleep current): The device wakes every 5 minutes, powers sensor rails via MOSFET switch, reads ADC/I2C, transmits telemetry over Wi-Fi, and re-enters deep sleep in $< 1.8\text{ seconds}$, achieving 12+ months autonomy without solar recharge.

### 3.2 Device Provisioning & QR-Code Claiming Workflow

```text
[Step 1: Unboxing & Power On]
- User turns on "SmartGarden Pro" hardware.
- Device firmware boots; detects unconfigured Wi-Fi.
- ESP32 enables SoftAP mode (SSID: "SmartGarden-Setup-A1B2") and BLE advertising.
   │
   ▼
[Step 2: Mobile/Web App QR Scan & Claiming]
- User opens Vue 3 App -> "Devices" -> "Add New Device".
- User scans QR code printed on device casing (contains device_uid and one-time factory PIN).
- App prompts user to select target Garden and Zone.
- Client submits: POST /api/devices/claim { deviceUid, pin, zoneId, name }
   │
   ▼
[Step 3: Server Key Generation & Association]
- Backend verifies device UID exists in factory database and is unclaimed.
- Backend generates raw API key: rawKey = 'sg_live_' + crypto.randomBytes(24).toString('hex')
- Computes key_prefix and SHA-256 key_hash.
- Inserts/updates `devices` record in MariaDB linked to `zoneId`.
- Returns rawKey securely over HTTPS session to user app.
   │
   ▼
[Step 4: BLE / SoftAP Credential Transfer]
- Web/Mobile app connects to ESP32 via WebBluetooth or SoftAP HTTP:
  Payload: { wifiSsid, wifiPassword, serverUrl, deviceKey: rawKey }
- ESP32 writes credentials to internal encrypted NVS (Non-Volatile Storage).
- ESP32 reboots.
   │
   ▼
[Step 5: Telemetry Handshake]
- ESP32 connects to local Wi-Fi router.
- Dispatches first telemetry packet to POST /api/sensors/ingest with X-Device-Key.
- Backend updates `last_seen_at = NOW()` and marks device active.
- App dashboard renders green "Connected & Online" badge.
```

---

## 4. Software Sensor Simulator Architecture

For rapid local development, automated testing, and CI/CD pipelines without physical hardware, the platform includes a standalone Node.js CLI simulator (`backend/simulator/sensorSimulator.js`).

### 4.1 Realistic Horticultural Simulation Math
The simulator does not output static random noise; it models physical environmental diurnal cycles and soil physics:
1. **Diurnal Temperature & Sunlight Curve:**
   Models solar progression with solar noon peak at 13:00 local time:
   $$\text{SolarAngle} = \frac{2\pi \times (\text{hour} - 6)}{24}$$
   $$\text{lightLux} = \max\left(0, \text{PeakLux} \times \sin(\text{SolarAngle})\right) + \text{noise}$$
   $$\text{temperature} = T_{\text{baseline}} + (T_{\text{amplitude}} \times \sin(\text{SolarAngle} - 0.5)) + \text{noise}$$
2. **Soil Moisture Exponential Decay:**
   Moisture gradually decreases over time due to plant transpiration and ambient evaporation:
   $$M(t) = M(t-1) - \left(k_{\text{decay}} \times \left(1 + \frac{\text{temperature}}{30}\right)\right)$$
3. **Irrigation Response Pulse:**
   When a watering event occurs or moisture drops below $15\%$, moisture spikes instantaneously to $85\%$ and then resumes gradual drainage and transpiration decay.

---

## 5. Device Heartbeat Watchdog & Offline Detection

Microcontrollers operating outdoors face battery depletion, severed sensor leads, and Wi-Fi router disconnections.

### 5.1 Watchdog Background Worker (`jobs/deviceWatchdog.js`)
* **Schedule:** Executes every **30 minutes** via `node-cron`.
* **Database Inspection:**
  ```sql
  SELECT d.id, d.device_name, d.device_uid, d.last_seen_at, z.name AS zone_name, g.id AS garden_id, g.name AS garden_name
  FROM devices d
  JOIN zones z ON d.zone_id = z.id
  JOIN gardens g ON z.garden_id = g.id
  WHERE d.is_active = TRUE
    AND (d.last_seen_at IS NULL OR d.last_seen_at < DATE_SUB(NOW(), INTERVAL 2 HOUR));
  ```
* **Offline Alert Emission:**
  * For devices inactive for $> 2\text{ hours}$, the watchdog inserts an alert in `alert_logs` with `severity = 'WARNING'` and message: *"Device 'Bed 1 Moisture Probe' has not reported telemetry in over 2 hours. Check battery level or Wi-Fi coverage."*
  * Dispatches an in-app toast notification to connected garden members.
  * If inactivity exceeds 24 hours, the device status in UI updates to red `OFFLINE`.

---

## 6. Time-Series Retention & Daily Downsampling Rollup

High-frequency telemetry (e.g. 1 sample every 5 minutes = 288 samples/device/day = 105,120 rows/device/year) rapidly degrades database query performance and bloats storage if raw records are retained indefinitely.

### 6.1 Two-Tier Retention Strategy
* **Tier 1 (Raw Granular Stream — 30-Day Retention):**
  * Stored in `sensor_readings`.
  * Preserves full sample-level granularity for high-resolution 24-hour and 7-day dashboard charts.
  * Composite indexes `(zone_id, recorded_at DESC)` and `(device_id, recorded_at DESC)` ensure sub-10ms query execution.
* **Tier 2 (Daily Statistical Rollup — Permanent Multi-Year Retention):**
  * Stored in `sensor_aggregates_daily`.
  * Retains daily statistical summaries: `min_soil_moisture`, `max_soil_moisture`, `avg_soil_moisture`, `min_temperature`, `max_temperature`, `avg_temperature`, `min_humidity`, `max_humidity`, `avg_humidity`, `peak_light_lux`, `avg_light_lux`, and `sample_count`.
  * Enables instant multi-year trend queries and PDF annual report generation (only 365 rows per device per year).

### 6.2 Daily Aggregation & Purge Worker (`jobs/telemetryRollup.js`)
* **Schedule:** Executes daily at **01:00 UTC**.
* **Step 1: Compute Daily Aggregates:**
  Executes an atomic MariaDB aggregation for yesterday's date (`DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)`):
  ```sql
  INSERT INTO sensor_aggregates_daily (
      zone_id, device_id, aggregate_date,
      min_soil_moisture, max_soil_moisture, avg_soil_moisture,
      min_temperature, max_temperature, avg_temperature,
      min_humidity, max_humidity, avg_humidity,
      peak_light_lux, avg_light_lux, sample_count
  )
  SELECT
      zone_id,
      device_id,
      DATE(recorded_at) AS aggregate_date,
      MIN(soil_moisture),
      MAX(soil_moisture),
      ROUND(AVG(soil_moisture), 2),
      MIN(temperature),
      MAX(temperature),
      ROUND(AVG(temperature), 2),
      MIN(humidity),
      MAX(humidity),
      ROUND(AVG(humidity), 2),
      MAX(light_lux),
      ROUND(AVG(light_lux), 2),
      COUNT(*)
  FROM sensor_readings
  WHERE recorded_at >= DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
    AND recorded_at < CURRENT_DATE
  GROUP BY zone_id, device_id, DATE(recorded_at)
  ON DUPLICATE KEY UPDATE
      min_soil_moisture = VALUES(min_soil_moisture),
      max_soil_moisture = VALUES(max_soil_moisture),
      avg_soil_moisture = VALUES(avg_soil_moisture),
      sample_count = VALUES(sample_count);
  ```
* **Step 2: Prune Raw Readings Older Than 30 Days:**
  ```sql
  DELETE FROM sensor_readings
  WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
  ```
  *(Note: In large enterprise deployments, this query is replaced with MariaDB `ALTER TABLE sensor_readings DROP PARTITION`, executing in $O(1)$ constant time without transaction log lock contention).*

---

## 7. Extensibility to MQTT Protocol Broker

To accommodate low-bandwidth cellular gateways or dense multi-node LoRaWAN/Zigbee mesh repeaters in agricultural field deployments, the telemetry ingestion logic is decoupled into a transport-independent `IngestService`.

```javascript
// backend/services/ingestService.js
class IngestService {
  /**
   * Universal telemetry ingestion handler called by HTTP routes or MQTT subscribers.
   */
  async processTelemetry(device, metrics, clientTimestamp) {
    // 1. Sanitize timestamp & handle clock skew
    const recordedAt = this.sanitizeTimestamp(clientTimestamp);

    // 2. Persist to MariaDB sensor_readings
    const reading = await SensorReading.create({
      zone_id: device.zone_id,
      device_id: device.id,
      soil_moisture: metrics.soilMoisture,
      temperature: metrics.temperature,
      humidity: metrics.humidity,
      light_lux: metrics.lightLux,
      battery_percent: metrics.batteryPercent || null,
      signal_rssi: metrics.signalRssi || null,
      recorded_at: recordedAt
    });

    // 3. Update device heartbeat
    await device.update({ last_seen_at: new Date() });

    // 4. Broadcast live frame over WebSocket broker (with optional chaining guard)
    const targetGardenId = device.Zone?.garden_id || null;
    if (targetGardenId) {
      wsBroker.broadcastToGarden(targetGardenId, {
        event: 'SENSOR_UPDATE',
        data: {
          gardenId: targetGardenId,
          zoneId: device.zone_id,
          deviceId: device.id,
          ...metrics,
          timestamp: recordedAt instanceof Date ? recordedAt.toISOString() : new Date(recordedAt).toISOString()
        }
      });
    }

    // 5. Evaluate instant alert thresholds
    await alertService.checkThresholds(device.zone_id, metrics);

    return reading;
  }
}
```

By maintaining this separation of concerns, an embedded MQTT broker (such as `aedes`) can be mounted onto Fastify's network listener in future sprints, listening on topic `smartgarden/:deviceUid/telemetry` and forwarding parsed MQTT packets directly to `IngestService.processTelemetry()`.
