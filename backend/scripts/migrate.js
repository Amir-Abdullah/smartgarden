const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/database');

async function runMigrations() {
  console.log('[Migration Runner] Initializing database connection...');
  await dbConfig.connectDb();
  const sequelize = dbConfig.sequelize;
  const Sequelize = dbConfig.Sequelize;

  console.log(`[Migration Runner] Connected to ${sequelize.options.dialect} database.`);

  const queryInterface = sequelize.getQueryInterface();

  // Create migrations tracking table if not exists
  const isMaria = sequelize.options.dialect === 'mariadb' || sequelize.options.dialect === 'mysql';
  const idColDef = isMaria
    ? 'INT AUTO_INCREMENT PRIMARY KEY'
    : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id ${idColDef},
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Fetch executed migrations
  const executedRows = await sequelize.query('SELECT name FROM _migrations ORDER BY id ASC;');
  const executedSet = new Set(executedRows.map(r => r.name));

  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  console.log(`[Migration Runner] Found ${files.length} migration files in ${migrationsDir}`);

  let appliedCount = 0;
  for (const file of files) {
    if (executedSet.has(file)) {
      continue;
    }

    console.log(`[Migration Runner] Applying migration: ${file}...`);
    const migration = require(path.join(migrationsDir, file));

    if (typeof migration.up === 'function') {
      await migration.up(queryInterface, Sequelize);
      await sequelize.query(`INSERT INTO _migrations (name) VALUES ('${file.replace(/'/g, "''")}');`);
      console.log(`[Migration Runner] Successfully applied: ${file}`);
      appliedCount++;
    } else {
      console.warn(`[Migration Runner] Warning: ${file} does not export an 'up' function.`);
    }
  }

  if (appliedCount === 0) {
    console.log('[Migration Runner] Database is already up to date. No pending migrations.');
  } else {
    console.log(`[Migration Runner] Successfully applied ${appliedCount} migration(s).`);
  }

  const allTables = await queryInterface.showAllTables();
  console.log(`[Migration Runner] Current database tables (${allTables.length}):`, allTables.join(', '));
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migration Runner] Migration execution complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Runner] Migration failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runMigrations
};
