const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SensorAggregateDaily = sequelize.define('SensorAggregateDaily', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    device_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    aggregate_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    min_soil_moisture: { type: DataTypes.FLOAT, allowNull: false },
    max_soil_moisture: { type: DataTypes.FLOAT, allowNull: false },
    avg_soil_moisture: { type: DataTypes.FLOAT, allowNull: false },
    min_temperature: { type: DataTypes.FLOAT, allowNull: false },
    max_temperature: { type: DataTypes.FLOAT, allowNull: false },
    avg_temperature: { type: DataTypes.FLOAT, allowNull: false },
    min_humidity: { type: DataTypes.FLOAT, allowNull: false },
    max_humidity: { type: DataTypes.FLOAT, allowNull: false },
    avg_humidity: { type: DataTypes.FLOAT, allowNull: false },
    peak_light_lux: { type: DataTypes.FLOAT, allowNull: false },
    avg_light_lux: { type: DataTypes.FLOAT, allowNull: false },
    sample_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }
  }, {
    tableName: 'sensor_aggregates_daily',
    timestamps: true,
    underscored: true,
    updatedAt: false
  });

  return SensorAggregateDaily;
};
