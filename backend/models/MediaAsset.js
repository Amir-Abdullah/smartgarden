const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MediaAsset = sequelize.define('MediaAsset', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    storage_key: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true
    },
    provider: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'DB'
    },
    mime_type: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    original_filename: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    size_bytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    data_base64: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    uploaded_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'media_assets',
    timestamps: false,
    underscored: true
  });

  return MediaAsset;
};
