# Smart Gardening System — Rules Engine & Business Logic Specification

**Document Version:** 1.1  
**Status:** Approved Business Logic Specification  
**Core Technologies:** Node.js v20 LTS · `node-cron` · Sequelize ORM · MariaDB 10.11  

---

## 1. Automation Rule Evaluation Engine Architecture

The Smart Gardening System incorporates an event- and schedule-driven automation engine that continuously evaluates environmental microclimate sensor readings and localized weather forecasts to perform autonomous horticultural actions.

### 1.1 Scheduler Architecture
* **Runner Framework:** In-process cron runner via `node-cron`.
* **Execution Interval:** Evaluated **every 15 minutes** (`*/15 * * * *`).
* **Evaluation Scope:** Iterates over all active automation rules (`automation_rules.is_active = true`), grouping rules by target zone to minimize database reads and leverage cached sensor values.

### 1.2 Multi-Condition Rule Evaluation Flowchart

```text
[Cron Tick: Every 15 Minutes (node-cron)]
   │
   ▼
1. Fetch all active rules:
   SELECT * FROM automation_rules WHERE is_active = true
   │
   ▼
2. For each rule:
   ├─► Check Tier 1: Cooldown & Daily Cap Guard
   │   ├─ Rule triggered within cooldown window?
   │   │  TIMESTAMPDIFF(MINUTE, last_triggered_at, NOW()) < cooldown_minutes ──► SKIP
   │   │  [JS Eqv: Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMinutes * 60000]
   │   └─ Dynamic Local Date Check & Execution Cap:
   │      - If rule.last_execution_date !== getLocalDate(garden.timezone): reset rule.executions_today = 0
   │      - Daily limit reached? (executions_today >= max_daily_executions) ──► SKIP
   │
   ├─► Fetch Zone & Garden Context:
   │   └─ Resolve Zone (is_outdoor, area_sq_m) & Garden (timezone, latitude, longitude)
   │
   ├─► Retrieve Latest Zone Sensor Reading:
   │   └─ Query sensor_readings for zone_id (most recent within past 60 minutes)
   │      No recent telemetry? ──► Log warning & SKIP (prevents stale actions)
   │
   ├─► Evaluate Sensor Condition:
   │   Compare reading[rule.metric] against rule.threshold_value using rule.operator:
   │   - 'LT' (Less Than): reading < threshold
   │   - 'GT' (Greater Than): reading > threshold
   │   - 'EQ' (Equal To): |reading - threshold| <= epsilon
   │   Condition False? ──► SKIP
   │
   ├─► Evaluate Meteorological Condition (Weather Guard):
   │   - If rule.weather_condition === 'NO_RAIN' AND zone.is_outdoor === true:
   │       Fetch spatial weather forecast (from weather_cache)
   │       If rainProbability >= 60%:
   │         SKIP rule action & log postponement ("RAIN_POSTPONED")
   │   - If zone.is_outdoor === false:
   │       Ignore weather condition (indoor plants rely purely on soil sensors)
   │
   ├─► Check Tier 2: Action Deduplication Guard
   │   ├─ If action_type === 'CREATE_TASK' (e.g. WATER):
   │   │    Query care_tasks WHERE zone_id = rule.zone_id AND task_type = 'WATER' AND is_completed = false
   │   │    Pending task already exists? ──► SKIP (Task already queued)
   │   │
   │   └─ If action_type === 'SEND_ALERT':
   │        Check Tier 3: Quiet Hours & Alert Cooldown
   │        Current local garden time within quiet window? ──► Suppress notification, log silent in-app record
   │
   └─► Execute Action & Atomic Rule State Update:
       - Insert CareTask or AlertLog
       - Broadcast live WebSocket frame to garden channel
       - Atomic Conditional Update:
         UPDATE automation_rules
         SET executions_today = executions_today + 1,
             last_triggered_at = NOW(),
             last_execution_date = :currentLocalDate
         WHERE id = :id AND executions_today < max_daily_executions;
```

---

## 2. Multi-Layer Deduplication & Cooldown Mechanism

Autonomous systems evaluating continuous sensor streams frequently encounter hysteresis and boundary oscillations (e.g. moisture fluctuating around a 30% threshold every 3 minutes). Without robust deduplication, a system would flood users with hundreds of redundant care tasks and alert notifications.

The Smart Gardening System implements a mandatory **3-layer deduplication guard**:

### Layer 1: Rule-Level Cooldown & Daily Execution Caps
* **`cooldown_minutes` (Default 180 Minutes / 3 Hours):**
  * Following any successful action dispatch, the rule enters an inactive cooldown period.
  * **Database SQL Check:**
    ```sql
    TIMESTAMPDIFF(MINUTE, last_triggered_at, NOW()) < cooldown_minutes
    ```
  * **JavaScript Epoch Millisecond Equivalent:**
    ```javascript
    Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMinutes * 60000
    ```
  * If the elapsed time since `last_triggered_at` is less than `cooldown_minutes`, execution is skipped.
* **Daily Execution Capping (`max_daily_executions`, Default 3) & Dynamic Local-Date Evaluation:**
  * Prevents runaway actuators or catastrophic water valve failures.
  * **Dynamic Local-Date Evaluation (Eliminating Midnight UTC Race Flaws):** Instead of relying on a fragile midnight UTC background reset worker, the engine dynamically evaluates the local calendar date for the garden's configured IANA timezone (`gardens.timezone`):
    ```javascript
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: garden.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); // Formats as 'YYYY-MM-DD'

    if (rule.last_execution_date !== localDate) {
      rule.executions_today = 0;
      rule.last_execution_date = localDate;
    }
    ```
  * **Atomic Conditional Updates (Preventing TOCTOU Concurrency Races):**
    To eliminate Time-of-Check to Time-of-Use (TOCTOU) race conditions when concurrent scheduler ticks or multi-process workers evaluate the same rule, state updates are committed atomically via conditional SQL:
    ```sql
    UPDATE automation_rules
    SET executions_today = executions_today + 1,
        last_triggered_at = NOW(),
        last_execution_date = :localDate
    WHERE id = :id AND executions_today < max_daily_executions;
    ```
    If the update affects 0 rows, another worker has already triggered the rule or the daily cap has been reached; the engine aborts the action execution immediately.

### Layer 2: Pending Care Task Deduplication
* Before the engine creates a new task (e.g. `WATER`, `FERTILIZE`), it queries the database for existing uncompleted tasks in that zone:
  ```sql
  SELECT id FROM care_tasks
  WHERE zone_id = :zone_id
    AND task_type = :task_type
    AND is_completed = FALSE;
  ```
* **Behavior:** If a matching uncompleted task exists, the rule engine immediately skips creation, logging an informational trace: *"Care task 'WATER' already pending for Zone 2. Redundant creation suppressed."*

### Layer 3: Alert Deduplication & Quiet-Hours Suppression
* **Alert Cooldown:** Evaluates `alert_configs.cooldown_minutes` (default 60 mins). If an alert for that specific metric was dispatched within 60 minutes, duplicate notifications are suppressed.
* **Local Quiet Hours Evaluation:**
  1. Retrieve `gardens.timezone` (e.g., `'America/New_York'`).
  2. Compute current local solar clock time formatted as `HH:mm:ss`.
  3. Compare against `quiet_hours_start` and `quiet_hours_end`:
     ```javascript
     function isWithinQuietHours(currentTimeStr, startStr, endStr) {
       if (!startStr || !endStr) return false;
       if (startStr <= endStr) {
         // Window does not span midnight (e.g., 13:00 to 15:00)
         return currentTimeStr >= startStr && currentTimeStr < endStr;
       } else {
         // Window spans midnight (e.g., 22:00 to 07:00)
         return currentTimeStr >= startStr || currentTimeStr < endStr;
       }
     }
     ```
  4. **Suppression Behavior:**
     * If within quiet hours: An `alert_logs` record is inserted with `email_sent = false` and `is_read = false` to preserve the visual dashboard audit trail.
     * High-priority email dispatches (SMTP) and intrusive sound/toast WebSocket alerts are completely suppressed until quiet hours expire.

---

## 3. Weather Forecast Rain-Skip Logic & Spatial Caching Policy

### 3.1 Spatial Grid Caching Policy (`weather_cache`)
To prevent external API rate limiting (e.g. Open-Meteo, Tomorrow.io, OpenWeatherMap) when managing hundreds of gardens across urban areas, forecast queries are quantized into geographic grid cells:
* **Grid Quantization & Negative Zero Normalization:**
  Coordinates are rounded to 2 decimal places ($\approx 1.1\text{ km}$ precision). In IEEE 754 floating-point arithmetic, rounding numbers between `-0.005` and `0` can produce `-0.00`. To ensure canonical grid indexing without bifurcated cache entries, coordinates are normalized via `|| 0` and formatted using `toFixed(2)`:
  ```javascript
  const latGrid = (Math.round(lat * 100) / 100) || 0;
  const lngGrid = (Math.round(lng * 100) / 100) || 0;
  const gridKey = `grid_${latGrid.toFixed(2)}_${lngGrid.toFixed(2)}`;
  ```
  Formula:
  $$\text{lat}_{\text{grid}} = \left(\frac{\lfloor \text{latitude} \times 100 + 0.5 \rfloor}{100}\right) \parallel 0, \quad \text{lng}_{\text{grid}} = \left(\frac{\lfloor \text{longitude} \times 100 + 0.5 \rfloor}{100}\right) \parallel 0$$
  $$\text{grid\_key} = \text{"grid\_" } + \text{lat}_{\text{grid}}\text{.toFixed(2)} + \text{"\_"} + \text{lng}_{\text{grid}}\text{.toFixed(2)}$$
* **Cache TTL (30 Minutes):**
  * When a weather query is triggered, the engine checks `weather_cache WHERE grid_key = :key AND expires_at > NOW()`.
  * If valid cache exists, the payload is returned in under 5ms without making external HTTP requests.
  * If cache is expired or missing, the backend queries the external weather provider, persists the JSON payload, and sets `expires_at = NOW() + INTERVAL 30 MINUTE`.
* **Single-Flight Request Coalescing (Eliminating Thundering-Herd Spikes):**
  When multiple outdoor zones in the same geographic grid trigger weather evaluations simultaneously during the 15-minute cron tick, concurrent cache misses could flood the third-party weather API. The `WeatherService` implements single-flight in-memory promise coalescing:
  ```javascript
  const pendingWeatherRequests = new Map();

  async function getWeatherData(latitude, longitude) {
    const latGrid = (Math.round(latitude * 100) / 100) || 0;
    const lngGrid = (Math.round(longitude * 100) / 100) || 0;
    const gridKey = `grid_${latGrid.toFixed(2)}_${lngGrid.toFixed(2)}`;

    // 1. Fast cache lookup
    const cached = await WeatherCache.findOne({
      where: {
        grid_key: gridKey,
        expires_at: { [Op.gt]: new Date() }
      }
    });
    if (cached) return cached.weather_data;

    // 2. Coalesce in-flight network requests for identical grid cell
    if (pendingWeatherRequests.has(gridKey)) {
      return await pendingWeatherRequests.get(gridKey);
    }

    const requestPromise = (async () => {
      try {
        const freshData = await fetchExternalWeatherForecast(latGrid, lngGrid);
        await WeatherCache.upsert({
          grid_key: gridKey,
          latitude: latGrid,
          longitude: lngGrid,
          weather_data: freshData,
          forecast_timestamp: new Date(),
          fetched_at: new Date(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000)
        });
        return freshData;
      } finally {
        pendingWeatherRequests.delete(gridKey);
      }
    })();

    pendingWeatherRequests.set(gridKey, requestPromise);
    return await requestPromise;
  }
  ```

### 3.2 Rain-Skip Irrigation Logic
Outdoor crops benefit directly from natural precipitation; irrigating immediately prior to heavy rainfall wastes water and risks nutrient leaching and root suffocation.
* **Evaluation Criteria:**
  1. Zone must have `zones.is_outdoor === true`.
  2. Forecast within the subsequent 12 hours must show precipitation probability $\ge 60\%$ or accumulated rainfall $> 5.0\text{ mm}$.
* **Execution Actions:**
  * Automated watering rules evaluating `NO_RAIN` suppress task creation.
  * The scheduler postpones scheduled outdoor watering tasks by updating their `due_date = due_date + 1 DAY` and appending an audit note: *"Postponed by 24h: 85% rain forecasted."*
* **Indoor Zone Exemption:**
  * Indoor zones, raised beds under polytunnels, and enclosed greenhouses (`is_outdoor === false`) are strictly exempted from rain-skip logic. Their irrigation depends entirely on direct soil moisture telemetry.

---

## 4. Plant Spacing & Zone Capacity Calculation

Overcrowding causes stunted vegetable growth, nutrient depletion, reduced fruit sizing, and severe vulnerability to fungal spores (powdery mildew, botrytis) due to restricted canopy airflow.

### 4.1 Botanical Spatial Growth Parameters
Each species in `plant_catalog` defines:
* `spacing_cm`: Recommended distance between individual plants in the same row ($S_p$).
* `row_spacing_cm`: Recommended distance between adjacent rows ($S_r$).
* `spread_radius_cm`: Mature canopy radial spread ($R_c$).
* `min_soil_depth_cm`: Minimum root depth requirement ($D_{\text{min}}$).

### 4.2 Individual Plant Footprint Formula
The required horizontal ground area for a single plant is computed as:
$$\text{Area}_{\text{plant}} = \frac{S_p \times S_r}{10,000} \quad (\text{in square meters, m}^2)$$

*Example (Heirloom Tomato):*
$$S_p = 45\text{ cm}, \quad S_r = 60\text{ cm} \implies \text{Area}_{\text{plant}} = \frac{45 \times 60}{10,000} = 0.27\text{ m}^2$$

*Example (Sweet Basil):*
$$S_p = 20\text{ cm}, \quad S_r = 25\text{ cm} \implies \text{Area}_{\text{plant}} = \frac{20 \times 25}{10,000} = 0.05\text{ m}^2$$

### 4.3 Total Zone Capacity Utilization Formula
For a given zone containing $N$ distinct plant clusters, the total occupied ground area is:
$$\text{Area}_{\text{occupied}} = \sum_{i=1}^N \left( \text{quantity}_i \times \text{Area}_{\text{plant}, i} \right) = \sum_{i=1}^N \left( \text{quantity}_i \times \frac{S_{p, i} \times S_{r, i}}{10,000} \right)$$

The **Utilization Ratio ($U$)** relative to usable bed area (`zones.area_sq_m`) is:
$$U = \frac{\text{Area}_{\text{occupied}}}{\text{zone.area\_sq\_m}}$$

#### Division-by-Zero Guard & Null Safety
In practical gardening workflows, a zone may be created before area dimensions are finalized (`zone.area_sq_m <= 0`), or a bed may have zero active plantings (`Area_occupied == 0`). To prevent arithmetic division-by-zero, `NaN`, `Infinity`, or broken JSON serialization (`null` or unparseable tokens), the engine enforces strict defensive guard logic:
```javascript
function calculateZoneCapacity(zoneAreaSqM, zonePlants) {
  // Guard 1: Zero or invalid bed area, or zero crops planted
  if (!zoneAreaSqM || Number(zoneAreaSqM) <= 0) {
    return {
      utilization_ratio: 0.0,
      occupied_area_sq_m: 0.0,
      available_area_sq_m: 0.0,
      status: 'OPTIMAL'
    };
  }

  const occupiedArea = (zonePlants || []).reduce((acc, zp) => {
    const spacing = zp.plant?.spacing_cm || zp.spacing_cm || 30;
    const rowSpacing = zp.plant?.row_spacing_cm || zp.row_spacing_cm || 45;
    const footprintSqM = (spacing * rowSpacing) / 10000;
    return acc + (Number(zp.quantity || 0) * footprintSqM);
  }, 0);

  // Guard 2: Empty bed
  if (occupiedArea <= 0) {
    return {
      utilization_ratio: 0.0,
      occupied_area_sq_m: 0.0,
      available_area_sq_m: Number(zoneAreaSqM),
      status: 'OPTIMAL'
    };
  }

  const ratio = Math.round((occupiedArea / Number(zoneAreaSqM)) * 100) / 100;
  let status = 'OPTIMAL';
  if (ratio > 1.00) {
    status = 'OVERCROWDED';
  } else if (ratio > 0.85) {
    status = 'DENSE';
  }

  return {
    utilization_ratio: ratio,
    occupied_area_sq_m: Math.round(occupiedArea * 100) / 100,
    available_area_sq_m: Number(zoneAreaSqM),
    status
  };
}
```

### 4.4 Utilization Classification & Warning System

```text
Utilization Ratio (U)
├── 0.00 <= U <= 0.85 ──► Status: OPTIMAL
│                         - Excellent canopy airflow
│                         - High solar penetration to base leaves
│                         - Healthy root expansion margin
│
├── 0.85 < U <= 1.00  ──► Status: DENSE
│                         - Intensive planting (e.g., Square Foot Gardening)
│                         - Requires diligent pruning and consistent fertilization
│                         - Acceptable with adequate ventilation
│
└── U > 1.00          ──► Status: OVERCROWDED
                          - Zone capacity exceeded
                          - High risk of root bound competition and fungal blight
                          - System emits warning metadata in API response
```

#### Non-Blocking API Advisory Response
When $U > 1.0$, the API permits the operation but delivers actionable advisory feedback in `meta`:
```json
{
  "success": true,
  "data": {
    "zone_plant": { "id": 12, "quantity": 15, "common_name": "Tomato" }
  },
  "meta": {
    "warning": "ZONE_OVERCROWDED",
    "utilization_ratio": 1.35,
    "occupied_area_sq_m": 4.05,
    "available_area_sq_m": 3.00,
    "message": "Zone area of 3.00 m2 is insufficient for current crops requiring 4.05 m2. Recommend reducing plant quantity or transplanting to prevent stunted growth."
  }
}
```

---

## 5. Companion Planting Compatibility Evaluation Logic

Companion planting is an ancient and scientifically proven polyculture technique that pairs plants with complementary growth habits, nutrient requirements, and natural pest-repellent volatiles.

### 5.1 Relational Companion Vectors
Each record in `plant_catalog` stores two JSON string arrays:
* `good_companions`: Species names that foster mutual benefits (nitrogen fixation, pest masking, predatory insect attraction, structural support).
* `bad_companions`: Species names that exhibit allelopathy (chemical growth inhibition), compete heavily for identical soil nutrients, or share devastating insect vectors.

### 5.2 Pairwise Compatibility Algorithm
When an inventory query (`GET /api/zones/:zoneId/plants`) or companion advisory endpoint is invoked, the engine computes a full pairwise compatibility matrix for all active species residing in that zone:

```javascript
function evaluateZoneCompanions(plantsInZone) {
  const goodMatches = [];
  const badMatches = [];
  const processedPairs = new Set();

  for (let i = 0; i < plantsInZone.length; i++) {
    for (let j = i + 1; j < plantsInZone.length; j++) {
      const plantA = plantsInZone[i];
      const plantB = plantsInZone[j];

      const pairKey = [plantA.catalogId, plantB.catalogId].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Check Good Companions
      const aLikesB = plantA.goodCompanions.includes(plantB.commonName);
      const bLikesA = plantB.goodCompanions.includes(plantA.commonName);
      if (aLikesB || bLikesA) {
        goodMatches.push({
          plantA: plantA.commonName,
          plantB: plantB.commonName,
          reason: getCompanionSynergyReason(plantA.commonName, plantB.commonName)
        });
      }

      // Check Bad Companions
      const aHatesB = plantA.badCompanions.includes(plantB.commonName);
      const bHatesA = plantB.badCompanions.includes(plantA.commonName);
      if (aHatesB || bHatesA) {
        badMatches.push({
          plantA: plantA.commonName,
          plantB: plantB.commonName,
          reason: getCompanionConflictReason(plantA.commonName, plantB.commonName)
        });
      }
    }
  }

  return {
    synergies: goodMatches,
    conflicts: badMatches,
    overallCompatibilityScore: calculateCompatibilityScore(goodMatches.length, badMatches.length)
  };
}
```

### 5.3 Authoritative Reference Synergy & Conflict Rules

| Primary Plant | Synergistic Companion (`good_companions`) | Horticultural Benefit | Antagonistic Plant (`bad_companions`) | Horticultural Conflict |
| :--- | :--- | :--- | :--- | :--- |
| **Tomato** (*Solanum lycopersicum*) | **Sweet Basil** (*Ocimum basilicum*), **French Marigold** (*Tagetes patula*), **Carrot** (*Daucus carota*) | Basil improves tomato vigor and repels thrips and hornworms; Marigold roots exude alpha-terthienyl, suppressing parasitic root-knot nematodes. | **Fennel** (*Foeniculum vulgare*), **Potato** (*Solanum tuberosum*), **Cabbage** (*Brassica oleracea*) | Fennel produces allelopathic compounds that stunt tomato growth; Potatoes share early and late blight susceptibility (*Phytophthora infestans*). |
| **Sweet Basil** (*Ocimum basilicum*) | **Tomato**, **Bell Pepper** (*Capsicum annuum*) | Concentrated aromatic essential oils mask solanaceous host crops from aphids and spider mites. | **Common Rue** (*Ruta graveolens*), **Sage** (*Salvia officinalis*) | Rue inhibits basil growth and moisture competition causes leaf drop. |
| **Carrot** (*Daucus carota*) | **Rosemary** (*Salvia rosmarinus*), **Leek**, **Lettuce** | Strong volatile scent of rosemary and leek confuses and deters the carrot rust fly (*Psila rosae*). | **Dill** (*Anethum graveolens*), **Fennel** | Can cross-pollinate with wild carrot cousins and attracts shared umbellifer pests. |
| **Bell Pepper** (*Capsicum annuum*) | **Sweet Basil**, **French Marigold**, **Oregano** | Low ground cover herbs conserve soil moisture; marigolds deter whiteflies. | **Fennel**, **Kohlrabi**, **Apricot tree** | Fennel roots secrete growth-inhibiting terpenes. |
| **Cucumber** (*Cucumis sativus*) | **Nasturtium** (*Tropaeolum majus*), **Dill**, **Radish** | Nasturtiums act as a sacrificial trap crop for aphids and repel cucumber beetles. | **Potato**, **Aromatic Herbs** (Sage, Rosemary) | Aromatic wood herbs inhibit cucurbit vine expansion. |
| **Green Bean** (*Phaseolus vulgaris*) | **Summer Savory** (*Satureja hortensis*), **Corn**, **Cucumber** | Legume root nodules harbor *Rhizobium* bacteria, fixing atmospheric nitrogen for heavy-feeding companions. | **Onion** (*Allium cepa*), **Garlic** (*Allium sativum*) | Allium sulfur compounds kill beneficial *Rhizobium* root bacteria on legume nodules. |

### 5.4 Zone Compatibility Scoring Metric
The overall companion health score for a zone is computed on a scale of 0 to 100:
$$\text{Score} = \text{clamp}\left( 70 + (10 \times \text{synergies}) - (25 \times \text{conflicts}), 0, 100 \right)$$
* **90–100 (Optimal Guild):** Strong symbiotic guild with mutual pest protection.
* **65–89 (Neutral):** Standard mixed bed without major biochemical antagonism.
* **$< 65$ (Conflict Detected):** Contains antagonistic pairings; frontend highlights affected plant cards with red warning badges and relocation advice.
