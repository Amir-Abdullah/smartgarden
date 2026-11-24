const { normalizeSelectRows, getDialect } = require('../utils/dbHelpers');

async function tableExists(queryInterface, tableName) {
  const rawTables = await queryInterface.showAllTables();
  const names = rawTables.map((t) => {
    if (typeof t === 'string') return t.toLowerCase();
    return String(t.tableName || Object.values(t)[0] || '').toLowerCase();
  });
  return names.includes(tableName.toLowerCase());
}

async function indexExists(sequelize, tableName, indexName) {
  const dialect = getDialect(sequelize);
  if (dialect === 'sqlite') {
    const res = await sequelize.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${indexName}';`);
    return normalizeSelectRows(res).length > 0;
  }
  if (dialect === 'postgres') {
    const res = await sequelize.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${tableName}' AND indexname = '${indexName}';`
    );
    return normalizeSelectRows(res).length > 0;
  }
  const res = await sequelize.query(
    `SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '${tableName}' AND index_name = '${indexName}';`
  );
  return normalizeSelectRows(res).length > 0;
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const sequelize = queryInterface.sequelize;

    // 1. notification_preferences (F21)
    if (!(await tableExists(queryInterface, 'notification_preferences'))) {
      await queryInterface.createTable('notification_preferences', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        email_digest_freq: {
          type: DataTypes.ENUM('INSTANT', 'DAILY', 'WEEKLY', 'OFF'),
          allowNull: false,
          defaultValue: 'INSTANT'
        },
        in_app_enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        web_push_enabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        webhook_url: {
          type: DataTypes.STRING(500),
          allowNull: true
        },
        webhook_secret: {
          type: DataTypes.STRING(128),
          allowNull: true
        },
        quiet_hours_start: {
          type: DataTypes.STRING(16),
          allowNull: true
        },
        quiet_hours_end: {
          type: DataTypes.STRING(16),
          allowNull: true
        },
        per_garden_overrides: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }

    // 2. notifications (F21)
    if (!(await tableExists(queryInterface, 'notifications'))) {
      await queryInterface.createTable('notifications', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        garden_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'gardens', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        channel: {
          type: DataTypes.ENUM('IN_APP', 'EMAIL', 'WEBHOOK', 'WEB_PUSH'),
          allowNull: false,
          defaultValue: 'IN_APP'
        },
        category: {
          type: DataTypes.ENUM('ALERT', 'TASK', 'WEATHER', 'COMMUNITY', 'SYSTEM'),
          allowNull: false,
          defaultValue: 'SYSTEM'
        },
        title: {
          type: DataTypes.STRING(200),
          allowNull: false
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        metadata_json: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }
    if (!(await indexExists(sequelize, 'notifications', 'idx_notif_user_read'))) {
      await queryInterface.addIndex('notifications', ['user_id', 'is_read'], { name: 'idx_notif_user_read' });
    }

    // 3. sustainability_logs (F22)
    if (!(await tableExists(queryInterface, 'sustainability_logs'))) {
      await queryInterface.createTable('sustainability_logs', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        garden_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'gardens', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        zone_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'zones', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        log_type: {
          type: DataTypes.ENUM('RAINWATER_HARVEST', 'COMPOST_ADDED', 'MULCH_SAVINGS', 'SOLAR_OFFSET'),
          allowNull: false
        },
        quantity: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: false
        },
        unit: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        estimated_water_saved_l: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: false,
          defaultValue: 0
        },
        estimated_co2_offset_kg: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: false,
          defaultValue: 0
        },
        recorded_date: {
          type: DataTypes.DATEONLY,
          allowNull: false
        },
        notes: {
          type: DataTypes.STRING(500),
          allowNull: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }
    if (!(await indexExists(sequelize, 'sustainability_logs', 'idx_sust_garden_date'))) {
      await queryInterface.addIndex('sustainability_logs', ['garden_id', 'recorded_date'], { name: 'idx_sust_garden_date' });
    }

    // 4. seed_packets (F23)
    if (!(await tableExists(queryInterface, 'seed_packets'))) {
      await queryInterface.createTable('seed_packets', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        garden_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'gardens', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        plant_catalog_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'plant_catalog', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        variety_name: {
          type: DataTypes.STRING(140),
          allowNull: false
        },
        brand: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        lot_number: {
          type: DataTypes.STRING(80),
          allowNull: true
        },
        quantity_packets: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 1
        },
        seeds_remaining: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 25
        },
        germination_rate_pct: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 85
        },
        purchased_date: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        expiry_date: {
          type: DataTypes.DATEONLY,
          allowNull: true
        },
        storage_location: {
          type: DataTypes.STRING(120),
          allowNull: true
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }
    if (!(await indexExists(sequelize, 'seed_packets', 'idx_seed_user_expiry'))) {
      await queryInterface.addIndex('seed_packets', ['user_id', 'expiry_date'], { name: 'idx_seed_user_expiry' });
    }

    // 5. api_keys (F24)
    if (!(await tableExists(queryInterface, 'api_keys'))) {
      await queryInterface.createTable('api_keys', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        key_prefix: {
          type: DataTypes.STRING(24),
          allowNull: false
        },
        key_hash: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true
        },
        scopes: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: 'gardens:read,sensors:read'
        },
        last_used_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: true
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }
    if (!(await indexExists(sequelize, 'api_keys', 'idx_ak_prefix'))) {
      await queryInterface.addIndex('api_keys', ['key_prefix'], { name: 'idx_ak_prefix' });
    }

    // 6. public_profiles (F24)
    if (!(await tableExists(queryInterface, 'public_profiles'))) {
      await queryInterface.createTable('public_profiles', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        handle: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true
        },
        is_public: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        bio: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        featured_garden_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'gardens', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        show_telemetry: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }
  },

  down: async (queryInterface) => {
    for (const table of [
      'public_profiles',
      'api_keys',
      'seed_packets',
      'sustainability_logs',
      'notifications',
      'notification_preferences'
    ]) {
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }
  }
};
