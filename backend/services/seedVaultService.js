const { SeedPacket, PlantCatalog, Zone, ZonePlant } = require('../models');
const { checkMemberAccess } = require('../middleware/rbac');

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function computeViabilityStatus(packet) {
  const today = new Date().toISOString().slice(0, 10);
  if (packet.expiry_date) {
    const exp = String(packet.expiry_date).slice(0, 10);
    if (exp < today) return 'EXPIRED';
    const diffDays = (new Date(`${exp}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000;
    if (diffDays <= 60) return 'EXPIRING_SOON';
  }
  if (Number(packet.seeds_remaining || 0) <= 5) {
    return 'LOW_STOCK';
  }
  return 'FRESH';
}

function serializePacket(packet, catalogMap) {
  const plain = typeof packet.toJSON === 'function' ? packet.toJSON() : { ...packet };
  const species = plain.plant_catalog_id ? catalogMap.get(Number(plain.plant_catalog_id)) : null;
  return {
    id: Number(plain.id),
    user_id: Number(plain.user_id),
    garden_id: plain.garden_id ? Number(plain.garden_id) : null,
    plant_catalog_id: plain.plant_catalog_id ? Number(plain.plant_catalog_id) : null,
    species_name: species ? species.common_name : null,
    scientific_name: species ? species.scientific_name : null,
    variety_name: plain.variety_name,
    brand: plain.brand || null,
    lot_number: plain.lot_number || null,
    quantity_packets: Number(plain.quantity_packets || 1),
    seeds_remaining: Number(plain.seeds_remaining || 0),
    germination_rate_pct: Number(plain.germination_rate_pct || 85),
    purchased_date: plain.purchased_date ? String(plain.purchased_date).slice(0, 10) : null,
    expiry_date: plain.expiry_date ? String(plain.expiry_date).slice(0, 10) : null,
    storage_location: plain.storage_location || null,
    notes: plain.notes || null,
    viability_status: computeViabilityStatus(plain)
  };
}

async function listSeeds(userId, { status = 'ALL', search = '' } = {}) {
  const [packets, catalog] = await Promise.all([
    SeedPacket.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC'], ['id', 'DESC']] }),
    PlantCatalog.findAll({ attributes: ['id', 'common_name', 'scientific_name'] })
  ]);

  const catalogMap = new Map(catalog.map((c) => [Number(c.id), c]));
  const serialized = packets.map((p) => serializePacket(p, catalogMap));

  const cleanStatus = String(status || 'ALL').toUpperCase();
  const cleanSearch = String(search || '').trim().toLowerCase();

  const filtered = serialized.filter((p) => {
    if (cleanStatus !== 'ALL' && p.viability_status !== cleanStatus) return false;
    if (cleanSearch) {
      const hay = `${p.variety_name} ${p.species_name || ''} ${p.brand || ''} ${p.lot_number || ''}`.toLowerCase();
      if (!hay.includes(cleanSearch)) return false;
    }
    return true;
  });

  const summary = {
    total_packets: serialized.length,
    total_seeds_remaining: serialized.reduce((s, p) => s + p.seeds_remaining, 0),
    low_stock_count: serialized.filter((p) => p.viability_status === 'LOW_STOCK').length,
    expiring_or_expired_count: serialized.filter((p) => ['EXPIRING_SOON', 'EXPIRED'].includes(p.viability_status)).length
  };

  return { packets: filtered, summary };
}

async function createSeed(userId, payload = {}) {
  const varietyName = String(payload.variety_name || '').trim();
  if (varietyName.length < 2 || varietyName.length > 140) {
    throw createError(400, 'VALIDATION_ERROR', 'variety_name must be between 2 and 140 characters.');
  }

  let catalogId = null;
  if (payload.plant_catalog_id && payload.plant_catalog_id !== 'NONE') {
    const species = await PlantCatalog.findByPk(payload.plant_catalog_id);
    if (!species) {
      throw createError(404, 'SPECIES_NOT_FOUND', `Plant catalog species ${payload.plant_catalog_id} not found.`);
    }
    catalogId = species.id;
  }

  const created = await SeedPacket.create({
    user_id: userId,
    garden_id: payload.garden_id && payload.garden_id !== 'NONE' ? Number(payload.garden_id) : null,
    plant_catalog_id: catalogId,
    variety_name: varietyName,
    brand: payload.brand ? String(payload.brand).slice(0, 100) : null,
    lot_number: payload.lot_number ? String(payload.lot_number).slice(0, 80) : null,
    quantity_packets: Math.max(1, Number(payload.quantity_packets || 1)),
    seeds_remaining: Math.max(0, Number(payload.seeds_remaining !== undefined ? payload.seeds_remaining : 25)),
    germination_rate_pct: Math.min(100, Math.max(0, Number(payload.germination_rate_pct !== undefined ? payload.germination_rate_pct : 85))),
    purchased_date: payload.purchased_date || null,
    expiry_date: payload.expiry_date || null,
    storage_location: payload.storage_location ? String(payload.storage_location).slice(0, 120) : null,
    notes: payload.notes ? String(payload.notes) : null
  });

  const catalog = await PlantCatalog.findAll({ attributes: ['id', 'common_name', 'scientific_name'] });
  return serializePacket(created, new Map(catalog.map((c) => [Number(c.id), c])));
}

async function updateSeed(userId, seedId, payload = {}) {
  const packet = await SeedPacket.findOne({ where: { id: seedId, user_id: userId } });
  if (!packet) {
    throw createError(404, 'SEED_NOT_FOUND', `Seed packet ${seedId} not found.`);
  }

  const updates = {};
  if (payload.variety_name !== undefined) updates.variety_name = String(payload.variety_name).trim().slice(0, 140);
  if (payload.seeds_remaining !== undefined) updates.seeds_remaining = Math.max(0, Number(payload.seeds_remaining));
  if (payload.germination_rate_pct !== undefined) updates.germination_rate_pct = Math.min(100, Math.max(0, Number(payload.germination_rate_pct)));
  if (payload.expiry_date !== undefined) updates.expiry_date = payload.expiry_date || null;
  if (payload.storage_location !== undefined) updates.storage_location = payload.storage_location || null;
  if (payload.notes !== undefined) updates.notes = payload.notes || null;

  await packet.update(updates);
  const catalog = await PlantCatalog.findAll({ attributes: ['id', 'common_name', 'scientific_name'] });
  return serializePacket(packet, new Map(catalog.map((c) => [Number(c.id), c])));
}

async function deleteSeed(userId, seedId) {
  const packet = await SeedPacket.findOne({ where: { id: seedId, user_id: userId } });
  if (!packet) {
    throw createError(404, 'SEED_NOT_FOUND', `Seed packet ${seedId} not found.`);
  }
  await packet.destroy();
  return { deleted: true, id: Number(seedId) };
}

async function allocateSeedToZone(userId, seedId, { zone_id, quantity = 1, seeds_used = 5, custom_nickname, plant_catalog_id } = {}) {
  const packet = await SeedPacket.findOne({ where: { id: seedId, user_id: userId } });
  if (!packet) {
    throw createError(404, 'SEED_NOT_FOUND', `Seed packet ${seedId} not found.`);
  }

  const zone = zone_id ? await Zone.findByPk(zone_id) : null;
  if (!zone) {
    throw createError(404, 'ZONE_NOT_FOUND', `Zone ${zone_id} not found.`);
  }

  const access = await checkMemberAccess({ id: userId }, zone.garden_id, ['OWNER', 'FAMILY']);
  if (!access.allowed) {
    throw createError(access.statusCode, access.code, access.message);
  }

  const used = Math.max(1, Number(seeds_used || 1));
  if (Number(packet.seeds_remaining) < used) {
    throw createError(400, 'INSUFFICIENT_SEEDS', `Only ${packet.seeds_remaining} seeds left in "${packet.variety_name}".`);
  }

  let catalogId = packet.plant_catalog_id || (plant_catalog_id ? Number(plant_catalog_id) : null);
  if (!catalogId) {
    const firstSpecies = await PlantCatalog.findOne({ order: [['id', 'ASC']] });
    catalogId = firstSpecies ? Number(firstSpecies.id) : null;
  }
  if (!catalogId) {
    throw createError(400, 'SPECIES_REQUIRED', 'Cannot allocate seed packet without an associated plant species.');
  }

  const nextRemaining = Number(packet.seeds_remaining) - used;
  await packet.update({ seeds_remaining: nextRemaining });

  const zonePlant = await ZonePlant.create({
    zone_id: zone.id,
    plant_catalog_id: catalogId,
    custom_nickname: (custom_nickname || packet.variety_name || '').slice(0, 100),
    quantity: Math.max(1, Number(quantity || 1)),
    planted_date: new Date().toISOString().slice(0, 10),
    status: 'SEEDLING',
    health_status: 'HEALTHY',
    notes: `Sown from Seed Vault packet #${packet.id}${packet.lot_number ? ` (Lot ${packet.lot_number})` : ''}`
  });

  const catalog = await PlantCatalog.findAll({ attributes: ['id', 'common_name', 'scientific_name'] });
  return {
    seed_packet: serializePacket(packet, new Map(catalog.map((c) => [Number(c.id), c]))),
    zone_plant: zonePlant
  };
}

module.exports = {
  listSeeds,
  createSeed,
  updateSeed,
  deleteSeed,
  allocateSeedToZone
};
