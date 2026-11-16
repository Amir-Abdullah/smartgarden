module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('care_tasks', {
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
      assigned_to: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      task_type: {
        type: DataTypes.ENUM('WATER', 'FERTILIZE', 'PRUNE', 'REPOT', 'HARVEST', 'PEST_INSPECTION'),
        allowNull: false,
        defaultValue: 'WATER'
      },
      due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      recurrence_days: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      is_completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      source: {
        type: DataTypes.ENUM('MANUAL', 'CARE_PLAN', 'RULE_ENGINE'),
        allowNull: false,
        defaultValue: 'MANUAL'
      },
      water_volume_liters: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true
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

    await queryInterface.addIndex('care_tasks', ['zone_id', 'due_date', 'is_completed'], {
      name: 'idx_ct_zone_due'
    });
    await queryInterface.addIndex('care_tasks', ['assigned_to'], {
      name: 'idx_ct_assigned'
    });
    await queryInterface.addIndex('care_tasks', ['zone_plant_id'], {
      name: 'idx_ct_zone_plant'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('care_tasks');
  }
};
