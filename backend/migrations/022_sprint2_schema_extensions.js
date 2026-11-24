const { getDialect, normalizeSelectRows } = require('../utils/dbHelpers');

async function columnExists(sequelize, tableName, columnName) {
  const dialect = getDialect(sequelize);
  const target = columnName.toLowerCase();

  if (dialect === 'sqlite') {
    const res = await sequelize.query(`PRAGMA table_info('${tableName}');`);
    const rows = normalizeSelectRows(res);
    return rows.some((r) => String(r.name || r.NAME || '').toLowerCase() === target);
  }

  if (dialect === 'postgres') {
    const res = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' AND LOWER(column_name) = '${target}';`
    );
    return normalizeSelectRows(res).length > 0;
  }

  // MariaDB / MySQL
  const res = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${tableName}' AND LOWER(column_name) = '${target}';`
  );
  return normalizeSelectRows(res).length > 0;
}

async function addColumnIfMissing(sequelize, tableName, columnName, columnSqlByDialect) {
  const exists = await columnExists(sequelize, tableName, columnName);
  if (exists) return false;

  const dialect = getDialect(sequelize);
  const columnSql = typeof columnSqlByDialect === 'string'
    ? columnSqlByDialect
    : (columnSqlByDialect[dialect] || columnSqlByDialect.default);

  if (dialect === 'postgres') {
    await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnSql};`);
  } else {
    await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql};`);
  }
  return true;
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

async function tableExists(queryInterface, tableName) {
  const rawTables = await queryInterface.showAllTables();
  const names = rawTables.map((t) => {
    if (typeof t === 'string') return t.toLowerCase();
    return String(t.tableName || Object.values(t)[0] || '').toLowerCase();
  });
  return names.includes(tableName.toLowerCase());
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const sequelize = queryInterface.sequelize;

    // 1. care_tasks.completed_by
    await addColumnIfMissing(sequelize, 'care_tasks', 'completed_by', {
      sqlite: 'INTEGER NULL REFERENCES users(id) ON DELETE SET NULL',
      postgres: 'INTEGER NULL REFERENCES users(id) ON DELETE SET NULL',
      mariadb: 'INT UNSIGNED NULL'
    });
    if (!(await indexExists(sequelize, 'care_tasks', 'idx_ct_completed_by'))) {
      await queryInterface.addIndex('care_tasks', ['completed_by'], { name: 'idx_ct_completed_by' });
    }

    // 2. alert_logs.is_suppressed
    await addColumnIfMissing(sequelize, 'alert_logs', 'is_suppressed', {
      sqlite: 'BOOLEAN NOT NULL DEFAULT 0',
      postgres: 'BOOLEAN NOT NULL DEFAULT FALSE',
      mariadb: 'BOOLEAN NOT NULL DEFAULT 0'
    });

    // 3. automation_rules.task_type
    await addColumnIfMissing(sequelize, 'automation_rules', 'task_type', {
      default: "VARCHAR(32) NOT NULL DEFAULT 'WATER'"
    });

    // 4. devices.last_offline_alert_at
    await addColumnIfMissing(sequelize, 'devices', 'last_offline_alert_at', {
      sqlite: 'DATETIME NULL',
      postgres: 'TIMESTAMPTZ NULL',
      mariadb: 'DATETIME NULL'
    });

    // 5. Additive device_watchdog_alerts table (keeps 016 alert_logs metric ENUM intact)
    if (!(await tableExists(queryInterface, 'device_watchdog_alerts'))) {
      await queryInterface.createTable('device_watchdog_alerts', {
        id: {
          type: DataTypes.BIGINT.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        device_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'devices',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        zone_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'zones',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        garden_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'gardens',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        alert_type: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: 'DEVICE_OFFLINE'
        },
        severity: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'WARNING'
        },
        message: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        is_read: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        triggered_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        resolved_at: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });

      await queryInterface.addIndex('device_watchdog_alerts', ['garden_id', 'triggered_at'], {
        name: 'idx_dwa_garden_triggered'
      });
      await queryInterface.addIndex('device_watchdog_alerts', ['device_id', 'triggered_at'], {
        name: 'idx_dwa_device_triggered'
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'device_watchdog_alerts')) {
      await queryInterface.dropTable('device_watchdog_alerts');
    }
  }
};
