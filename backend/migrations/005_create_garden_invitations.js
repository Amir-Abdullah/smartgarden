module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('garden_invitations', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      garden_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'gardens',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      invited_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex('garden_invitations', ['token'], {
      name: 'uq_gi_token',
      unique: true
    });
    await queryInterface.addIndex('garden_invitations', ['invitee_email', 'status'], {
      name: 'idx_gi_email_status'
    });
    await queryInterface.addIndex('garden_invitations', ['garden_id'], {
      name: 'idx_gi_garden'
    });
    await queryInterface.addIndex('garden_invitations', ['invited_by'], {
      name: 'idx_gi_invited_by'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('garden_invitations');
  }
};
