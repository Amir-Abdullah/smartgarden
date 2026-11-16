# Smart Gardening System — Requirements Specification

**Document Version:** 1.1  
**Status:** Approved Engineering Baseline  
**Project:** Smart Gardening System (Full-Stack MVC SPA)  
**Applicability:** Full System Architecture (F1–F20) with Deep Specification for Milestone 1 Showcase Scope (F1–F5)  

---

## 1. Executive Summary & Purpose

The Smart Gardening System is a full-stack, cloud-enabled Internet of Things (IoT) gardening platform engineered to help home gardeners, community allotment caretakers, and urban farming enthusiasts monitor, automate, and optimize crop cultivation. The platform combines real-time microclimate sensing, botanical knowledge graphs, rule-based automation, weather forecasting, and collaborative garden access control into a single unified Single Page Application (SPA).

This document serves as the authoritative functional and non-functional requirements specification for the platform. It details all 20 primary system features (F1 through F20), defines user personas, specifies non-functional engineering standards, and details explicit user stories and verifiable acceptance criteria for the initial foundation showcase scope (Features F1 through F5).

---

## 2. User Personas & Actors

| Persona | Role & Description | Primary Objectives | Key Pain Points |
| :--- | :--- | :--- | :--- |
| **P1: Home Gardener (Primary Owner)** | Residential gardener managing backyards, raised beds, balconies, or indoor grow tents. Holds `OWNER` role on one or more gardens. | Wants automated alerts when soil dries out, tailored care schedules, and insights into optimal plant placement without manual research. | Forgets watering during heatwaves; overwaters indoor plants; lacks time to research companion planting. |
| **P2: Family Collaborator** | Household member, co-gardener, or trusted partner holding `FAMILY` role on a shared garden. | Needs to view garden health, log completed watering/pruning tasks, record crop growth, and add new plants. | Unsure if a bed has already been watered today; accidental duplicate watering. |
| **P3: Temporary Guest / Plant Sitter** | Neighbor, house sitter, or friend granted time-bounded `GUEST` role while owners are away. | Needs read-only access to view plant checklists, sensor status, and emergency instructions. | Needs clear, restricted view without risk of accidentally altering garden configurations or rules. |
| **P4: System Administrator** | Technical platform operator holding `is_admin = true`. | Manages master plant encyclopedia, moderates community feed content, monitors device connectivity health. | Managing inconsistent botanical reference data; moderating user-generated spam or offensive posts. |
| **P5: IoT Device / Sensor Simulator (Machine Actor)** | Hardware microcontroller ("SmartGarden Pro" ESP32-S3) or software CLI Node.js simulator. | Authenticates via device API key (`X-Device-Key`) and streams high-frequency microclimate telemetry. | Unreliable Wi-Fi connectivity, battery drain, network clock desynchronization. |

---

## 3. System Scope & Sprint Milestone Roadmap

```text
+--------------------------------------------------------------------------------------------------+
|                                    FULL SYSTEM CAPABILITY (F1–F20)                               |
+--------------------------------------------------------------------------------------------------+
|  [PHASE 1: Foundation Showcase Scope (F1–F5)]                                                    |
|  - F1: Accounts & Authentication (Bcrypt, JWT, SHA-256 Reset Tokens)                             |
|  - F2: Role-Based Access Control & Invitations (OWNER, FAMILY, GUEST, Resource Resolver)         |
|  - F3: Garden & Zone Management (Timezone, Coordinates, Outdoor/Indoor Flags, Soil/Sunlight)     |
|  - F4: Plant Catalog & Reference Data (Encyclopedia Search/Filters, Spacing Attributes, Admin)   |
|  - F5: Zone Plant Inventory (Crop Lifecycle Progression, Density & Overcrowding Engine)          |
+--------------------------------------------------------------------------------------------------+
|  [PHASE 2: Telemetry, Automation & Real-Time Engine (F6–F11)]                                    |
|  - F6: Recurring Care Tasks & Task Execution Engine                                              |
|  - F7: Sensor Ingestion (Dual ESP32-S3 / Simulator Ingest Pipeline via Hashed API Keys)          |
|  - F8: Real-Time Live WebSocket Dashboard (Dial Gauges, Live Trends)                             |
|  - F9: Smart Threshold Alerts & Local Time Quiet-Hours Suppression                               |
|  - F10: Automation Rule Engine (IF Metric + Weather THEN Action with 3-Layer Deduplication)     |
|  - F11: Weather-Aware Planning & Spatial Grid Forecast Caching (Outdoor Rain-Skip Delays)        |
+--------------------------------------------------------------------------------------------------+
|  [PHASE 3: Horticultural Intelligence, Media & Analytics (F12–F17)]                              |
|  - F12: Seasonal Planting Calendar (Dynamic Regional Monthly Matrix)                             |
|  - F13: Personalized Care Plan Generator (Species-to-Zone Task Automation)                        |
|  - F14: Plant Recommendation Engine (Sunlight, Soil, Climate Match Scoring)                      |
|  - F15: Companion Planting Advisor (Synergies & Allelopathic Conflict Matrix)                    |
|  - F16: Growth Journal & Timeline (Multipart Photo Upload, Height Tracking)                      |
|  - F17: Analytics & Data Export (Water Usage Logging, Daily Sensor Aggregates, PDF/CSV)        |
+--------------------------------------------------------------------------------------------------+
|  [PHASE 4: AI Intelligence & Community Collaboration (F18–F20)]                                  |
|  - F18: AI Leaf Disease & Pest Diagnosis (Multimodal Vision API Integration)                     |
|  - F19: AI Gardening Assistant (Context-Aware LLM Chatbot with Live Garden Telemetry Injection)  |
|  - F20: Community Hub (Social Feed, Garden Snapshots, Q&A Threads, Follows, Admin Moderation)    |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. Comprehensive Functional Requirements (F1 through F20)

### F1: Accounts & Authentication
* **Objective:** Provide secure user onboarding, credential authentication, stateless session management, and self-service password recovery.
* **Functional Capabilities:**
  * **F1.1 Registration:** Users register via `POST /api/auth/register` supplying `name`, `email`, `password`, and optional `location_region`. Passwords must be hashed using `bcrypt` with cost factor 10. Duplicate emails must be rejected with HTTP 409 Conflict.
  * **F1.2 Login:** Users authenticate via `POST /api/auth/login` with email and password. Successful authentication issues a signed JSON Web Token (JWT) with HS256 algorithm and 7-day expiration.
  * **F1.3 Session Verification:** Protected routes validate the `Authorization: Bearer <token>` header, attaching the verified user object (`id`, `email`, `name`, `is_admin`) to `request.user`.
  * **F1.4 Password Reset Request:** Users trigger reset via `POST /api/auth/forgot-password`. If the email exists, the system generates a cryptographically secure 32-byte random hex token, stores its SHA-256 hash in `password_reset_tokens` with a 60-minute expiration, and dispatches a reset link via email. Always returns generic success to prevent email enumeration.
  * **F1.5 Password Reset Execution:** Users submit `POST /api/auth/reset-password` with `token` and `new_password`. The system validates the token hash, verifies `expires_at > NOW()` and `used_at IS NULL`, updates the user's password hash, and marks `used_at = NOW()`.

### F2: Role-Based Access Control (RBAC) & Invitations
* **Objective:** Enable multi-user garden collaboration while enforcing fine-grained role privileges across gardens, zones, plants, and tasks.
* **Functional Capabilities:**
  * **F2.1 Garden Roles:** Supports `OWNER` (full control, billing, member invites, deletion), `FAMILY` (read/write zones, plants, tasks, journals), and `GUEST` (read-only access).
  * **F2.2 Resource-to-Garden Resolver:** A Fastify `preHandler` hook transparently extracts child resource IDs (`:zoneId`, `:plantId`, `:taskId`, `:deviceId`), queries the database to resolve the root `garden_id`, and verifies caller membership in `garden_members`.
  * **F2.3 Garden Invitations:** Owners can issue invitations via `POST /api/gardens/:id/invitations` specifying recipient email, role (`FAMILY` or `GUEST`), and expiration period. A 64-character token is generated and stored in `garden_invitations`. Owners can list active invitations via `GET /api/gardens/:id/invitations` and cancel invitations via `DELETE /api/gardens/:id/invitations/:inviteId`.
  * **F2.4 Invitation Acceptance/Rejection & Member Management:** Authenticated recipients accept via `POST /api/invitations/:token/accept` or reject via `POST /api/invitations/:token/reject`. Acceptance automatically provisions a record in `garden_members` and marks the invitation `ACCEPTED`. Owners can update member roles via `PUT /api/gardens/:id/members/:userId` and remove members or allow members to leave via `DELETE /api/gardens/:id/members/:userId`.

### F3: Garden & Zone Management
* **Objective:** Maintain the structural hierarchy of physical growing environments and microclimate zones.
* **Functional Capabilities:**
  * **F3.1 Garden Management:** Full CRUD operations on gardens (`POST /api/gardens`, `GET`, `PUT`, `DELETE`). Each garden stores `name`, `latitude`, `longitude`, `area_sq_m`, and mandatory IANA `timezone` (e.g., `'America/Chicago'`). Garden creation automatically binds the creator as `OWNER`.
  * **F3.2 Timezone Enforcement:** Validates timezone against standard IANA strings. Used for all local solar calculations, quiet-hours alert windows, and recurring task schedules.
  * **F3.3 Zone Management:** Full CRUD operations on zones within gardens (`POST /api/gardens/:gardenId/zones`, `GET /api/zones/:id`, `PUT`, `DELETE`). Each zone stores `name`, `is_outdoor` (Boolean), `soil_type` (`LOAM`, `CLAY`, `SANDY`, `SILT`, `PEAT`, `CHALKY`), `sunlight_level` (`FULL_SUN`, `PART_SHADE`, `FULL_SHADE`), and `area_sq_m`.
  * **F3.4 Outdoor Environment Designation:** The `is_outdoor` flag determines whether the zone is subject to natural precipitation and external weather rules.

### F4: Plant Catalog & Reference Data
* **Objective:** Serve a comprehensive botanical encyclopedia containing cultivation specifications, environmental thresholds, and spatial dimensions.
* **Functional Capabilities:**
  * **F4.1 Catalog Browsing & Search:** `GET /api/catalog` supports full-text substring search (`q`), category filtering (`VEGETABLE`, `HERB`, `FRUIT`, `FLOWER`, `FOLIAGE`, `SUCCULENT`, `TREE`), sunlight requirements, and page/limit pagination.
  * **F4.2 Botanical Attributes:** Each species record includes `scientific_name`, `common_name`, `category`, `ideal_moisture_min/max`, `ideal_temp_min/max`, `watering_freq_days`, `fertilizing_freq_days`, `spacing_cm`, `row_spacing_cm`, `planting_months` (JSON array), `harvest_months` (JSON array), `good_companions` (JSON array), and `bad_companions` (JSON array).
  * **F4.3 Admin Catalog Management:** Mutations (`POST /api/catalog`, `PUT`, `DELETE`) are strictly guarded by `checkAdmin` (`request.user.is_admin === true`).
  * **F4.4 Reference Seed Data:** The system includes automated seed scripts populating at least 30 real-world plant species across vegetables, herbs, fruits, and flowers.

### F5: Zone Plant Inventory
* **Objective:** Track specific crops planted inside individual garden zones throughout their lifecycle.
* **Functional Capabilities:**
  * **F5.1 Inventory Tracking:** `POST /api/zones/:zoneId/plants` links a catalog species to a zone, capturing `custom_nickname`, `quantity`, `planted_date`, and optional `expected_harvest_date`.
  * **F5.2 Lifecycle Progression:** Crops transition through defined lifecycle states: `SEEDLING` $\rightarrow$ `GROWING` $\rightarrow$ `HARVEST_READY` $\rightarrow$ `HARVESTED` (or `DEAD`), alongside health status flags (`HEALTHY`, `NEEDS_ATTENTION`, `CRITICAL`, `DORMANT`).
  * **F5.3 Zone Capacity & Overcrowding Evaluation:** Computes total plant footprint against `zones.area_sq_m`:
    $$\text{Utilization Ratio} = \frac{\sum (\text{quantity}_i \times \text{spacing\_cm}_i \times \text{row\_spacing\_cm}_i / 10000)}{\text{zone.area\_sq\_m}}$$
    Returns non-blocking warnings when ratio $> 1.0$ (`OVERCROWDED`).

### F6: Recurring Care Tasks
* **Objective:** Schedule, assign, and track garden maintenance tasks (watering, fertilizing, pruning, harvesting, repotting).
* **Functional Capabilities:**
  * **F6.1 Task Creation:** Users or automated engines create tasks (`POST /api/zones/:id/tasks`) with `task_type`, `due_date`, `recurrence_days`, `source` (`MANUAL`, `CARE_PLAN`, `RULE_ENGINE`), and optional assignment.
  * **F6.2 Completion & Recurrence:** Marking a recurring task complete (`PATCH /api/zones/:id/tasks/:taskId`) automatically logs completion and schedules the next occurrence at `due_date = completion_date + recurrence_days`.
  * **F6.3 Water Task Linking:** Completing a `WATER` task prompts for irrigation volume (`water_volume_liters`), which is automatically recorded in `water_usage_logs`.

### F7: Sensor Ingestion & Telemetry
* **Objective:** Ingest real-time environmental telemetry from physical microcontrollers ("SmartGarden Pro" ESP32-S3) and software simulators.
* **Functional Capabilities:**
  * **F7.1 Ingestion Endpoint:** `POST /api/sensors/ingest` validates inbound `X-Device-Key` against MariaDB `devices.key_prefix` and `key_hash` using constant-time SHA-256 matching.
  * **F7.2 Ingest Payload:** Ingests soil moisture (%), ambient temperature (°C), relative humidity (%), light intensity (lux), battery percentage, signal RSSI, and device UID.
  * **F7.3 Clock Skew Sanitization:** Server validates device timestamps. If skewed $> 15$ minutes from server UTC, the timestamp is normalized to server current time.
  * **F7.4 High-Performance Storage:** Telemetry records persist to `sensor_readings` with composite indexes on `(zone_id, recorded_at DESC)`.

### F8: Real-Time Live WebSocket Dashboard
* **Objective:** Provide zero-latency live telemetry streams and instant alert notifications to active dashboard browser sessions.
* **Functional Capabilities:**
  * **F8.1 WebSocket Handshake:** Fastify WebSocket route `ws://host/ws/gardens/:gardenId?token=<JWT>` validates token and verifies garden access before joining channel `garden:<gardenId>`.
  * **F8.2 Telemetry Broadcasting:** Ingested sensor readings immediately publish `SENSOR_UPDATE` JSON frames to connected garden subscribers.
  * **F8.3 Alert Notifications:** System publishes `ALERT_TRIGGERED` frames on threshold violations, triggering immediate toast banners in the Vue 3 UI.

### F9: Smart Threshold Alerts & Quiet Hours
* **Objective:** Detect microclimate anomalies and dispatch in-app and email alerts while respecting user rest periods.
* **Functional Capabilities:**
  * **F9.1 Threshold Configuration:** `alert_configs` defines per-zone min/max bounds for soil moisture, temperature, humidity, and light lux.
  * **F9.2 Local Quiet Hours Evaluation:** Evaluates garden local time (via `gardens.timezone`) against `quiet_hours_start` and `quiet_hours_end`. Alerts triggered during quiet hours suppress intrusive emails and WebSocket popups, logging silently to `alert_logs`.
  * **F9.3 Cooldown Guard:** Prevents alert fatigue by suppressing duplicate alerts for the same metric within `cooldown_minutes` (default 60 mins).

### F10: Automation Rule Engine
* **Objective:** Execute autonomous gardening logic evaluating sensor metrics, weather forecasts, and calendar schedules.
* **Functional Capabilities:**
  * **F10.1 Cron Evaluator:** Background worker runs every 15 minutes (`jobs/scheduler.js`), querying active `automation_rules`.
  * **F10.2 Rule Logic:** Evaluates conditions: `IF metric (MOISTURE, TEMP, HUMIDITY) operator (LT, GT) threshold AND weather_condition (NO_RAIN, ANY) THEN action (CREATE_TASK, SEND_ALERT)`.
  * **F10.3 3-Layer Deduplication:** Enforces rule cooldown (`cooldown_minutes`), daily execution limit (`max_daily_executions`), and checks whether an uncompleted task of the same type already exists for that zone before creating another.

### F11: Weather-Aware Planning & Spatial Cache
* **Objective:** Integrate external meteorological forecasts to optimize irrigation and protect crops from severe weather events.
* **Functional Capabilities:**
  * **F11.1 Spatial Grid Cache:** Forecasts are cached in `weather_cache` keyed by geographic grid (~1 km precision) with a 30-minute TTL, eliminating redundant third-party API calls.
  * **F11.2 Rain-Skip Delay:** If outdoor precipitation probability exceeds 60%, the system postpones scheduled outdoor watering tasks by 24 hours. Indoor zones (`is_outdoor = false`) ignore rain forecasts.
  * **F11.3 Severe Weather Watchdog:** Scans forecasts every 6 hours for frost ($< 2^\circ\text{C}$), extreme heat ($> 38^\circ\text{C}$), and high winds, alerting owners to deploy frost covers or shade netting.

### F12: Seasonal Planting Calendar
* **Objective:** Guide gardeners on what crops to sow, transplant, and harvest based on geographic region and current month.
* **Functional Capabilities:**
  * **F12.1 Dynamic Schedule Query:** Cross-references user location region against `plant_catalog.planting_months` and `harvest_months` JSON arrays.
  * **F12.2 Monthly Matrix:** Returns categorized lists of crops suitable for indoor sowing, direct outdoor sowing, or harvesting for the active calendar month.

### F13: Personalized Care Plan Generator
* **Objective:** Automatically construct a recurring maintenance schedule for newly planted crops based on botanical requirements.
* **Functional Capabilities:**
  * **F13.1 Automated Generation:** When adding a crop to a zone, owners can trigger care plan generation.
  * **F13.2 Frequency Calibration:** Creates recurring `WATER`, `FERTILIZE`, and `PRUNE` tasks in `care_tasks`, adjusting default species frequency based on zone soil type and sunlight level.

### F14: Plant Recommendation Engine
* **Objective:** Recommend botanical species that will thrive in a given garden zone's specific environmental conditions.
* **Functional Capabilities:**
  * **F14.1 Multi-Factor Scoring:** Evaluates candidate species from `plant_catalog` against zone attributes (`sunlight_level`, `soil_type`, `is_outdoor`, available area) and garden regional climate.
  * **F14.2 Ranked Suggestions:** Returns ranked species with compatibility percentages and contextual advice (e.g., "Full sun and well-draining loam make this zone ideal for Mediterranean herbs").

### F15: Companion Planting Advisor
* **Objective:** Prevent harmful plant pairings and maximize symbiotic pest control and nutrient sharing within zones.
* **Functional Capabilities:**
  * **F15.1 Pairwise Cross-Referencing:** Compares all active species in a zone against `plant_catalog.good_companions` and `bad_companions`.
  * **F15.2 Synergy & Conflict Reports:** Identifies beneficial pairings (e.g., Basil repelling hornworms near Tomatoes) and warns against allelopathic pairings (e.g., Fennel inhibiting tomato growth).

### F16: Growth Journal & Photo Timeline
* **Objective:** Document crop development over time with chronological measurements, notes, and visual photographic records.
* **Functional Capabilities:**
  * **F16.1 Multipart Image Upload:** Accepts multipart/form-data image uploads (`@fastify/multipart`, max 5 MB, JPEG/PNG/WebP), persisting files to storage and saving URLs in `growth_journals`.
  * **F16.2 Growth Metrics:** Captures plant height (cm), growth stage observations, and health notes plotted on a visual timeline.

### F17: Analytics & Data Export
* **Objective:** Aggregate long-term horticultural metrics into downloadable PDF and CSV analytical reports.
* **Functional Capabilities:**
  * **F17.1 Water Analytics:** Aggregates water volume from `water_usage_logs` by day, week, month, and irrigation method.
  * **F17.2 Historical Sensor Rollups:** Compiles time-series sensor trends using `sensor_aggregates_daily`.
  * **F17.3 Document Export:** Generates formatted PDF reports via `pdfkit` (including summary tables and KPI cards) and raw tabular data via `json2csv`.

### F18: AI Leaf Disease & Pest Diagnosis
* **Objective:** Provide automated visual disease identification and organic remedy recommendations from uploaded leaf photographs.
* **Functional Capabilities:**
  * **F18.1 Multimodal Diagnosis:** Uploaded leaf images are converted to base64 and forwarded to a hosted Vision AI API with a domain-specific botanical prompt.
  * **F18.2 Structured Remediation:** Returns parsed JSON specifying `diseaseName`, `confidence` score (0–100%), symptom description, organic treatment steps, and chemical treatment alternatives.

### F19: AI Gardening Assistant
* **Objective:** Offer a conversational AI assistant that understands the user's specific garden state and sensor readings.
* **Functional Capabilities:**
  * **F19.1 Context Injection:** Chat requests retrieve the user's garden names, zone soil/sunlight specs, planted crops, and current sensor telemetry, injecting them as grounding context into the LLM system prompt.
  * **F19.2 Natural Language Q&A:** Delivers conversational answers tailored to real-time garden conditions (e.g., "Why are my cucumber leaves wilting given that soil moisture is currently 22%?").

### F20: Community Hub & Social Feed
* **Objective:** Foster peer-to-peer knowledge sharing, showcase garden harvests, and facilitate community Q&A.
* **Functional Capabilities:**
  * **F20.1 Social Feed:** Users publish posts (`community_posts`) with categories (`QUESTION`, `SHOWCASE`, `TIP`, `GENERAL`), optional photos, and linked garden snapshots.
  * **F20.2 Discussions & Follows:** Threaded replies (`community_comments`) and peer subscriptions (`user_follows`). Self-following is prevented by database check constraints.
  * **F20.3 Moderation:** System administrators can pin, flag, or remove inappropriate posts and comments.

---

## 5. Detailed User Stories & Acceptance Criteria (Showcase Scope: F1–F5)

### 5.1 Feature 1: Accounts & Authentication

#### User Story US-1.1: User Registration
* **As a** new gardener,  
  **I want to** register an account with my name, email, password, and geographical region,  
  **So that** I can create and manage my personalized gardens.
* **Acceptance Criteria:**
  - [ ] `POST /api/auth/register` accepts `{ name, email, password, location_region }`.
  - [ ] Rejects requests missing `name`, `email`, or `password` with HTTP 400 Bad Request.
  - [ ] Enforces email format validation and minimum password length of 8 characters.
  - [ ] Stores passwords hashed using `bcrypt` with cost factor $\ge 10$; plaintext passwords are never stored or logged.
  - [ ] Rejects duplicate email registrations (case-insensitive) with HTTP 409 Conflict.
  - [ ] Upon successful registration, returns HTTP 201 Created with sanitized `user` object (no password hash) and a valid signed JWT access token.

#### User Story US-1.2: User Login & Session Retrieval
* **As an** existing registered gardener,  
  **I want to** authenticate using my email and password,  
  **So that** I receive a secure session token to access my gardens.
* **Acceptance Criteria:**
  - [ ] `POST /api/auth/login` accepts `{ email, password }`.
  - [ ] Invalid email or incorrect password returns HTTP 401 Unauthorized (`INVALID_CREDENTIALS`).
  - [ ] Successful login returns HTTP 200 OK with sanitized `user` object and signed JWT token.
  - [ ] JWT payload contains `{ id, email, name, is_admin }` with 7-day expiration (`expiresIn: '7d'`).
  - [ ] `GET /api/auth/me` with header `Authorization: Bearer <token>` returns HTTP 200 OK with the authenticated user profile.
  - [ ] Requests with expired, malformed, or missing tokens return HTTP 401 Unauthorized.

#### User Story US-1.3: Secure Password Reset Flow
* **As a** user who forgot their password,  
  **I want to** request a password reset link and submit a new password using a temporary token,  
  **So that** I can securely regain access to my account.
* **Acceptance Criteria:**
  - [ ] `POST /api/auth/forgot-password` accepts `{ email }`.
  - [ ] Returns HTTP 200 OK with generic confirmation message regardless of whether the email exists, preventing user enumeration.
  - [ ] For valid accounts, generates a cryptographically secure 32-byte token and stores its SHA-256 hash in `password_reset_tokens` with `expires_at = NOW() + 60 MINUTES`.
  - [ ] `POST /api/auth/reset-password` accepts `{ token, new_password }`.
  - [ ] Validates token SHA-256 hash against `password_reset_tokens`; verifies token is not expired and `used_at IS NULL`.
  - [ ] Updates `users.password_hash` with newly salted bcrypt hash and sets `used_at = NOW()`.
  - [ ] Expired, reused, or forged tokens return HTTP 400 Bad Request (`INVALID_OR_EXPIRED_TOKEN`).

---

### 5.2 Feature 2: Role-Based Access Control (RBAC) & Invitations

#### User Story US-2.1: Garden-Level Role Enforcement
* **As a** garden owner,  
  **I want** role-based authorization enforced across all garden endpoints,  
  **So that** family members can assist with maintenance while temporary guests only have read access.
* **Acceptance Criteria:**
  - [ ] `OWNER` role has complete access: update garden, delete garden, manage members, create/delete zones.
  - [ ] `FAMILY` role can create/update zones, manage plants, and complete tasks, but cannot delete the garden or modify members.
  - [ ] `GUEST` role has read-only access (`GET` endpoints only); mutations return HTTP 403 Forbidden.
  - [ ] Non-members attempting to access garden resources receive HTTP 403 Forbidden (`NOT_A_GARDEN_MEMBER`).
  - [ ] Guest memberships past their `expires_at` timestamp receive HTTP 403 Forbidden (`GUEST_ACCESS_EXPIRED`).
  - [ ] Superadmins (`user.is_admin === true`) bypass garden membership checks for support and administrative operations.

#### User Story US-2.2: Resource-to-Garden Resolver Hook
* **As an** API client accessing child entities (zones, plants, tasks),  
  **I want** the system to automatically resolve the parent garden from child resource IDs,  
  **So that** routes do not require redundant `:gardenId` parameters in every URL path.
* **Acceptance Criteria:**
  - [ ] Route paths like `GET /api/zones/:id` and `POST /api/zones/:zoneId/plants` resolve `garden_id` from the database.
  - [ ] If child entity does not exist in MariaDB, immediately returns HTTP 404 Not Found before checking permissions.
  - [ ] Resolves `garden_id`, validates caller role against required permission level, and attaches `request.resolvedGardenId` and `request.gardenRole`.

#### User Story US-2.3: Garden Member Invitations
* **As a** garden owner,  
  **I want to** invite collaborators via email with a specific role,  
  **So that** they can join my garden securely.
* **Acceptance Criteria:**
  - [ ] `POST /api/gardens/:id/invitations` accepts `{ email, role, expiresInDays }` (OWNER only).
  - [ ] `GET /api/gardens/:id/invitations` lists all invitations issued for the garden (OWNER only).
  - [ ] `DELETE /api/gardens/:id/invitations/:inviteId` cancels a pending invitation (OWNER only).
  - [ ] `PUT /api/gardens/:id/members/:userId` updates an existing member's role (OWNER only).
  - [ ] `DELETE /api/gardens/:id/members/:userId` removes a member (or allows a non-owner to leave).
  - [ ] Generates a secure random token in `garden_invitations` with status `PENDING` and 7-day expiration.
  - [ ] `POST /api/invitations/:token/accept` adds the authenticated user to `garden_members` and marks invitation `ACCEPTED`.
  - [ ] Accepting an invitation for a garden where the user is already a member returns HTTP 409 Conflict.
  - [ ] `POST /api/invitations/:token/reject` marks invitation `REJECTED`.

---

### 5.3 Feature 3: Garden & Zone Management

#### User Story US-3.1: Garden Management with Timezone
* **As a** gardener,  
  **I want to** create and configure gardens with geographic coordinates and local IANA timezones,  
  **So that** my garden schedules and automation rules execute according to my local solar time.
* **Acceptance Criteria:**
  - [ ] `POST /api/gardens` accepts `{ name, latitude, longitude, timezone, area_sq_m, description }`.
  - [ ] Validates `timezone` against supported IANA strings (e.g., `'America/New_York'`); invalid timezones return HTTP 400 Bad Request.
  - [ ] Automatically inserts the creator into `garden_members` with `role = 'OWNER'`.
  - [ ] `GET /api/gardens` returns only gardens where the user holds an active membership.
  - [ ] `PUT /api/gardens/:id` updates garden metadata (OWNER only).
  - [ ] `DELETE /api/gardens/:id` cascades deletion to all zones, plants, devices, rules, and memberships (OWNER only).

#### User Story US-3.2: Zone Management with Environment Flags
* **As a** gardener,  
  **I want to** partition my garden into distinct growing zones with indoor/outdoor flags, soil types, and sunlight levels,  
  **So that** I can model different microclimates accurately.
* **Acceptance Criteria:**
  - [ ] `POST /api/gardens/:gardenId/zones` accepts `{ name, is_outdoor, soil_type, sunlight_level, area_sq_m }`.
  - [ ] `is_outdoor` accepts boolean (default `true`); distinguishes outdoor beds from indoor grow tents and greenhouses.
  - [ ] Validates `sunlight_level` against `FULL_SUN`, `PART_SHADE`, `FULL_SHADE`.
  - [ ] Validates `soil_type` against standard categories (`LOAM`, `CLAY`, `SANDY`, `SILT`, `PEAT`, `CHALKY`).
  - [ ] `GET /api/zones/:id` returns zone details and active crop summary (RBAC resolved).
  - [ ] `DELETE /api/zones/:id` removes zone and cascades associated plant inventory (OWNER only, RBAC resolved).

---

### 5.4 Feature 4: Plant Catalog & Reference Data

#### User Story US-4.1: Plant Catalog Search & Filtering
* **As a** gardener,  
  **I want to** search and filter the master botanical catalog by name, category, and sunlight requirements,  
  **So that** I can find plants suitable for my garden zones.
* **Acceptance Criteria:**
  - [ ] `GET /api/catalog` supports query parameters: `q` (substring search on common and scientific names), `category`, `sunlight`, `page`, `limit`.
  - [ ] Returns paginated data envelope `{ data: [...], pagination: { page, limit, totalItems, totalPages } }`.
  - [ ] Returns care specifications: ideal moisture range, temperature range, watering frequency, and companion lists.
  - [ ] Plant records include spatial attributes: `spacing_cm`, `row_spacing_cm`, `spread_radius_cm`.
  - [ ] Empty search results return HTTP 200 OK with `data: []` and total items 0.

#### User Story US-4.2: Master Catalog Seeder & Administration
* **As a** system operator,  
  **I want** the database pre-seeded with at least 30 real-world botanical species,  
  **So that** users have immediate access to comprehensive care reference data.
* **Acceptance Criteria:**
  - [ ] Seeder script populates $\ge 30$ species spanning Vegetables, Herbs, Fruits, and Companion Flowers.
  - [ ] Each species contains complete care parameters, JSON calendar arrays, and companion planting arrays.
  - [ ] Mutation endpoints (`POST /api/catalog`, `PUT`, `DELETE`) require `user.is_admin === true`; unauthorized users receive HTTP 403 Forbidden.

---

### 5.5 Feature 5: Zone Plant Inventory

#### User Story US-5.1: Assign Plants to Zones & Lifecycle Tracking
* **As a** gardener,  
  **I want to** record crops planted in my zones with quantities and planting dates,  
  **So that** I can track crop growth and anticipate harvest dates.
* **Acceptance Criteria:**
  - [ ] `POST /api/zones/:zoneId/plants` accepts `{ plant_catalog_id, custom_nickname, quantity, planted_date, expected_harvest_date, status }`.
  - [ ] Validates `quantity >= 1` and `planted_date` is a valid ISO date.
  - [ ] Rejects non-existent `plant_catalog_id` with HTTP 404 / 400 Bad Request.
  - [ ] `GET /api/zones/:zoneId/plants` returns active crops joined with catalog care data.
  - [ ] `PUT /api/zones/:zoneId/plants/:plantId` allows updating nickname, quantity, health status, and lifecycle state (`SEEDLING`, `GROWING`, `HARVEST_READY`, `HARVESTED`, `DEAD`).
  - [ ] `DELETE /api/zones/:zoneId/plants/:plantId` removes crop record from zone inventory.

#### User Story US-5.2: Zone Density & Overcrowding Detection
* **As a** gardener,  
  **I want** the system to alert me if I add too many plants to a zone,  
  **So that** I avoid overcrowding that stunts growth and fosters fungal disease.
* **Acceptance Criteria:**
  - [ ] System computes occupied plant footprint: $\text{Area} = \text{quantity} \times \frac{\text{spacing\_cm} \times \text{row\_spacing\_cm}}{10000} \text{ m}^2$.
  - [ ] Compares sum of all plant footprints in the zone against `zones.area_sq_m`.
  - [ ] When $\text{Utilization Ratio} > 1.0$, the API response includes warning metadata `{ warning: 'ZONE_OVERCROWDED', utilizationRatio: 1.35 }`.
  - [ ] Non-blocking behavior: Record is successfully created/updated, but UI displays an amber advisory warning card.

---

## 6. Non-Functional Requirements (NFRs)

### NFR-1: Security & Cryptographic Standards
* **NFR-1.1 Password Security:** Passwords must be hashed using `bcrypt` with cost factor 10. Passwords must never be stored, logged, or returned in API responses.
* **NFR-1.2 Token Cryptography:** Password reset tokens and invitation tokens must be generated using cryptographically strong pseudo-random bytes (`crypto.randomBytes(32)`). Only SHA-256 hashes must be stored in database tables.
* **NFR-1.3 Device Authentication:** IoT devices must authenticate using raw keys formatted as `sg_live_<hex>`. MariaDB must store only `key_prefix` (16 chars) and `key_hash` (SHA-256). Lookups must use indexed prefixes followed by constant-time hash comparisons.
* **NFR-1.4 Stateless Sessions:** User authentication must utilize HMAC-SHA256 JWT tokens with a strict 7-day TTL and claims validation (`id`, `email`, `is_admin`).
* **NFR-1.5 SQL & Injection Defense:** All database queries must be executed via Sequelize parameterized models or prepared statements. Input bodies must be validated against JSON schemas using Fastify's native Ajv engine.

### NFR-2: Performance & Latency Targets
* **NFR-2.1 REST API Latency:** Under standard local/container operating conditions, 95% of standard CRUD API requests (Auth, Gardens, Zones, Catalog, Plants) must respond in under 100 ms.
* **NFR-2.2 Telemetry Ingestion Throughput:** The `POST /api/sensors/ingest` endpoint must process, validate, and persist telemetry in under 50 ms per request.
* **NFR-2.3 Real-Time WebSocket Latency:** Ingested sensor readings must be broadcast to connected WebSocket subscribers within 100 ms of receipt.
* **NFR-2.4 Rate Limiting:** Global rate limiting must throttle clients exceeding 100 requests per minute per IP, and IoT telemetry ingestion must throttle devices exceeding 60 requests per minute per device key.

### NFR-3: Data Retention & Scalability
* **NFR-3.1 High-Frequency Retention:** Raw sensor readings in `sensor_readings` must be retained for 30 days.
* **NFR-3.2 Automated Downsampling:** A daily cron job at 01:00 UTC must compute summary metrics (min, max, avg, count) into `sensor_aggregates_daily` before purging raw readings older than 30 days.
* **NFR-3.3 Weather Caching:** Weather forecast queries must be cached in `weather_cache` with a 30-minute TTL, bounding external API consumption regardless of garden density.

### NFR-4: Availability, Reliability & Offline Resilience
* **NFR-4.1 Third-Party Graceful Degradation:** Failures or rate limits from external APIs (Weather, Vision AI, SMTP) must not crash backend services. Fallback adapters (e.g., cached weather, mock SMTP loggers) must maintain application availability.
* **NFR-4.2 Test Determinism:** Unit and integration test suites must execute deterministically without requiring live internet connectivity or external credentials by leveraging in-memory SQLite or mock adapters.
* **NFR-4.3 Relational Cascades:** Deleting root entities (such as a Garden) must leverage MariaDB InnoDB foreign key cascading (`ON DELETE CASCADE`) to prevent orphaned rows across all 21 entities.

### NFR-5: Technology Stack & Architectural Compliance
* **NFR-5.1 Pure JavaScript Standard:** All application source code across backend and frontend must use plain JavaScript (`.js`). No TypeScript or extraneous transpilation layers.
* **NFR-5.2 Stack Constraints:** Strict adherence to Node.js v20 LTS, Fastify, Sequelize ORM, Vue 3 SPA with Vite, and MariaDB 10.11 in Docker. No Express, MongoDB, or React dependencies.
* **NFR-5.3 Clean Monorepo Scaffold:** Workspaces configured via root `package.json` coordinating `backend/` and `frontend/` services with unified development scripts.

---

## 7. Verification & Traceability Matrix

| Requirement ID | Module / Feature | Verification Method | Acceptance Artifact |
| :--- | :--- | :--- | :--- |
| **REQ-F1-01** | User Registration & Bcrypt | Automated Integration Test (`test/integration/auth.test.js`) | HTTP 201 + Bcrypt hash verified in DB |
| **REQ-F1-02** | User Login & JWT Issuance | Automated Integration Test (`test/integration/auth.test.js`) | HTTP 200 + Valid JWT payload decoded |
| **REQ-F1-03** | Password Reset Hash & TTL | Automated Integration Test (`test/integration/auth.test.js`) | Token marked used; expired token rejected |
| **REQ-F2-01** | Garden RBAC Role Guard | Automated Integration Test (`test/integration/rbacResolver.test.js`) | OWNER allowed; GUEST mutation rejected (403) |
| **REQ-F2-02** | Resource-to-Garden Resolver | Automated Integration Test (`test/integration/rbacResolver.test.js`) | Zone/Plant ID resolved to parent garden |
| **REQ-F2-03** | Garden Invitation Lifecycle | Automated Integration Test (`test/integration/invitations.test.js`) | Token created, accepted, member added |
| **REQ-F3-01** | Garden CRUD + IANA Timezone | Automated Integration Test (`test/integration/gardensZones.test.js`) | Timezone persisted; invalid string rejected |
| **REQ-F3-02** | Zone CRUD + Outdoor Flag | Automated Integration Test (`test/integration/gardensZones.test.js`) | `is_outdoor` persisted; sunlight enums validated |
| **REQ-F4-01** | Plant Catalog Query & Filter | Automated Integration Test (`test/integration/plantCatalog.test.js`) | Substring search, sunlight filter, pagination |
| **REQ-F4-02** | Reference Catalog 30+ Seeds | Database Verification Script (`npm run seed`) | MariaDB `COUNT(*) FROM plant_catalog >= 30` |
| **REQ-F5-01** | Zone Plant Inventory CRUD | Automated Integration Test (`test/integration/zonePlants.test.js`) | Crop record created, status updated, deleted |
| **REQ-F5-02** | Overcrowding Warning Engine | Automated Unit Test (`test/unit/densityCalculator.test.js`) | Area formula verified; warning flag emitted |
