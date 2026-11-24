const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    garden_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    channel: {
      type: DataTypes.ENUM('IN_APP', 'EMAIL', 'WEBHOOK', 'WEB_PUSH'),
      allowNull: false,
      defaultValue: 'IN_APP'
    },
    category: {
      type: DataTypes.ENUM('ALERT', 'TASK', 'WEATHER', 'COMMUNITY', 'SYSTEM'),
      allowNull: false,
      defaultValue: 'SYSTEM'
    },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    metadata_json: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'notifications',
    timestamps: false,
    underscored: true
  });

  return Notification;
};
