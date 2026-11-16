module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('alert_logs', {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      alert_config_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'alert_configs',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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
      metric: {
        type: DataTypes.ENUM('SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'),
        allowNull: false
      },
      triggered_value: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      threshold_value: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      severity: {
        type: DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL'),
        allowNull: false,
        defaultValue: 'WARNING'
      },
      message: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      email_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      triggered_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex('alert_logs', ['zone_id', 'triggered_at'], {
      name: 'idx_al_zone_triggered'
    });
    await queryInterface.addIndex('alert_logs', ['alert_config_id'], {
      name: 'idx_al_config'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('alert_logs');
  }
};
