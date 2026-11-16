const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Zone = sequelize.define('Zone', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    garden_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    is_outdoor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    zone_type: {
      type: DataTypes.ENUM('OUTDOOR_BED', 'RAISED_BED', 'GREENHOUSE', 'INDOOR_POTS', 'HYDROPONIC'),
      allowNull: false,
      defaultValue: 'OUTDOOR_BED'
    },
    soil_type: {
      type: DataTypes.ENUM('LOAM', 'CLAY', 'SANDY', 'SILT', 'PEAT', 'CHALKY'),
      allowNull: false,
      defaultValue: 'LOAM'
    },
    sunlight_level: {
      type: DataTypes.ENUM('FULL_SUN', 'PART_SHADE', 'FULL_SHADE'),
      allowNull: false,
      defaultValue: 'FULL_SUN'
    },
    area_sq_m: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 1.00
    },
    dimensions_description: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'zones',
    timestamps: true,
    underscored: true
  });

  return Zone;
};
