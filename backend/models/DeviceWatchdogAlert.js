const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DeviceWatchdogAlert = sequelize.define('DeviceWatchdogAlert', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    device_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    garden_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
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
  }, {
    tableName: 'device_watchdog_alerts',
    timestamps: false,
    underscored: true
  });

  return DeviceWatchdogAlert;
};
