const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Garden = sequelize.define('Garden', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    owner_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    location_address: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    timezone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: 'UTC'
    },
    area_sq_m: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 0.00
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'gardens',
    timestamps: true,
    underscored: true
  });

  return Garden;
};
