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

    if (!(await tableExists(queryInterface, 'media_assets'))) {
      await queryInterface.createTable('media_assets', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        storage_key: {
          type: DataTypes.STRING(180),
          allowNull: false,
          unique: true
        },
        provider: {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: 'DB'
        },
        mime_type: {
          type: DataTypes.STRING(64),
          allowNull: false
        },
        original_filename: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        size_bytes: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false
        },
        data_base64: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        uploaded_by: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }

    if (!(await indexExists(sequelize, 'media_assets', 'idx_ma_uploaded_by'))) {
      await queryInterface.addIndex('media_assets', ['uploaded_by'], { name: 'idx_ma_uploaded_by' });
    }

    if (!(await tableExists(queryInterface, 'community_post_likes'))) {
      await queryInterface.createTable('community_post_likes', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        post_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'community_posts',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        user_id: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });
    }

    if (!(await indexExists(sequelize, 'community_post_likes', 'uq_cpl_post_user'))) {
      await queryInterface.addIndex('community_post_likes', ['post_id', 'user_id'], {
        name: 'uq_cpl_post_user',
        unique: true
      });
    }
  },

  down: async (queryInterface) => {
    if (await tableExists(queryInterface, 'community_post_likes')) {
      await queryInterface.dropTable('community_post_likes');
    }
    if (await tableExists(queryInterface, 'media_assets')) {
      await queryInterface.dropTable('media_assets');
    }
  }
};
