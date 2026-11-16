# Smart Gardening System — REST API & WebSocket Specification

**Document Version:** 1.1  
**Protocol:** HTTP/1.1 & HTTP/2 (TLS 1.3), WebSocket (`ws://` / `wss://`)  
**Base URL:** `https://<api-host>/api`  
**Status:** Approved Engineering Specification  

---

## 1. API Conventions & Standard Response Envelopes

### 1.1 Headers & Content Negotiation
* **Standard Request Headers:**
  * `Content-Type: application/json` (Required on POST, PUT, PATCH requests with payloads).
  * `Authorization: Bearer <JWT>` (Required for authenticated user sessions).
  * `X-Device-Key: <raw_key>` (Required on IoT telemetry ingestion `POST /api/sensors/ingest`).
* **Multipart Requests:**
  * `Content-Type: multipart/form-data` (Required for photo uploads in `/api/plants/:id/journal` and `/api/ai/diagnose-leaf`).

### 1.2 Standard Success Response Envelope
All successful API responses return a structured JSON object containing a `success` boolean, the payload `data`, and optional pagination/query metadata:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### 1.3 Standard RFC 7807 Error Response Envelope
All client and server errors conform strictly to an RFC 7807-inspired schema, delivering predictable machine-readable error codes and localized error messages:

```json
{
  "success": false,
  "error": {
    "code": "ZONE_OVERCROWDED",
    "message": "Zone area of 4.50 m2 is insufficient for 15 Tomato plants requiring 6.75 m2.",
    "statusCode": 422,
    "details": [
      {
        "field": "quantity",
        "issue": "Exceeds usable zone capacity"
      }
    ],
    "path": "/api/zones/14/plants",
    "timestamp": "2026-11-16T01:35:00.000Z"
  }
}
```

### 1.4 HTTP Status Codes Summary

| Status Code | Meaning | Usage |
| :---: | :--- | :--- |
| `200 OK` | Request succeeded | Standard response for GET, PUT, PATCH, and non-creation POST. |
| `201 Created` | Resource created | Returned on successful POST resource creations. |
| `204 No Content`| Deletion successful | Resource permanently removed; no response body returned. |
| `400 Bad Request`| Malformed request | Schema validation failed, missing required fields, or invalid formats. |
| `401 Unauthorized`| Authentication failed | Missing, invalid, or expired JWT token, or revoked device key. |
| `403 Forbidden` | Access denied | Caller lacks required RBAC role (`OWNER`, `FAMILY`, `ADMIN`) or guest access expired. |
| `404 Not Found` | Resource not found | Targeted entity ID does not exist in the database. |
| `409 Conflict` | Unique conflict | Unique constraint violation (e.g. email or device UID already registered). |
| `422 Unprocessable`| Business validation | Request is well-formed but violates domain business logic. |
| `429 Too Many Req`| Rate limited | Request threshold exceeded (100 req/min for users, 60 req/min for devices). |
| `500 Server Error`| Internal failure | Unhandled exception encountered by server. |

---

## 2. REST Endpoints Specification

### 2.1 Authentication & Account Management (F1)

#### `POST /api/auth/register`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "name": "Jane Gardener",
    "email": "jane@example.com",
    "password": "StrongPassword123!",
    "location_region": "US-Zone-6b"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": 1,
        "name": "Jane Gardener",
        "email": "jane@example.com",
        "location_region": "US-Zone-6b",
        "is_admin": false,
        "created_at": "2026-11-16T01:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
* **Error Response (409 Conflict):**
  ```json
  {
    "success": false,
    "error": {
      "code": "EMAIL_ALREADY_EXISTS",
      "message": "The email address 'jane@example.com' is already registered.",
      "statusCode": 409
    }
  }
  ```

#### `POST /api/auth/login`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "StrongPassword123!"
  }
  ```
* **Success Response (200 OK):** Returns `{ success: true, data: { user, token } }`.
* **Error Response (401 Unauthorized):** `{ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password.", statusCode: 401 } }`.

#### `GET /api/auth/me`
* **Access:** Authenticated (`verifyJwt`)
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):** Returns `{ success: true, data: { user } }`.

#### `POST /api/auth/forgot-password`
* **Access:** Public
* **Request Body:** `{ "email": "jane@example.com" }`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "If an account with that email exists, reset instructions have been sent."
    }
  }
  ```

#### `POST /api/auth/reset-password`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "token": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "new_password": "BrandNewPassword456!"
  }
  ```
* **Success Response (200 OK):** `{ success: true, data: { message: "Password has been reset successfully." } }`.
* **Error Response (400 Bad Request):** `{ success: false, error: { code: "INVALID_OR_EXPIRED_TOKEN", message: "Reset token is invalid or has expired.", statusCode: 400 } }`.

---

### 2.2 Garden & Zone Management (F3)

#### `GET /api/gardens`
* **Access:** Authenticated (`verifyJwt`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "gardens": [
        {
          "id": 1,
          "name": "Backyard Eden",
          "latitude": 40.7128,
          "longitude": -74.0060,
          "location_address": "Brooklyn, NY",
          "timezone": "America/New_York",
          "area_sq_m": 45.0,
          "role": "OWNER",
          "zone_count": 3,
          "plant_count": 14
        }
      ]
    }
  }
  ```

#### `POST /api/gardens`
* **Access:** Authenticated (`verifyJwt`)
* **Request Body:**
  ```json
  {
    "name": "Rooftop Greenhouse",
    "latitude": 40.7589,
    "longitude": -73.9851,
    "location_address": "Manhattan, NY",
    "timezone": "America/New_York",
    "area_sq_m": 25.5,
    "description": "High-light automated hydroponic and container rooftop system."
  }
  ```
* **Success Response (201 Created):** Returns `{ success: true, data: { garden, role: "OWNER" } }`.

#### `GET /api/gardens/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { garden, zones: [...], members: [...] } }`.

#### `PUT /api/gardens/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Request Body:** `{ "name": "Updated Name", "timezone": "America/New_York", "area_sq_m": 30.0 }`.
* **Success Response (200 OK):** Returns `{ success: true, data: { garden } }`.

#### `DELETE /api/gardens/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Success Response (200 OK):** `{ success: true, data: { message: "Garden and all associated records deleted." } }`.

#### `GET /api/gardens/:gardenId/zones`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { zones: [...] } }`.

#### `POST /api/gardens/:gardenId/zones`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Request Body:**
  ```json
  {
    "name": "South Bed (Tomatoes & Basil)",
    "is_outdoor": true,
    "zone_type": "RAISED_BED",
    "soil_type": "LOAM",
    "sunlight_level": "FULL_SUN",
    "area_sq_m": 6.0,
    "dimensions_description": "4m x 1.5m cedar bed"
  }
  ```
* **Success Response (201 Created):** Returns `{ success: true, data: { zone } }`.

#### `GET /api/zones/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { zone, plants: [...], active_devices: [...] } }`.

#### `PUT /api/zones/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { zone } }`.

#### `DELETE /api/zones/:id`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Success Response (200 OK):** `{ success: true, data: { message: "Zone and child inventory removed." } }`.

---

### 2.3 RBAC & Collaboration Invitations (F2)

#### `GET /api/gardens/:id/members`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { members: [...] } }`.

#### `PUT /api/gardens/:id/members/:userId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Description:** Updates an existing garden member's role (`FAMILY` or `GUEST`). An owner cannot demote themselves if they are the sole owner.
* **Request Body:**
  ```json
  {
    "role": "FAMILY"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "member": {
        "id": 4,
        "garden_id": 1,
        "user_id": 3,
        "role": "FAMILY",
        "updated_at": "2026-11-16T02:00:00.000Z"
      }
    }
  }
  ```
* **Error Response (400 Bad Request):**
  ```json
  {
    "success": false,
    "error": {
      "code": "CANNOT_DEMOTE_SOLE_OWNER",
      "message": "The sole garden owner cannot demote their own role without transferring ownership.",
      "statusCode": 400
    }
  }
  ```

#### `DELETE /api/gardens/:id/members/:userId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Description:** Removes a member from the garden roster. Owners can remove any non-owner member; non-owner members can remove themselves to voluntarily leave the garden. The sole owner cannot leave without deleting the garden or transferring ownership.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Member removed from garden successfully."
    }
  }
  ```
* **Error Response (403 Forbidden):**
  ```json
  {
    "success": false,
    "error": {
      "code": "CANNOT_REMOVE_MEMBER",
      "message": "Only garden owners can remove other members.",
      "statusCode": 403
    }
  }
  ```

#### `GET /api/gardens/:id/invitations`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Description:** Retrieves all outstanding and historical invitations issued for this garden.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "invitations": [
        {
          "id": 10,
          "garden_id": 1,
          "invited_by": 2,
          "invitee_email": "neighbor@example.com",
          "role": "GUEST",
          "token": "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
          "status": "PENDING",
          "expires_at": "2026-11-30T01:00:00.000Z",
          "created_at": "2026-11-16T01:00:00.000Z"
        }
      ]
    }
  }
  ```

#### `POST /api/gardens/:id/invitations`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Request Body:**
  ```json
  {
    "email": "neighbor@example.com",
    "role": "GUEST",
    "expiresInDays": 14
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": 10,
      "email": "neighbor@example.com",
      "role": "GUEST",
      "token": "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
      "expires_at": "2026-11-30T01:00:00.000Z",
      "invite_url": "https://smartgarden.app/invitations/accept?token=7f8a9b0c..."
    }
  }
  ```

#### `DELETE /api/gardens/:id/invitations/:inviteId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Description:** Cancels a pending invitation for the garden.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Invitation canceled successfully."
    }
  }
  ```
* **Error Response (404 Not Found):**
  ```json
  {
    "success": false,
    "error": {
      "code": "INVITATION_NOT_FOUND",
      "message": "Invitation not found or does not belong to this garden.",
      "statusCode": 404
    }
  }
  ```

#### `POST /api/invitations/:token/accept`
* **Access:** Authenticated (`verifyJwt`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully joined garden as GUEST.",
      "gardenId": 1,
      "role": "GUEST"
    }
  }
  ```

#### `POST /api/invitations/:token/reject`
* **Access:** Authenticated (`verifyJwt`)
* **Success Response (200 OK):** `{ success: true, data: { message: "Invitation declined." } }`.

---

### 2.4 Plant Catalog & Reference Encyclopedia (F4)

#### `GET /api/catalog`
* **Access:** Authenticated (`verifyJwt`)
* **Query Parameters:**
  * `q` (string, optional): Substring search in `common_name` and `scientific_name`.
  * `category` (enum, optional): `VEGETABLE`, `HERB`, `FRUIT`, `FLOWER`, etc.
  * `sunlight` (enum, optional): `FULL_SUN`, `PART_SHADE`, `FULL_SHADE`.
  * `page` (integer, default 1).
  * `limit` (integer, default 20, max 100).
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "plants": [
        {
          "id": 1,
          "scientific_name": "Solanum lycopersicum",
          "common_name": "Tomato",
          "category": "VEGETABLE",
          "sunlight_req": "FULL_SUN",
          "ideal_moisture_min": 50.0,
          "ideal_moisture_max": 75.0,
          "ideal_temp_min": 18.0,
          "ideal_temp_max": 30.0,
          "watering_freq_days": 2,
          "fertilizing_freq_days": 14,
          "spacing_cm": 45,
          "row_spacing_cm": 60,
          "spread_radius_cm": 25,
          "min_soil_depth_cm": 30,
          "planting_months": [3, 4, 5],
          "harvest_months": [7, 8, 9, 10],
          "good_companions": ["Basil", "Marigold", "Carrot"],
          "bad_companions": ["Fennel", "Potato", "Cabbage"]
        }
      ]
    },
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 34,
      "totalPages": 2
    }
  }
  ```

#### `GET /api/catalog/:id`
* **Access:** Authenticated (`verifyJwt`)
* **Success Response (200 OK):** Returns single plant record.

#### `POST /api/catalog`
* **Access:** Administrator only (`verifyJwt`, `checkAdmin`)
* **Request Body:** Complete botanical specification schema.
* **Success Response (201 Created):** Returns `{ success: true, data: { plant } }`.

#### `PUT /api/catalog/:id`
* **Access:** Administrator only (`verifyJwt`, `checkAdmin`)
* **Description:** Updates botanical parameters (thresholds, spacing, description) for an existing plant catalog entry.
* **Request Body:**
  ```json
  {
    "common_name": "Beefsteak Heirloom Tomato",
    "ideal_moisture_min": 55.0,
    "ideal_moisture_max": 80.0,
    "spacing_cm": 50,
    "row_spacing_cm": 65,
    "watering_freq_days": 2
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "plant": {
        "id": 1,
        "scientific_name": "Solanum lycopersicum",
        "common_name": "Beefsteak Heirloom Tomato",
        "category": "VEGETABLE",
        "spacing_cm": 50,
        "row_spacing_cm": 65,
        "updated_at": "2026-11-16T02:00:00.000Z"
      }
    }
  }
  ```
* **Error Response (404 Not Found):**
  ```json
  {
    "success": false,
    "error": {
      "code": "CATALOG_PLANT_NOT_FOUND",
      "message": "Plant catalog entry not found.",
      "statusCode": 404
    }
  }
  ```

#### `DELETE /api/catalog/:id`
* **Access:** Administrator only (`verifyJwt`, `checkAdmin`)
* **Description:** Deletes a master plant catalog entry. Deletion is rejected if active plantings reference this species in any zone (enforced via foreign key `RESTRICT`).
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "Catalog plant record deleted successfully."
    }
  }
  ```
* **Error Response (409 Conflict):**
  ```json
  {
    "success": false,
    "error": {
      "code": "CANNOT_DELETE_ACTIVE_PLANT",
      "message": "Cannot delete plant species referenced in active garden zone inventory.",
      "statusCode": 409
    }
  }
  ```

---

### 2.5 Zone Plant Inventory & Capacity (F5)

#### `GET /api/zones/:zoneId/plants`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "plants": [
        {
          "id": 5,
          "zone_id": 2,
          "plant_catalog_id": 1,
          "common_name": "Tomato",
          "custom_nickname": "Cherokee Purple Heirloom",
          "quantity": 6,
          "planted_date": "2026-04-15",
          "expected_harvest_date": "2026-07-25",
          "status": "GROWING",
          "health_status": "HEALTHY",
          "days_since_planted": 32,
          "days_until_harvest": 69
        }
      ],
      "zone_utilization": {
        "zone_area_sq_m": 6.0,
        "occupied_area_sq_m": 1.62,
        "utilization_ratio": 0.27,
        "status": "OPTIMAL"
      }
    }
  }
  ```

#### `POST /api/zones/:zoneId/plants`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Request Body:**
  ```json
  {
    "plant_catalog_id": 1,
    "custom_nickname": "Roma Bed B",
    "quantity": 10,
    "planted_date": "2026-05-01",
    "expected_harvest_date": "2026-08-10",
    "status": "SEEDLING",
    "notes": "Directly transplanted from indoor seedling tray."
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "zone_plant": {
        "id": 8,
        "zone_id": 2,
        "plant_catalog_id": 1,
        "custom_nickname": "Roma Bed B",
        "quantity": 10,
        "planted_date": "2026-05-01",
        "status": "SEEDLING"
      }
    },
    "meta": {
      "warning": null,
      "utilization_ratio": 0.72
    }
  }
  ```
* **Response with Density Warning (201 Created with Warning Meta):**
  ```json
  {
    "success": true,
    "data": { "zone_plant": { ... } },
    "meta": {
      "warning": "ZONE_OVERCROWDED",
      "message": "Zone capacity exceeded (118%). High risk of stunted growth and fungal blight.",
      "utilization_ratio": 1.18
    }
  }
  ```

#### `PUT /api/zones/:zoneId/plants/:plantId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Request Body:**
  ```json
  {
    "custom_nickname": "Summer Cherry Tomatoes",
    "quantity": 12,
    "status": "GROWING",
    "health_status": "HEALTHY",
    "expected_harvest_date": "2026-08-01",
    "notes": "Pruned suckers and added secondary trellis."
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "zone_plant": {
        "id": 8,
        "zone_id": 2,
        "plant_catalog_id": 1,
        "custom_nickname": "Summer Cherry Tomatoes",
        "quantity": 12,
        "status": "GROWING",
        "health_status": "HEALTHY",
        "expected_harvest_date": "2026-08-01",
        "notes": "Pruned suckers and added secondary trellis.",
        "updated_at": "2026-11-16T02:00:00.000Z"
      }
    },
    "meta": {
      "warning": null,
      "utilization_ratio": 0.81
    }
  }
  ```
* **Response with Density Warning (200 OK with Warning Meta):**
  ```json
  {
    "success": true,
    "data": {
      "zone_plant": {
        "id": 8,
        "zone_id": 2,
        "quantity": 18,
        "status": "GROWING"
      }
    },
    "meta": {
      "warning": "ZONE_OVERCROWDED",
      "message": "Zone capacity exceeded (121%). High risk of stunted growth and fungal blight.",
      "utilization_ratio": 1.21
    }
  }
  ```

#### `DELETE /api/zones/:zoneId/plants/:plantId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Success Response (200 OK):** `{ success: true, data: { message: "Plant removed from zone inventory." } }`.

---

### 2.6 IoT Telemetry Ingestion & Watchdog (F7)

#### `POST /api/sensors/ingest`
* **Access:** Machine Device (`verifyDeviceKey`)
* **Headers:**
  * `X-Device-Key: sg_live_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d`
  * `Content-Type: application/json`
* **Request Body (Hardware / Unified Schema):**
  ```json
  {
    "deviceUid": "SG-PRO-ESP32-A1B2C3",
    "timestamp": 1778980000,
    "metrics": {
      "soilMoisture": 42.5,
      "temperature": 23.8,
      "humidity": 61.2,
      "lightLux": 2450.0,
      "batteryPercent": 88.0,
      "signalRssi": -62
    },
    "firmwareVersion": "v1.2.0"
  }
  ```
* **Request Body (Legacy / Simulator Flat Schema):**
  ```json
  {
    "soilMoisture": 42.5,
    "temperature": 23.8,
    "humidity": 61.2,
    "lightLux": 2450.0
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "reading_id": 489201,
      "zone_id": 2,
      "recorded_at": "2026-11-16T01:35:00.000Z",
      "status": "PROCESSED"
    }
  }
  ```
* **Error Response (401 Unauthorized):**
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_DEVICE_KEY",
      "message": "Device key header 'X-Device-Key' is missing, invalid, or revoked.",
      "statusCode": 401
    }
  }
  ```

#### `GET /api/zones/:id/readings`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Query Parameters:** `hours` (default 24, max 168), `limit` (default 100).
* **Success Response (200 OK):** Returns raw time-series array sorted by `recorded_at DESC`.

#### `GET /api/zones/:id/stats/daily`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Query Parameters:** `days` (default 30, max 365).
* **Success Response (200 OK):** Returns downsampled statistical records from `sensor_aggregates_daily`.

---

### 2.7 Care Tasks & Water Usage (F6, F17)

#### `GET /api/zones/:zoneId/tasks`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Query Parameters:** `is_completed` (boolean), `due_before` (date).
* **Success Response (200 OK):** Returns `{ success: true, data: { tasks: [...] } }`.

#### `POST /api/zones/:zoneId/tasks`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Request Body:**
  ```json
  {
    "task_type": "WATER",
    "due_date": "2026-05-03",
    "recurrence_days": 3,
    "assigned_to": 1,
    "notes": "Deep soak around base"
  }
  ```
* **Success Response (201 Created):** Returns `{ success: true, data: { task } }`.

#### `PATCH /api/zones/:zoneId/tasks/:taskId`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Request Body (Completing a Watering Task with Volume):**
  ```json
  {
    "is_completed": true,
    "water_volume_liters": 12.5,
    "irrigation_method": "DRIP_IRRIGATION"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "task": {
        "id": 14,
        "is_completed": true,
        "completed_at": "2026-05-03T10:15:00.000Z",
        "next_scheduled_task_id": 19
      },
      "water_log": {
        "id": 82,
        "liters_applied": 12.5,
        "method": "DRIP_IRRIGATION"
      }
    }
  }
  ```

---

### 2.8 Automation Rules & Alerts (F9, F10)

#### `GET /api/zones/:zoneId/rules`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY'])`)
* **Success Response (200 OK):** Returns `{ success: true, data: { rules: [...] } }`.

#### `POST /api/zones/:zoneId/rules`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Request Body:**
  ```json
  {
    "name": "Dry Soil Afternoon Soak",
    "metric": "SOIL_MOISTURE",
    "operator": "LT",
    "threshold_value": 30.0,
    "weather_condition": "NO_RAIN",
    "action_type": "CREATE_TASK",
    "cooldown_minutes": 180,
    "max_daily_executions": 2
  }
  ```
* **Success Response (201 Created):** Returns `{ success: true, data: { rule } }`.

#### `GET /api/zones/:zoneId/alerts/config`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER', 'FAMILY', 'GUEST'])`)
* **Success Response (200 OK):** Returns configured metric boundaries and quiet-hours windows.

#### `PUT /api/zones/:zoneId/alerts/config`
* **Access:** Authenticated (`resolveGardenAndRole(['OWNER'])`)
* **Request Body:**
  ```json
  {
    "metric": "SOIL_MOISTURE",
    "min_threshold": 25.0,
    "max_threshold": 85.0,
    "is_email_enabled": true,
    "quiet_hours_start": "22:00:00",
    "quiet_hours_end": "07:00:00",
    "cooldown_minutes": 60
  }
  ```
* **Success Response (200 OK):** Returns updated configuration.

---

### 2.9 Weather & Intelligence (F11, F18, F19)

#### `GET /api/weather`
* **Access:** Authenticated (`verifyJwt`)
* **Query Parameters:** `latitude` (decimal), `longitude` (decimal).
* **Success Response (200 OK):** Returns current meteorological conditions, 24-hour hourly precipitation probabilities, and severe weather warnings (served from `weather_cache`).

#### `POST /api/ai/diagnose-leaf`
* **Access:** Authenticated (`verifyJwt`)
* **Content-Type:** `multipart/form-data`
* **Body:** `photo` (file, max 5 MB).
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "disease_name": "Early Blight (Alternaria solani)",
      "confidence": 92.4,
      "symptoms": "Concentric rings (target-like spots) on lower mature leaves with surrounding yellow halo.",
      "organic_treatment": "Prune affected bottom leaves immediately to improve airflow. Apply copper fungicide or organic neem oil spray every 7 days.",
      "preventative_actions": "Avoid overhead watering; mulch base to prevent soil splashing."
    }
  }
  ```

#### `POST /api/ai/chat`
* **Access:** Authenticated (`verifyJwt`)
* **Request Body:** `{ "message": "My bell pepper leaves are curling upwards. What should I do?", "garden_id": 1 }`.
* **Success Response (200 OK):** Returns streaming or markdown response grounded in the user's garden microclimate data.

---

### 2.10 Community & Social (F20)

#### `GET /api/community/posts`
* **Access:** Public or Authenticated
* **Query Parameters:** `category`, `page`, `limit`.
* **Success Response (200 OK):** Returns paginated posts with like and comment counts.

#### `POST /api/community/posts`
* **Access:** Authenticated (`verifyJwt`)
* **Request Body:**
  ```json
  {
    "title": "First Heirloom Tomato Harvest of 2026!",
    "content": "Cherokee Purples finally ripened in Bed A. Total yield 8.4 kg.",
    "category": "SHOWCASE",
    "garden_id": 1
  }
  ```
* **Success Response (201 Created):** Returns `{ success: true, data: { post } }`.

---

## 3. Real-Time WebSocket Protocol Specification

### 3.1 Connection Handshake & Channel Binding
* **Endpoint URL:** `ws://<host>/ws/gardens/:gardenId?token=<JWT>` (or `wss://` in production)
* **Lifecycle Flow:**
  1. Client initiates WebSocket upgrade providing target `gardenId` parameter and active JWT token.
  2. Server hook validates JWT via `@fastify/jwt`.
  3. Server verifies caller holds an active role (`OWNER`, `FAMILY`, `GUEST`) on that garden in `garden_members`.
  4. If authorized, the socket joins channel room `garden:<gardenId>`.
  5. If unauthorized or token invalid, the connection terminates with WebSocket close code `4001` (Unauthorized) or `4003` (Forbidden).

### 3.2 Real-Time Event Frames

All event frames transmitted across the WebSocket channel enforce a standard payload schema containing the target `gardenId` and an ISO-8601 UTC `timestamp` for seamless client-side filtering and timeline ordering.

#### Event: `SENSOR_UPDATE`
Emitted immediately whenever a sensor reading is ingested for a zone in this garden:
```json
{
  "event": "SENSOR_UPDATE",
  "data": {
    "gardenId": 1,
    "zoneId": 2,
    "deviceId": 1,
    "soilMoisture": 42.5,
    "temperature": 23.8,
    "humidity": 61.2,
    "lightLux": 2450.0,
    "batteryPercent": 88.0,
    "signalRssi": -62,
    "timestamp": "2026-11-16T01:35:00.000Z"
  }
}
```

#### Event: `ALERT_TRIGGERED`
Emitted when a metric crosses configured bounds (and outside quiet hours):
```json
{
  "event": "ALERT_TRIGGERED",
  "data": {
    "gardenId": 1,
    "alertId": 104,
    "zoneId": 2,
    "zoneName": "South Bed",
    "metric": "SOIL_MOISTURE",
    "triggeredValue": 22.1,
    "thresholdValue": 25.0,
    "severity": "WARNING",
    "message": "Critical low soil moisture detected in South Bed (22.1% < 25.0%).",
    "timestamp": "2026-11-16T01:35:00.000Z"
  }
}
```

#### Event: `TASK_UPDATED`
Emitted when a collaborator completes or reschedules a care task:
```json
{
  "event": "TASK_UPDATED",
  "data": {
    "gardenId": 1,
    "taskId": 14,
    "zoneId": 2,
    "taskType": "WATER",
    "isCompleted": true,
    "completedBy": "Jane Gardener",
    "timestamp": "2026-11-16T01:35:00.000Z"
  }
}
```

### 3.3 Heartbeat & Auto-Reconnection Protocol
* **Ping / Pong:** Server transmits WebSocket ping frames every 30 seconds. If client does not reply with pong within 10 seconds, server closes socket.
* **Client Auto-Reconnect:** Vue 3 `wsClient.js` employs exponential backoff ($1\text{s}, 2\text{s}, 4\text{s}, \dots, \max 30\text{s}$) upon connection interruption, automatically rebinding to the active garden channel once network restores.
* **Reconnect State Reconciliation:**
  Network disconnects during mobile operation or temporary Wi-Fi dropouts can cause clients to miss event frames emitted during the interruption. To guarantee state eventual consistency without heavy server-side message queuing:
  1. **Immediate Channel Re-subscription:** Upon successful WebSocket reconnect, the client re-subscribes to `garden:<gardenId>`.
  2. **Selective State Fetch:** The client concurrently dispatches lightweight REST reconciliation requests:
     - `GET /api/zones/:id/readings?limit=1` for active zones to refresh dial gauges with latest telemetry.
     - `GET /api/zones/:zoneId/alerts/logs?is_read=false` to synchronize unread alert badges and toasts.
     - `GET /api/zones/:zoneId/tasks?is_completed=false` to reconcile newly completed or rescheduled care tasks.
  3. **Idempotent UI Store Merge:** Pinia stores merge incoming REST records using primary keys (`id`), ensuring duplicate frames do not create phantom entries in the reactive UI.
