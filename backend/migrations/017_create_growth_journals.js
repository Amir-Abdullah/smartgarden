module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('growth_journals', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      zone_plant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'zone_plants',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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
      entry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      height_cm: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      photo_url: {
        type: DataTypes.STRING(500),
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

    await queryInterface.addIndex('growth_journals', ['zone_plant_id', 'entry_date'], {
      name: 'idx_gj_plant_date'
    });
    await queryInterface.addIndex('growth_journals', ['author_id'], {
      name: 'idx_gj_author'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('growth_journals');
  }
};
