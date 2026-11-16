const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlantCatalog = sequelize.define('PlantCatalog', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    scientific_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true
    },
    common_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('VEGETABLE', 'HERB', 'FRUIT', 'FLOWER', 'FOLIAGE', 'SUCCULENT', 'TREE'),
      allowNull: false,
      defaultValue: 'VEGETABLE'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sunlight_req: {
      type: DataTypes.ENUM('FULL_SUN', 'PART_SHADE', 'FULL_SHADE'),
      allowNull: false
    },
    ideal_moisture_min: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    ideal_moisture_max: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    ideal_temp_min: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    ideal_temp_max: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    watering_freq_days: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3
    },
    fertilizing_freq_days: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 14
    },
    soil_pref: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Well-draining, nutrient-rich loam'
    },
    spacing_cm: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 30
    },
    row_spacing_cm: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 45
    },
    spread_radius_cm: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 20
    },
    min_soil_depth_cm: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 25
    },
    planting_months: {
      type: DataTypes.JSON,
      allowNull: false
    },
    harvest_months: {
      type: DataTypes.JSON,
      allowNull: false
    },
    good_companions: {
      type: DataTypes.JSON,
      allowNull: false
    },
    bad_companions: {
      type: DataTypes.JSON,
      allowNull: false
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'plant_catalog',
    timestamps: true,
    underscored: true
  });

  return PlantCatalog;
};
