# Changelog

All notable changes to the SmartGarden project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Sprint 4 (`sprint4`):** Growth Journal & Photo Timeline (`F16`), Analytics & PDF/CSV Export (`F17`), AI Leaf Disease Diagnosis (`F18`), AI Gardening Assistant (`F19`), Community Hub & Moderation (`F20`).
- **Sprint 5 (`sprint5`):** Multi-Channel Notifications (`F21`), Water & Sustainability Metrics (`F22`), Seed Vault (`F23`), Public Profiles & Scoped API Keys (`F24`), all 7 public pages + `/dashboard/help`, ORM upgrade, security headers/rate limiting, PWA, CI, MQTT, i18n, and ESP32 reference firmware.

## [3.0.0] - 2026-11-25 (`sprint3`)

### Added
- **F11 Weather-Aware Planning & Spatial Cache:** `WeatherCache` model, `weatherService.js` (extensible `WEATHER_API_PROVIDER` defaulting to Open-Meteo with deterministic offline fallback, negative-zero normalized `grid_key`, 30m spatial cache, single-flight coalescing, hazard detection, outdoor 24h rain-skip with indoor exemption), `/api/weather`, `/api/gardens/:id/weather`, `/api/gardens/:id/weather/rain-skip`, `POST /api/jobs/weather-watchdog`, 6-hour cron schedule, F10 `ruleEngineService.rainLikely` integration, and `WeatherView.vue`.
- **F12 Seasonal Planting Calendar:** `calendarService.js` (+6m Southern Hemisphere shift, indoor seed-start derivation, RFC 5545 `.ics` export), `/api/calendar`, `/api/calendar/export.ics`, and `CalendarView.vue`.
- **F13 Personalized Care Plan Generator:** `carePlanService.js` (soil & sunlight multipliers, recommended water liters, idempotent `CARE_PLAN` task generation), `/api/zones/:zoneId/care-plans/*`, and `CarePlansView.vue`.
- **F14 Plant Recommendation Engine:** `recommendationService.js` (100-point 5-factor compatibility scorer), `/api/zones/:zoneId/recommendations`, and `RecommendationsView.vue`.
- **F15 Companion Planting Advisor:** `companionService.js` (group alias matching, $N \times N$ compatibility matrix, What-If candidate simulator), `/api/zones/:zoneId/companions*`, and `CompanionsView.vue`.
- **Tests & Tooling:** `backend/tests/sprint3_f11_f15.test.js` (7 tests, `117/117` total backend passing), `frontend/tests/e2e/sprint3-f11-f15.test.js` (5 tests, `28/28` total E2E passing), and `frontend/src/stores/horticulture.js`.

### Changed
- Updated `frontend/src/config/features.js` (`F11`–`F15` live -> `15 Live / 9 Soon`), `frontend/src/router/index.js`, `frontend/src/stores/gardens.js` (`fetchZones`), `LandingView.vue`, `OverviewView.vue`, and `backend/scripts/seed-demo.js` (idempotent Sprint 3 demo weather cache & care-plan task).

## [2.0.0] - 2026-11-24 (`sprint2`)

### Added
- **F6 Recurring Care Tasks & Water Logging:** `CareTask` & `WaterUsageLog` models/services/routes (`/api/gardens/:gardenId/tasks`, `/api/zones/:zoneId/tasks`, `/api/gardens/:gardenId/water-logs`, `/api/zones/:zoneId/water-logs`), timezone-aware recurring task auto-rescheduling, `CareTasksView.vue`, `tasks.js` Pinia store, and `ZonePlantsView.vue` `Care Tasks` tab.
- **F7 IoT Sensor Ingestion, Device Management & Watchdog:** `Device`, `SensorReading`, `SensorAggregateDaily`, `DeviceWatchdogAlert` models/routes, `verifyDeviceKey` middleware, `ingestService.js` clock-skew normalization and bounds validation, `sensorSimulator.js` CLI (`npm run simulate`), 30-minute offline device watchdog, `SensorsView.vue`, `TelemetryChart.vue`, `sensors.js` store, `GardenDetailView.vue` `Devices` tab, and `ZonePlantsView.vue` `Live Telemetry` tab.
- **F8 Real-Time Live WebSocket Dashboard:** `eventBus.js`, `@fastify/websocket` transport (`/ws/gardens/:gardenId`), SSE fallback (`/api/gardens/:gardenId/stream`), `frontend/src/services/realtime.js` backoff + REST reconciliation, and live badges/widgets in `OverviewView.vue`, `GardenDetailView.vue`, and `SensorsView.vue`.
- **F9 Smart Threshold Alerts & Quiet Hours:** `AlertConfig` & `AlertLog` models/services/routes, Nodemailer SMTP `emailService.js` with console-log fallback, IANA midnight-crossing quiet hours suppression, `AlertBellButton.vue`, `AlertsView.vue`, and `alerts.js` store.
- **F10 Automation Rule Engine & Scheduler:** `AutomationRule` model/routes, `ruleEngineService.js` with 3-layer deduplication (open-task check before atomic SQL cap increment), `node-cron` scheduler (`backend/jobs/scheduler.js`), `/api/jobs/{evaluate-rules,device-watchdog}` endpoints, `AutomationsView.vue`, and `rules.js` store.
- **Schema, Tooling & Verification:** Additive multi-dialect migration `022_sprint2_schema_extensions.js`, `backend/utils/dbHelpers.js`, tracked pure-JS `backend/vendor/` mirror, `SPRINT_TRACKER.md`, `CHANGELOG.md`, `scripts/git-deliver-sprints.ps1`, `frontend/tests/e2e/sprint2-f6-f10.test.js`, and `frontend/tests/integration/f6-f10-fullstack.test.mjs`.

### Changed
- Renumbered `frontend/src/config/features.js` to authoritative `F1`–`F24` (`10` live, `14` soon) + `PUBLIC_COMING_SOON_PAGES` (`7`).
- Extended `backend/middleware/rbac.js` with zone-level RBAC and IDOR protections and updated `backend/server.js` dual-prefix routing and CORS headers (`X-Device-Key`, `X-Cron-Secret`).
- Extended `backend/scripts/seed-demo.js` idempotently with Sprint 2 demo devices, 24h readings, 7d aggregates, care tasks, water logs, alert configs/logs, and automation rules.
- Updated `.env.example` with `VITE_WS_BASE_URL`, `VITE_REALTIME_TRANSPORT`, `VITE_SUPABASE_URL`, `SIMULATOR_*`, and commented DB URI aliases.
- Updated `frontend/tests/helpers/server-harness.js` (WebSocket `upgrade` proxy, SSE abort handling, SQLite `:memory:`/`CRON_SECRET` defaults, F6–F10 cleanup), `cdp-browser.js` (`time` input support), `run-e2e.js`, and Sprint 1 E2E specs to reflect `F1`–`F24` and live Sprint 2 views.
- Committed pre-Sprint-2 `Document/*.md` v1.2 specification updates and `vercel.json` alignment prior to Sprint 2 implementation commit.

### Security
- Enforced timing-safe SHA-256 `sg_live_` device API key hashing/verification (`verifyDeviceKey.js`) and timing-safe `CRON_SECRET` verification (`routes/jobs.js`).
- Enforced WebSocket close codes `4001` (invalid JWT) and `4003` (unauthorized/expired garden membership) and `OWNER`-only `PUT /api/zones/:zoneId/alerts/config`.

## [1.0.0] - 2026-11-23 (`sprint1` / `main`)

### Added
- Initial SmartGarden full-stack release implementing `F1`–`F5`: authentication & password recovery, collaboration & RBAC, gardens & microclimate zones, 32-species botanical plant catalog, zone crop inventory with spatial utilization & companion analysis, public pages, and Sprint 1 unit/E2E test suites.
