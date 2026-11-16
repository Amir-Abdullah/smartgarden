module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('weather_cache', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
      },
      longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
      },
      grid_key: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true
      },
      weather_data: {
        type: DataTypes.JSON,
        allowNull: false
      },
      forecast_timestamp: {
        type: DataTypes.DATE,
        allowNull: false
      },
      fetched_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('weather_cache', ['grid_key'], {
      name: 'uq_weather_grid_key',
      unique: true
    });
    await queryInterface.addIndex('weather_cache', ['grid_key', 'expires_at'], {
      name: 'idx_weather_grid_expires'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('weather_cache');
  }
};
