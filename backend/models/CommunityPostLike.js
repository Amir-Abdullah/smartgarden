const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityPostLike = sequelize.define('CommunityPostLike', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    post_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'community_post_likes',
    timestamps: false,
    underscored: true
  });

  return CommunityPostLike;
};
