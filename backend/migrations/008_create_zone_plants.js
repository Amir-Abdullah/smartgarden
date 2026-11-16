module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('zone_plants', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      zone_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'zones',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      plant_catalog_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'plant_catalog',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      custom_nickname: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      planted_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      expected_harvest_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('SEEDLING', 'GROWING', 'HARVEST_READY', 'HARVESTED', 'DEAD'),
        allowNull: false,
        defaultValue: 'GROWING'
      },
      health_status: {
        type: DataTypes.ENUM('HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL', 'DORMANT'),
        allowNull: false,
        defaultValue: 'HEALTHY'
      },
      notes: {
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

    await queryInterface.addIndex('zone_plants', ['zone_id'], {
      name: 'idx_zp_zone'
    });
    await queryInterface.addIndex('zone_plants', ['plant_catalog_id'], {
      name: 'idx_zp_catalog'
    });
    await queryInterface.addIndex('zone_plants', ['status'], {
      name: 'idx_zp_status'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('zone_plants');
  }
};
