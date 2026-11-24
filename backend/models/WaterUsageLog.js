const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaterUsageLog = sequelize.define('WaterUsageLog', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    zone_plant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    task_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    logged_by_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    liters_applied: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false
    },
    method: {
      type: DataTypes.ENUM('MANUAL_HOSE', 'DRIP_IRRIGATION', 'SPRINKLER', 'WATERING_CAN', 'AUTOMATED_VALVE'),
      allowNull: false,
      defaultValue: 'MANUAL_HOSE'
    },
    recorded_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'water_usage_logs',
    timestamps: false,
    underscored: true
  });

  return WaterUsageLog;
};
