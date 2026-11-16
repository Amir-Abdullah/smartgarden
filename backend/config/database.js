const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const { Sequelize, DataTypes, Op, Model } = require('sequelize');

function createSequelizeInstance(dialect, storageOrConfig) {
  if (dialect === 'sqlite') {
    const storage = storageOrConfig || process.env.DB_STORAGE || (process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, '../smartgarden.sqlite'));
    return new Sequelize({
      dialect: 'sqlite',
      storage,
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      define: {
        timestamps: true,
        underscored: true
      }
    });
  }

  // MariaDB
  return new Sequelize(
    process.env.DB_NAME || 'smartgarden',
    process.env.DB_USER || 'smartgarden_user',
    process.env.DB_PASS || 'smartgarden_pass',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      dialect: 'mariadb',
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isTestEnv = nodeEnv === 'test';
const initialDialect = process.env.DB_DIALECT || (isTestEnv ? 'sqlite' : 'mariadb');

let sequelize = createSequelizeInstance(initialDialect);

async function connectDb() {
  try {
    await sequelize.authenticate();
    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
    return sequelize;
  } catch (error) {
    if (sequelize.options.dialect === 'mariadb' && process.env.DB_STRICT_DIALECT !== 'true') {
      console.warn(`[Database] MariaDB unreachable (${error.message}). Falling back to SQLite dialect for local environment...`);
      sequelize = createSequelizeInstance('sqlite');
      await sequelize.authenticate();
      await sequelize.query('PRAGMA foreign_keys = ON;');
      return sequelize;
    }
    console.error('Unable to connect to the database:', error.message);
    throw error;
  }
}

function getDatabase() {
  return sequelize;
}

module.exports = {
  get sequelize() { return sequelize; },
  getDatabase,
  Sequelize,
  DataTypes,
  Op,
  Model,
  connectDb
};
