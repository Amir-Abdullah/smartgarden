const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificationPreference = sequelize.define('NotificationPreference', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    email_digest_freq: {
      type: DataTypes.ENUM('INSTANT', 'DAILY', 'WEEKLY', 'OFF'),
      allowNull: false,
      defaultValue: 'INSTANT'
    },
    in_app_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    web_push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    webhook_url: { type: DataTypes.STRING(500), allowNull: true },
    webhook_secret: { type: DataTypes.STRING(128), allowNull: true },
    quiet_hours_start: { type: DataTypes.STRING(16), allowNull: true },
    quiet_hours_end: { type: DataTypes.STRING(16), allowNull: true },
    per_garden_overrides: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'notification_preferences',
    timestamps: true,
    underscored: true
  });

  return NotificationPreference;
};
