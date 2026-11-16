# Project: Smart Gardening System (F1–F5 Showcase & Documentation Suite)

## Architecture
The system is built as a decoupled Model–View–Controller (MVC) Single Page Application (SPA):
- **Frontend**: Vue 3 SPA (Plain JavaScript) with Vite, Pinia, Vue Router, and Axios. Runs on port 5173 with Vite dev proxy forwarding `/api` and `/ws` to Fastify.
- **Backend**: Node.js + Fastify (Plain JavaScript, CommonJS). Modular structure with `controllers/`, `models/`, `middleware/`, `routes/`, `services/`, and `scripts/`.
- **Database & ORM**: MariaDB 10.11 via `docker-compose.yml`, managed via Sequelize ORM with programmatic migrations and seed scripts. Dual-dialect support (`mariadb` for container/production, `sqlite` in-memory for zero-dependency rapid test execution).
- **Security & Authorization**: Bcrypt password hashing (cost 10), JWT session authentication (`@fastify/jwt`, 7-day TTL), and garden-level RBAC (`OWNER`, `FAMILY`, `GUEST`) with a resource-to-garden resolver preHandler hook.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Documentation Suite Update | Resolve 12 design gaps, create modular docs in `Document/`, update technical doc to v1.1 | M1 | R1, survey_spec_miner_1 |
| 2 | Monorepo & Scaffold | npm workspaces (`backend`, `frontend`), `docker-compose.yml` for MariaDB, root scripts | M2 | R2, survey_explorer_2 |
| 3 | Database Migrations & Seeds | Sequelize migrations for all 17 tables and seeder for 30+ plant species with care thresholds and spacing | M2 | R2, survey_spec_miner_2 |
| 4 | User Registration & Login | Secure registration, bcrypt password hashing, JWT token generation | M3 | R3 (F1) |
| 5 | Current User Profile (`/me`) | Authenticated session profile retrieval | M3 | R3 (F1) |
| 6 | Password Reset Flow | Crypto 32-byte reset token, SHA-256 hash storage in `password_reset_tokens`, 60-min expiration, reset endpoint | M3 | R3 (F1) |
| 7 | Authentication Frontend View | Tabbed/routed `AuthView.vue` supporting Login, Register, Forgot Password, and Reset Password | M3 | R3 (F1) |
| 8 | Garden-Level RBAC Enforcement | Role checks (`OWNER`, `FAMILY`, `GUEST`, `ADMIN`) on garden actions | M4 | R4 (F2) |
| 9 | Resource-to-Garden Resolver | PreHandler hook resolving `garden_id` from `:zoneId` or `:plantId` for RBAC | M4 | R4 (F2) |
| 10 | Garden Member Management | List, update member roles, remove members from gardens | M4 | R4 (F2) |
| 11 | Garden Invitations Workflow | Create invite, token generation, status (`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`), accept/reject endpoints | M4 | R4 (F2) |
| 12 | Garden CRUD with Timezone | Full CRUD on `gardens` with IANA `timezone`, coordinates, area | M5 | R5 (F3) |
| 13 | Zone CRUD with Outdoor Flag | Full CRUD on `zones` with `is_outdoor` boolean, `soil_type`, `sunlight_level`, dimensions | M5 | R5 (F3) |
| 14 | Garden & Zone Frontend Views | `GardensView.vue`, `GardenDetailView.vue`, `ZoneDetailView.vue` | M5 | R5 (F3) |
| 15 | Plant Catalog Master Data | Schema with scientific/common name, category, care thresholds, `spacing_cm`, JSON companion/calendar arrays | M6 | R6 (F4) |
| 16 | Plant Catalog Filtering & Search | Query endpoint with text search (`q`), category, sunlight, watering filters, and pagination | M6 | R6 (F4) |
| 17 | Plant Catalog Frontend Browser | `PlantCatalogView.vue` with search bar, filter chips, pagination, and plant detail modal | M6 | R6 (F4) |
| 18 | Zone Plant Inventory CRUD | Assign catalog plant to zone, custom nickname, quantity, planting date, expected harvest date | M7 | R7 (F5) |
| 19 | Crop Lifecycle & Status Tracking | Status tracking (`SEEDLING`, `GROWING`, `HARVEST_READY`, `HARVESTED`, `DEAD`), days to harvest calculation | M7 | R7 (F5) |
| 20 | Zone Plant Frontend View | `ZonePlantsView.vue` with plant grid/list, status badges, days-to-harvest counter, add/edit modal | M7 | R7 (F5) |
| 21 | Automated E2E & Integration Tests | Unit and route integration test suite covering F1–F5 passing 100% with exit code 0 (`npm test`) | M8 | R8, Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design Documentation Suite | Produce `Document/` suite (7 comprehensive documents, v1.1 update, 12 design gaps, 21 DDL entities, RFC 7807, compound scoping) | None | DONE |
| M2 | Core Foundation Scaffold | Monorepo setup, `docker-compose.yml`, Fastify backend scaffold, Vue 3 Vite frontend scaffold, Sequelize migrations for all tables, 30+ seed plants, root scripts | None | DONE |
| M3 | F1: Accounts & Authentication | User model, password_reset_tokens model, auth controller/routes, bcrypt, JWT, AuthView.vue | M2 | DONE |
| M4 | F2: RBAC & Invitations | GardenMember & GardenInvitation models, resolver middleware, permissions matrix, invitation acceptance flow | M3 | IN_PROGRESS |
| M5 | F3: Garden & Zone Management | Garden & Zone models/controllers/routes, timezone persistence, outdoor flag, frontend views | M4 | PLANNED |
| M6 | F4: Plant Catalog & Reference Data | PlantCatalog model, search/filter/pagination controller/routes, 30+ plant seed verification, PlantCatalogView.vue | M2 | PLANNED |
| M7 | F5: Zone Plant Inventory | ZonePlant model, crop tracking controller/routes, harvest calculations, ZonePlantsView.vue | M5, M6 | PLANNED |
| M8 | Final Verification & E2E Test Pass | 100% passing E2E test suite (Tiers 1–4) via `npm test`, adversarial coverage hardening | M1–M7 | PLANNED |

## Interface Contracts

### Auth & User Context
- `POST /api/auth/register`: `{ name, email, password, location_region? }` -> `201 { user, token }`
- `POST /api/auth/login`: `{ email, password }` -> `200 { user, token }`
- `GET /api/auth/me`: Headers: `Authorization: Bearer <token>` -> `200 { user }`
- `POST /api/auth/forgot-password`: `{ email }` -> `200 { message }`
- `POST /api/auth/reset-password`: `{ token, new_password }` -> `200 { message }`
- JWT Payload: `{ id: number, email: string, name: string, is_admin: boolean }`

### Garden & Zone Management
- `GET /api/gardens`: -> `200 { gardens: [...] }`
- `POST /api/gardens`: `{ name, location, timezone, area_sq_m }` -> `201 { garden }` (auto-creates OWNER in `garden_members`)
- `GET /api/gardens/:id`: -> `200 { garden, zones: [...], members: [...] }`
- `PUT /api/gardens/:id`: `{ name, location, timezone, area_sq_m }` -> `200 { garden }`
- `DELETE /api/gardens/:id`: -> `200 { message }`
- `POST /api/gardens/:gardenId/zones`: `{ name, is_outdoor, soil_type, sunlight_level, area_sq_m }` -> `201 { zone }`
- `GET /api/zones/:id`: -> `200 { zone, plants: [...] }` (resolved via `zones.garden_id`)
- `PUT /api/zones/:id`: `{ name, is_outdoor, soil_type, sunlight_level, area_sq_m }` -> `200 { zone }`
- `DELETE /api/zones/:id`: -> `200 { message }`

### RBAC & Invitations
- Roles: `OWNER`, `FAMILY`, `GUEST`
- PreHandler resolver: extracts `gardenId` or resolves from `zoneId` / `plantId`, checks active membership in `garden_members`
- `POST /api/gardens/:id/invitations`: `{ email, role, expiresInDays? }` -> `201 { invitation }`
- `GET /api/gardens/:id/invitations`: -> `200 { invitations: [...] }`
- `POST /api/invitations/:token/accept`: -> `200 { message, gardenId }`
- `POST /api/invitations/:token/reject`: -> `200 { message }`

### Plant Catalog & Zone Inventory
- `GET /api/catalog`: Query: `q`, `category`, `sunlight`, `page`, `limit` -> `200 { plants: [...], total, page, totalPages }`
- `GET /api/catalog/:id`: -> `200 { plant }`
- `GET /api/zones/:zoneId/plants`: -> `200 { plants: [...] }`
- `POST /api/zones/:zoneId/plants`: `{ catalog_plant_id, custom_nickname, quantity, planted_date, expected_harvest_date }` -> `201 { zonePlant }`
- `PUT /api/zones/:zoneId/plants/:plantId`: `{ custom_nickname, quantity, status, expected_harvest_date, notes }` -> `200 { zonePlant }`
- `DELETE /api/zones/:zoneId/plants/:plantId`: -> `200 { message }`

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human-readable description",
    "details": {},
    "statusCode": 400
  }
}
```

## Code Layout
```
c:\Users\Lenovo\Documents\antigravity\smartgarden/
├── Document/                               # Comprehensive design documentation
│   ├── smart_gardening_system_technical_documentation.md (v1.1)
│   ├── requirements_specification.md
│   ├── database_schema_data_dictionary.md
│   ├── api_specification.md
│   ├── security_and_permissions_matrix.md
│   ├── rules_engine_and_business_logic.md
│   └── iot_ingest_and_device_architecture.md
├── docker-compose.yml                      # MariaDB 10.11 service definition
├── .env.example                            # Template environment configuration
├── package.json                            # Root monorepo workspace configuration
├── backend/                                # Node.js + Fastify API service
│   ├── package.json
│   ├── server.js                           # Fastify server entry point
│   ├── config/                             # Database & app configuration
│   │   ├── database.js
│   │   └── config.js
│   ├── models/                             # Sequelize models (Plain JS / CJS)
│   │   ├── index.js
│   │   ├── User.js
│   │   ├── PasswordResetToken.js
│   │   ├── Garden.js
│   │   ├── GardenMember.js
│   │   ├── GardenInvitation.js
│   │   ├── Zone.js
│   │   ├── PlantCatalog.js
│   │   └── ZonePlant.js
│   ├── middleware/                         # Fastify authentication & RBAC hooks
│   │   ├── auth.js                         # verifyJwt
│   │   └── rbac.js                         # checkGardenRole & resolveGardenId
│   ├── routes/                             # Fastify route plugins
│   │   ├── auth.js
│   │   ├── gardens.js
│   │   ├── zones.js
│   │   ├── catalog.js
│   │   ├── invitations.js
│   │   └── plants.js
│   ├── scripts/                            # Database migrations and seed runners
│   │   ├── migrate.js
│   │   └── seed.js
│   ├── tests/                              # Automated tests (Unit & Integration)
│   │   ├── auth.test.js
│   │   ├── rbac.test.js
│   │   ├── gardens.test.js
│   │   └── catalog_inventory.test.js
│   └── seeds/                              # 30+ plant catalog reference data
│       └── plants.json
└── frontend/                               # Vue 3 + Vite SPA (Plain JS)
    ├── package.json
    ├── vite.config.js                      # Dev server & API proxy
    ├── index.html
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/index.js
        ├── stores/                         # Pinia stores (auth, gardens, catalog)
        ├── views/                          # Page views (Auth, Gardens, Zone, Catalog, Inventory)
        └── services/                       # Axios API client
```
