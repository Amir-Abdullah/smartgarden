module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('alert_configs', {
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
      metric: {
        type: DataTypes.ENUM('SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'LIGHT_LUX'),
        allowNull: false
      },
      min_threshold: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      max_threshold: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      is_email_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      is_in_app_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      quiet_hours_start: {
        type: DataTypes.TIME,
        allowNull: true
      },
      quiet_hours_end: {
        type: DataTypes.TIME,
        allowNull: true
      },
      cooldown_minutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 60
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex('alert_configs', ['zone_id', 'metric'], {
      name: 'uq_zone_metric',
      unique: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('alert_configs');
  }
};
