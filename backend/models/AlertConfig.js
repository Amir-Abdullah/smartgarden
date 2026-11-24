const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlertConfig = sequelize.define('AlertConfig', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    metric: {
      type: DataTypes.ENUM('SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'),
      allowNull: false
    },
    min_threshold: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    max_threshold: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    is_email_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    is_in_app_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    quiet_hours_start: {
      type: DataTypes.TIME,
      allowNull: true
    },
    quiet_hours_end: {
      type: DataTypes.TIME,
      allowNull: true
    },
    cooldown_minutes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 60
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'alert_configs',
    timestamps: true,
    underscored: true
  });

  return AlertConfig;
};
