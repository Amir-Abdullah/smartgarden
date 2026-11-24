# SmartGarden — Sprint Progress & Resumable Checkpoint Tracker (R6)

> **Purpose:** Version-controlled, resumable source of truth across Sprints 2–5 (`F6`–`F24`, public pages, and hardening). Updated after every completed milestone, verification run, and branch checkpoint.

## 1. Resume Header & Active Checkpoint

- **Active Sprint:** Sprint 3 (`sprint3` branch) — Horticultural Intelligence (`F11`–`F15`)
- **Base Branch / Commit:** `sprint2` -> `sprint3` (chained from `main` @ `7653b4fd55c2fde36182d17daa9c9f0d629f07d3`)
- **Status:** `VERIFIED_READY_FOR_PUSH` (Sprint 2 + Sprint 3 code, unit/integration tests `117/117`, Chrome CDP E2E `28/28`, Vite build `994` modules, and migration/seed idempotency `0` Run 2 mutations all passed in `BypassSandbox: false`; ready for Sprint 4 `F16`–`F20`)
- **Next Action on Resume:** Branch & push `sprint2`/`sprint3` (leaving `main` untouched until all manual human testing completes), then start **Sprint 4 (`F16`–`F20`)**.

---

## 2. Git Branch & Commit Checkpoints

> **Delivery Rule (R1):** Sprint branches chain sequentially (`main` -> `sprint2` -> `sprint3` -> `sprint4` -> `sprint5`), are pushed to `origin`, and are **NEVER merged into `main`** automatically.

| Branch | Parent | Base / Tip SHA | Push Status | Merged to `main`? | Scope |
|---|---|---|---|---|---|
| `main` | — | `7653b4fd55c2fde36182d17daa9c9f0d629f07d3` | Pushed (`origin/main`) | — | Sprint 1 foundation baseline |
| `sprint1` | `main` | `7653b4fd55c2fde36182d17daa9c9f0d629f07d3` | Pushed (`origin/sprint1`) | No | Sprint 1 archive branch |
| `sprint2` | `main` | Staged via `scripts/git-deliver-sprints.ps1` | Verified & ready (`-DryRun` PASS) | **No** | Pre-Sprint-2 docs (`Document/*.md` + `vercel.json`), F6–F10, `S2-X`, `R6` |
| `sprint3` | `sprint2` | Verified working tree | Verified & ready (`BypassSandbox: false` PASS) | **No** | F11–F15 Horticultural Intelligence (`117/117` backend, `28/28` E2E) |
| `sprint4` | `sprint3` | `pending` | Pending | **No** | F16–F20 Media, Analytics, AI & Community |
| `sprint5` | `sprint4` | `pending` | Pending | **No** | F21–F24, `PUB-7` public pages & hardening |

---

## 3. Completed Work

### Sprint 1 — Foundation (`F1`–`F5`)
- [x] **F1 Accounts & Security:** JWT auth, bcrypt hashing, password reset tokens, `User`/`PasswordResetToken` models, `LoginView`, `RegisterView`, `ForgotPasswordView`, `ResetPasswordView`, `OAuthCallbackView`, `SettingsView`.
- [x] **F2 Collaboration & RBAC:** `OWNER`, `FAMILY`, `GUEST`, `ADMIN` roles, tokenized garden invitations, sole-owner safeguards (`backend/middleware/rbac.js`, `GardenMember`, `GardenInvitation`, `InviteAcceptView`).
- [x] **F3 Gardens & Microclimate Zones:** Multi-plot garden & zone CRUD with coordinates, IANA timezones, soil/sunlight/zone enums (`GardensView`, `GardenDetailView`).
- [x] **F4 Botanical Plant Catalog:** 32+ seeded species with moisture/temp bounds, spacing, and companion lists (`PlantCatalogView`).
- [x] **F5 Zone Crop Inventory:** Bed capacity utilization (`ZONE_OVERCROWDED` warnings) and companion synergy/conflict analysis (`ZonePlantsView`).

### Sprint 2 — Live Operations, Telemetry & Automation (`F6`–`F10`, `S2-X`, `R6`)
- [x] **F6 Recurring Care Tasks & Water Logging:**
  - Backend: `backend/services/taskService.js`, `backend/routes/tasks.js` (garden & zone task CRUD, timezone-aware `next_scheduled_task_id` auto-rescheduling, `WaterUsageLog` creation on `WATER` completion and standalone logs), `CareTask` & `WaterUsageLog` models.
  - Frontend: `frontend/src/stores/tasks.js`, `frontend/src/views/dashboard/CareTasksView.vue`, `ZonePlantsView.vue` `Care Tasks` tab.
- [x] **F7 Sensor Ingestion, Device Mgmt & Watchdog:**
  - Backend: `backend/middleware/verifyDeviceKey.js` (timing-safe SHA-256 `sg_live_` verification), `backend/services/ingestService.js` (clock-skew normalization, out-of-range `METRIC_OUT_OF_RANGE` `400` validation), `backend/routes/devices.js`, `backend/routes/sensors.js`, `backend/simulator/sensorSimulator.js`, `Device`/`SensorReading`/`SensorAggregateDaily`/`DeviceWatchdogAlert` models, 30-minute offline watchdog in `backend/jobs/scheduler.js`.
  - Frontend: `frontend/src/stores/sensors.js`, `frontend/src/views/dashboard/SensorsView.vue` (one-time `sg_live_` key banner, claim, rotate, revoke), `frontend/src/components/charts/TelemetryChart.vue`, `ZonePlantsView.vue` `Live Telemetry` tab, `GardenDetailView.vue` `Devices` tab.
- [x] **F8 Real-Time Live WebSocket Dashboard:**
  - Backend: `backend/services/eventBus.js`, `backend/realtime/wsTransport.js` (`/ws/gardens/:gardenId?token=` with `4001`/`4003` close codes & ping/pong heartbeat), `backend/realtime/sseTransport.js` (`/api/gardens/:gardenId/stream` SSE fallback with disconnect cleanup).
  - Frontend: `frontend/src/services/realtime.js` (exponential backoff, `4001`/`4003` stop, automatic SSE fallback after 2 pre-open WS failures, REST reconciliation), live updates in `OverviewView.vue`, `GardenDetailView.vue`, `SensorsView.vue`.
- [x] **F9 Smart Threshold Alerts & Quiet Hours:**
  - Backend: `backend/services/alertService.js`, `backend/services/emailService.js` (Nodemailer SMTP with console-log fallback), `backend/routes/alerts.js` (`OWNER`-only config updates, severity ranking, cooldowns, IANA midnight-crossing quiet hours suppression), `AlertConfig` & `AlertLog` models.
  - Frontend: `frontend/src/stores/alerts.js`, `frontend/src/components/AlertBellButton.vue`, `frontend/src/views/dashboard/AlertsView.vue`.
- [x] **F10 Automation Rule Engine & Scheduler:**
  - Backend: `backend/services/ruleEngineService.js` (3-layer deduplication: cooldown/local-date cap guard -> `hasOpenTask` BEFORE atomic SQL increment -> conditional atomic `executions_today` update), `backend/routes/rules.js`, `backend/routes/jobs.js` (`X-Cron-Secret`), `backend/jobs/scheduler.js` (`node-cron`), `AutomationRule` model.
  - Frontend: `frontend/src/stores/rules.js`, `frontend/src/views/dashboard/AutomationsView.vue`.
- [x] **S2-X Sprint 2 Cross-Cutting:**
  - Additive dialect-safe migration `backend/migrations/022_sprint2_schema_extensions.js` + `backend/utils/dbHelpers.js`.
  - `frontend/src/config/features.js` renumbered to authoritative `F1`–`F24` (`10 Live`, `14 Soon`) + `PUBLIC_COMING_SOON_PAGES` (`7`).
  - `backend/middleware/rbac.js` zone/garden scoping + `backend/server.js` CORS (`X-Device-Key`, `X-Cron-Secret`) & dual-prefix WS/SSE/API routing.
  - `backend/scripts/seed-demo.js` strictly additive, idempotent Sprint 2 demo dataset (`SG-DEMO-BED-01`, `SG-DEMO-GH-01`, `SG-DEMO-HYD-01`, tasks, water logs, alert configs/logs, automation rules).
  - Tracked pure-JS vendor parity (`backend/vendor/` mirrored to `node_modules/`).
  - Updated E2E harness/specs (`server-harness.js` WS upgrade proxy & SSE abort, `cdp-browser.js` `time` input, `public-pages.test.js`, `dashboard-f1-f5.test.js`, `coming-soon-and-edges.test.js`, new `sprint2-f6-f10.test.js`) + fast in-process integration suite (`frontend/tests/integration/f6-f10-fullstack.test.mjs`).
- [x] **R6 Tracker, Changelog & Delivery Automation:**
  - `SPRINT_TRACKER.md`, `CHANGELOG.md`, updated `.env.example`, `scripts/git-deliver-sprints.ps1`.

### Sprint 3 — Horticultural Intelligence (`F11`–`F15`)
- [x] **F11 Weather-Aware Planning & Spatial Cache:**
  - Backend: `backend/models/WeatherCache.js`, `backend/services/weatherService.js` (Open-Meteo adapter via `WEATHER_API_PROVIDER` + `registerWeatherProvider`, deterministic offline fallback, negative-zero normalized `grid_key`, 30m `weather_cache`, single-flight coalescing, frost/heatwave/high-wind/rain hazard analytics, outdoor 24h rain-skip with indoor exemption), `backend/routes/weather.js`, F10 `ruleEngineService.rainLikely` wiring, 6-hour `runSevereWeatherWatchdog` in `scheduler.js` + `POST /api/jobs/weather-watchdog`.
  - Frontend: `frontend/src/stores/horticulture.js`, `frontend/src/views/dashboard/WeatherView.vue`.
- [x] **F12 Seasonal Planting Calendar & `.ics` Export:**
  - Backend: `backend/services/calendarService.js` (+6 month Southern Hemisphere shift, indoor seed-start derivation, RFC 5545 `text/calendar` `.ics` export), `backend/routes/calendar.js`.
  - Frontend: `frontend/src/views/dashboard/CalendarView.vue` (preserves `?feature=F23` Seed Vault `ComingSoonView` alias).
- [x] **F13 Personalized Care Plan Generator:**
  - Backend: `backend/services/carePlanService.js` (soil drainage & sunlight multipliers, recommended water liters, idempotent `CARE_PLAN` task generation), `backend/routes/carePlans.js`.
  - Frontend: `frontend/src/views/dashboard/CarePlansView.vue`.
- [x] **F14 Plant Recommendation Engine:**
  - Backend: `backend/services/recommendationService.js` (100-point 5-factor scorer across Sunlight 35, Season 25, Soil 15, Free Bed Area 15, Companion Guild 10), `backend/routes/recommendations.js`.
  - Frontend: `frontend/src/views/dashboard/RecommendationsView.vue` (5-factor cards + 1-click Add to Zone).
- [x] **F15 Companion Planting Advisor:**
  - Backend: `backend/services/companionService.js` (botanical group alias resolution e.g. `Brassicas`/`Alliums`/`Aromatic Herbs`, $N \times N$ compatibility matrix, What-If candidate simulation), `backend/routes/companions.js`.
  - Frontend: `frontend/src/views/dashboard/CompanionsView.vue`.
- [x] **S3-X Sprint 3 Cross-Cutting:**
  - Registered F11–F15 routes in `backend/server.js`, added idempotent Sprint 3 demo weather cache & `CARE_PLAN` task to `backend/scripts/seed-demo.js`.
  - Updated `frontend/src/config/features.js` (`F1`–`F15` live, `15 Live / 9 Soon`), `frontend/src/router/index.js`, `frontend/src/stores/gardens.js` (`fetchZones`), `LandingView.vue`, and `OverviewView.vue`.

---

## 4. Verification Outcomes Log

| Component / Gate | Command | Result | Notes |
|---|---|---|---|
| Sprint 3 Backend Suite | `npm test` | **PASS** (`117/117` across `29` suites) | Includes new `backend/tests/sprint3_f11_f15.test.js` on SQLite `:memory:` |
| M1-C In-Process Full-Stack Integration | `node --test --test-reporter=spec frontend/tests/integration/f6-f10-fullstack.test.mjs` | **PASS** (`5/5` journeys) | Real Pinia + Vue Router + `app.inject` / `app.injectWs` |
| Sprint 3 Frontend Build | `npm --prefix frontend run build` | **PASS** (`0` errors, `994` modules) | Vite production bundle |
| Sprint 3 Migrate & Seed Idempotency | `migrate.js` x2 & `seed-demo.js` x2 on fresh temp SQLite | **PASS** (`22` migrations, `0` Run 2 mutations) | Includes `sprint3` `weatherCacheEntries` & `carePlanTasks` |
| Sprint 3 Chrome CDP E2E Suite | `$env:DB_DIALECT='sqlite'; $env:DB_STORAGE=':memory:'; npm --prefix frontend run test:e2e` | **PASS** (`28/28` across `6` suites) | Covers `auth-flows` (`2`), `coming-soon-and-edges` (`3`), `dashboard-f1-f5` (`7`), `public-pages` (`5`), `sprint2-f6-f10` (`6`), `sprint3-f11-f15` (`5`) |
| M1-C Vendor Parity | SHA-256 check `backend/vendor/` vs `node_modules/` | **PASS** (`14/14` matched) | Pure-JS modules |

---

## 5. Fallback, Environment & Vendor Setup Notes

1. **CRITICAL — Do NOT run `npm install` from the npm registry:**
   - `node_modules/{fastify,@fastify/cors,@fastify/jwt,@fastify/websocket,node-cron,nodemailer,sequelize}` are custom zero-dependency pure-JS implementations mirrored in tracked `backend/vendor/`.
   - On a fresh clone (where `node_modules/` is gitignored), restore them from `backend/vendor/` rather than overwriting them from npm until Sprint 5 (`S5-ORM`) upgrades ORM/package consistency.
2. **Database & Sequelize Shim Constraints:**
   - Automated tests default to `DB_DIALECT=sqlite` and `DB_STORAGE=:memory:`. Without `DB_STRICT_DIALECT=true`, unreachable remote Postgres falls back to local `backend/smartgarden.sqlite`.
   - The current `sequelize` shim returns `{ changes, rowCount, rows }` from `sequelize.query()`, lacks `QueryInterface.addColumn` / `Model.upsert` / `Op.iLike` / `Op.between` / `Op.notIn`, and ignores nested `where` inside `include`. Use `backend/utils/dbHelpers.js` and strictly additive `022+` migrations until Sprint 5 (`S5-ORM`).
3. **SMTP Email Alerts (`F9`):**
   - Leaving `SMTP_HOST` empty activates `EmailService:ConsoleFallback` (logs full alert email payload cleanly to stdout). Setting `SMTP_HOST` (+ optional `SMTP_USER`/`SMTP_PASS`) enables real Nodemailer SMTP transport.
4. **Realtime Transport (`F8`) & Cron Jobs (`F10`/`F7`):**
   - Primary transport is WebSocket (`/ws/gardens/:gardenId?token=`); frontend `realtime.js` automatically falls back to SSE (`/api/gardens/:gardenId/stream?token=`) after 2 pre-open WS failures or when `VITE_REALTIME_TRANSPORT=sse`.
   - Background cron jobs run automatically when `ENABLE_SCHEDULER=true`, or can be triggered explicitly via `POST /api/jobs/evaluate-rules` and `POST /api/jobs/device-watchdog` with header `X-Cron-Secret: <CRON_SECRET>`.

---

## 6. Remaining Work (Sprints 4–5)

- **Sprint 4 (`sprint4` from `sprint3`) — F16–F20 Media, Analytics, AI & Community:**
  - `F16` Growth Journal & Photo Timeline (`@fastify/multipart`, `sharp`, Cloudflare R2 S3 adapter + `media_assets` DB/local fallback, `JournalView.vue`).
  - `F17` Analytics & Data Export (01:00 UTC daily rollup + 30-day purge, `pdfkit` PDF + `json2csv` CSV export, `AnalyticsView.vue`).
  - `F18` AI Leaf Disease & Pest Diagnosis (`POST /api/ai/diagnose-leaf`, Gemini Vision adapter + deterministic offline fallback, `AiDiagnosisView.vue`).
  - `F19` AI Gardening Assistant (`POST /api/ai/chat`, context-grounded Gemini adapter + deterministic fallback, `AiAssistantView.vue`).
  - `F20` Community Hub, Social Feed & Moderation (`CommunityView.vue`).
- **Sprint 5 (`sprint5` from `sprint4`) — F21–F24, Public Pages & Hardening:**
  - `F21` Multi-Channel Notifications, `F22` Water & Sustainability Metrics, `F23` Seed Vault & Germination Logs, `F24` Public Profiles & Scoped API Keys (`sg_pat_`).
  - `PUB-7`: Replace all 7 `PUBLIC_COMING_SOON_PAGES` + `/dashboard/help` `ComingSoonView` placeholders with real views.
  - `S5-ORM`, `S5-SEC` (`@fastify/helmet`, `@fastify/rate-limit`, security matrix audit), `S5-PWA`, `S5-QA` (CI workflow, DB index audit, expanded E2E), `S5-EXT` (MQTT bridge, Vue i18n, ESP32-S3 firmware sketch).
