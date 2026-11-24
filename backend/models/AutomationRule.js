const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AutomationRule = sequelize.define('AutomationRule', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    metric: {
      type: DataTypes.ENUM('SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'),
      allowNull: false
    },
    operator: {
      type: DataTypes.ENUM('LT', 'GT', 'EQ'),
      allowNull: false,
      defaultValue: 'LT'
    },
    threshold_value: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    weather_condition: {
      type: DataTypes.ENUM('NO_RAIN', 'ANY'),
      allowNull: false,
      defaultValue: 'ANY'
    },
    action_type: {
      type: DataTypes.ENUM('CREATE_TASK', 'SEND_ALERT'),
      allowNull: false,
      defaultValue: 'CREATE_TASK'
    },
    task_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'WATER'
    },
    cooldown_minutes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 180
    },
    max_daily_executions: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 3
    },
    executions_today: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    last_execution_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    last_triggered_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'automation_rules',
    timestamps: true,
    underscored: true
  });

  return AutomationRule;
};
