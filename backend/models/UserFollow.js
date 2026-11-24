const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserFollow = sequelize.define('UserFollow', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    follower_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    followed_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_follows',
    timestamps: false,
    underscored: true
  });

  return UserFollow;
};
