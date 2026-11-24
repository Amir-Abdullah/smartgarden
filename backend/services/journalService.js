const { GrowthJournal, ZonePlant, Zone, PlantCatalog, User } = require('../models');
const { Op } = require('sequelize');
const storageService = require('./storageService');
const { validateImageBuffer } = require('../utils/multipartParser');

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function normalizeEntryDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw createError(400, 'INVALID_ENTRY_DATE', 'entry_date must follow YYYY-MM-DD format.');
  }
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, 'INVALID_ENTRY_DATE', 'entry_date is not a valid calendar date.');
  }
  return str;
}

function normalizeHeightCm(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 2000) {
    throw createError(400, 'INVALID_HEIGHT', 'height_cm must be a finite number between 0 and 2000.');
  }
  return Math.round(num * 100) / 100;
}

async function resolvePhotoFromInput({ file, photo_base64, photo_mime_type, photo_url, userId }) {
  if (file && Buffer.isBuffer(file.buffer)) {
    const uploaded = await storageService.uploadImage({
      buffer: file.buffer,
      mimeType: file.mimeType,
      originalFilename: file.filename,
      folder: 'journal',
      userId
    });
    return uploaded.url;
  }

  if (photo_base64 && typeof photo_base64 === 'string') {
    const dataUriMatch = photo_base64.match(/^data:([^;]+);base64,(.+)$/);
    const mime = dataUriMatch ? dataUriMatch[1] : (photo_mime_type || 'image/png');
    const b64Payload = dataUriMatch ? dataUriMatch[2] : photo_base64;
    const buffer = Buffer.from(b64Payload, 'base64');
    const verifiedMime = validateImageBuffer(buffer, mime);
    const uploaded = await storageService.uploadImage({
      buffer,
      mimeType: verifiedMime,
      originalFilename: `journal.${verifiedMime.split('/')[1] || 'png'}`,
      folder: 'journal',
      userId
    });
    return uploaded.url;
  }

  if (photo_url && typeof photo_url === 'string') {
    const trimmed = photo_url.trim();
    if (trimmed.startsWith('/api/media/') || /^https?:\/\//i.test(trimmed)) {
      return trimmed.slice(0, 500);
    }
    throw createError(400, 'INVALID_PHOTO_URL', 'photo_url must be a valid /api/media/ path or http(s) URL.');
  }

  return null;
}

async function hydrateAuthors(entries) {
  const authorIds = [...new Set(entries.map((e) => e.author_id).filter(Boolean))];
  if (authorIds.length === 0) return new Map();
  const users = await User.findAll({
    where: { id: { [Op.in]: authorIds } },
    attributes: ['id', 'name', 'location_region']
  });
  return new Map(users.map((u) => [Number(u.id), u]));
}

function serializeEntry(entry, authorMap, plantMeta = null) {
  const plain = typeof entry.toJSON === 'function' ? entry.toJSON() : { ...entry };
  const author = authorMap.get(Number(plain.author_id));
  return {
    id: Number(plain.id),
    zone_plant_id: Number(plain.zone_plant_id),
    author_id: Number(plain.author_id),
    author_name: author ? author.name : 'Gardener',
    entry_date: String(plain.entry_date).slice(0, 10),
    height_cm: plain.height_cm !== null && plain.height_cm !== undefined ? Number(plain.height_cm) : null,
    note: plain.note,
    photo_url: plain.photo_url || null,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
    ...(plantMeta || {})
  };
}

async function loadZonePlantOrThrow(zonePlantId) {
  const plant = await ZonePlant.findByPk(zonePlantId, {
    include: [
      { model: Zone, as: 'zone', attributes: ['id', 'garden_id', 'name'] },
      { model: PlantCatalog, as: 'catalogPlant', attributes: ['id', 'common_name', 'scientific_name'] }
    ]
  });
  if (!plant) {
    throw createError(404, 'PLANT_NOT_FOUND', `Plant ${zonePlantId} not found.`);
  }
  return plant;
}

async function getPlantJournal(zonePlantId) {
  const plant = await loadZonePlantOrThrow(zonePlantId);
  const rawEntries = await GrowthJournal.findAll({
    where: { zone_plant_id: plant.id },
    order: [['entry_date', 'DESC'], ['id', 'DESC']]
  });

  const authorMap = await hydrateAuthors(rawEntries);
  const entries = rawEntries.map((e) => serializeEntry(e, authorMap));

  const chronological = [...entries].sort((a, b) => {
    const cmp = a.entry_date.localeCompare(b.entry_date);
    return cmp !== 0 ? cmp : a.id - b.id;
  });

  const height_series = chronological
    .filter((e) => e.height_cm !== null)
    .map((e) => ({
      entry_id: e.id,
      entry_date: e.entry_date,
      height_cm: e.height_cm
    }));

  const withPhotos = chronological.filter((e) => Boolean(e.photo_url));
  const before_after = {
    earliest: withPhotos.length > 0 ? withPhotos[0] : (chronological[0] || null),
    latest: withPhotos.length > 1
      ? withPhotos[withPhotos.length - 1]
      : (withPhotos.length === 1 ? withPhotos[0] : (chronological[chronological.length - 1] || null))
  };

  return {
    plant: {
      id: Number(plant.id),
      zone_id: Number(plant.zone_id),
      zone_name: plant.zone?.name || 'Zone',
      garden_id: plant.zone?.garden_id || null,
      common_name: plant.custom_nickname || plant.catalogPlant?.common_name || 'Crop',
      species_name: plant.catalogPlant?.common_name || 'Crop',
      scientific_name: plant.catalogPlant?.scientific_name || null,
      planted_date: plant.planted_date,
      status: plant.status
    },
    entries,
    height_series,
    before_after
  };
}

async function getGardenJournal(gardenId) {
  const zones = await Zone.findAll({
    where: { garden_id: gardenId },
    attributes: ['id', 'name', 'garden_id']
  });
  if (zones.length === 0) {
    return { garden_id: Number(gardenId), entries: [] };
  }

  const zoneById = new Map(zones.map((z) => [Number(z.id), z]));
  const zoneIds = zones.map((z) => Number(z.id));

  const zonePlants = await ZonePlant.findAll({
    where: { zone_id: { [Op.in]: zoneIds } },
    include: [{ model: PlantCatalog, as: 'catalogPlant', attributes: ['id', 'common_name', 'scientific_name'] }]
  });
  if (zonePlants.length === 0) {
    return { garden_id: Number(gardenId), entries: [] };
  }

  const plantById = new Map(zonePlants.map((zp) => [Number(zp.id), zp]));
  const plantIds = zonePlants.map((zp) => Number(zp.id));

  const rawEntries = await GrowthJournal.findAll({
    where: { zone_plant_id: { [Op.in]: plantIds } },
    order: [['entry_date', 'DESC'], ['id', 'DESC']]
  });
  const authorMap = await hydrateAuthors(rawEntries);

  const entries = rawEntries.map((e) => {
    const zp = plantById.get(Number(e.zone_plant_id));
    const zone = zp ? zoneById.get(Number(zp.zone_id)) : null;
    return serializeEntry(e, authorMap, {
      zone_id: zone ? Number(zone.id) : null,
      zone_name: zone ? zone.name : 'Zone',
      plant_name: zp ? (zp.custom_nickname || zp.catalogPlant?.common_name || 'Crop') : 'Crop',
      species_name: zp?.catalogPlant?.common_name || null
    });
  });

  return {
    garden_id: Number(gardenId),
    entries
  };
}

async function createJournalEntry(zonePlantId, userId, payload = {}) {
  const plant = await loadZonePlantOrThrow(zonePlantId);
  const note = String(payload.note || '').trim();
  if (!note) {
    throw createError(400, 'VALIDATION_ERROR', 'A growth observation note is required.');
  }
  if (note.length > 5000) {
    throw createError(400, 'VALIDATION_ERROR', 'Note must be 5000 characters or fewer.');
  }

  const entry_date = normalizeEntryDate(payload.entry_date);
  const height_cm = normalizeHeightCm(payload.height_cm);
  const photo_url = await resolvePhotoFromInput({
    file: payload.file || null,
    photo_base64: payload.photo_base64,
    photo_mime_type: payload.photo_mime_type,
    photo_url: payload.photo_url,
    userId
  });

  const created = await GrowthJournal.create({
    zone_plant_id: plant.id,
    author_id: userId,
    entry_date,
    height_cm,
    note,
    photo_url
  });

  const authorMap = await hydrateAuthors([created]);
  return serializeEntry(created, authorMap);
}

async function updateJournalEntry(zonePlantId, entryId, userId, payload = {}) {
  await loadZonePlantOrThrow(zonePlantId);
  const entry = await GrowthJournal.findOne({
    where: { id: entryId, zone_plant_id: zonePlantId }
  });
  if (!entry) {
    throw createError(404, 'JOURNAL_ENTRY_NOT_FOUND', `Journal entry ${entryId} not found for plant ${zonePlantId}.`);
  }

  const updates = {};
  if (payload.entry_date !== undefined) {
    updates.entry_date = normalizeEntryDate(payload.entry_date);
  }
  if (payload.height_cm !== undefined) {
    updates.height_cm = normalizeHeightCm(payload.height_cm);
  }
  if (payload.note !== undefined) {
    const trimmed = String(payload.note || '').trim();
    if (!trimmed) {
      throw createError(400, 'VALIDATION_ERROR', 'Note cannot be empty.');
    }
    updates.note = trimmed.slice(0, 5000);
  }
  if (payload.file || payload.photo_base64 || payload.photo_url !== undefined) {
    if (payload.photo_url === null && !payload.file && !payload.photo_base64) {
      if (entry.photo_url) {
        await storageService.deleteMediaByUrl(entry.photo_url);
      }
      updates.photo_url = null;
    } else {
      const nextUrl = await resolvePhotoFromInput({
        file: payload.file || null,
        photo_base64: payload.photo_base64,
        photo_mime_type: payload.photo_mime_type,
        photo_url: payload.photo_url,
        userId
      });
      if (nextUrl && entry.photo_url && nextUrl !== entry.photo_url) {
        await storageService.deleteMediaByUrl(entry.photo_url);
      }
      updates.photo_url = nextUrl;
    }
  }

  await entry.update(updates);
  const authorMap = await hydrateAuthors([entry]);
  return serializeEntry(entry, authorMap);
}

async function deleteJournalEntry(zonePlantId, entryId) {
  await loadZonePlantOrThrow(zonePlantId);
  const entry = await GrowthJournal.findOne({
    where: { id: entryId, zone_plant_id: zonePlantId }
  });
  if (!entry) {
    throw createError(404, 'JOURNAL_ENTRY_NOT_FOUND', `Journal entry ${entryId} not found for plant ${zonePlantId}.`);
  }
  const previousPhoto = entry.photo_url;
  await entry.destroy();
  if (previousPhoto) {
    await storageService.deleteMediaByUrl(previousPhoto);
  }
  return { deleted: true, id: Number(entryId) };
}

module.exports = {
  getPlantJournal,
  getGardenJournal,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry
};
