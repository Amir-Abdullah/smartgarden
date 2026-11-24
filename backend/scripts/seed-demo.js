const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env (and optional root .env) before initializing database config
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dbConfig = require('../config/database');
const {
  User,
  Garden,
  GardenMember,
  Zone,
  PlantCatalog,
  ZonePlant,
  Device,
  SensorReading,
  SensorAggregateDaily,
  CareTask,
  WaterUsageLog,
  AlertConfig,
  AlertLog,
  AutomationRule,
  WeatherCache,
  GrowthJournal,
  CommunityPost,
  CommunityComment,
  NotificationPreference,
  Notification,
  SustainabilityLog,
  SeedPacket,
  PublicProfile
} = require('../models');
const weatherService = require('../services/weatherService');
const { runMigrations } = require('./migrate');
const { runSeed } = require('./seed');

const DEMO_USERS = [
  {
    name: 'Amir Abdullah',
    email: 'abdullahamir142@gmail.com',
    password: process.env.ADMIN_USER_PASSWORD || 'Password123!',
    location_region: 'US-East',
    is_admin: true
  },
  {
    name: 'Demo Gardener',
    email: 'demo@smartgarden.app',
    password: process.env.DEMO_USER_PASSWORD || 'DemoGarden123!',
    location_region: 'US-Zone-8b',
    is_admin: false
  },
  {
    name: 'SmartGarden Admin',
    email: 'admin@smartgarden.app',
    password: process.env.DEMO_ADMIN_PASSWORD || 'AdminGarden123!',
    location_region: 'US-Zone-8b',
    is_admin: true
  }
];

function dateOffsetIso(daysOffset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

const DEMO_GARDENS = [
  {
    name: 'Sunny Backyard Oasis',
    latitude: 45.51523200,
    longitude: -122.67838500,
    location_address: '742 Evergreen Terrace, Portland, OR',
    timezone: 'America/Los_Angeles',
    area_sq_m: 64.00,
    description: 'Main backyard culinary and pollinator garden featuring cedar raised beds, a polycarbonate greenhouse, and shaded herb borders.',
    zones: [
      {
        name: 'South Raised Bed',
        is_outdoor: true,
        zone_type: 'RAISED_BED',
        soil_type: 'LOAM',
        sunlight_level: 'FULL_SUN',
        area_sq_m: 6.00,
        dimensions_description: '3m x 2m cedar raised bed',
        plants: [
          {
            scientific_name: 'Solanum lycopersicum',
            custom_nickname: 'Heirloom Cherry Tomatoes',
            quantity: 4,
            planted_offset_days: -42,
            harvest_offset_days: 28,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Staked along southern trellis; deep watering every 3 days.'
          },
          {
            scientific_name: 'Ocimum basilicum',
            custom_nickname: 'Sweet Genovese Basil',
            quantity: 6,
            planted_offset_days: -30,
            harvest_offset_days: 7,
            status: 'HARVEST_READY',
            health_status: 'HEALTHY',
            notes: 'Pinching top flower buds weekly for fuller foliage.'
          },
          {
            scientific_name: 'Tagetes patula',
            custom_nickname: 'French Border Marigolds',
            quantity: 8,
            planted_offset_days: -38,
            harvest_offset_days: null,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Companion border deterring aphids and nematodes.'
          }
        ]
      },
      {
        name: 'Glass Greenhouse',
        is_outdoor: false,
        zone_type: 'GREENHOUSE',
        soil_type: 'PEAT',
        sunlight_level: 'FULL_SUN',
        area_sq_m: 8.50,
        dimensions_description: '3.4m x 2.5m polycarbonate greenhouse',
        plants: [
          {
            scientific_name: 'Capsicum annuum',
            custom_nickname: 'California Wonder Peppers',
            quantity: 4,
            planted_offset_days: -35,
            harvest_offset_days: 35,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Flowering well under warm daytime greenhouse temps.'
          },
          {
            scientific_name: 'Cucumis sativus',
            custom_nickname: 'Trellised Marketmore Cucumbers',
            quantity: 3,
            planted_offset_days: -26,
            harvest_offset_days: 22,
            status: 'GROWING',
            health_status: 'NEEDS_ATTENTION',
            notes: 'Monitor lower leaves for early powdery mildew and increase vent airflow.'
          }
        ]
      },
      {
        name: 'Shaded Herb & Greens Border',
        is_outdoor: true,
        zone_type: 'OUTDOOR_BED',
        soil_type: 'SILT',
        sunlight_level: 'PART_SHADE',
        area_sq_m: 4.50,
        dimensions_description: '4.5m x 1m east-facing border',
        plants: [
          {
            scientific_name: 'Lactuca sativa',
            custom_nickname: 'Buttercrunch Salad Mix',
            quantity: 10,
            planted_offset_days: -28,
            harvest_offset_days: 4,
            status: 'HARVEST_READY',
            health_status: 'HEALTHY',
            notes: 'Ready for cut-and-come-again outer leaf harvest.'
          },
          {
            scientific_name: 'Spinacia oleracea',
            custom_nickname: 'Bloomsdale Spinach',
            quantity: 12,
            planted_offset_days: -12,
            harvest_offset_days: 30,
            status: 'SEEDLING',
            health_status: 'HEALTHY',
            notes: 'Recently thinned to 15cm spacing.'
          },
          {
            scientific_name: 'Mentha spicata',
            custom_nickname: 'Spearmint Container Patch',
            quantity: 2,
            planted_offset_days: -60,
            harvest_offset_days: null,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Sunk in root-barrier pot to keep runners contained.'
          }
        ]
      }
    ]
  },
  {
    name: 'Urban Balcony & Indoor Studio',
    latitude: 45.52561000,
    longitude: -122.67312000,
    location_address: '210 NW Flanders St, Apt 4B, Portland, OR',
    timezone: 'America/Los_Angeles',
    area_sq_m: 14.00,
    description: 'Compact balcony pots and indoor countertop hydroponics for year-round culinary herbs and alpine strawberries.',
    zones: [
      {
        name: 'Windowsill & Balcony Pots',
        is_outdoor: false,
        zone_type: 'INDOOR_POTS',
        soil_type: 'SANDY',
        sunlight_level: 'PART_SHADE',
        area_sq_m: 2.00,
        dimensions_description: '4 terracotta pots on south-west sill',
        plants: [
          {
            scientific_name: 'Salvia rosmarinus',
            custom_nickname: 'Tuscan Blue Rosemary',
            quantity: 2,
            planted_offset_days: -90,
            harvest_offset_days: null,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Allow top 3cm of gritty mix to dry between waterings.'
          },
          {
            scientific_name: 'Thymus vulgaris',
            custom_nickname: 'English Culinary Thyme',
            quantity: 3,
            planted_offset_days: -75,
            harvest_offset_days: null,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'Thriving in fast-draining terracotta containers.'
          }
        ]
      },
      {
        name: 'Kitchen Counter Hydroponics',
        is_outdoor: false,
        zone_type: 'HYDROPONIC',
        soil_type: 'PEAT',
        sunlight_level: 'FULL_SHADE',
        area_sq_m: 1.20,
        dimensions_description: '12-pod LED NFT hydroponic rail',
        plants: [
          {
            scientific_name: 'Fragaria × ananassa',
            custom_nickname: 'Everbearing Alpine Strawberries',
            quantity: 4,
            planted_offset_days: -45,
            harvest_offset_days: 18,
            status: 'GROWING',
            health_status: 'HEALTHY',
            notes: 'EC 1.4 mS/cm, pH 5.9 under 14-hour grow light cycle.'
          },
          {
            scientific_name: 'Petroselinum crispum',
            custom_nickname: 'Flat-Leaf Italian Parsley',
            quantity: 4,
            planted_offset_days: -36,
            harvest_offset_days: 5,
            status: 'HARVEST_READY',
            health_status: 'HEALTHY',
            notes: 'Harvest outer stems cleanly at the base.'
          }
        ]
      }
    ]
  }
];

async function ensureUser(spec) {
  const email = spec.email.toLowerCase().trim();
  let user = await User.findOne({ where: { email } });

  if (!user) {
    const password_hash = await bcrypt.hash(spec.password, 10);
    await User.create({
      name: spec.name,
      email,
      password_hash,
      location_region: spec.location_region,
      is_admin: Boolean(spec.is_admin)
    });
    user = await User.findOne({ where: { email } });
    return { user, action: 'created' };
  }

  const updates = {};
  if (user.name !== spec.name) updates.name = spec.name;
  if (Boolean(user.is_admin) !== Boolean(spec.is_admin)) updates.is_admin = Boolean(spec.is_admin);
  if (user.location_region !== spec.location_region) updates.location_region = spec.location_region;

  const passwordValid = await user.validPassword(spec.password);
  if (!passwordValid) {
    updates.password_hash = await bcrypt.hash(spec.password, 10);
  }

  if (Object.keys(updates).length > 0) {
    await User.update(updates, { where: { id: user.id } });
    user = await User.findOne({ where: { email } });
    return { user, action: 'updated' };
  }

  return { user, action: 'existing' };
}

async function ensureGarden(owner, spec) {
  let garden = await Garden.findOne({
    where: { owner_id: owner.id, name: spec.name }
  });
  let action = 'existing';

  if (!garden) {
    await Garden.create({
      owner_id: owner.id,
      name: spec.name,
      latitude: spec.latitude,
      longitude: spec.longitude,
      location_address: spec.location_address,
      timezone: spec.timezone,
      area_sq_m: spec.area_sq_m,
      description: spec.description
    });
    garden = await Garden.findOne({
      where: { owner_id: owner.id, name: spec.name }
    });
    action = 'created';
  }

  // Ensure owner membership exists for /api/gardens and RBAC middleware
  let membership = await GardenMember.findOne({
    where: { garden_id: garden.id, user_id: owner.id }
  });
  if (!membership) {
    await GardenMember.create({
      garden_id: garden.id,
      user_id: owner.id,
      role: 'OWNER'
    });
  } else if (membership.role !== 'OWNER') {
    await GardenMember.update(
      { role: 'OWNER', expires_at: null },
      { where: { id: membership.id } }
    );
  }

  return { garden, action };
}

async function ensureZone(garden, spec) {
  let zone = await Zone.findOne({
    where: { garden_id: garden.id, name: spec.name }
  });
  let action = 'existing';

  if (!zone) {
    await Zone.create({
      garden_id: garden.id,
      name: spec.name,
      is_outdoor: Boolean(spec.is_outdoor),
      zone_type: spec.zone_type,
      soil_type: spec.soil_type,
      sunlight_level: spec.sunlight_level,
      area_sq_m: spec.area_sq_m,
      dimensions_description: spec.dimensions_description
    });
    zone = await Zone.findOne({
      where: { garden_id: garden.id, name: spec.name }
    });
    action = 'created';
  }

  return { zone, action };
}

async function ensureZonePlant(zone, catalogPlant, spec) {
  let zonePlant = await ZonePlant.findOne({
    where: { zone_id: zone.id, plant_catalog_id: catalogPlant.id }
  });
  let action = 'existing';

  if (!zonePlant) {
    await ZonePlant.create({
      zone_id: zone.id,
      plant_catalog_id: catalogPlant.id,
      custom_nickname: spec.custom_nickname || null,
      quantity: spec.quantity,
      planted_date: dateOffsetIso(spec.planted_offset_days || -30),
      expected_harvest_date: spec.harvest_offset_days !== null && spec.harvest_offset_days !== undefined
        ? dateOffsetIso(spec.harvest_offset_days)
        : null,
      status: spec.status,
      health_status: spec.health_status,
      notes: spec.notes || null
    });
    zonePlant = await ZonePlant.findOne({
      where: { zone_id: zone.id, plant_catalog_id: catalogPlant.id }
    });
    action = 'created';
  }

  return { zonePlant, action };
}

async function ensureSprint2DemoData(demoUser, seededZonesByName) {
  const stats = {
    devices: 0,
    sensorReadings: 0,
    dailyAggregates: 0,
    careTasks: 0,
    waterLogs: 0,
    alertConfigs: 0,
    alertLogs: 0,
    automationRules: 0
  };

  const southBed = seededZonesByName.get('South Raised Bed');
  const greenhouse = seededZonesByName.get('Glass Greenhouse');
  const hydro = seededZonesByName.get('Kitchen Counter Hydroponics');

  const deviceSpecs = [
    southBed && {
      zone: southBed,
      device_name: 'South Bed Moisture & Lux Node',
      device_uid: 'SG-DEMO-BED-01',
      rawKey: 'sg_live_demo_south_bed_node_01_abcdef1234567890',
      device_type: 'ESP32_WROOM',
      firmware_version: 'v1.4.2'
    },
    greenhouse && {
      zone: greenhouse,
      device_name: 'Greenhouse Climate Sensor',
      device_uid: 'SG-DEMO-GH-01',
      rawKey: 'sg_live_demo_greenhouse_01_abcdef1234567890ab',
      device_type: 'SG_PRO_V1',
      firmware_version: 'v2.1.0'
    },
    hydro && {
      zone: hydro,
      device_name: 'Hydroponics Rail Monitor',
      device_uid: 'SG-DEMO-HYD-01',
      rawKey: 'sg_live_demo_hydroponics_01_abcdef1234567890a',
      device_type: 'SIMULATOR',
      firmware_version: 'sim-2.0.0'
    }
  ].filter(Boolean);

  const now = new Date();
  for (const spec of deviceSpecs) {
    let device = await Device.findOne({ where: { device_uid: spec.device_uid } });
    if (!device) {
      const key_prefix = spec.rawKey.slice(0, 16);
      const key_hash = crypto.createHash('sha256').update(spec.rawKey).digest('hex');
      device = await Device.create({
        zone_id: spec.zone.id,
        device_name: spec.device_name,
        device_uid: spec.device_uid,
        key_prefix,
        key_hash,
        device_type: spec.device_type,
        firmware_version: spec.firmware_version,
        is_active: true,
        last_seen_at: new Date(now.getTime() - 5 * 60000)
      });
      stats.devices++;
    }

    const existingReadings = await SensorReading.count({ where: { device_id: device.id } });
    if (existingReadings === 0) {
      for (let h = 23; h >= 0; h--) {
        const ts = new Date(now.getTime() - h * 3600000);
        const angle = (2 * Math.PI * ((ts.getUTCHours() - 6) / 24));
        const solar = Math.max(0, Math.sin(angle));
        await SensorReading.create({
          zone_id: spec.zone.id,
          device_id: device.id,
          soil_moisture: Math.round((56 - (23 - h) * 0.4 + Math.sin(angle) * 2) * 10) / 10,
          temperature: Math.round((19 + 8 * Math.sin(angle - 0.3)) * 10) / 10,
          humidity: Math.round((68 - 18 * Math.sin(angle - 0.3)) * 10) / 10,
          light_lux: Math.round(solar * 42000 + 20),
          battery_percent: 91.5,
          signal_rssi: -61,
          recorded_at: ts
        });
        stats.sensorReadings++;
      }
    }

    const existingAgg = await SensorAggregateDaily.count({ where: { device_id: device.id } });
    if (existingAgg === 0) {
      for (let d = 7; d >= 1; d--) {
        await SensorAggregateDaily.create({
          zone_id: spec.zone.id,
          device_id: device.id,
          aggregate_date: dateOffsetIso(-d),
          min_soil_moisture: 44.0,
          max_soil_moisture: 68.5,
          avg_soil_moisture: 55.2,
          min_temperature: 14.2,
          max_temperature: 27.8,
          avg_temperature: 21.1,
          min_humidity: 46.0,
          max_humidity: 78.0,
          avg_humidity: 61.5,
          peak_light_lux: 44200,
          avg_light_lux: 16500,
          sample_count: 24
        });
        stats.dailyAggregates++;
      }
    }
  }

  if (southBed) {
    const taskSpecs = [
      {
        zone_id: southBed.id,
        assigned_to: demoUser.id,
        task_type: 'WATER',
        due_date: dateOffsetIso(0),
        recurrence_days: 3,
        is_completed: false,
        source: 'MANUAL',
        notes: 'Deep water cherry tomatoes and basil border'
      },
      {
        zone_id: southBed.id,
        assigned_to: demoUser.id,
        task_type: 'FERTILIZE',
        due_date: dateOffsetIso(2),
        recurrence_days: 14,
        is_completed: false,
        source: 'CARE_PLAN',
        notes: 'Apply organic kelp emulsion around tomato base'
      },
      {
        zone_id: southBed.id,
        assigned_to: demoUser.id,
        completed_by: demoUser.id,
        task_type: 'WATER',
        due_date: dateOffsetIso(-3),
        recurrence_days: 3,
        is_completed: true,
        completed_at: new Date(now.getTime() - 3 * 86400000),
        source: 'MANUAL',
        water_volume_liters: 8.5,
        notes: 'Completed baseline irrigation cycle'
      }
    ];

    let completedWaterTask = null;
    for (const ts of taskSpecs) {
      let existing = await CareTask.findOne({
        where: { zone_id: ts.zone_id, task_type: ts.task_type, notes: ts.notes }
      });
      if (!existing) {
        existing = await CareTask.create(ts);
        stats.careTasks++;
      }
      if (ts.is_completed && ts.task_type === 'WATER') {
        completedWaterTask = existing;
      }
    }

    const existingWaterLogs = await WaterUsageLog.count({ where: { zone_id: southBed.id } });
    if (existingWaterLogs === 0) {
      await WaterUsageLog.create({
        zone_id: southBed.id,
        task_id: completedWaterTask ? completedWaterTask.id : null,
        logged_by_user_id: demoUser.id,
        liters_applied: 8.5,
        method: 'DRIP_IRRIGATION',
        recorded_at: new Date(now.getTime() - 3 * 86400000),
        notes: 'Drip line morning run'
      });
      await WaterUsageLog.create({
        zone_id: southBed.id,
        logged_by_user_id: demoUser.id,
        liters_applied: 5.0,
        method: 'WATERING_CAN',
        recorded_at: new Date(now.getTime() - 1 * 86400000),
        notes: 'Hand-watered basil seedlings'
      });
      stats.waterLogs += 2;
    }

    const existingSoilCfg = await AlertConfig.findOne({
      where: { zone_id: southBed.id, metric: 'SOIL_MOISTURE' }
    });
    if (!existingSoilCfg) {
      await AlertConfig.create({
        zone_id: southBed.id,
        metric: 'SOIL_MOISTURE',
        min_threshold: 35,
        max_threshold: 85,
        is_email_enabled: true,
        is_in_app_enabled: true,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '07:00:00',
        cooldown_minutes: 60,
        is_active: true
      });
      stats.alertConfigs++;
    }

    const existingAlerts = await AlertLog.count({ where: { zone_id: southBed.id } });
    if (existingAlerts === 0) {
      await AlertLog.create({
        zone_id: southBed.id,
        metric: 'SOIL_MOISTURE',
        triggered_value: 31.5,
        threshold_value: 35.0,
        severity: 'WARNING',
        message: 'Soil moisture dropped below 35% in South Raised Bed (31.5%).',
        is_read: false,
        email_sent: false,
        is_suppressed: false,
        triggered_at: new Date(now.getTime() - 2 * 3600000)
      });
      stats.alertLogs++;
    }

    const existingRule = await AutomationRule.findOne({
      where: { zone_id: southBed.id, name: 'Auto-Schedule Watering When Dry' }
    });
    if (!existingRule) {
      await AutomationRule.create({
        zone_id: southBed.id,
        name: 'Auto-Schedule Watering When Dry',
        metric: 'SOIL_MOISTURE',
        operator: 'LT',
        threshold_value: 35,
        weather_condition: 'NO_RAIN',
        action_type: 'CREATE_TASK',
        task_type: 'WATER',
        cooldown_minutes: 180,
        max_daily_executions: 3,
        executions_today: 0,
        is_active: true
      });
      stats.automationRules++;
    }
  }

  if (greenhouse) {
    const existingTempCfg = await AlertConfig.findOne({
      where: { zone_id: greenhouse.id, metric: 'TEMPERATURE' }
    });
    if (!existingTempCfg) {
      await AlertConfig.create({
        zone_id: greenhouse.id,
        metric: 'TEMPERATURE',
        min_threshold: 14,
        max_threshold: 34,
        is_email_enabled: true,
        is_in_app_enabled: true,
        quiet_hours_start: '22:30:00',
        quiet_hours_end: '06:30:00',
        cooldown_minutes: 60,
        is_active: true
      });
      stats.alertConfigs++;
    }

    const existingGhRule = await AutomationRule.findOne({
      where: { zone_id: greenhouse.id, name: 'Greenhouse High Temp Alert' }
    });
    if (!existingGhRule) {
      await AutomationRule.create({
        zone_id: greenhouse.id,
        name: 'Greenhouse High Temp Alert',
        metric: 'TEMPERATURE',
        operator: 'GT',
        threshold_value: 34,
        weather_condition: 'ANY',
        action_type: 'SEND_ALERT',
        task_type: 'WATER',
        cooldown_minutes: 120,
        max_daily_executions: 4,
        executions_today: 0,
        is_active: true
      });
      stats.automationRules++;
    }
  }

  return stats;
}

async function ensureSprint3DemoData(demoUser, seededZonesByName) {
  const stats = {
    weatherCacheEntries: 0,
    carePlanTasks: 0
  };

  for (const gardenSpec of DEMO_GARDENS) {
    if (gardenSpec.latitude == null || gardenSpec.longitude == null) continue;
    const { latGrid, lngGrid, gridKey } = weatherService.computeGridKey(gardenSpec.latitude, gardenSpec.longitude);
    const existingCache = await WeatherCache.findOne({ where: { grid_key: gridKey } });
    if (!existingCache) {
      await weatherService.getWeatherData(latGrid, lngGrid);
      stats.weatherCacheEntries++;
    }
  }

  const herbZone = seededZonesByName.get('Shaded Herb & Greens Border');
  if (herbZone) {
    const existingCarePlanTask = await CareTask.findOne({
      where: { zone_id: herbZone.id, source: 'CARE_PLAN' }
    });
    if (!existingCarePlanTask) {
      const dueStr = dateOffsetIso(1);
      await CareTask.create({
        zone_id: herbZone.id,
        assigned_to: demoUser.id,
        task_type: 'PRUNE',
        due_date: dueStr,
        recurrence_days: 10,
        is_completed: false,
        source: 'CARE_PLAN',
        notes: '[CarePlan] Pinch mint and lettuce outer leaves to promote bushy canopy growth.'
      });
      stats.carePlanTasks++;
    }
  }

  return stats;
}

async function ensureSprint4DemoData(demoUser, seededZonesByName) {
  const stats = {
    communityUsers: 0,
    journalEntries: 0,
    dailyAggregates: 0,
    communityPosts: 0,
    communityComments: 0
  };

  // Seed a peer grower account for F20 Community Hub interactions & follow workflow
  const { user: mayaUser, action: mayaAction } = await ensureUser({
    name: 'Maya Lin',
    email: 'maya@smartgarden.app',
    password: process.env.DEMO_USER_PASSWORD || 'DemoGarden123!',
    location_region: 'US-Zone-8b',
    is_admin: false
  });
  if (mayaAction === 'created') stats.communityUsers++;

  const southBed = seededZonesByName.get('South Raised Bed');
  if (southBed) {
    // 1. Growth journal entries for the first zone plant in South Raised Bed
    const zonePlants = await ZonePlant.findAll({
      where: { zone_id: southBed.id },
      order: [['id', 'ASC']]
    });
    const tomatoPlant = zonePlants[0];
    if (tomatoPlant) {
      const existingCount = await GrowthJournal.count({ where: { zone_plant_id: tomatoPlant.id } });
      if (existingCount === 0) {
        const journalSeeds = [
          {
            entry_date: dateOffsetIso(-28),
            height_cm: 14.5,
            note: 'Transplanted hardened tomato seedlings into warm cedar raised bed with compost collar.'
          },
          {
            entry_date: dateOffsetIso(-14),
            height_cm: 26.0,
            note: 'Strong lateral foliage growth after deep morning drip irrigation and basil underplanting.'
          },
          {
            entry_date: dateOffsetIso(-2),
            height_cm: 41.5,
            note: 'First yellow flower trusses setting cleanly along the lower trellised leaders.'
          }
        ];
        for (const entry of journalSeeds) {
          await GrowthJournal.create({
            zone_plant_id: tomatoPlant.id,
            author_id: demoUser.id,
            entry_date: entry.entry_date,
            height_cm: entry.height_cm,
            note: entry.note,
            photo_url: null
          });
          stats.journalEntries++;
        }
      }
    }

    // 2. Daily sensor rollups for South Raised Bed over the last 5 days
    const device = await Device.findOne({ where: { zone_id: southBed.id } });
    if (device) {
      for (let d = 1; d <= 5; d++) {
        const statDate = dateOffsetIso(-d);
        const existingAgg = await SensorAggregateDaily.findOne({
          where: { zone_id: southBed.id, device_id: device.id, aggregate_date: statDate }
        });
        if (!existingAgg) {
          await SensorAggregateDaily.create({
            zone_id: southBed.id,
            device_id: device.id,
            aggregate_date: statDate,
            min_soil_moisture: 44 + d,
            max_soil_moisture: 58 + d,
            avg_soil_moisture: 51 + d,
            min_temperature: 17.0,
            max_temperature: 25.5,
            avg_temperature: 21.2 + (d * 0.3),
            min_humidity: 50,
            max_humidity: 72,
            avg_humidity: 60.5,
            peak_light_lux: 36000,
            avg_light_lux: 22500,
            sample_count: 18
          });
          stats.dailyAggregates++;
        }
      }
    }
  }

  // 3. Community showcase, tips & threaded discussions
  const existingPosts = await CommunityPost.count();
  if (existingPosts === 0) {
    const garden = await Garden.findOne({ where: { owner_id: demoUser.id }, order: [['id', 'ASC']] });
    const post1 = await CommunityPost.create({
      author_id: demoUser.id,
      garden_id: garden ? garden.id : null,
      title: 'Spring Cedar Bed Polyculture Setup',
      content: 'Interplanted Heirloom Cherry Tomatoes, Sweet Genovese Basil, and French Marigolds in South Raised Bed — aphid pressure dropped almost immediately.',
      category: 'SHOWCASE',
      is_pinned: true,
      is_flagged: false,
      likes_count: 0,
      comments_count: 2
    });
    stats.communityPosts++;

    await CommunityPost.create({
      author_id: mayaUser.id,
      garden_id: null,
      title: 'Deep Morning Mulch + Drip Tip',
      content: 'Adding 5 cm of straw mulch cut afternoon soil temperature peaks by 4 C in my sunny tomato beds.',
      category: 'TIP',
      is_pinned: false,
      is_flagged: false,
      likes_count: 0,
      comments_count: 0
    });
    stats.communityPosts++;

    await CommunityPost.create({
      author_id: mayaUser.id,
      garden_id: null,
      title: 'Overwintering Rosemary in Partial Shade?',
      content: 'Has anyone tested floating row cover vs. cold frame around Zone 8b for potted coastal rosemary?',
      category: 'QUESTION',
      is_pinned: false,
      is_flagged: false,
      likes_count: 0,
      comments_count: 0
    });
    stats.communityPosts++;

    const c1 = await CommunityComment.create({
      post_id: post1.id,
      author_id: mayaUser.id,
      parent_comment_id: null,
      content: 'Love this companion pairing! Are you trellising the tomatoes single-stem or Florida weave?',
      is_flagged: false
    });
    stats.communityComments++;

    await CommunityComment.create({
      post_id: post1.id,
      author_id: demoUser.id,
      parent_comment_id: c1.id,
      content: 'Single-stem twine trellis on the sunny side so the basil gets dappled afternoon airflow!',
      is_flagged: false
    });
    stats.communityComments++;
  }

  return stats;
}

async function ensureSprint5DemoData(demoUser, catalogBySciName) {
  const stats = {
    notifications: 0,
    preferences: 0,
    sustainabilityLogs: 0,
    seedPackets: 0,
    publicProfiles: 0
  };

  // 1. Notification preferences + inbox items
  const existingPref = await NotificationPreference.findOne({ where: { user_id: demoUser.id } });
  if (!existingPref) {
    await NotificationPreference.create({
      user_id: demoUser.id,
      email_digest_freq: 'DAILY',
      in_app_enabled: true,
      web_push_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00'
    });
    stats.preferences++;
  }

  const existingNotifs = await Notification.count({ where: { user_id: demoUser.id } });
  if (existingNotifs === 0) {
    await Notification.create({
      user_id: demoUser.id,
      channel: 'IN_APP',
      category: 'WEATHER',
      title: 'Forecast Advisory: Gentle Rain Window',
      message: 'South Raised Bed outdoor watering schedules will auto-delay when 24h precipitation probability reaches 60%.',
      is_read: false
    });
    await Notification.create({
      user_id: demoUser.id,
      channel: 'IN_APP',
      category: 'SYSTEM',
      title: 'Welcome to SmartGarden 3D & Seed Vault',
      message: 'Explore your interactive 3D Garden Twin inside any garden workspace or manage heirloom packets in Seed Vault.',
      is_read: true
    });
    stats.notifications += 2;
  }

  // 2. Sustainability logs for Sunny Backyard Oasis
  const mainGarden = await Garden.findOne({
    where: { owner_id: demoUser.id, name: 'Sunny Backyard Oasis' }
  });
  if (mainGarden) {
    const existingSust = await SustainabilityLog.count({ where: { garden_id: mainGarden.id } });
    if (existingSust === 0) {
      await SustainabilityLog.create({
        garden_id: mainGarden.id,
        user_id: demoUser.id,
        log_type: 'RAINWATER_HARVEST',
        quantity: 220,
        unit: 'liters',
        estimated_water_saved_l: 220,
        estimated_co2_offset_kg: 0.44,
        recorded_date: dateOffsetIso(-5),
        notes: 'Captured cistern overflow from spring shower event'
      });
      await SustainabilityLog.create({
        garden_id: mainGarden.id,
        user_id: demoUser.id,
        log_type: 'COMPOST_ADDED',
        quantity: 18,
        unit: 'kg',
        estimated_water_saved_l: 72,
        estimated_co2_offset_kg: 32.4,
        recorded_date: dateOffsetIso(-12),
        notes: 'Finished backyard kitchen & leaf mold compost top-dressing'
      });
      await SustainabilityLog.create({
        garden_id: mainGarden.id,
        user_id: demoUser.id,
        log_type: 'MULCH_SAVINGS',
        quantity: 6,
        unit: 'sq_m',
        estimated_water_saved_l: 72,
        estimated_co2_offset_kg: 2.7,
        recorded_date: dateOffsetIso(-15),
        notes: 'Straw mulch layer reducing bed surface evaporation'
      });
      stats.sustainabilityLogs += 3;
    }

    // 3. Seed Vault packets
    const existingSeeds = await SeedPacket.count({ where: { user_id: demoUser.id } });
    if (existingSeeds === 0) {
      const tomato = catalogBySciName.get('Solanum lycopersicum');
      const basil = catalogBySciName.get('Ocimum basilicum');
      const carrot = catalogBySciName.get('Daucus carota');

      await SeedPacket.create({
        user_id: demoUser.id,
        garden_id: mainGarden.id,
        plant_catalog_id: tomato ? tomato.id : null,
        variety_name: 'San Marzano Heirloom Tomato',
        brand: 'Pacific Heirloom Seeds',
        lot_number: 'LOT-2026-TM1',
        quantity_packets: 2,
        seeds_remaining: 45,
        germination_rate_pct: 92,
        purchased_date: dateOffsetIso(-60),
        expiry_date: dateOffsetIso(420),
        storage_location: 'Cool Cedar Seed Box',
        notes: 'High-brix paste tomato for southern raised beds.'
      });
      await SeedPacket.create({
        user_id: demoUser.id,
        garden_id: mainGarden.id,
        plant_catalog_id: basil ? basil.id : null,
        variety_name: 'Sweet Genovese Organic Basil',
        brand: 'Botanical Co-op',
        lot_number: 'LOT-2026-BS4',
        quantity_packets: 1,
        seeds_remaining: 80,
        germination_rate_pct: 88,
        purchased_date: dateOffsetIso(-40),
        expiry_date: dateOffsetIso(300),
        storage_location: 'Cool Cedar Seed Box'
      });
      await SeedPacket.create({
        user_id: demoUser.id,
        garden_id: mainGarden.id,
        plant_catalog_id: carrot ? carrot.id : null,
        variety_name: 'Scarlet Nantes Root Carrot',
        brand: 'Heritage Growers',
        lot_number: 'LOT-2025-CR9',
        quantity_packets: 1,
        seeds_remaining: 4,
        germination_rate_pct: 78,
        purchased_date: dateOffsetIso(-200),
        expiry_date: dateOffsetIso(25),
        storage_location: 'Pantry Airtight Jar',
        notes: 'Running low — finish sowing soon for peak germination.'
      });
      stats.seedPackets += 3;
    }

    // 4. Opt-in Public Profile for Demo Gardener (/u/demo-gardener)
    const existingProfile = await PublicProfile.findOne({ where: { user_id: demoUser.id } });
    if (!existingProfile) {
      await PublicProfile.create({
        user_id: demoUser.id,
        handle: 'demo-gardener',
        is_public: true,
        bio: 'Zone 8b raised-bed polyculture grower experimenting with companion guilds, drip irrigation, and ESP32 soil sensors.',
        featured_garden_id: mainGarden.id,
        show_telemetry: true
      });
      stats.publicProfiles++;
    }
  }

  return stats;
}

async function runDemoSeed() {
  console.log('[Demo Seed] Connecting to database...');
  await dbConfig.connectDb();
  const sequelize = dbConfig.sequelize;
  console.log(`[Demo Seed] Connected using dialect: ${sequelize.options.dialect}`);

  // Always ensure all migrations (including Sprint 2 022+) are applied
  await runMigrations();

  const catalogCount = await PlantCatalog.count();
  if (catalogCount === 0) {
    console.log('[Demo Seed] Plant catalog is empty. Seeding catalog from seeds/plants.json...');
    await runSeed();
  } else {
    console.log(`[Demo Seed] Plant catalog already populated (${catalogCount} species).`);
  }

  // Load catalog lookup by scientific_name
  const allCatalog = await PlantCatalog.findAll();
  const catalogBySciName = new Map(allCatalog.map((p) => [p.scientific_name, p]));

  const summary = {
    users: { created: 0, updated: 0, existing: 0 },
    gardens: { created: 0, existing: 0 },
    zones: { created: 0, existing: 0 },
    zonePlants: { created: 0, existing: 0 },
    sprint2: null
  };

  let demoUser = null;
  for (const userSpec of DEMO_USERS) {
    const { user, action } = await ensureUser(userSpec);
    summary.users[action] += 1;
    console.log(`[Demo Seed] User ${user.email} (id=${user.id}, is_admin=${Boolean(user.is_admin)}): ${action}`);
    if (user.email === 'demo@smartgarden.app') {
      demoUser = user;
    }
  }

  const seededZonesByName = new Map();
  for (const gardenSpec of DEMO_GARDENS) {
    const { garden, action: gardenAction } = await ensureGarden(demoUser, gardenSpec);
    summary.gardens[gardenAction] += 1;
    console.log(`[Demo Seed] Garden "${garden.name}" (id=${garden.id}): ${gardenAction}`);

    for (const zoneSpec of gardenSpec.zones) {
      const { zone, action: zoneAction } = await ensureZone(garden, zoneSpec);
      seededZonesByName.set(zone.name, zone);
      summary.zones[zoneAction] += 1;
      console.log(`[Demo Seed]   Zone "${zone.name}" (${zone.zone_type}/${zone.sunlight_level}/${zone.soil_type}, id=${zone.id}): ${zoneAction}`);

      for (const plantSpec of zoneSpec.plants) {
        const catalogPlant = catalogBySciName.get(plantSpec.scientific_name);
        if (!catalogPlant) {
          throw new Error(`Catalog plant not found for scientific_name="${plantSpec.scientific_name}"`);
        }
        const { zonePlant, action: zpAction } = await ensureZonePlant(zone, catalogPlant, plantSpec);
        summary.zonePlants[zpAction] += 1;
        console.log(`[Demo Seed]     Plant "${catalogPlant.common_name}" x${zonePlant.quantity} (id=${zonePlant.id}): ${zpAction}`);
      }
    }
  }

  summary.sprint2 = await ensureSprint2DemoData(demoUser, seededZonesByName);
  summary.sprint3 = await ensureSprint3DemoData(demoUser, seededZonesByName);
  summary.sprint4 = await ensureSprint4DemoData(demoUser, seededZonesByName);
  summary.sprint5 = await ensureSprint5DemoData(demoUser, catalogBySciName);

  const totalCatalog = await PlantCatalog.count();
  const demoGardenCount = await Garden.count({ where: { owner_id: demoUser.id } });
  const totalGardens = await Garden.count();
  const totalZones = await Zone.count();
  const totalZonePlants = await ZonePlant.count();

  console.log('[Demo Seed] Summary:', JSON.stringify({
    ...summary,
    totals: {
      plant_catalog: totalCatalog,
      demo_gardens: demoGardenCount,
      gardens: totalGardens,
      zones: totalZones,
      zone_plants: totalZonePlants
    }
  }));

  return summary;
}

if (require.main === module) {
  runDemoSeed()
    .then(async () => {
      await dbConfig.sequelize.close();
      console.log('[Demo Seed] Completed successfully.');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Demo Seed] Failed:', err);
      try {
        await dbConfig.sequelize.close();
      } catch {
        // ignore close errors during failure exit
      }
      process.exit(1);
    });
}

module.exports = {
  runDemoSeed
};
