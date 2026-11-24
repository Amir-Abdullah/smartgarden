const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WeatherCache = sequelize.define('WeatherCache', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
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
  }, {
    tableName: 'weather_cache',
    timestamps: false,
    underscored: true
  });

  return WeatherCache;
};
