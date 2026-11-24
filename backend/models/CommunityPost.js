const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityPost = sequelize.define('CommunityPost', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    author_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    garden_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('QUESTION', 'SHOWCASE', 'TIP', 'GENERAL'),
      allowNull: false,
      defaultValue: 'GENERAL'
    },
    photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    is_flagged: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    likes_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    comments_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'community_posts',
    timestamps: true,
    underscored: true
  });

  return CommunityPost;
};
