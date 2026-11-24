const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    key_prefix: { type: DataTypes.STRING(24), allowNull: false },
    key_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    scopes: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'gardens:read,sensors:read' },
    last_used_at: { type: DataTypes.DATE, allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'api_keys',
    timestamps: false,
    underscored: true
  });

  return ApiKey;
};
