const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityComment = sequelize.define('CommunityComment', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    post_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    author_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    parent_comment_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'community_comments',
    timestamps: true,
    underscored: true
  });

  return CommunityComment;
};
