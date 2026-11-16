module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('sensor_readings', {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
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
      soil_moisture: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      humidity: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      light_lux: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      battery_percent: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      signal_rssi: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      recorded_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex('sensor_readings', ['zone_id', 'recorded_at'], {
      name: 'idx_sr_zone_recorded'
    });
    await queryInterface.addIndex('sensor_readings', ['device_id', 'recorded_at'], {
      name: 'idx_sr_device_recorded'
    });
    await queryInterface.addIndex('sensor_readings', ['recorded_at'], {
      name: 'idx_sr_recorded_at'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sensor_readings');
  }
};
