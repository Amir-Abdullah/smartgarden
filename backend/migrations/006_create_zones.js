module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable('zones', {
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      is_outdoor: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      zone_type: {
        type: DataTypes.ENUM('OUTDOOR_BED', 'RAISED_BED', 'GREENHOUSE', 'INDOOR_POTS', 'HYDROPONIC'),
        allowNull: false,
        defaultValue: 'OUTDOOR_BED'
      },
      soil_type: {
        type: DataTypes.ENUM('LOAM', 'CLAY', 'SANDY', 'SILT', 'PEAT', 'CHALKY'),
        allowNull: false,
        defaultValue: 'LOAM'
      },
      sunlight_level: {
        type: DataTypes.ENUM('FULL_SUN', 'PART_SHADE', 'FULL_SHADE'),
        allowNull: false,
        defaultValue: 'FULL_SUN'
      },
      area_sq_m: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
        defaultValue: 1.00
      },
      dimensions_description: {
        type: DataTypes.STRING(100),
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
    }, {
      checks: [
        { name: 'chk_zones_area', expression: 'area_sq_m > 0.00' }
      ]
    });

    await queryInterface.addIndex('zones', ['garden_id'], {
      name: 'idx_zones_garden'
    });
    await queryInterface.addIndex('zones', ['sunlight_level'], {
      name: 'idx_zones_sunlight'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('zones');
  }
};
