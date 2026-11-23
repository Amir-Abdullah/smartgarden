const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env at root or in backend)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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

  // Detect URI from environment variables
  const uri = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.MYSQL_ADDON_URI;
  let activeDialect = dialect;
  if (!activeDialect && uri) {
    if (uri.startsWith('postgres://') || uri.startsWith('postgresql://')) {
      activeDialect = 'postgres';
    } else if (uri.startsWith('mysql://') || uri.startsWith('mariadb://')) {
      activeDialect = 'mariadb';
    }
  }

  const isPostgres = activeDialect === 'postgres' || activeDialect === 'postgresql';

  if (isPostgres) {
    const pgModule = require('pg');

    // Default Supabase connection parameters (Transaction pooler on port 6543)
    let host = process.env.DB_HOST || 'aws-0-ap-southeast-2.pooler.supabase.com';
    let port = Number(process.env.DB_PORT || 6543);
    let dbName = process.env.DB_NAME || 'postgres';
    let user = process.env.DB_USER || 'postgres.bpfpjnhaawwrgykxduef';
    let pass = process.env.DB_PASS || 'tF+?V4cS85+fXRt';

    if (uri && (uri.startsWith('postgres://') || uri.startsWith('postgresql://'))) {
      try {
        const parsed = new URL(uri);
        host = parsed.hostname || host;
        port = Number(parsed.port) || port;
        user = decodeURIComponent(parsed.username) || user;
        pass = decodeURIComponent(parsed.password) || pass;
        dbName = (parsed.pathname || '').replace(/^\//, '') || dbName;
      } catch (_) {}
    }

    return new Sequelize(
      dbName,
      user,
      pass,
      {
        host,
        port,
        dialect: 'postgres',
        dialectModule: pgModule,
        logging: process.env.DB_LOGGING === 'true' ? console.log : false,
        pool: {
          max: Number(process.env.DB_POOL_MAX || 10),
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        dialectOptions: {
          connectTimeout: 20000,
          ssl: process.env.DB_SSL === 'false' ? false : {
            require: true,
            rejectUnauthorized: false
          }
        },
        define: {
          timestamps: true,
          underscored: true
        }
      }
    );
  }

  // MariaDB / MySQL
  const mariadbModule = require('mariadb');
  let host = process.env.DB_HOST || process.env.MYSQL_ADDON_HOST || 'bb34mwz9qi0g8blktlam-mysql.services.clever-cloud.com';
  let port = Number(process.env.DB_PORT || process.env.MYSQL_ADDON_PORT || 3306);
  let dbName = process.env.DB_NAME || process.env.MYSQL_ADDON_DB || 'bb34mwz9qi0g8blktlam';
  let user = process.env.DB_USER || process.env.MYSQL_ADDON_USER || 'udfb1i4ltuzp3a9m';
  let pass = process.env.DB_PASS || process.env.MYSQL_ADDON_PASSWORD || '5DcsoNlfZ5wKhuLopN4C';

  if (uri && (uri.startsWith('mysql://') || uri.startsWith('mariadb://'))) {
    try {
      const parsed = new URL(uri);
      host = parsed.hostname || host;
      port = Number(parsed.port) || port;
      user = decodeURIComponent(parsed.username) || user;
      pass = decodeURIComponent(parsed.password) || pass;
      dbName = (parsed.pathname || '').replace(/^\//, '') || dbName;
    } catch (_) {}
  }

  return new Sequelize(
    dbName,
    user,
    pass,
    {
      host,
      port,
      dialect: 'mariadb',
      dialectModule: mariadbModule,
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
      pool: {
        max: Number(process.env.DB_POOL_MAX || 1),
        min: 0,
        acquire: 15000,
        idle: 1000,
        evict: 1000
      },
      dialectOptions: {
        connectTimeout: 20000,
        ssl: process.env.DB_SSL === 'false' ? false : {
          rejectUnauthorized: false
        }
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
// Default dialect is postgres in development/production, or sqlite in test
const initialDialect = process.env.DB_DIALECT || (isTestEnv ? 'sqlite' : 'postgres');

let sequelize = createSequelizeInstance(initialDialect);

async function connectDb() {
  try {
    await sequelize.authenticate();
    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
    return sequelize;
  } catch (error) {
    if (isTestEnv || process.env.DB_STRICT_DIALECT !== 'true') {
      console.warn(`[Database] ${sequelize.options.dialect} connection failed (${error.message}). Falling back to SQLite dialect for local environment...`);
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
