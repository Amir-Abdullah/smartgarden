const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CareTask = sequelize.define('CareTask', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
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
    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    completed_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    task_type: {
      type: DataTypes.ENUM('WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'HARVEST', 'PEST_INSPECTION'),
      allowNull: false,
      defaultValue: 'WATER'
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    recurrence_days: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    is_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    source: {
      type: DataTypes.ENUM('MANUAL', 'CARE_PLAN', 'RULE_ENGINE'),
      allowNull: false,
      defaultValue: 'MANUAL'
    },
    water_volume_liters: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'care_tasks',
    timestamps: true,
    underscored: true
  });

  return CareTask;
};
