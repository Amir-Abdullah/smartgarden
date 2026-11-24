const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PublicProfile = sequelize.define('PublicProfile', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    handle: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    bio: { type: DataTypes.TEXT, allowNull: true },
    featured_garden_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    show_telemetry: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'public_profiles',
    timestamps: true,
    underscored: true
  });

  return PublicProfile;
};
