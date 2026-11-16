const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GardenMember = sequelize.define('GardenMember', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    garden_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('OWNER', 'FAMILY', 'GUEST'),
      allowNull: false,
      defaultValue: 'GUEST'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'garden_members',
    timestamps: true,
    underscored: true
  });

  return GardenMember;
};
