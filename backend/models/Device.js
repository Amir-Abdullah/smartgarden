const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Device = sequelize.define('Device', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    zone_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    device_uid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    key_prefix: {
      type: DataTypes.STRING(16),
      allowNull: false
    },
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    device_type: {
      type: DataTypes.ENUM('SIMULATOR', 'ESP32_WROOM', 'SG_PRO_V1', 'GENERIC_IOT'),
      allowNull: false,
      defaultValue: 'SIMULATOR'
    },
    firmware_version: {
      type: DataTypes.STRING(32),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_offline_alert_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    }
  }, {
    tableName: 'devices',
    timestamps: true,
    underscored: true
  });

  Device.prototype.toJSON = function() {
    const values = Object.assign({}, this._values || this.get());
    delete values.key_hash;
    values.is_active = Boolean(values.is_active);
    return values;
  };

  return Device;
};
