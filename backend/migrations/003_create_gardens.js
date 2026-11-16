module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('gardens', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      owner_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      location_address: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      timezone: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'UTC'
      },
      area_sq_m: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        defaultValue: 0.00
      },
      description: {
        type: DataTypes.TEXT,
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

    await queryInterface.addIndex('gardens', ['owner_id'], {
      name: 'idx_gardens_owner'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('gardens');
  }
};
