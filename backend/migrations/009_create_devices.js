module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('devices', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
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
      device_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      device_uid: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      key_prefix: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      key_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      device_type: {
        type: DataTypes.ENUM('SIMULATOR', 'ESP32_WROOM', 'SG_PRO_V1', 'GENERIC_IOT'),
        allowNull: false,
        defaultValue: 'SIMULATOR'
      },
      firmware_version: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      last_seen_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ip_address: {
        type: DataTypes.STRING(45),
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

    await queryInterface.addIndex('devices', ['device_uid'], {
      name: 'uq_devices_uid',
      unique: true
    });
    await queryInterface.addIndex('devices', ['key_hash'], {
      name: 'uq_devices_key_hash',
      unique: true
    });
    await queryInterface.addIndex('devices', ['key_prefix'], {
      name: 'idx_devices_prefix'
    });
    await queryInterface.addIndex('devices', ['zone_id'], {
      name: 'idx_devices_zone'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('devices');
  }
};
