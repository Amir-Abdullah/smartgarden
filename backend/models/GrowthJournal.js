const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GrowthJournal = sequelize.define('GrowthJournal', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_plant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    author_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    entry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    height_cm: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'growth_journals',
    timestamps: true,
    underscored: true
  });

  return GrowthJournal;
};
