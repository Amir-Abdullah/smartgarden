const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    location_region: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  User.prototype.validPassword = function (password, callback) {
    if (!password || !this.password_hash) {
      if (callback) return callback(null, false);
      return Promise.resolve(false);
    }
    if (callback) {
      return bcrypt.compare(password, this.password_hash, callback);
    }
    return bcrypt.compare(password, this.password_hash);
  };

  User.prototype.validPasswordSync = function (password) {
    if (!password || !this.password_hash) return false;
    return bcrypt.compareSync(password, this.password_hash);
  };

  User.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    return values;
  };

  return User;
};
