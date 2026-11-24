# SmartGarden — Sprint Progress & Resumable Checkpoint Tracker (R6)

> **Purpose:** Version-controlled, resumable source of truth across Sprints 2–5 (`F6`–`F24`, public pages, and hardening). Updated after every completed milestone, verification run, and branch checkpoint.

## 1. Resume Header & Active Checkpoint

- **Active Sprint:** Sprint 5 (`sprint5` branch) — Notifications, Sustainability, Seed Vault, Developer API, Three.js 3D Visualizations, Public Pages & Hardening (`F21`–`F24`, `PUB-7`, `3D`)
- **Base Branch / Commit:** `main` (`7653b4fd`) -> `sprint2` (`f983e0e`) -> `sprint3` (`36a3f44`) -> `sprint4` (`b1b7abd`) -> `sprint5`
- **Status:** `VERIFIED_READY_FOR_PUSH` (Backend `127/127` across `31` suites, Chrome CDP E2E `38/38` across `8` suites, Vite build `1018` modules with split `three` chunk, migration/seed idempotency `24` migrations / `31` tables / `0` Run 2 mutations, and vendor parity `14/14` matched all passed in `BypassSandbox: false`)
- **Next Action on Resume:** Push `sprint5` to `origin/sprint5` (never merging into `main`), then begin manual human testing sequentially from `sprint2` -> `sprint3` -> `sprint4` -> `sprint5` and wire production credentials (Cloudflare R2, Gemini API key, SMTP, hosting) before merging tested branches into `main`.

---

## 2. Git Branch & Commit Checkpoints

> **Delivery Rule (R1):** Sprint branches chain sequentially (`main` -> `sprint2` -> `sprint3` -> `sprint4` -> `sprint5`), are pushed to `origin`, and are **NEVER merged into `main`** automatically.

| Branch | Parent | Base / Tip SHA | Push Status | Merged to `main`? | Scope |
|---|---|---|---|---|---|
| `main` | — | `7653b4fd55c2fde36182d17daa9c9f0d629f07d3` | Pushed (`origin/main`) | — | Sprint 1 foundation baseline |
| `sprint1` | `main` | `7653b4fd55c2fde36182d17daa9c9f0d629f07d3` | Pushed (`origin/sprint1`) | No | Sprint 1 archive branch |
| `sprint2` | `main` | `23f77c6` + `f983e0e` | Pushed (`origin/sprint2`) | **No** | Pre-Sprint-2 docs (`Document/*.md` + `vercel.json`), F6–F10, `S2-X`, `R6` |
| `sprint3` | `sprint2` | `36a3f44` | Pushed (`origin/sprint3`) | **No** | F11–F15 Horticultural Intelligence (`117/117` backend, `28/28` E2E) |
| `sprint4` | `sprint3` | `b1b7abd` | Pushed (`origin/sprint4`) | **No** | F16–F20 Media, Analytics, AI & Community (`122/122` backend, `33/33` E2E) |
| `sprint5` | `sprint4` | Prepared via `scripts/git-deliver-sprints.ps1 -Sprint sprint5` | Ready to push (`origin/sprint5`) | **No** | F21–F24, Three.js 3D visualizations, `PUB-7` public pages & hardening (`127/127` backend, `38/38` E2E) |

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

### Sprint 4 — Media, Analytics, AI & Community (`F16`–`F20`)
- [x] **S4-INFRA Schema, Binary/Multipart & Storage:**
  - Additive migration `backend/migrations/023_sprint4_media_and_likes.js` (`media_assets`, `community_post_likes`).
  - 6 Sequelize models (`GrowthJournal`, `CommunityPost`, `CommunityComment`, `UserFollow`, `MediaAsset`, `CommunityPostLike`) wired in `backend/models/index.js`.
  - Updated `node_modules/fastify/index.js` + `backend/vendor/fastify/index.js` for raw binary `Buffer` multipart parsing & `rawPayload` responses, plus pure-JS `backend/utils/{multipartParser,csvGenerator,pdfGenerator}.js` and `backend/services/storageService.js` (Cloudflare R2 SigV4 adapter + DB `media_assets` fallback).
- [x] **F16 Growth Journal & Photo Timeline:**
  - Backend: `backend/services/journalService.js`, `backend/routes/journal.js` (`GET/POST/PUT/DELETE /api/plants/:id/journal`, `GET /api/gardens/:id/journal`, public `GET /api/media/:key`).
  - Frontend: `frontend/src/views/dashboard/JournalView.vue` & live `GardenDetailView.vue` `Activity` tab.
- [x] **F17 Analytics & Data Export:**
  - Backend: `backend/services/analyticsService.js` (`runDailyTelemetryRollup` + >30d pruning, `getGardenAnalytics`, CSV & PDF-1.4 exports), `backend/routes/analytics.js`, 01:00 UTC cron schedule in `backend/jobs/scheduler.js`, `POST /api/jobs/telemetry-rollup` in `backend/routes/jobs.js`.
  - Frontend: `frontend/src/views/dashboard/AnalyticsView.vue` (preserves `?feature=F22` `ComingSoonView` alias).
- [x] **F18 AI Leaf Disease & Pest Diagnosis:**
  - Backend: `POST /api/ai/diagnose-leaf` in `backend/services/aiService.js` & `backend/routes/ai.js` (Gemini Vision adapter + structured deterministic fallback when `GEMINI_API_KEY` is unset).
  - Frontend: `frontend/src/views/dashboard/AiDiagnosisView.vue`.
- [x] **F19 AI Gardening Assistant:**
  - Backend: `POST /api/ai/chat` in `backend/services/aiService.js` & `backend/routes/ai.js` (live garden/zone/crop/sensor/alert context injection, RBAC garden guard, per-user rate limit `429`, deterministic agronomy fallback).
  - Frontend: `frontend/src/views/dashboard/AiAssistantView.vue`.
- [x] **F20 Community Hub, Social Feed & Moderation:**
  - Backend: `backend/services/communityService.js`, `backend/routes/community.js` (paginated/filtered feed, toggleable likes, threaded comments, user follow/unfollow blocking `CANNOT_FOLLOW_SELF`, admin pin/flag & comment deletion).
  - Frontend: `frontend/src/views/dashboard/CommunityView.vue`.
- [x] **S4-X Sprint 4 Cross-Cutting:**
  - Registered Sprint 4 routes in `backend/server.js`, added `ensureSprint4DemoData` (`Maya Lin`, 3 tomato journal entries, 5d aggregates, 3 community posts, 2 threaded comments) to `backend/scripts/seed-demo.js`.
  - Updated `frontend/src/services/api.js` (FormData boundary preservation), `frontend/src/config/features.js` (`20 Live / 4 Soon`), `frontend/src/stores/{sprint4,index}.js`, `frontend/src/router/index.js`, `LandingView.vue`, and `OverviewView.vue`.

### Sprint 5 — Notifications, Sustainability, Seed Vault, Developer API, Three.js 3D, Public Pages & Hardening (`F21`–`F24`, `PUB-7`, `3D`)
- [x] **S5-INFRA Migration & Models:**
  - Additive migration `backend/migrations/024_sprint5_notifications_sustainability_seeds_keys.js` (`notification_preferences`, `notifications`, `sustainability_logs`, `seed_packets`, `api_keys`, `public_profiles`).
  - 6 Sequelize models (`NotificationPreference`, `Notification`, `SustainabilityLog`, `SeedPacket`, `ApiKey`, `PublicProfile`) registered and associated in `backend/models/index.js`.
- [x] **F21 — Multi-Channel Notifications & Profile Preferences:**
  - Backend: `backend/services/notificationService.js` (strict HTTPS-only SSRF guard blocking `localhost`, `127.*`, `10.*`, `169.254.*`, `192.168.*`, `172.16-31.*`, `::1`, `fe80:` with `400 SSRF_BLOCKED_URL`; HMAC-SHA256 `X-SmartGarden-Signature` test webhook; inbox CRUD & mark-read), `backend/routes/notifications.js`, plus `PUT /api/auth/me` profile update in `backend/routes/auth.js`.
  - Frontend: Upgraded `frontend/src/views/dashboard/SettingsView.vue` (real `PUT /api/auth/me` profile save, language toggle, unified notification inbox, SSRF-checked webhook settings & tester).
- [x] **F22 — Water & Sustainability Metrics:**
  - Backend: `backend/services/sustainabilityService.js` (drip vs overhead savings, rainwater/compost/mulch/solar water & CO₂ impact, 0–100 score & `A+`..`D` grade), `backend/routes/sustainability.js`.
  - Frontend: `frontend/src/views/dashboard/SustainabilityView.vue` (`/dashboard/sustainability`) and `AnalyticsView.vue` `?feature=F22` handoff to live Sustainability metrics.
- [x] **F23 — Seed Vault & Germination Logs:**
  - Backend: `backend/services/seedVaultService.js` (seed packet CRUD, `FRESH`/`EXPIRING_SOON`/`EXPIRED`/`LOW_STOCK` viability status, 1-click `POST /api/seeds/:id/allocate` decrementing `seeds_remaining` & creating `ZonePlant` with zone RBAC), `backend/routes/seedVault.js`.
  - Frontend: `frontend/src/views/dashboard/SeedVaultView.vue` (`/dashboard/seed-vault`) and `CalendarView.vue` `?feature=F23` handoff to Seed Vault.
- [x] **F24 — Developer API Keys (`sg_pat_`) & Public Showcase:**
  - Backend: `backend/services/developerService.js` (once-shown `sg_pat_` token issuance, timing-safe SHA-256 hash verification, key revocation, opt-in `GET /api/public/growers/:handle` excluding private PII), `backend/routes/developer.js`, `sg_pat_` authentication inside `backend/middleware/auth.js` (`verifyJwt`).
  - Frontend: `SettingsView.vue` Showcase & API Key manager + `frontend/src/views/public/PublicProfileView.vue` (`/u/:handle`).
- [x] **Three.js Interactive 3D Experiences (`frontend/src/components/three/`):**
  - `HeroGardenScene3D.vue`: Landing hero interactive cedar raised-bed diorama with tomato vines, basil, marigolds, pulsing IoT sensor probe, floating pollen motes, drag-to-orbit, Day / Golden Hour / Night Glow lighting switcher, Auto-Spin toggle, safe WebGL `try/catch` + 2D fallback, and full geometry/material disposal (`LandingView.vue`).
  - `GardenPlot3D.vue`: Data-driven 3D Digital Twin mapping garden zones by `zone_type`/`soil_type`/area and live moisture halo rings with drag-to-orbit, zoom, Sun Hour slider (`6:00`–`22:00`), click raycasting, and HUD overlay (`GardenDetailView.vue` `3D Twin` tab, `OverviewView.vue` preview card, `PublicProfileView.vue`).
  - `AmbientBotanicalBg3D.vue`: Subtle floating particle backdrop in `AuthLayout.vue` and `PricingView.vue`.
  - `frontend/vite.config.js`: Split `three` into an isolated `manualChunks` bundle (`531.60 kB` / `132.31 kB` gzip).
- [x] **All 7 Public Content Pages + `/dashboard/help` (`PUB-7`, `24 Live / 0 Soon`):**
  - Live views: `PricingView.vue` (`/pricing`), `DocsView.vue` (`/docs`), `BlogView.vue` (`/blog`), `ChangelogView.vue` (`/changelog`), `HelpCenterView.vue` (`/help` & `/dashboard/help`), `PrivacyView.vue` (`/privacy`), `TermsView.vue` (`/terms`), wired across `features.js`, `router/index.js`, `PublicLayout.vue`, and `DashboardLayout.vue`.
- [x] **Hardening, PWA, CI & IoT/i18n Extras:**
  - Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) + per-IP rate limiter (`backend/middleware/rateLimit.js`) in `backend/server.js`.
  - PWA shell (`frontend/public/manifest.webmanifest`, `frontend/public/sw.js`), wired in `frontend/index.html` and `frontend/src/main.js` (production SW registration).
  - `frontend/src/composables/useI18n.js` (`en`/`es`), `backend/services/mqttBridge.js` (delegating to `ingestService.processTelemetry`), `firmware/esp32_smartgarden_node/esp32_smartgarden_node.ino`, `.github/workflows/ci.yml`, and idempotent `ensureSprint5DemoData` in `backend/scripts/seed-demo.js`.
  - Tests: `backend/tests/sprint5_f21_f24.test.js` (`5` tests) and `frontend/tests/e2e/sprint5-f21-f24-3d.test.js` (`5` tests).

---

## 4. Verification Outcomes Log

| Component / Gate | Command | Result | Notes |
|---|---|---|---|
| Sprint 5 Backend Suite | `npm test` | **PASS** (`127/127` across `31` suites) | Includes `backend/tests/sprint5_f21_f24.test.js` (`5` tests on SQLite `:memory:`) |
| M1-C In-Process Full-Stack Integration | `node --test --test-reporter=spec frontend/tests/integration/f6-f10-fullstack.test.mjs` | **PASS** (`5/5` journeys) | Real Pinia + Vue Router + `app.inject` / `app.injectWs` |
| Sprint 5 Frontend Build | `npm --prefix frontend run build` | **PASS** (`0` errors, `1018` modules) | Split `three` chunk (`531.60 kB` / `132.31 kB` gzip) |
| Sprint 5 Migrate & Seed Idempotency | `migrate.js` x2 & `seed-demo.js` x2 on fresh temp SQLite | **PASS** (`24` migrations, `31` tables, `0` Run 2 mutations) | Verified Sprint 1–5 schemas & demo seeds idempotent |
| Sprint 5 Chrome CDP E2E Suite | `$env:DB_DIALECT='sqlite'; $env:DB_STORAGE=':memory:'; npm --prefix frontend run test:e2e` | **PASS** (`38/38` across `8` suites) | Includes `sprint5-f21-f24-3d.test.js` (`5` tests incl. Three.js WebGL canvases) |
| Vendor Parity | SHA-256 check `backend/vendor/` vs `node_modules/` | **PASS** (`14/14` matched) | Pure-JS modules untouched; `three` installed only in `frontend/` |

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
4. **Media Storage (`F16`/`F18`/`F20`) & AI Providers (`F18`/`F19`):**
   - Setting `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` uploads photos to Cloudflare R2 via AWS SigV4; leaving them blank persists binary assets safely in `media_assets` served at `/api/media/:key`.
   - Setting `GEMINI_API_KEY` enables Gemini Vision & Gemini Chat; leaving it blank uses deterministic structured fallbacks with `provider: 'deterministic-fallback'`.
5. **Realtime Transport (`F8`) & Cron Jobs (`F7`/`F10`/`F11`/`F17`):**
   - Primary transport is WebSocket (`/ws/gardens/:gardenId?token=`); frontend `realtime.js` automatically falls back to SSE (`/api/gardens/:gardenId/stream?token=`) after 2 pre-open WS failures or when `VITE_REALTIME_TRANSPORT=sse`.
   - Background cron jobs run automatically when `ENABLE_SCHEDULER=true`, or can be triggered explicitly via `/api/jobs/{evaluate-rules,device-watchdog,weather-watchdog,telemetry-rollup}` with `X-Cron-Secret: <CRON_SECRET>`.

---

## 6. Post-Implementation Manual Testing & Production Onboarding Checklist

- [ ] Manual human testing pass sequentially across `sprint2` (`F6`–`F10`) -> `sprint3` (`F11`–`F15`) -> `sprint4` (`F16`–`F20`) -> `sprint5` (`F21`–`F24`, Three.js 3D scenes, public pages) before merging branches into `main`.
- [ ] Configure Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `R2_PUBLIC_URL`) for Sprint 4+ photo storage.
- [ ] Configure Gemini API key (`GEMINI_API_KEY`) for Sprint 4 live AI Diagnosis (`F18`) & Assistant (`F19`).
- [ ] Configure SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`) for Sprint 2/5 alert & notification emails.
- [ ] Finalize always-on backend hosting alternative to Render free tier and verify production MySQL/PostgreSQL environment before merging tested sprint branches into `main`.
