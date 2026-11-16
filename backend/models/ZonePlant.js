const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ZonePlant = sequelize.define('ZonePlant', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    plant_catalog_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    custom_nickname: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },
    planted_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    expected_harvest_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('SEEDLING', 'GROWING', 'HARVEST_READY', 'HARVESTED', 'DEAD'),
      allowNull: false,
      defaultValue: 'GROWING'
    },
    health_status: {
      type: DataTypes.ENUM('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL', 'DORMANT'),
      allowNull: false,
      defaultValue: 'HEALTHY'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'zone_plants',
    timestamps: true,
    underscored: true
  });

  return ZonePlant;
};
