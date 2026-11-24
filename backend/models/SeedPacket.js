const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SeedPacket = sequelize.define('SeedPacket', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    garden_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    plant_catalog_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    variety_name: { type: DataTypes.STRING(140), allowNull: false },
    brand: { type: DataTypes.STRING(100), allowNull: true },
    lot_number: { type: DataTypes.STRING(80), allowNull: true },
    quantity_packets: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    seeds_remaining: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 25 },
    germination_rate_pct: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 85 },
    purchased_date: { type: DataTypes.DATEONLY, allowNull: true },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
    storage_location: { type: DataTypes.STRING(120), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'seed_packets',
    timestamps: true,
    underscored: true
  });

  return SeedPacket;
};
