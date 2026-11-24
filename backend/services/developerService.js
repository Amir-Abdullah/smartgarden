const crypto = require('crypto');
const { ApiKey, PublicProfile, User, Garden, Zone, ZonePlant, PlantCatalog, SensorReading } = require('../models');
const { Op } = require('sequelize');

const VALID_SCOPES = ['gardens:read', 'gardens:write', 'sensors:read', 'sensors:write', 'analytics:read', 'seeds:read', 'seeds:write'];

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function sha256Hex(val) {
  return crypto.createHash('sha256').update(String(val)).digest('hex');
}

function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listApiKeys(userId) {
  const rows = await ApiKey.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC'], ['id', 'DESC']]
  });
  return rows.map((k) => ({
    id: Number(k.id),
    name: k.name,
    key_prefix: k.key_prefix,
    scopes: String(k.scopes || '').split(',').filter(Boolean),
    is_active: Boolean(k.is_active),
    last_used_at: k.last_used_at,
    expires_at: k.expires_at,
    created_at: k.created_at
  }));
}

async function createApiKey(userId, { name, scopes = ['gardens:read', 'sensors:read'], expires_in_days = null } = {}) {
  const cleanName = String(name || '').trim();
  if (cleanName.length < 2 || cleanName.length > 100) {
    throw createError(400, 'VALIDATION_ERROR', 'API key name must be between 2 and 100 characters.');
  }

  const scopeList = Array.isArray(scopes)
    ? scopes.filter((s) => VALID_SCOPES.includes(s))
    : String(scopes || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => VALID_SCOPES.includes(s));

  const finalScopes = scopeList.length > 0 ? [...new Set(scopeList)] : ['gardens:read', 'sensors:read'];

  const rawToken = `sg_pat_${crypto.randomBytes(24).toString('hex')}`;
  const keyPrefix = rawToken.slice(0, 16);
  const keyHash = sha256Hex(rawToken);

  let expiresAt = null;
  if (expires_in_days !== null && expires_in_days !== undefined && expires_in_days !== '') {
    const days = Number(expires_in_days);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      throw createError(400, 'VALIDATION_ERROR', 'expires_in_days must be between 1 and 3650.');
    }
    expiresAt = new Date(Date.now() + days * 86400000);
  }

  const created = await ApiKey.create({
    user_id: userId,
    name: cleanName,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes: finalScopes.join(','),
    expires_at: expiresAt,
    is_active: true
  });

  return {
    id: Number(created.id),
    name: created.name,
    key_prefix: created.key_prefix,
    scopes: finalScopes,
    token: rawToken,
    expires_at: created.expires_at,
    created_at: created.created_at
  };
}

async function revokeApiKey(userId, keyId) {
  const key = await ApiKey.findOne({ where: { id: keyId, user_id: userId } });
  if (!key) {
    throw createError(404, 'API_KEY_NOT_FOUND', `API key ${keyId} not found.`);
  }
  await key.update({ is_active: false });
  return { revoked: true, id: Number(key.id) };
}

async function authenticatePat(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || !rawToken.startsWith('sg_pat_')) {
    return null;
  }

  const prefix = rawToken.slice(0, 16);
  const computedBuf = Buffer.from(sha256Hex(rawToken), 'utf8');
  const candidates = await ApiKey.findAll({
    where: { key_prefix: prefix, is_active: true }
  });

  let matched = null;
  for (const cand of candidates) {
    const candBuf = Buffer.from(String(cand.key_hash || ''), 'utf8');
    if (candBuf.length === computedBuf.length && crypto.timingSafeEqual(candBuf, computedBuf)) {
      matched = cand;
      break;
    }
  }

  if (!matched) return null;
  if (matched.expires_at && new Date(matched.expires_at).getTime() < Date.now()) {
    return null;
  }

  const user = await User.findByPk(matched.user_id);
  if (!user) return null;

  await matched.update({ last_used_at: new Date() });
  return {
    user: {
      id: Number(user.id),
      email: user.email,
      name: user.name,
      is_admin: Boolean(user.is_admin)
    },
    scopes: String(matched.scopes || '').split(',').filter(Boolean),
    keyId: Number(matched.id)
  };
}

async function getMyPublicProfile(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'name', 'location_region'] });
  let profile = await PublicProfile.findOne({ where: { user_id: userId } });
  if (!profile) {
    const base = normalizeHandle(user?.name || `grower-${userId}`) || `grower-${userId}`;
    profile = await PublicProfile.create({
      user_id: userId,
      handle: `${base}-${userId}`.slice(0, 64),
      is_public: false,
      bio: '',
      show_telemetry: true
    });
  }
  return {
    id: Number(profile.id),
    user_id: Number(profile.user_id),
    handle: profile.handle,
    is_public: Boolean(profile.is_public),
    bio: profile.bio || '',
    featured_garden_id: profile.featured_garden_id ? Number(profile.featured_garden_id) : null,
    show_telemetry: Boolean(profile.show_telemetry)
  };
}

async function upsertMyPublicProfile(userId, payload = {}) {
  const existing = await PublicProfile.findOne({ where: { user_id: userId } });
  let handle = existing ? existing.handle : `grower-${userId}`;

  if (payload.handle !== undefined) {
    const cleaned = String(payload.handle || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,40}$/.test(cleaned)) {
      throw createError(
        400,
        'INVALID_HANDLE',
        'Public handle must be 3–40 characters using lowercase letters, numbers, hyphens, or underscores.'
      );
    }
    const taken = await PublicProfile.findOne({ where: { handle: cleaned } });
    if (taken && Number(taken.user_id) !== Number(userId)) {
      throw createError(409, 'HANDLE_TAKEN', `Handle "@${cleaned}" is already claimed.`);
    }
    handle = cleaned;
  }

  let featuredGardenId = existing ? existing.featured_garden_id : null;
  if (payload.featured_garden_id !== undefined) {
    if (payload.featured_garden_id === null || payload.featured_garden_id === '' || payload.featured_garden_id === 'NONE') {
      featuredGardenId = null;
    } else {
      const g = await Garden.findByPk(payload.featured_garden_id);
      if (!g || Number(g.owner_id) !== Number(userId)) {
        throw createError(403, 'FORBIDDEN', 'Featured garden must belong to your account.');
      }
      featuredGardenId = g.id;
    }
  }

  const fields = {
    user_id: userId,
    handle,
    is_public: payload.is_public !== undefined ? Boolean(payload.is_public) : Boolean(existing?.is_public),
    bio: payload.bio !== undefined ? String(payload.bio || '').slice(0, 1000) : (existing?.bio || ''),
    featured_garden_id: featuredGardenId,
    show_telemetry: payload.show_telemetry !== undefined ? Boolean(payload.show_telemetry) : (existing ? Boolean(existing.show_telemetry) : true)
  };

  if (existing) {
    await existing.update(fields);
  } else {
    await PublicProfile.create(fields);
  }
  return getMyPublicProfile(userId);
}

async function getPublicShowcaseByHandle(rawHandle) {
  const clean = String(rawHandle || '').trim().toLowerCase();
  const profile = await PublicProfile.findOne({ where: { handle: clean } });
  if (!profile || !profile.is_public) {
    throw createError(404, 'PROFILE_NOT_FOUND', `Public grower profile "@${clean}" not found.`);
  }

  // Strictly omit private user PII (no email, password_hash, exact GPS coordinates)
  const user = await User.findByPk(profile.user_id, {
    attributes: ['id', 'name', 'location_region', 'created_at']
  });

  let garden = profile.featured_garden_id
    ? await Garden.findByPk(profile.featured_garden_id)
    : await Garden.findOne({ where: { owner_id: profile.user_id }, order: [['id', 'ASC']] });

  let featuredGarden = null;
  if (garden) {
    const zones = await Zone.findAll({ where: { garden_id: garden.id }, order: [['id', 'ASC']] });
    const zoneIds = zones.map((z) => Number(z.id));
    let zonePlants = [];
    const latestReadingsByZone = {};

    if (zoneIds.length > 0) {
      zonePlants = await ZonePlant.findAll({
        where: { zone_id: { [Op.in]: zoneIds } },
        include: [{ model: PlantCatalog, as: 'catalogPlant', attributes: ['id', 'common_name', 'scientific_name'] }]
      });

      if (profile.show_telemetry) {
        const readings = await SensorReading.findAll({
          where: { zone_id: { [Op.in]: zoneIds } },
          order: [['recorded_at', 'DESC'], ['id', 'DESC']]
        });
        for (const r of readings) {
          const zId = Number(r.zone_id);
          if (!latestReadingsByZone[zId]) {
            latestReadingsByZone[zId] = {
              soil_moisture: r.soil_moisture,
              temperature: r.temperature,
              humidity: r.humidity,
              light_lux: r.light_lux,
              recorded_at: r.recorded_at
            };
          }
        }
      }
    }

    featuredGarden = {
      id: Number(garden.id),
      name: garden.name,
      description: garden.description,
      timezone: garden.timezone,
      area_sq_m: Number(garden.area_sq_m || 0),
      zones: zones.map((z) => ({
        id: Number(z.id),
        name: z.name,
        zone_type: z.zone_type,
        soil_type: z.soil_type,
        sunlight_level: z.sunlight_level,
        is_outdoor: Boolean(z.is_outdoor),
        area_sq_m: Number(z.area_sq_m || 0),
        plants: zonePlants
          .filter((zp) => Number(zp.zone_id) === Number(z.id))
          .map((zp) => ({
            id: Number(zp.id),
            name: zp.custom_nickname || zp.catalogPlant?.common_name || 'Crop',
            scientific_name: zp.catalogPlant?.scientific_name || null,
            quantity: Number(zp.quantity || 1)
          }))
      })),
      latest_readings_by_zone: latestReadingsByZone
    };
  }

  return {
    profile: {
      handle: profile.handle,
      bio: profile.bio || '',
      member_name: user ? user.name : profile.handle,
      location_region: user?.location_region || null,
      member_since: user?.created_at || null,
      show_telemetry: Boolean(profile.show_telemetry)
    },
    featured_garden: featuredGarden
  };
}

module.exports = {
  VALID_SCOPES,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  authenticatePat,
  getMyPublicProfile,
  upsertMyPublicProfile,
  getPublicShowcaseByHandle
};
