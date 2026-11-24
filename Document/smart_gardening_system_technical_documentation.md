# Smart Gardening System — Technical Architecture & Design Document

**Version:** 1.2 (PostgreSQL / Supabase, Render Backend & Vercel Multi-Service Deployment Update)  
**Project:** Smart Gardening System (Full-Stack Single Page Application)  
**Architecture Pattern:** Model–View–Controller (MVC) SPA with Fastify Hook Pipeline & WebSocket Broker  
**Tech Stack:** Vue.js 3 + Nuxt UI v4 · Node.js + Fastify · Sequelize ORM · PostgreSQL (Supabase) / MariaDB / SQLite · Vercel & Render  
**Status:** Approved Architecture Baseline  

---

## 1. System Architecture & Data Flow Connections

The Smart Gardening System is designed as an industrial-grade, decoupled **Single Page Application (SPA)** adhering strictly to the **MVC separation of concerns** and modern IoT cloud ingestion principles:

* **View Layer (Vue.js 3 + Nuxt UI v4 SPA):** Runs client-side in the browser. Employs Vue 3 Composition API (Plain JavaScript), Nuxt UI v4 (`@nuxt/ui` 4.12) with Tailwind CSS v4, Vue Router for client-side navigation, Pinia for reactive centralized state, Axios for REST communication, and Chart.js for real-time sensor dials and historical trend visualization. Deployed as a high-performance static SPA on **Vercel** with local URL rewrite fallback.
* **Middleware Pipeline Layer (Fastify Hooks):** Implements an ordered lifecycle execution chain. Validates JSON schemas, enforces rate limits, handles CORS and security headers, verifies stateless JWT sessions, verifies Supabase OAuth tokens, resolves resource-to-garden hierarchies for Role-Based Access Control (RBAC), and authenticates IoT device API keys using constant-time hashed lookups.
* **Controller & Service Layer (Node.js + Fastify):** Encapsulates pure business logic. Orchestrates Sequelize ORM operations, pushes real-time telemetry over WebSockets (`@fastify/websocket`), evaluates automation rules via a multi-tier deduplication engine, and interfaces with external weather, AI vision/LLM, and transactional SMTP email providers. Deployed on **Render** as an always-on web service (`smartgarden-backend-6ie1.onrender.com`), seamlessly reverse-proxied from Vercel via `/api/*` rewrites.
* **Model & Persistence Layer (Sequelize + Supabase PostgreSQL / MariaDB):** Normalized relational schema in PostgreSQL (Supabase pooler on port 6543) and MariaDB. Supports multi-engine operation (`postgres` on Supabase for cloud production, `mariadb` for containerized environments, and in-memory `sqlite` for deterministic, zero-dependency unit and integration test suites).
* **Dual IoT Telemetry Ingestion Layer:** Ingests live environmental readings via an authenticated HTTP/REST endpoint (`POST /api/sensors/ingest`), supporting both the software-based Node.js sensor simulator and own-brand physical gardening hardware ("SmartGarden Pro" ESP32-S3) with an architecture primed for future MQTT broker integration.

### High-Level System Architecture Diagram

```text
+---------------------------------------------------------------------------------------+
|                                CLIENT BROWSER (VIEW)                                  |
|  Vue.js 3 SPA (Plain JS)  |  Vue Router  |  Pinia State  |  Chart.js  |  Axios Client |
+---------------------------+-----------------------------------+-----------------------+
                            | HTTPS / REST (JSON)               ^ WebSocket (ws://)
                            v                                   | (Live Sensor & Alert Push)
+---------------------------------------------------------------------------------------+
|                         FASTIFY MIDDLEWARE PIPELINE (HOOKS)                           |
| 1. CORS, Helmet & Rate Limiter (@fastify/rate-limit)                                  |
| 2. JWT Session Authenticator (verifyJwt.js via @fastify/jwt)                          |
| 3. Resource-to-Garden Resolver & RBAC Guard (resolveGardenAndRole.js)                   |
| 4. IoT Device Key Authenticator (verifyDeviceKey.js via SHA-256 Prefix Lookup)        |
| 5. Multipart File Upload Streamer (@fastify/multipart)                                |
+-----------------------------------+---------------------------------------------------+
                                    |
                                    v
+---------------------------------------------------------------------------------------+
|                         CONTROLLER & SERVICE LAYER (NODE.JS)                          |
|  - AuthController & GardenController            - SensorController & Telemetry Broker  |
|  - ZonePlantController & TaskController         - WebSocket Room Dispatcher            |
|  - RuleEngineService (Deduplication/Cooldown)   - WeatherService (Spatial Grid Cache)  |
|  - EmailService (Mockable SMTP Transport)       - ReportService (PDFKit & json2csv)    |
|  - Background Workers: Scheduler (node-cron: 15-min Rule Cron, 6-hr Extreme Weather,  |
|    Daily Rollup & Sensor Purge Cron at 01:00 UTC, Heartbeat Watchdog)                 |
+-------------------+-------------------------------+-------------------+---------------+
                    | Sequelize ORM                 | HTTPS REST        | SMTP (TLS)
                    v                               v                   v
+-----------------------------------+   +-----------------------+   +-------------------+
|          MARIADB 10.11            |   |     EXTERNAL APIS     |   |   EMAIL SERVICE   |
|  - Normalized Relational Tables   |   | - Weather Forecast API|   | (System Alerts,   |
|  - 30-Day Sensor Telemetry Logs   |   | - Hosted Vision AI    |   |  Password Resets, |
|  - Daily Rollup Aggregates Table  |   |   (Leaf Diagnosis)    |   |  Member Invites)  |
|  - Spatial Weather Cache Table    |   | - Hosted Gardening    |   +-------------------+
+-----------------------------------+   |   LLM Chat Assistant  |
                    ^                   +-----------------------+
                    | HTTP POST (/api/sensors/ingest) with X-Device-Key
+-------------------+---------------------------------------------------+
|                           IOT TELEMETRY INGESTION                     |
|  [Hardware] "SmartGarden Pro" ESP32-S3   |   [Software] Node.js CLI   |
|  - Multi-depth Soil Moisture, Temp,      |     Sensor Simulator       |
|    Humidity, Light Lux, Battery %, RSSI  |   - Diurnal Curves & Decay |
+-----------------------------------------------------------------------+
```

---

## 2. Technology Stack Breakdown

| Layer | Technology | Version / Packages | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Frontend (View)** | **Vue.js 3 + Nuxt UI v4** | `vue` ^3.5, `@nuxt/ui` ^4.12, `@tailwindcss/vite` ^4.3, `tailwindcss` ^4.3, `vue-router` ^4.6, `pinia` ^2.3, `axios` ^1.20 | Production-ready component system, dark/light theme, accessible forms, responsive layout, route guards, and centralized state. |
| **Frontend Build & Hosting** | **Vite on Vercel** | `vite` ^5.4, Vercel SPA | High-speed local dev server and static SPA deployment on Vercel with localized `/index.html` rewrite and `/api/*` proxy rewrite to Render. |
| **Backend Runtime & Hosting**| **Node.js on Render** | Node v20 LTS+, Render Web Service | Always-on Node.js runtime executing the Fastify server, native WebSockets, background tasks, and connection poolers without serverless cold-start limitations. |
| **Backend Framework** | **Fastify** | `fastify` ^4.28, `@fastify/cors`, `@fastify/jwt` | Low-overhead HTTP engine supporting dual routing (`/api/*` and direct `/*`), lifecycle hooks, and serverless compatibility adapters. |
| **Real-Time Engine** | **Fastify WebSocket** | `@fastify/websocket` ^10.0 | Bidirectional WebSocket pub/sub broker distributing live telemetry and alert toasts to authenticated garden subscriber channels. |
| **Authentication** | **JWT, Bcrypt & Supabase OAuth** | `@fastify/jwt` ^8.0, `bcryptjs` ^3.0, Supabase Auth | Dual authentication: salted bcrypt passwords + stateless JWTs, plus Supabase Google OAuth (`POST /api/auth/oauth` with frontend `/auth/callback`). |
| **File Handling** | **Multipart & Storage** | `@fastify/multipart` ^8.1 | High-throughput streaming multipart handler for plant growth photos and leaf disease diagnostic uploads (max 5 MB). |
| **Background Cron** | **Node-Cron** | `node-cron` ^3.0 | In-process cron workers executing 15-minute automation rule evaluations, 6-hour severe weather warnings, and daily telemetry downsampling. |
| **ORM (Model)** | **Sequelize** | `sequelize` ^6.37, `pg` ^8.11, `mariadb` ^3.5, `sqlite3` ^5.1 | Multi-dialect ORM managing schema migrations and seeders across PostgreSQL (Supabase), MariaDB, and in-memory SQLite for automated tests. |
| **Database** | **PostgreSQL (Supabase) / MariaDB** | PostgreSQL 15+ (Supabase) / MariaDB 10.11 | Production database provisioned on Supabase PostgreSQL with transaction pooler (port 6543) and SSL, with MariaDB compatibility. |
| **Reporting** | **PDF & CSV Engines** | `pdfkit` ^0.15, `json2csv` ^6.0 | Compiles downloadable PDF summary reports and CSV spreadsheets covering water consumption, task compliance, and sensor analytics. |
| **Containerization**| **Docker Compose** | Compose v2 | Optional local container orchestration provisioning database services with persistent volume storage and automated healthchecks. |

---

## 3. Modular Documentation Directory Structure (`Document/`)

To guarantee complete engineering rigor and maintainability across the software lifecycle, the design documentation suite has been decomposed into dedicated, authoritative specifications under `Document/`:

```text
Document/
├── smart_gardening_system_technical_documentation.md   # [Master Doc v1.1] Architecture overview, tech stack, and module roadmap
├── requirements_specification.md                       # Comprehensive functional (F1–F20) & non-functional specifications, user stories, showcase scope
├── database_schema_data_dictionary.md                  # Complete MariaDB DDL, Sequelize models, column dictionary, and Mermaid ER diagram (21 entities)
├── api_specification.md                                # REST contracts, RFC 7807 error envelopes, query parameters, and WebSocket event protocols
├── security_and_permissions_matrix.md                  # Bcrypt, JWT lifecycle, password reset tokens, garden RBAC matrix, and route resolver algorithm
├── rules_engine_and_business_logic.md                  # Automation engine, 3-tier deduplication, quiet hours, rain-skip, plant spacing & companion algorithms
└── iot_ingest_and_device_architecture.md               # Telemetry JSON schema, ESP32-S3 hardware & simulator design, QR onboarding, and 30-day retention
```

---

## 4. Architectural Decisions & Design Gap Resolutions

### 4.1 Dedicated Staging and Cache Tables
* **Password Reset Tokens (`password_reset_tokens`)**: Dedicated table isolating 32-byte cryptographically secure reset tokens (SHA-256 hashed), bounded by a 60-minute expiration window and single-use `used_at` timestamp. Prevents user table mutation and mitigates replay attacks.
* **Garden Invitations (`garden_invitations`)**: Dedicated collaboration table tracking email invitations, role assignments (`FAMILY`, `GUEST`), 7-day expiration dates, and lifecycle statuses (`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELED`). Includes explicit foreign key index `idx_gi_invited_by` for fast inviter audits.
* **Weather Cache (`weather_cache`)**: Spatial grid cache rounding coordinates to approximately 1 km precision with a 30-minute time-to-live (TTL), normalized against IEEE 754 negative zero (`-0.00` to `0.00`), indexed with `UNIQUE KEY uq_weather_grid_key (grid_key)`, and protected against thundering-herd API spikes via single-flight request coalescing.
* **Daily Sensor Aggregates (`sensor_aggregates_daily`)**: Pre-aggregated time-series rollup table storing daily min, max, average, and sample counts per device/zone with explicit `idx_sad_device` index. Ensures rapid historical reporting over multi-year horizons without scanning millions of raw telemetry rows.
* **Water Usage Logs (`water_usage_logs`)**: Dedicated auditing table capturing irrigation volume (liters applied), delivery method (`DRIP_IRRIGATION`, `MANUAL_HOSE`, `SPRINKLER`, `AUTOMATED_VALVE`), and originating task references, indexed across foreign keys (`idx_wul_zone_plant`, `idx_wul_task`, `idx_wul_logged_by`).

### 4.2 Garden Timezone Configuration
* Added standard IANA timezone attribute (`gardens.timezone`, e.g., `'America/New_York'`, `'Europe/London'`).
* **Justification**: Sensor diurnal curves, local sunrise/sunset calculations, automation quiet hours, and daily care tasks must operate against the physical garden's local solar time rather than server UTC time.

### 4.3 Zone Outdoor Environment Flag & Positive Area Check Constraint
* Added `zones.is_outdoor` (Boolean), `zones.zone_type` (`OUTDOOR_BED`, `RAISED_BED`, `GREENHOUSE`, `INDOOR_POTS`, `HYDROPONIC`), and enforced strict positive boundary check `CONSTRAINT chk_zones_area CHECK (area_sq_m > 0.00)`.
* **Justification**: Weather-aware irrigation logic (such as automated rain-skip) must apply strictly to outdoor zones. Indoor grow tents and greenhouses are shielded from precipitation and must rely purely on soil moisture telemetry. The positive area check guarantees relational validity and eliminates division-by-zero risks in capacity math.

### 4.4 Plant Spacing & Zone Capacity Modeling
* Enhanced `plant_catalog` with spatial growth parameters: `spacing_cm`, `row_spacing_cm`, `spread_radius_cm`, and `min_soil_depth_cm`.
* Implemented the zone capacity evaluation formula:
  $$\text{Area}_{\text{occupied}} = \sum_{i=1}^N \left( \text{quantity}_i \times \frac{\text{spacing\_cm}_i \times \text{row\_spacing\_cm}_i}{10,000} \right)$$
  $$\text{Utilization Ratio} = \frac{\text{Area}_{\text{occupied}}}{\text{zone.area\_sq\_m}}$$
* **Defensive Division-by-Zero Guard**: If `zone.area_sq_m <= 0` or `Area_occupied == 0`, the engine immediately short-circuits to `{ utilization_ratio: 0.0, status: 'OPTIMAL' }`, preventing `NaN`, `Infinity`, and invalid null JSON serialization.
* Evaluates zone planting density into three states: `OPTIMAL` ($\le 85\%$), `DENSE` ($85\% - 100\%$), and `OVERCROWDED` ($> 100\%$), providing instant visual warnings in the UI to prevent root choking and fungal blight.

### 4.5 Cryptographically Hashed Device API Keys
* Replaced plaintext device keys with a secure, prefix-indexed hashing architecture modeled after high-security API standards (Stripe/GitHub).
* Devices are issued a raw key formatted as `sg_live_<24_random_bytes_hex>` (e.g., `sg_live_7a8b9c...`).
* MariaDB stores only `key_prefix` (first 16 characters) for fast index retrieval and `key_hash` (full SHA-256 hex digest). Inbound `X-Device-Key` headers are hashed and validated in constant time, preventing database credential exposure if a read replica or backup is compromised.

### 4.6 Route Authorization via Resource-to-Garden Resolver & Compound Scoping
* Endpoints operating on child entities (e.g., `GET /api/zones/:id`, `POST /api/zones/:zoneId/plants`, `PATCH /api/zones/:zoneId/tasks/:taskId`, `GET /api/plants/:id/journal`) do not supply `:gardenId` in their URL paths.
* A Fastify `preHandler` hook (`resolveGardenAndRole`) inspects the request parameters, resolves the parent `garden_id` via cached database lookups (including plant record ID lookup on `/api/plants/:id/*`), verifies active membership and role in `garden_members`, and attaches `request.resolvedGardenId` and `request.gardenRole`. Non-existent resources fail immediately with standard 404 responses before RBAC evaluation, preventing information leakage.
* **Compound Scoping (IDOR Prevention)**: All multi-ID route controllers (e.g. `zones/:zoneId/plants/:plantId`) enforce compound relational queries (`where: { id: plantId, zone_id: zoneId }`) preventing cross-zone and cross-garden IDOR tampering.

### 4.7 Rule Engine Deduplication, Dynamic Local Date & Atomic Conditional Updates
* Automation rules evaluated every 15 minutes by `node-cron` enforce a 3-layer deduplication guard:
  1. **Rule Cooldown**: Evaluates exact datetime math via MariaDB `TIMESTAMPDIFF(MINUTE, last_triggered_at, NOW()) < cooldown_minutes` (and JS epoch millisecond equivalent `Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMinutes * 60000`).
  2. **Dynamic Local-Date Cap & Atomic Execution**: Replaces midnight UTC background resets with dynamic local-date evaluation (`if (rule.last_execution_date !== getLocalDate(garden.timezone)) { rule.executions_today = 0; }`). Enforces atomic conditional updates (`UPDATE automation_rules SET executions_today = executions_today + 1, last_triggered_at = NOW() WHERE id = :id AND executions_today < max_daily_executions`) to eliminate TOCTOU concurrency race conditions.
  3. **Active Task Guard**: Checks whether an uncompleted `CareTask` of the same type already exists for that zone before creating another.
  4. **Quiet Hours Alert Filter**: Evaluates garden local solar time against `quiet_hours_start` and `quiet_hours_end`. During quiet hours, intrusive email and WebSocket alerts are suppressed while silent in-app log entries are retained.

### 4.8 Standard RFC 7807 Error and Response Envelope
* Standardized all API responses into predictable JSON structures:
  * **Success Envelope**: `{ success: true, data: ..., meta: { page, limit, total, totalPages } }`
  * **Error Envelope (RFC 7807 compliant)**:
    ```json
    {
      "success": false,
      "error": {
        "code": "STRING_ERROR_CODE",
        "message": "Human-readable explanation.",
        "details": [],
        "statusCode": 400
      }
    }
    ```

### 4.9 Dual IoT Ingestion Architecture (Simulator & ESP32-S3 Hardware)
* The telemetry endpoint `POST /api/sensors/ingest` accepts a unified, schema-validated JSON payload supporting multi-depth soil moisture, ambient temperature, relative humidity, light lux, battery level, signal RSSI, and firmware version.
* Supports both the standalone Node.js CLI simulator (for testing diurnal decay and automated watering responses) and own-brand physical hardware ("SmartGarden Pro" ESP32-S3), with ingestion logic abstracted in `IngestService` to enable drop-in MQTT broker connectivity in future sprints.

---

## 5. Relational Database Schema Overview (21 Entities)

The system manages 21 distinct database entities (17 primary domain models and 4 auxiliary association/support structures) in MariaDB:

```text
                                  +-------------------+
                                  |       users       |
                                  +---------+---------+
                                            |
         +----------------------------------+----------------------------------+
         |                                  |                                  |
         v 1:N                              v 1:N                              v 1:N
+------------------------+        +--------------------+             +--------------------+
| password_reset_tokens  |        |    user_follows    |             |  community_posts   |
+------------------------+        +--------------------+             +---------+----------+
                                                                               |
                                                                               v 1:N
                                                                     +--------------------+
                                                                     | community_comments |
                                                                     +--------------------+

                                  +-------------------+
                                  |      gardens      |
                                  +---------+---------+
                                            |
         +----------------------------------+----------------------------------+
         |                                  |                                  |
         v 1:N                              v 1:N                              v 1:N
+------------------------+        +--------------------+             +--------------------+
|   garden_invitations   |        |   garden_members   |             |       zones        |
+------------------------+        +--------------------+             +---------+----------+
                                                                               |
         +----------------------------------+----------------------------------+
         |                                  |                                  |
         v 1:N                              v 1:N                              v 1:N
+------------------------+        +--------------------+             +--------------------+
|        devices         |        |    zone_plants     |             |     care_tasks     |
+-----------+------------+        +---------+----------+             +---------+----------+
            |                               |                                  |
            v 1:N                           v 1:N                              v 1:N
+------------------------+        +--------------------+             +--------------------+
|    sensor_readings     |        |   growth_journals  |             | water_usage_logs   |
+-----------+------------+        +--------------------+             +--------------------+
            |
            v (Daily Rollup)
+------------------------+
| sensor_aggregates_daily|
+------------------------+

+------------------------+        +--------------------+             +--------------------+
|    automation_rules    |        |   alert_configs    | ──1:N──>    |     alert_logs     |
+------------------------+        +--------------------+             +--------------------+

+------------------------+        +--------------------+
|     weather_cache      |        |   plant_catalog    | ──1:N──> zone_plants
+------------------------+        +--------------------+
```

*For complete MariaDB DDL definitions, Sequelize ORM models, positive area check constraints (`chk_zones_area`), unique keys (`uq_weather_grid_key`), foreign key indexes, and full column data dictionaries, refer to `Document/database_schema_data_dictionary.md`.*

---

## 6. Middleware Pipeline Execution Flow

Every HTTP request traverses Fastify's lifecycle hooks in deterministic sequence:

```text
Incoming HTTP Request
   │
   ├─► 1. Rate Limiting (@fastify/rate-limit)
   │      Exceeds threshold? ──► Return 429 Too Many Requests
   │
   ├─► 2. Security Headers & CORS (@fastify/helmet, @fastify/cors)
   │
   ├─► 3. Route Handler Authentication:
   │      ├─ Telemetry Ingestion Route? (`POST /api/sensors/ingest`)
   │      │  └─► verifyDeviceKey.js: Lookup key_prefix, verify key_hash (SHA-256)
   │      │      Invalid/revoked? ──► Return 401 Unauthorized
   │      │
   │      └─ Standard API Route?
   │         ├─ Public Endpoint (Register, Login, Forgot Password)? ──► Skip to Handler
   │         └─ Protected Endpoint? ──► verifyJwt.js: Extract Bearer token, verify HS256
   │            Invalid/expired? ──► Return 401 Unauthorized
   │
   ├─► 4. Authorization & Context Resolution:
   │      ├─ Global Admin Route? (`/api/admin/*`, `POST /api/catalog`)
   │      │  └─► checkAdmin.js: `user.is_admin === true`? No ──► Return 403 Forbidden
   │      │
   │      └─ Garden / Zone / Plant / Task Route?
   │         └─► resolveGardenAndRole.js:
   │             1. Extract :gardenId, :zoneId, :plantId, or :taskId
   │             2. Resolve parent garden_id via database lookup (if child ID)
   │             3. Entity missing? ──► Return 404 Not Found
   │             4. Check garden_members for (gardenId, userId)
   │             5. Expired GUEST? ──► Return 403 Forbidden
   │             6. Insufficient Role? ──► Return 403 Forbidden
   │             7. Attach `req.resolvedGardenId` and `req.gardenRole`
   │
   └─► 5. Request Body Schema Validation & Controller Execution
```

---

## 7. Background Workers & Scheduled Tasks

All asynchronous workers run within Node.js utilizing `node-cron` with centralized error handling and database connection resiliency:

1. **Automation Rule Evaluator (`jobs/scheduler.js` — Every 15 Minutes)**:
   * Queries active `automation_rules` across all gardens.
   * Compares the latest sensor readings against rule thresholds (`SOIL_MOISTURE`, `TEMPERATURE`, `HUMIDITY`, `LIGHT_LUX`).
   * Evaluates outdoor weather conditions (checking spatial `weather_cache`).
   * Enforces 3-tier deduplication (rule cooldown, active task check, quiet hours suppression).
   * Automatically dispatches `CareTask` creation or sends system `AlertLog` and WebSocket notifications.
2. **Severe Weather Watchdog (`jobs/scheduler.js` — Every 6 Hours)**:
   * Scans spatial forecasts for frost ($< 2^\circ\text{C}$), heatwaves ($> 38^\circ\text{C}$), and high-wind thunderstorms.
   * Auto-delays outdoor watering tasks scheduled within 12 hours if precipitation probability exceeds $60\%$.
   * Dispatches proactive advisory notifications to affected garden owners and family members.
3. **Telemetry Downsampling & Purge Worker (`jobs/telemetryRollup.js` — Daily at 01:00 UTC)**:
   * Aggregates raw `sensor_readings` recorded over the prior 24 hours into `sensor_aggregates_daily` (calculating min, max, avg, and sample counts per device and zone).
   * Executes partition or indexed batch pruning to delete raw telemetry records older than 30 days (`DELETE FROM sensor_readings WHERE recorded_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`).
4. **IoT Device Heartbeat Watchdog (`jobs/deviceWatchdog.js` — Every 30 Minutes)**:
   * Queries `devices` where `is_active = true` and `last_seen_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)`.
   * Flags unresponsive hardware and creates an in-app system warning alerting the owner to verify power or Wi-Fi connectivity.

---

## 8. Complete System Feature Matrix (F1–F20)

| ID | Feature Name | Core Technical Implementation Summary | Milestone | Primary Actors |
| :--- | :--- | :--- | :---: | :--- |
| **F1** | **Accounts & Authentication** | Salted bcrypt password hashing (cost 10), stateless JWT tokens (`@fastify/jwt`, 7-day TTL), crypto 32-byte password reset tokens stored via SHA-256 hashes with 60-min expiration, and Supabase Google OAuth (`POST /api/auth/oauth` with frontend `/auth/callback`). | M3 (Sprint 1) | All Users |
| **F2** | **Role-Based Access Control** | Per-garden membership roles (`OWNER`, `FAMILY`, `GUEST`), time-bounded guest expiration, tokenized invitation workflow (issuance, listing, cancellation, acceptance/rejection), member role updates/removals, and route-level resource resolver with IDOR compound scoping. | M4 (Sprint 1) | Garden Owner, Collaborators |
| **F3** | **Garden & Zone Management** | Multi-garden management with IANA timezone validation, coordinates, and zone partitioning with `is_outdoor` flags, soil types, sunlight levels, and positive area check constraint (`chk_zones_area`). | M5 (Sprint 1) | Garden Owner, Family |
| **F4** | **Plant Catalog & Reference** | Comprehensive master encyclopedia with search, sunlight/category filters, pagination, care thresholds, spatial spacing attributes (`spacing_cm`), and full admin CRUD (`POST/PUT/DELETE /api/catalog`). | M6 (Sprint 1) | All Users, System Admin |
| **F5** | **Zone Plant Inventory** | Active crop tracking in garden zones, lifecycle status progression (`SEEDLING` $\rightarrow$ `GROWING` $\rightarrow$ `HARVEST_READY` $\rightarrow$ `HARVESTED`), harvest countdowns, quantity updates with capacity utilization ratio & warning meta, and zero-area division guards. | M7 (Sprint 1) | Garden Owner, Family |
| **F6** | **Recurring Care Tasks** | Flexible task manager supporting watering, fertilizing, pruning, and harvesting with auto-rescheduling recurrence intervals (`recurrence_days`) upon completion. | Post-M1 Sprint | Garden Owner, Family |
| **F7** | **Sensor Ingestion & Telemetry** | Secure HTTP ingestion endpoint (`X-Device-Key` with SHA-256 hash lookup) accommodating multi-metric sensor payloads from both physical hardware and the CLI simulator, with optional-chaining zone guards. | Post-M1 Sprint | IoT Hardware, Simulator |
| **F8** | **Real-Time Live Dashboard** | WebSocket pub/sub broker (`@fastify/websocket`) streaming live `SENSOR_UPDATE`, `ALERT_TRIGGERED`, and `TASK_UPDATED` event frames with standard `gardenId` and ISO timestamps, plus reconnect state reconciliation. | Post-M1 Sprint | Garden Owner, Family, Guest |
| **F9** | **Smart Threshold Alerts** | Zone-level min/max metric bounds, user quiet-hours suppression evaluated in garden local time, in-app notification toasts, and transactional SMTP emails. | Post-M1 Sprint | Garden Owner, Family |
| **F10**| **Automation Rule Engine** | 15-minute cron worker evaluating multi-condition `IF sensor_metric + weather THEN action` rules with `TIMESTAMPDIFF` cooldown math, dynamic local-date evaluation, and atomic conditional SQL state updates. | Post-M1 Sprint | Garden Owner |
| **F11**| **Weather-Aware Planning** | Spatial grid weather caching (30-min TTL), severe weather hazard alerts (frost/heatwave), and automated rain-delay postponement for outdoor zones. | Post-M1 Sprint | Garden Owner, Family |
| **F12**| **Seasonal Planting Calendar** | Dynamic regional matrix computing monthly sowing and harvesting schedules by cross-referencing user location with `plant_catalog.planting_months` JSON. | Post-M1 Sprint | All Users |
| **F13**| **Personalized Care Plan Generator** | Algorithmic generation of recurring care tasks upon planting a crop, calibrating frequency based on plant care parameters, zone soil, and sunlight exposure. | Post-M1 Sprint | Garden Owner, Family |
| **F14**| **Plant Recommendation Engine** | Multi-variable scoring algorithm suggesting optimal species based on garden climate region, current calendar month, zone sunlight, and available bed area. | Post-M1 Sprint | Garden Owner, Family |
| **F15**| **Companion Planting Advisor** | Zone compatibility engine cross-referencing active plants against `good_companions` (synergistic) and `bad_companions` (allelopathic/pest-attracting) catalog lists. | Post-M1 Sprint | Garden Owner, Family |
| **F16**| **Growth Journal & Timeline** | Chronological visual journal supporting plant height tracking, textual notes, and multipart photo uploads with thumbnail generation. | Post-M1 Sprint | Garden Owner, Family |
| **F17**| **Analytics & Data Export** | Water volume aggregation (`water_usage_logs`), sensor historical trends, and downloadable PDF (`pdfkit`) and CSV (`json2csv`) analytical reports. | Post-M1 Sprint | Garden Owner |
| **F18**| **AI Leaf Disease Diagnosis** | Multipart leaf image upload forwarded to hosted multimodal Vision AI API, returning disease identification, confidence scores, and organic remedies. | Post-M1 Sprint | Garden Owner, Family |
| **F19**| **AI Gardening Assistant** | Context-aware LLM chatbot prompt-injected with live garden telemetry, zone metadata, and active plant inventory for tailored horticultural advice. | Post-M1 Sprint | Garden Owner, Family |
| **F20**| **Community Hub & Social Feed** | Public social feed for sharing garden snapshots, categorized Q&A discussions, nested comment threads, user follow mappings, and admin content moderation. | Post-M1 Sprint | All Users, System Admin |

---

## 9. Monorepo Project Directory Structure

```text
smartgarden/
├── Document/                               # Comprehensive Technical Specification Suite (v1.1)
│   ├── smart_gardening_system_technical_documentation.md
│   ├── requirements_specification.md
│   ├── database_schema_data_dictionary.md
│   ├── api_specification.md
│   ├── security_and_permissions_matrix.md
│   ├── rules_engine_and_business_logic.md
│   └── iot_ingest_and_device_architecture.md
├── docker-compose.yml                      # MariaDB 10.11 container orchestration
├── .env.example                            # Comprehensive environment configuration template
├── package.json                            # Root workspace configuration & unified scripts
├── backend/                                # Node.js + Fastify API Service (Plain JavaScript)
│   ├── package.json
│   ├── server.js                           # Fastify server entry point & plugin registrations
│   ├── config/
│   │   ├── database.js                     # Sequelize database connection pool (MariaDB/SQLite)
│   │   └── config.js                       # Environment variable loader and schema validation
│   ├── models/                             # Sequelize relational models
│   │   ├── index.js                        # Master association definitions (1:N, M:N)
│   │   ├── User.js
│   │   ├── PasswordResetToken.js
│   │   ├── Garden.js
│   │   ├── GardenMember.js
│   │   ├── GardenInvitation.js
│   │   ├── Zone.js
│   │   ├── PlantCatalog.js
│   │   ├── ZonePlant.js
│   │   ├── CareTask.js
│   │   ├── Device.js
│   │   ├── SensorReading.js
│   │   ├── SensorAggregateDaily.js
│   │   ├── WaterUsageLog.js
│   │   ├── AutomationRule.js
│   │   ├── AlertConfig.js
│   │   ├── AlertLog.js
│   │   ├── WeatherCache.js
│   │   ├── GrowthJournal.js
│   │   ├── CommunityPost.js
│   │   ├── CommunityComment.js
│   │   └── UserFollow.js
│   ├── middleware/                         # Fastify lifecycle hooks
│   │   ├── auth.js                         # verifyJwt token validation
│   │   ├── rbac.js                         # checkGardenRole and resolveGardenAndRole resolver
│   │   ├── checkAdmin.js                   # Superadmin access guard
│   │   └── verifyDeviceKey.js              # Constant-time hashed IoT device key verification
│   ├── routes/                             # Fastify route plugins
│   │   ├── auth.js                         # /api/auth routes
│   │   ├── gardens.js                      # /api/gardens routes
│   │   ├── zones.js                        # /api/zones routes
│   │   ├── catalog.js                      # /api/catalog routes
│   │   ├── invitations.js                  # /api/invitations routes
│   │   ├── plants.js                       # /api/zones/:zoneId/plants routes
│   │   ├── tasks.js                        # /api/zones/:zoneId/tasks routes
│   │   ├── sensors.js                      # /api/sensors routes
│   │   └── community.js                    # /api/community routes
│   ├── controllers/                        # Business logic controllers
│   ├── services/                           # External integrations and helper logic
│   │   ├── weatherService.js
│   │   ├── ruleEngineService.js
│   │   ├── emailService.js
│   │   └── reportService.js
│   ├── scripts/                            # Database management scripts
│   │   ├── migrate.js                      # Automated migration runner
│   │   └── seed.js                         # 30+ plant catalog reference data seeder
│   ├── seeds/
│   │   └── plants.json                     # Seed data for 30+ botanical species
│   ├── simulator/
│   │   └── sensorSimulator.js              # Standalone Node.js CLI telemetry simulator
│   └── tests/                              # Automated unit & integration test suites
│       ├── auth.test.js
│       ├── rbac.test.js
│       ├── gardens.test.js
│       ├── catalog_inventory.test.js
│       └── resolver.test.js
└── frontend/                               # Vue.js 3 + Vite SPA (Plain JavaScript)
    ├── package.json
    ├── vite.config.js                      # Dev server & reverse proxy configuration
    ├── index.html
    └── src/
        ├── main.js                         # Application bootstrap
        ├── App.vue                         # Persistent layout, nav bar, and alert toasts
        ├── router/index.js                 # Vue Router configuration & navigation guards
        ├── stores/                         # Pinia centralized stores
        │   ├── auth.js                     # User session & JWT state
        │   ├── gardens.js                  # Active garden & zone state
        │   └── catalog.js                  # Plant encyclopedia state
        ├── views/                          # Page views
        │   ├── AuthView.vue                # Tabbed Login, Register, Password Reset
        │   ├── GardensView.vue             # Multi-garden dashboard
        │   ├── GardenDetailView.vue        # Garden overview & zone management
        │   ├── ZoneDetailView.vue          # Zone sensor charts & plant inventory
        │   ├── PlantCatalogView.vue        # Searchable plant encyclopedia
        │   └── ZonePlantsView.vue          # Zone crop inventory & harvest countdowns
        └── services/                       # API clients
            ├── api.js                      # Axios instance with interceptors
            └── wsClient.js                 # WebSocket client with reconnection logic
```
