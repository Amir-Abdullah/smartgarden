module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('community_posts', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      author_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      garden_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'gardens',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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

    // Explicit leading index on community_posts (author_id)
    await queryInterface.addIndex('community_posts', ['author_id'], {
      name: 'idx_cp_author'
    });
    await queryInterface.addIndex('community_posts', ['created_at'], {
      name: 'idx_cp_created'
    });
    await queryInterface.addIndex('community_posts', ['category'], {
      name: 'idx_cp_category'
    });
    await queryInterface.addIndex('community_posts', ['garden_id'], {
      name: 'idx_cp_garden'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('community_posts');
  }
};
