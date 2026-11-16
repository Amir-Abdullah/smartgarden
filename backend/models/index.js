const { sequelize, Sequelize } = require('../config/database');

const UserModel = require('./User');
const PasswordResetTokenModel = require('./PasswordResetToken');
const GardenModel = require('./Garden');
const GardenMemberModel = require('./GardenMember');
const GardenInvitationModel = require('./GardenInvitation');
const ZoneModel = require('./Zone');
const PlantCatalogModel = require('./PlantCatalog');
const ZonePlantModel = require('./ZonePlant');

const User = UserModel(sequelize);
const PasswordResetToken = PasswordResetTokenModel(sequelize);
const Garden = GardenModel(sequelize);
const GardenMember = GardenMemberModel(sequelize);
const GardenInvitation = GardenInvitationModel(sequelize);
const Zone = ZoneModel(sequelize);
const PlantCatalog = PlantCatalogModel(sequelize);
const ZonePlant = ZonePlantModel(sequelize);

// Associations
User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'resetTokens', onDelete: 'CASCADE' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Garden, { foreignKey: 'owner_id', as: 'ownedGardens', onDelete: 'RESTRICT' });
Garden.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Garden.hasMany(GardenMember, { foreignKey: 'garden_id', as: 'members', onDelete: 'CASCADE' });
GardenMember.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });
User.hasMany(GardenMember, { foreignKey: 'user_id', as: 'memberships', onDelete: 'CASCADE' });
GardenMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Garden.hasMany(GardenInvitation, { foreignKey: 'garden_id', as: 'invitations', onDelete: 'CASCADE' });
GardenInvitation.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });
User.hasMany(GardenInvitation, { foreignKey: 'invited_by', as: 'sentInvitations', onDelete: 'CASCADE' });
GardenInvitation.belongsTo(User, { foreignKey: 'invited_by', as: 'inviter' });

Garden.hasMany(Zone, { foreignKey: 'garden_id', as: 'zones', onDelete: 'CASCADE' });
Zone.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });

Zone.hasMany(ZonePlant, { foreignKey: 'zone_id', as: 'plants', onDelete: 'CASCADE' });
ZonePlant.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

PlantCatalog.hasMany(ZonePlant, { foreignKey: 'plant_catalog_id', as: 'zonePlants', onDelete: 'RESTRICT' });
ZonePlant.belongsTo(PlantCatalog, { foreignKey: 'plant_catalog_id', as: 'catalogPlant' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  PasswordResetToken,
  Garden,
  GardenMember,
  GardenInvitation,
  Zone,
  PlantCatalog,
  ZonePlant
};
