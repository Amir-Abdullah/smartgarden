module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('garden_members', {
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
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      role: {
        type: DataTypes.ENUM('OWNER', 'FAMILY', 'GUEST'),
        allowNull: false,
        defaultValue: 'GUEST'
      },
      expires_at: {
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

    await queryInterface.addIndex('garden_members', ['garden_id', 'user_id'], {
      name: 'uq_garden_user',
      unique: true
    });
    await queryInterface.addIndex('garden_members', ['user_id'], {
      name: 'idx_gm_user'
    });
    await queryInterface.addIndex('garden_members', ['garden_id'], {
      name: 'idx_gm_garden'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('garden_members');
  }
};
