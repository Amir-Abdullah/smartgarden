const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SustainabilityLog = sequelize.define('SustainabilityLog', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    garden_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    zone_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    log_type: {
      type: DataTypes.ENUM('RAINWATER_HARVEST', 'COMPOST_ADDED', 'MULCH_SAVINGS', 'SOLAR_OFFSET'),
      allowNull: false
    },
    quantity: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    unit: { type: DataTypes.STRING(32), allowNull: false },
    estimated_water_saved_l: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    estimated_co2_offset_kg: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    recorded_date: { type: DataTypes.DATEONLY, allowNull: false },
    notes: { type: DataTypes.STRING(500), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'sustainability_logs',
    timestamps: false,
    underscored: true
  });

  return SustainabilityLog;
};
