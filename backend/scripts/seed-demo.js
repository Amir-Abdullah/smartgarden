const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env (and optional root .env) before initializing database config
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const dbConfig = require('../config/database');
const { User, Garden, GardenMember, Zone, PlantCatalog, ZonePlant } = require('../models');
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

async function runDemoSeed() {
  console.log('[Demo Seed] Connecting to database...');
  await dbConfig.connectDb();
  const sequelize = dbConfig.sequelize;
  console.log(`[Demo Seed] Connected using dialect: ${sequelize.options.dialect}`);

  const queryInterface = sequelize.getQueryInterface();
  const rawTables = await queryInterface.showAllTables();
  const tables = rawTables.map(t => typeof t === 'string' ? t : (t.tableName || Object.values(t)[0]));
  const requiredTables = ['users', 'gardens', 'garden_members', 'zones', 'plant_catalog', 'zone_plants'];
  if (requiredTables.some((t) => !tables.includes(t))) {
    console.log('[Demo Seed] Running pending migrations first...');
    await runMigrations();
  }

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
    zonePlants: { created: 0, existing: 0 }
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

  for (const gardenSpec of DEMO_GARDENS) {
    const { garden, action: gardenAction } = await ensureGarden(demoUser, gardenSpec);
    summary.gardens[gardenAction] += 1;
    console.log(`[Demo Seed] Garden "${garden.name}" (id=${garden.id}): ${gardenAction}`);

    for (const zoneSpec of gardenSpec.zones) {
      const { zone, action: zoneAction } = await ensureZone(garden, zoneSpec);
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
