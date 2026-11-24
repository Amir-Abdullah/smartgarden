const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlertLog = sequelize.define('AlertLog', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    alert_config_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    metric: {
      type: DataTypes.ENUM('SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'),
      allowNull: false
    },
    triggered_value: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    threshold_value: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    severity: {
      type: DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL'),
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
    email_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_suppressed: {
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
    tableName: 'alert_logs',
    timestamps: false,
    underscored: true
  });

  return AlertLog;
};
