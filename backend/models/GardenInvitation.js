const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GardenInvitation = sequelize.define('GardenInvitation', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    garden_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    invited_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    invitee_email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('FAMILY', 'GUEST'),
      allowNull: false,
      defaultValue: 'GUEST'
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'garden_invitations',
    timestamps: true,
    underscored: true
  });

  return GardenInvitation;
};
