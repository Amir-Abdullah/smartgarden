module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('sensor_aggregates_daily', {
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
      aggregate_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      min_soil_moisture: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      max_soil_moisture: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      avg_soil_moisture: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      min_temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      max_temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      avg_temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      min_humidity: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      max_humidity: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      avg_humidity: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      peak_light_lux: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      avg_light_lux: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      sample_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex('sensor_aggregates_daily', ['zone_id', 'device_id', 'aggregate_date'], {
      name: 'uq_sad_zone_device_date',
      unique: true
    });
    await queryInterface.addIndex('sensor_aggregates_daily', ['zone_id', 'aggregate_date'], {
      name: 'idx_sad_zone_date'
    });
    await queryInterface.addIndex('sensor_aggregates_daily', ['device_id'], {
      name: 'idx_sad_device'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sensor_aggregates_daily');
  }
};
