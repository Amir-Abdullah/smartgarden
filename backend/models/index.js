const { sequelize, Sequelize } = require('../config/database');

const UserModel = require('./User');
const PasswordResetTokenModel = require('./PasswordResetToken');
const GardenModel = require('./Garden');
const GardenMemberModel = require('./GardenMember');
const GardenInvitationModel = require('./GardenInvitation');
const ZoneModel = require('./Zone');
const PlantCatalogModel = require('./PlantCatalog');
const ZonePlantModel = require('./ZonePlant');
const DeviceModel = require('./Device');
const SensorReadingModel = require('./SensorReading');
const SensorAggregateDailyModel = require('./SensorAggregateDaily');
const CareTaskModel = require('./CareTask');
const WaterUsageLogModel = require('./WaterUsageLog');
const AutomationRuleModel = require('./AutomationRule');
const AlertConfigModel = require('./AlertConfig');
const AlertLogModel = require('./AlertLog');
const DeviceWatchdogAlertModel = require('./DeviceWatchdogAlert');
const WeatherCacheModel = require('./WeatherCache');
const GrowthJournalModel = require('./GrowthJournal');
const CommunityPostModel = require('./CommunityPost');
const CommunityCommentModel = require('./CommunityComment');
const UserFollowModel = require('./UserFollow');
const MediaAssetModel = require('./MediaAsset');
const CommunityPostLikeModel = require('./CommunityPostLike');
const NotificationPreferenceModel = require('./NotificationPreference');
const NotificationModel = require('./Notification');
const SustainabilityLogModel = require('./SustainabilityLog');
const SeedPacketModel = require('./SeedPacket');
const ApiKeyModel = require('./ApiKey');
const PublicProfileModel = require('./PublicProfile');

const User = UserModel(sequelize);
const PasswordResetToken = PasswordResetTokenModel(sequelize);
const Garden = GardenModel(sequelize);
const GardenMember = GardenMemberModel(sequelize);
const GardenInvitation = GardenInvitationModel(sequelize);
const Zone = ZoneModel(sequelize);
const PlantCatalog = PlantCatalogModel(sequelize);
const ZonePlant = ZonePlantModel(sequelize);
const Device = DeviceModel(sequelize);
const SensorReading = SensorReadingModel(sequelize);
const SensorAggregateDaily = SensorAggregateDailyModel(sequelize);
const CareTask = CareTaskModel(sequelize);
const WaterUsageLog = WaterUsageLogModel(sequelize);
const AutomationRule = AutomationRuleModel(sequelize);
const AlertConfig = AlertConfigModel(sequelize);
const AlertLog = AlertLogModel(sequelize);
const DeviceWatchdogAlert = DeviceWatchdogAlertModel(sequelize);
const WeatherCache = WeatherCacheModel(sequelize);
const GrowthJournal = GrowthJournalModel(sequelize);
const CommunityPost = CommunityPostModel(sequelize);
const CommunityComment = CommunityCommentModel(sequelize);
const UserFollow = UserFollowModel(sequelize);
const MediaAsset = MediaAssetModel(sequelize);
const CommunityPostLike = CommunityPostLikeModel(sequelize);
const NotificationPreference = NotificationPreferenceModel(sequelize);
const Notification = NotificationModel(sequelize);
const SustainabilityLog = SustainabilityLogModel(sequelize);
const SeedPacket = SeedPacketModel(sequelize);
const ApiKey = ApiKeyModel(sequelize);
const PublicProfile = PublicProfileModel(sequelize);

// Sprint 1 Associations
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

// Sprint 2 Associations (F6-F10)
Zone.hasMany(Device, { foreignKey: 'zone_id', as: 'devices', onDelete: 'CASCADE' });
Device.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

Zone.hasMany(SensorReading, { foreignKey: 'zone_id', as: 'sensorReadings', onDelete: 'CASCADE' });
SensorReading.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
Device.hasMany(SensorReading, { foreignKey: 'device_id', as: 'readings', onDelete: 'CASCADE' });
SensorReading.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Zone.hasMany(SensorAggregateDaily, { foreignKey: 'zone_id', as: 'dailyAggregates', onDelete: 'CASCADE' });
SensorAggregateDaily.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
Device.hasMany(SensorAggregateDaily, { foreignKey: 'device_id', as: 'dailyAggregates', onDelete: 'CASCADE' });
SensorAggregateDaily.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Zone.hasMany(CareTask, { foreignKey: 'zone_id', as: 'careTasks', onDelete: 'CASCADE' });
CareTask.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
ZonePlant.hasMany(CareTask, { foreignKey: 'zone_plant_id', as: 'careTasks', onDelete: 'SET NULL' });
CareTask.belongsTo(ZonePlant, { foreignKey: 'zone_plant_id', as: 'zonePlant' });
User.hasMany(CareTask, { foreignKey: 'assigned_to', as: 'assignedTasks', onDelete: 'SET NULL' });
CareTask.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
User.hasMany(CareTask, { foreignKey: 'completed_by', as: 'completedTasks', onDelete: 'SET NULL' });
CareTask.belongsTo(User, { foreignKey: 'completed_by', as: 'completer' });

Zone.hasMany(WaterUsageLog, { foreignKey: 'zone_id', as: 'waterLogs', onDelete: 'CASCADE' });
WaterUsageLog.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
ZonePlant.hasMany(WaterUsageLog, { foreignKey: 'zone_plant_id', as: 'waterLogs', onDelete: 'SET NULL' });
WaterUsageLog.belongsTo(ZonePlant, { foreignKey: 'zone_plant_id', as: 'zonePlant' });
CareTask.hasMany(WaterUsageLog, { foreignKey: 'task_id', as: 'waterLogs', onDelete: 'SET NULL' });
WaterUsageLog.belongsTo(CareTask, { foreignKey: 'task_id', as: 'task' });
User.hasMany(WaterUsageLog, { foreignKey: 'logged_by_user_id', as: 'waterLogs', onDelete: 'SET NULL' });
WaterUsageLog.belongsTo(User, { foreignKey: 'logged_by_user_id', as: 'loggedBy' });

Zone.hasMany(AutomationRule, { foreignKey: 'zone_id', as: 'automationRules', onDelete: 'CASCADE' });
AutomationRule.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

Zone.hasMany(AlertConfig, { foreignKey: 'zone_id', as: 'alertConfigs', onDelete: 'CASCADE' });
AlertConfig.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

Zone.hasMany(AlertLog, { foreignKey: 'zone_id', as: 'alertLogs', onDelete: 'CASCADE' });
AlertLog.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
AlertConfig.hasMany(AlertLog, { foreignKey: 'alert_config_id', as: 'alertLogs', onDelete: 'SET NULL' });
AlertLog.belongsTo(AlertConfig, { foreignKey: 'alert_config_id', as: 'alertConfig' });

Device.hasMany(DeviceWatchdogAlert, { foreignKey: 'device_id', as: 'watchdogAlerts', onDelete: 'CASCADE' });
DeviceWatchdogAlert.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });
Zone.hasMany(DeviceWatchdogAlert, { foreignKey: 'zone_id', as: 'watchdogAlerts', onDelete: 'CASCADE' });
DeviceWatchdogAlert.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
Garden.hasMany(DeviceWatchdogAlert, { foreignKey: 'garden_id', as: 'watchdogAlerts', onDelete: 'CASCADE' });
DeviceWatchdogAlert.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });

// Sprint 4 Associations (F16-F20)
ZonePlant.hasMany(GrowthJournal, { foreignKey: 'zone_plant_id', as: 'journalEntries', onDelete: 'CASCADE' });
GrowthJournal.belongsTo(ZonePlant, { foreignKey: 'zone_plant_id', as: 'zonePlant' });
User.hasMany(GrowthJournal, { foreignKey: 'author_id', as: 'journalEntries', onDelete: 'CASCADE' });
GrowthJournal.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

User.hasMany(CommunityPost, { foreignKey: 'author_id', as: 'communityPosts', onDelete: 'CASCADE' });
CommunityPost.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Garden.hasMany(CommunityPost, { foreignKey: 'garden_id', as: 'communityPosts', onDelete: 'SET NULL' });
CommunityPost.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });

CommunityPost.hasMany(CommunityComment, { foreignKey: 'post_id', as: 'comments', onDelete: 'CASCADE' });
CommunityComment.belongsTo(CommunityPost, { foreignKey: 'post_id', as: 'post' });
User.hasMany(CommunityComment, { foreignKey: 'author_id', as: 'communityComments', onDelete: 'CASCADE' });
CommunityComment.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
CommunityComment.hasMany(CommunityComment, { foreignKey: 'parent_comment_id', as: 'replies', onDelete: 'CASCADE' });
CommunityComment.belongsTo(CommunityComment, { foreignKey: 'parent_comment_id', as: 'parent' });

CommunityPost.hasMany(CommunityPostLike, { foreignKey: 'post_id', as: 'likes', onDelete: 'CASCADE' });
CommunityPostLike.belongsTo(CommunityPost, { foreignKey: 'post_id', as: 'post' });
User.hasMany(CommunityPostLike, { foreignKey: 'user_id', as: 'postLikes', onDelete: 'CASCADE' });
CommunityPostLike.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(UserFollow, { foreignKey: 'follower_id', as: 'followingRecords', onDelete: 'CASCADE' });
UserFollow.belongsTo(User, { foreignKey: 'follower_id', as: 'follower' });
User.hasMany(UserFollow, { foreignKey: 'followed_id', as: 'followerRecords', onDelete: 'CASCADE' });
UserFollow.belongsTo(User, { foreignKey: 'followed_id', as: 'followed' });

User.hasMany(MediaAsset, { foreignKey: 'uploaded_by', as: 'mediaAssets', onDelete: 'SET NULL' });
MediaAsset.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// Sprint 5 Associations (F21-F24)
User.hasOne(NotificationPreference, { foreignKey: 'user_id', as: 'notificationPreference', onDelete: 'CASCADE' });
NotificationPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Garden.hasMany(Notification, { foreignKey: 'garden_id', as: 'notifications', onDelete: 'SET NULL' });
Notification.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });

Garden.hasMany(SustainabilityLog, { foreignKey: 'garden_id', as: 'sustainabilityLogs', onDelete: 'CASCADE' });
SustainabilityLog.belongsTo(Garden, { foreignKey: 'garden_id', as: 'garden' });
Zone.hasMany(SustainabilityLog, { foreignKey: 'zone_id', as: 'sustainabilityLogs', onDelete: 'SET NULL' });
SustainabilityLog.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

User.hasMany(SeedPacket, { foreignKey: 'user_id', as: 'seedPackets', onDelete: 'CASCADE' });
SeedPacket.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
PlantCatalog.hasMany(SeedPacket, { foreignKey: 'plant_catalog_id', as: 'seedPackets', onDelete: 'SET NULL' });
SeedPacket.belongsTo(PlantCatalog, { foreignKey: 'plant_catalog_id', as: 'catalogPlant' });

User.hasMany(ApiKey, { foreignKey: 'user_id', as: 'apiKeys', onDelete: 'CASCADE' });
ApiKey.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(PublicProfile, { foreignKey: 'user_id', as: 'publicProfile', onDelete: 'CASCADE' });
PublicProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Garden.hasMany(PublicProfile, { foreignKey: 'featured_garden_id', as: 'featuredProfiles', onDelete: 'SET NULL' });
PublicProfile.belongsTo(Garden, { foreignKey: 'featured_garden_id', as: 'featuredGarden' });

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
  ZonePlant,
  Device,
  SensorReading,
  SensorAggregateDaily,
  CareTask,
  WaterUsageLog,
  AutomationRule,
  AlertConfig,
  AlertLog,
  DeviceWatchdogAlert,
  WeatherCache,
  GrowthJournal,
  CommunityPost,
  CommunityComment,
  UserFollow,
  MediaAsset,
  CommunityPostLike,
  NotificationPreference,
  Notification,
  SustainabilityLog,
  SeedPacket,
  ApiKey,
  PublicProfile
};
