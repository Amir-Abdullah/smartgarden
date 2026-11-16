module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('water_usage_logs', {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
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
      zone_plant_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'zone_plants',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      task_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'care_tasks',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      logged_by_user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      liters_applied: {
        type: DataTypes.DECIMAL(7, 2),
        allowNull: false
      },
      method: {
        type: DataTypes.ENUM('MANUAL_HOSE', 'DRIP_IRRIGATION', 'SPRINKLER', 'WATERING_CAN', 'AUTOMATED_VALVE'),
        allowNull: false,
        defaultValue: 'MANUAL_HOSE'
      },
      recorded_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      notes: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    });

    await queryInterface.addIndex('water_usage_logs', ['zone_id', 'recorded_at'], {
      name: 'idx_wul_zone_recorded'
    });
    await queryInterface.addIndex('water_usage_logs', ['zone_plant_id'], {
      name: 'idx_wul_zone_plant'
    });
    await queryInterface.addIndex('water_usage_logs', ['task_id'], {
      name: 'idx_wul_task'
    });
    await queryInterface.addIndex('water_usage_logs', ['logged_by_user_id'], {
      name: 'idx_wul_logged_by'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('water_usage_logs');
  }
};
