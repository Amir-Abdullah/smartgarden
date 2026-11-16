const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/database');
const { runMigrations } = require('./migrate');

async function runSeed() {
  console.log('[Seed Runner] Initializing database connection...');
  await dbConfig.connectDb();
  const sequelize = dbConfig.sequelize;

  console.log(`[Seed Runner] Connected to ${sequelize.options.dialect} database.`);

  const queryInterface = sequelize.getQueryInterface();

  // Verify plant_catalog table exists; if not, ensure migrations are run
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('plant_catalog')) {
    console.log('[Seed Runner] plant_catalog table not found. Executing migrations first...');
    await runMigrations();
  }

  const plantsPath = path.resolve(__dirname, '../seeds/plants.json');
  console.log(`[Seed Runner] Loading plant catalog seeds from ${plantsPath}...`);
  const rawData = fs.readFileSync(plantsPath, 'utf8');
  const plants = JSON.parse(rawData);

  console.log(`[Seed Runner] Found ${plants.length} plant species to seed.`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const plant of plants) {
    const existing = await sequelize.query(
      `SELECT id FROM plant_catalog WHERE scientific_name = '${plant.scientific_name.replace(/'/g, "''")}';`
    );

    const now = new Date().toISOString();
    const record = {
      scientific_name: plant.scientific_name,
      common_name: plant.common_name,
      category: plant.category,
      description: plant.description || null,
      sunlight_req: plant.sunlight_req,
      ideal_moisture_min: plant.ideal_moisture_min,
      ideal_moisture_max: plant.ideal_moisture_max,
      ideal_temp_min: plant.ideal_temp_min,
      ideal_temp_max: plant.ideal_temp_max,
      watering_freq_days: plant.watering_freq_days,
      fertilizing_freq_days: plant.fertilizing_freq_days || 14,
      soil_pref: plant.soil_pref || 'Well-draining, nutrient-rich loam',
      spacing_cm: plant.spacing_cm,
      row_spacing_cm: plant.row_spacing_cm || Math.round(plant.spacing_cm * 1.5),
      spread_radius_cm: plant.spread_radius_cm || Math.round(plant.spacing_cm / 2),
      min_soil_depth_cm: plant.min_soil_depth_cm || 25,
      planting_months: JSON.stringify(plant.planting_months || [3, 4, 5]),
      harvest_months: JSON.stringify(plant.harvest_months || [7, 8, 9]),
      good_companions: JSON.stringify(plant.good_companions || []),
      bad_companions: JSON.stringify(plant.bad_companions || []),
      image_url: plant.image_url || null,
      created_at: now,
      updated_at: now
    };

    if (existing && existing.length > 0) {
      const sets = Object.entries(record)
        .filter(([k]) => k !== 'created_at')
        .map(([k, v]) => `${k} = ${v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`}`)
        .join(', ');
      await sequelize.query(
        `UPDATE plant_catalog SET ${sets} WHERE scientific_name = '${plant.scientific_name.replace(/'/g, "''")}';`
      );
      updatedCount++;
    } else {
      await queryInterface.bulkInsert('plant_catalog', [record]);
      insertedCount++;
    }
  }

  const totalInDb = await sequelize.query('SELECT COUNT(*) as cnt FROM plant_catalog;');
  const count = totalInDb[0] ? (totalInDb[0].cnt || totalInDb[0]['COUNT(*)'] || 0) : plants.length;

  console.log(`[Seed Runner] Seeding complete: ${insertedCount} inserted, ${updatedCount} updated.`);
  console.log(`[Seed Runner] Total plants in catalog: ${count}`);
}

if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('[Seed Runner] Seed execution completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Runner] Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runSeed
};
