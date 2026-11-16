module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('user_follows', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      follower_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      followed_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    }, {
      checks: [
        { name: 'chk_no_self_follow', expression: 'follower_id <> followed_id' }
      ]
    });

    await queryInterface.addIndex('user_follows', ['follower_id', 'followed_id'], {
      name: 'uq_follower_followed',
      unique: true
    });
    await queryInterface.addIndex('user_follows', ['followed_id'], {
      name: 'idx_uf_followed'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_follows');
  }
};
