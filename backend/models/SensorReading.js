const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SensorReading = sequelize.define('SensorReading', {
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
  }, {
    tableName: 'sensor_readings',
    timestamps: false,
    underscored: true
  });

  return SensorReading;
};
