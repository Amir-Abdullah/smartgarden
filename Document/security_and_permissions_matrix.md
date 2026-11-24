# Smart Gardening System — Security & Permissions Matrix

**Document Version:** 1.1  
**Status:** Approved Security Architecture Baseline  
**Target Runtime:** Node.js v20 LTS · Fastify · `@fastify/jwt` · `bcryptjs`  

---

## 1. Authentication Architecture & Credential Policies

The Smart Gardening System implements a defense-in-depth security model protecting user identity, multi-tenant garden boundaries, and high-frequency IoT hardware telemetry.

### 1.1 User Password Hashing Policy
* **Algorithm:** Salted `bcrypt` using `bcryptjs`.
* **Work Factor (Cost Factor):** `10` rounds ($\approx 2^{10}$ iterations), calibrated to provide high resistance against offline dictionary and brute-force GPU attacks while maintaining sub-100ms API response latency during registration and authentication.
* **Password Complexity Policy:**
  * Minimum length: 8 characters; maximum length: 128 characters.
  * Validation: Requires at least one uppercase letter, one lowercase letter, and one numeric or special character.
* **Zero Plaintext Storage:** Plaintext passwords are never logged, stored in cache, or returned in API responses.

### 1.2 JWT Session Authentication Specification
* **Fastify Plugin:** `@fastify/jwt`
* **Cryptographic Algorithm:** HMAC using SHA-256 (`HS256`)
* **Secret Configuration:** Loaded via environment variable `JWT_SECRET` (minimum 32-byte high-entropy string; development fallback provided for isolated testing).
* **Token Expiration (TTL):** 7 days (`expiresIn: '7d'`), balancing user convenience on mobile/desktop browsers with exposure boundaries.
* **Token Transport:** Standard HTTP request header:
  `Authorization: Bearer <signed_jwt_token>`
* **Token Payload Claims Schema:**
  ```json
  {
    "id": 42,
    "email": "gardener@example.com",
    "name": "Jane Doe",
    "is_admin": false,
    "iat": 1778980000,
    "exp": 1779584800
  }
  ```

### 1.3 Password Reset Token Lifecycle & Security
To prevent user enumeration and credential hijacking, password resets operate via a dedicated, time-bounded token architecture:

```text
User Requests Reset (POST /api/auth/forgot-password)
   │
   ▼
1. Query user by email (case-insensitive lookup).
   - If user not found: Return 200 OK immediately with generic message:
     "If an account with that email exists, password reset instructions have been sent."
   - (Prevents user enumeration attacks)
   │
   ▼
2. If user exists:
   - Generate 32 bytes of cryptographically secure random data:
     rawToken = crypto.randomBytes(32).toString('hex')  (64 hex characters)
   - Compute SHA-256 digest:
     tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
   - Insert into dedicated `password_reset_tokens` table:
     INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (user.id, tokenHash, DATE_ADD(NOW(), INTERVAL 60 MINUTE));
   │
   ▼
3. Dispatch email containing link with rawToken:
   https://app.smartgarden.com/reset-password?token=<rawToken>
   │
   ▼
User Submits New Password (POST /api/auth/reset-password)
   │
   ▼
4. Verify Token:
   - Compute hash of incoming token:
     incomingHash = crypto.createHash('sha256').update(payload.token).digest('hex')
   - Query:
     SELECT * FROM password_reset_tokens
     WHERE token_hash = incomingHash
       AND used_at IS NULL
       AND expires_at > NOW();
   - If no valid record: Return HTTP 400 Bad Request ("INVALID_OR_EXPIRED_TOKEN")
   │
   ▼
5. Execute Password Update in Atomic Transaction:
   - newHash = bcrypt.hash(payload.new_password, 10)
   - UPDATE users SET password_hash = newHash WHERE id = tokenRecord.user_id;
   - UPDATE password_reset_tokens SET used_at = NOW() WHERE id = tokenRecord.id;
   - Invalidate all other pending reset tokens for this user.
```

### 1.4 Supabase OAuth2 Google Authentication Architecture
To support modern frictionless social authentication while preserving stateless backend JWT integrity, OAuth is federated through Supabase Auth:

1. **Frontend Authorization Redirect:** Client initiates flow via Supabase Auth OAuth endpoint (`https://<project>.supabase.co/auth/v1/authorize?provider=google&redirect_to=<origin>/auth/callback`).
2. **Provider Callback Handling:** The client catches the incoming authorization token at `/auth/callback` and dispatches `POST /api/auth/oauth` with `{ provider: 'google', access_token }`.
3. **Server-Side Token Verification:** Fastify backend verifies the access token directly with the Supabase Auth server (`GET /auth/v1/user`), validating the user's Google email and unique subject ID (`google_id`).
4. **Account Linkage & Provisioning:**
   - If an account exists with matching `email` or `google_id`, the system attaches `google_id` if missing and generates a SmartGarden JWT.
   - If no account exists, a new user is provisioned with high-entropy random password hash, linking the identity.
5. **Standard Session Token:** Returns the standard HS256 JWT session token, ensuring all downstream RBAC and route protection mechanisms function identically.

---

## 2. Garden Role-Based Access Control (RBAC) Architecture

Access to garden resources is governed by a multi-tenant hierarchy rooted in `garden_members`.

### 2.1 Role Definitions
1. **`OWNER` (Tier 3 - Full Garden Authority):**
   * The creator of the garden or a promoted owner. Holds full administrative authority over the garden, its zones, devices, members, billing, and lifecycle.
   * Can delete the garden (cascading all data), invite new members, alter member roles, remove members, and configure automation rules.
   * Safety Guard: The sole owner of a garden cannot leave or demote themselves without first transferring ownership to another member.
2. **`FAMILY` (Tier 2 - Active Co-Gardener):**
   * Household member or trusted co-caretaker.
   * Can create and modify zones, assign and update crops in zone plant inventory, create and complete care tasks, log growth journals, record irrigation, and configure alert thresholds.
   * Cannot delete the garden, modify garden metadata, or manage memberships/invitations.
3. **`GUEST` (Tier 1 - Read-Only Observer / Plant Sitter):**
   * Neighbor, friend, or temporary visitor.
   * Can view garden overview, zones, planted crops, sensor telemetry charts, and task lists (`GET` requests only).
   * Cannot mutate any state (no zone creation, plant modification, task completion, or rule editing).
   * Optional time-bounding via `expires_at`: Access is automatically revoked once `NOW() >= expires_at`.
4. **`ADMIN` (Platform Superuser):**
   * System-level administrator indicated by `users.is_admin = true`.
   * Bypasses garden membership checks for technical support and audits. Holds exclusive authority over the master `plant_catalog` and community content moderation.

---

## 3. Comprehensive Permissions Matrix

| Resource / Entity | Operation / Endpoint | OWNER | FAMILY | GUEST | ADMIN | Architectural Rule / Precondition |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Auth / Profile** | `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ | Any valid JWT session. |
| **Gardens** | `GET /api/gardens` | ✅ | ✅ | ✅ | ✅ | Lists only gardens where user is an active member. |
| **Gardens** | `POST /api/gardens` | ✅ | ✅ | ✅ | ✅ | Any authenticated user can create a garden (becomes OWNER). |
| **Gardens** | `GET /api/gardens/:id` | ✅ | ✅ | ✅ | ✅ | Active garden member (`expires_at > NOW()`). |
| **Gardens** | `PUT /api/gardens/:id` | ✅ | ❌ | ❌ | ✅ | OWNER only. |
| **Gardens** | `DELETE /api/gardens/:id` | ✅ | ❌ | ❌ | ✅ | OWNER only; cascades all child zones, plants, devices. |
| **Members** | `GET /api/gardens/:id/members` | ✅ | ✅ | ✅ | ✅ | All active members of the garden. |
| **Members** | `PUT /api/gardens/:id/members/:userId`| ✅ | ❌ | ❌ | ✅ | OWNER only; cannot demote sole OWNER. |
| **Members** | `DELETE /api/gardens/:id/members/:userId`| ✅ | ❌ | ❌ | ✅ | OWNER can remove any; user can remove self. |
| **Invitations** | `POST /api/gardens/:id/invitations` | ✅ | ❌ | ❌ | ✅ | OWNER only. |
| **Invitations** | `DELETE /api/gardens/:id/invitations/:invId`| ✅ | ❌ | ❌ | ✅ | OWNER only. |
| **Invitations** | `POST /api/invitations/:token/accept` | ✅ | ✅ | ✅ | ✅ | Authenticated user matching invitation. |
| **Invitations** | `POST /api/invitations/:token/reject` | ✅ | ✅ | ✅ | ✅ | Any recipient. |
| **Zones** | `GET /api/gardens/:gardenId/zones` | ✅ | ✅ | ✅ | ✅ | Active garden member. |
| **Zones** | `POST /api/gardens/:gardenId/zones` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only. |
| **Zones** | `GET /api/zones/:id` | ✅ | ✅ | ✅ | ✅ | Resolved via `zones.garden_id`. |
| **Zones** | `PUT /api/zones/:id` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Zones** | `DELETE /api/zones/:id` | ✅ | ❌ | ❌ | ✅ | OWNER only (resolved). |
| **Catalog** | `GET /api/catalog` & `/:id` | ✅ | ✅ | ✅ | ✅ | All authenticated users. |
| **Catalog** | `POST/PUT/DELETE /api/catalog` | ❌ | ❌ | ❌ | ✅ | ADMIN only (`user.is_admin === true`). |
| **Zone Plants** | `GET /api/zones/:zoneId/plants` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Zone Plants** | `POST /api/zones/:zoneId/plants` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Zone Plants** | `PUT /api/zones/:zoneId/plants/:plantId` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Zone Plants** | `DELETE /api/zones/:zoneId/plants/:plantId`| ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Care Tasks** | `GET /api/zones/:zoneId/tasks` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Care Tasks** | `POST /api/zones/:zoneId/tasks` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Care Tasks** | `PATCH /api/zones/:zoneId/tasks/:taskId` | ✅ | ✅ | ❌ | ✅ | Complete/reschedule task (resolved). |
| **Care Tasks** | `DELETE /api/zones/:zoneId/tasks/:taskId` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Water Logs** | `GET /api/gardens/:id/water-logs` | ✅ | ✅ | ✅ | ✅ | Active garden member. |
| **Water Logs** | `POST /api/zones/:zoneId/water-logs` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Telemetry Ingest**| `POST /api/sensors/ingest` | 🤖 | 🤖 | 🤖 | 🤖 | Authenticated via `X-Device-Key` (device probe). |
| **Sensor Readings**| `GET /api/zones/:id/readings` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Automation Rules**| `GET /api/zones/:zoneId/rules` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Automation Rules**| `POST/PUT/DELETE /api/zones/:zoneId/rules`| ✅ | ❌ | ❌ | ✅ | OWNER only (resolved). |
| **Alert Configs** | `GET /api/zones/:zoneId/alerts/config` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Alert Configs** | `PUT /api/zones/:zoneId/alerts/config` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Alert Logs** | `GET /api/zones/:zoneId/alerts/logs` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Weather** | `GET /api/weather` | ✅ | ✅ | ✅ | ✅ | Any authenticated user. |
| **Growth Journals**| `GET /api/plants/:id/journal` | ✅ | ✅ | ✅ | ✅ | Active garden member (resolved). |
| **Growth Journals**| `POST /api/plants/:id/journal` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only (resolved). |
| **Reports / PDF** | `GET /api/gardens/:id/report` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only. |
| **AI Vision/Chat** | `POST /api/ai/diagnose-leaf` / `chat` | ✅ | ✅ | ❌ | ✅ | OWNER & FAMILY only. |
| **Community Feed** | `GET /api/community/posts` | ✅ | ✅ | ✅ | ✅ | Public / Authenticated. |
| **Community Posts**| `POST /api/community/posts` | ✅ | ✅ | ✅ | ✅ | Any authenticated user. |
| **Community Mod** | `DELETE /api/community/posts/:id` | ❌ | ❌ | ❌ | ✅ | Post author or ADMIN only. |

---

## 4. Resource-to-Garden Resolver PreHandler Hook Algorithm

Because RESTful API best practices encourage natural hierarchical paths (e.g. `GET /api/zones/:id`, `POST /api/zones/:zoneId/plants`, `PATCH /api/zones/:zoneId/tasks/:taskId`), child routes do not explicitly include `:gardenId`.

The `resolveGardenAndRole(requiredMinRole)` hook dynamically resolves the parent garden, validates caller membership, and rejects unauthorized access before the controller executes.

### 4.1 Resolution Flowchart

```text
Incoming HTTP Request (e.g. POST /api/zones/14/plants)
   │
   ▼
[Step 1: Extract Resource Identifiers]
Check request params in priority order:
- params.gardenId or params.id (in garden routes, e.g. /api/gardens/:id)        --> targetGardenId = id
- params.zoneId or params.id (in zone routes, e.g. /api/zones/:id)            --> Lookup Zone(id).garden_id
- params.plantId or params.id (in plant routes, e.g. /api/plants/:id/journal) --> Lookup ZonePlant(id) -> Zone -> garden_id
- params.taskId or params.id (in task routes, e.g. /api/tasks/:id)             --> Lookup CareTask(id) -> Zone -> garden_id
- params.deviceId                                                             --> Lookup Device(id) -> Zone -> garden_id
   │
   ├─► Entity ID Not Found in Database?
   │   └─► Terminate immediately with HTTP 404 Not Found:
   │       { "success": false, "error": { "code": "RESOURCE_NOT_FOUND", "message": "Resource not found", "statusCode": 404 } }
   │       (Note: Prevents permission enumeration)
   │
   ▼
[Step 2: Platform Administrator Superuser Bypass]
- Check: request.user && request.user.is_admin === true
- If true:
    Attach request.resolvedGardenId = targetGardenId
    Attach request.gardenRole = 'ADMIN'
    Proceed to Controller Handler (Bypass membership check)
   │
   ▼
[Step 3: Query Garden Membership]
Execute parameterized lookup:
SELECT role, expires_at FROM garden_members
WHERE garden_id = :targetGardenId AND user_id = :request.user.id
   │
   ├─► No Record Returned?
   │   └─► Terminate with HTTP 403 Forbidden:
   │       { "success": false, "error": { "code": "NOT_A_GARDEN_MEMBER", "message": "Access denied: Not a member of this garden.", "statusCode": 403 } }
   │
   ▼
[Step 4: Check Guest Expiration]
- If member.role === 'GUEST' AND member.expires_at IS NOT NULL AND member.expires_at < NOW():
    Terminate with HTTP 403 Forbidden:
    { "success": false, "error": { "code": "GUEST_ACCESS_EXPIRED", "message": "Your temporary guest access to this garden has expired.", "statusCode": 403 } }
   │
   ▼
[Step 5: Verify Role Permission Hierarchy]
Map roles to numerical privilege rank:
- OWNER:  3
- FAMILY: 2
- GUEST:  1
- If memberRoleRank < requiredMinRoleRank:
    Terminate with HTTP 403 Forbidden:
    { "success": false, "error": { "code": "INSUFFICIENT_PERMISSIONS", "message": "Insufficient permissions for this action.", "statusCode": 403 } }
   │
   ▼
[Step 6: Context Binding & Controller Invocation]
- Attach request.resolvedGardenId = targetGardenId
- Attach request.gardenRole = member.role
- Invoke Route Handler
```

### 4.2 Middleware Implementation Blueprint (`middleware/rbac.js`)

```javascript
const { Zone, ZonePlant, CareTask, Device, GardenMember } = require('../models');

const ROLE_RANKS = {
  GUEST: 1,
  FAMILY: 2,
  OWNER: 3,
  ADMIN: 4
};

function resolveGardenAndRole(allowedRoles = ['OWNER', 'FAMILY', 'GUEST']) {
  return async function preHandlerHook(request, reply) {
    const { user } = request;
    if (!user) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 }
      });
    }

    let gardenId = request.params.gardenId;

    // 1. Resolve Garden ID from child resources if not explicitly in params
    if (!gardenId) {
      if (request.params.zoneId || (request.routerPath && request.routerPath.includes('/zones/:id'))) {
        const zoneId = request.params.zoneId || request.params.id;
        const zone = await Zone.findByPk(zoneId, { attributes: ['id', 'garden_id'] });
        if (!zone) {
          return reply.code(404).send({
            success: false,
            error: { code: 'ZONE_NOT_FOUND', message: `Zone ${zoneId} not found`, statusCode: 404 }
          });
        }
        gardenId = zone.garden_id;
      } else if (request.params.plantId || (request.routerPath && (request.routerPath.includes('/plants/:id') || request.routerPath.includes('/zones/:zoneId/plants/:plantId')))) {
        const plantId = request.params.plantId || request.params.id;
        const plant = await ZonePlant.findByPk(plantId, {
          include: [{ model: Zone, attributes: ['garden_id'] }]
        });
        if (!plant || !plant.Zone) {
          return reply.code(404).send({
            success: false,
            error: { code: 'PLANT_NOT_FOUND', message: `Plant record not found`, statusCode: 404 }
          });
        }
        gardenId = plant.Zone.garden_id;
      } else if (request.params.taskId || (request.routerPath && request.routerPath.includes('/tasks/:id'))) {
        const taskId = request.params.taskId || request.params.id;
        const task = await CareTask.findByPk(taskId, {
          include: [{ model: Zone, attributes: ['garden_id'] }]
        });
        if (!task || !task.Zone) {
          return reply.code(404).send({
            success: false,
            error: { code: 'TASK_NOT_FOUND', message: `Task not found`, statusCode: 404 }
          });
        }
        gardenId = task.Zone.garden_id;
      } else if (request.params.id && request.routerPath && request.routerPath.includes('/gardens/:id')) {
        gardenId = request.params.id;
      }
    }

    if (!gardenId) {
      return reply.code(400).send({
        success: false,
        error: { code: 'GARDEN_CONTEXT_MISSING', message: 'Unable to resolve target garden context', statusCode: 400 }
      });
    }

    // 2. Admin superuser bypass
    if (user.is_admin) {
      request.resolvedGardenId = gardenId;
      request.gardenRole = 'ADMIN';
      return;
    }

    // 3. Verify membership
    const membership = await GardenMember.findOne({
      where: { garden_id: gardenId, user_id: user.id }
    });

    if (!membership) {
      return reply.code(403).send({
        success: false,
        error: { code: 'NOT_A_GARDEN_MEMBER', message: 'Access denied: You are not a member of this garden', statusCode: 403 }
      });
    }

    // 4. Check guest expiration
    if (membership.role === 'GUEST' && membership.expires_at && new Date(membership.expires_at) <= new Date()) {
      return reply.code(403).send({
        success: false,
        error: { code: 'GUEST_ACCESS_EXPIRED', message: 'Your guest access to this garden has expired', statusCode: 403 }
      });
    }

    // 5. Check allowed roles
    if (!allowedRoles.includes(membership.role)) {
      return reply.code(403).send({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient garden role for this operation', statusCode: 403 }
      });
    }

    // 6. Bind context to request
    request.resolvedGardenId = gardenId;
    request.gardenRole = membership.role;
  };
}

module.exports = { resolveGardenAndRole, ROLE_RANKS };
```

### 4.3 Compound Scoping & Insecure Direct Object Reference (IDOR) Prevention

In RESTful APIs featuring nested resource identifiers (e.g., `PUT /api/zones/:zoneId/plants/:plantId` or `DELETE /api/zones/:zoneId/plants/:plantId`), authorizing the caller against the parent `:zoneId` or parent garden alone is necessary but **insufficient** to prevent Insecure Direct Object Reference (IDOR) vulnerabilities.

#### The Multi-ID Vulnerability Vector
If a controller queries or mutates the child entity using only the primary key (`findByPk(request.params.plantId)`), a malicious user with legitimate `FAMILY` or `OWNER` permissions in Zone 1 could supply `:zoneId = 1` while substituting `:plantId = 99` (a plant belonging to Zone 4 in another user's garden). If the route resolver authorizes access based on Zone 1, an un-scoped update would compromise plant 99.

#### Mandatory Compound Scoping Rule
All controllers operating on multi-ID routes **must enforce compound scoping** across both the child primary key and the parent foreign key in all database queries (`findOne`, `update`, `destroy`):

```javascript
// Secure Compound Scoping Pattern in Controllers:
const { zoneId, plantId } = request.params;

const plant = await ZonePlant.findOne({
  where: {
    id: plantId,
    zone_id: zoneId
  }
});

if (!plant) {
  // Return 404 regardless of whether plantId exists elsewhere (prevents resource enumeration)
  return reply.code(404).send({
    success: false,
    error: {
      code: 'PLANT_NOT_FOUND',
      message: `Plant ${plantId} not found in Zone ${zoneId}`,
      statusCode: 404
    }
  });
}
```

This compound constraint guarantees that:
1. Every child entity is strictly anchored to its parent container.
2. Even if an attacker guesses another tenant's primary key, cross-zone and cross-garden tampering is rendered cryptographically and relationally impossible.

---

## 5. IoT Device Key Hashing & Validation

To secure edge microcontrollers and software simulators streaming telemetry into `POST /api/sensors/ingest`, the system uses an indexed prefix hashing scheme. Plaintext keys are never persisted in the database.

### 5.1 Key Generation Protocol
1. **Raw Key Generation:**
   * When an IoT device is registered or claimed, the backend generates 24 cryptographically secure random bytes:
     ```javascript
     const crypto = require('crypto');
     const rawEntropy = crypto.randomBytes(24).toString('hex'); // 48 hex characters
     const rawKey = `sg_live_${rawEntropy}`;                    // 56 characters total
     ```
2. **Extraction & Hashing:**
   * `key_prefix`: First 16 characters (`rawKey.substring(0, 16)`, e.g. `'sg_live_7a8b9c0d'`).
   * `key_hash`: SHA-256 hex digest of the complete `rawKey`:
     ```javascript
     const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
     ```
3. **Database Storage:**
   * MariaDB stores `key_prefix` (indexed) and `key_hash` (unique index).
   * The raw key is returned to the user or device provisioning workflow exactly once upon creation.

### 5.2 Verification Pipeline (`middleware/verifyDeviceKey.js`)

```javascript
const crypto = require('crypto');
const { Device, Zone } = require('../models');

async function verifyDeviceKey(request, reply) {
  const rawKey = request.headers['x-device-key'];

  if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('sg_live_')) {
    return reply.code(401).send({
      success: false,
      error: {
        code: 'MISSING_OR_INVALID_DEVICE_KEY',
        message: 'Valid header X-Device-Key starting with sg_live_ is required',
        statusCode: 401
      }
    });
  }

  const prefix = rawKey.substring(0, 16);
  const computedHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Fast index query on key_prefix
  const candidateDevices = await Device.findAll({
    where: { key_prefix: prefix, is_active: true },
    include: [{ model: Zone, attributes: ['id', 'garden_id'] }]
  });

  if (!candidateDevices || candidateDevices.length === 0) {
    return reply.code(401).send({
      success: false,
      error: { code: 'INVALID_DEVICE_KEY', message: 'Device key not recognized or revoked', statusCode: 401 }
    });
  }

  // Constant-time hash verification across candidates
  let matchedDevice = null;
  const computedBuffer = Buffer.from(computedHash, 'utf8');

  for (const device of candidateDevices) {
    const storedBuffer = Buffer.from(device.key_hash, 'utf8');
    if (storedBuffer.length === computedBuffer.length && crypto.timingSafeEqual(storedBuffer, computedBuffer)) {
      matchedDevice = device;
      break;
    }
  }

  if (!matchedDevice) {
    return reply.code(401).send({
      success: false,
      error: { code: 'INVALID_DEVICE_KEY', message: 'Device key not recognized or revoked', statusCode: 401 }
    });
  }

  // Attach authenticated device and its zone/garden context
  request.device = matchedDevice;
  request.resolvedZoneId = matchedDevice.zone_id;
  request.resolvedGardenId = matchedDevice.Zone ? matchedDevice.Zone.garden_id : null;
}

module.exports = verifyDeviceKey;
```
