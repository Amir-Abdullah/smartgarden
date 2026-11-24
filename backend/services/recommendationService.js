const { Garden, Zone, ZonePlant, PlantCatalog } = require('../models');
const { detectHemisphere, shiftMonthsForHemisphere } = require('./calendarService');
const { evaluatePair } = require('./companionService');

function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function scoreSunlight(speciesSun, zoneSun) {
  if (speciesSun === zoneSun) return 35;
  if (
    (speciesSun === 'PART_SHADE' && (zoneSun === 'FULL_SUN' || zoneSun === 'FULL_SHADE')) ||
    (zoneSun === 'PART_SHADE' && (speciesSun === 'FULL_SUN' || speciesSun === 'FULL_SHADE'))
  ) {
    return 20;
  }
  return 5;
}

function isAdjacentMonth(m, monthList) {
  const prev = ((m - 2 + 12) % 12) + 1;
  const next = (m % 12) + 1;
  return monthList.includes(prev) || monthList.includes(next);
}

function scoreSeason(plantingMonths, activeMonth, zone) {
  const isProtected = !zone.is_outdoor || ['GREENHOUSE', 'INDOOR_POTS', 'HYDROPONIC'].includes(zone.zone_type);
  if (plantingMonths.includes(activeMonth)) return 25;
  if (isAdjacentMonth(activeMonth, plantingMonths)) return isProtected ? 22 : 15;
  return isProtected ? 20 : 5;
}

const SOIL_KEYWORDS = {
  LOAM: ['loam', 'well-draining', 'humus', 'rich'],
  SANDY: ['sandy', 'light', 'well-draining', 'fast-draining', 'gritty'],
  CLAY: ['clay', 'moist', 'retentive', 'heavy'],
  SILT: ['silt', 'moist', 'humus', 'fertile'],
  PEAT: ['peat', 'acidic', 'humus', 'moist'],
  CHALKY: ['chalk', 'alkaline', 'well-draining', 'mediterranean']
};

function scoreSoil(soilPrefStr, zoneSoilType, zoneType) {
  if (zoneType === 'HYDROPONIC') {
    return /moist|well-draining|rich|humus/i.test(soilPrefStr || '') ? 15 : 10;
  }
  const pref = String(soilPrefStr || '').toLowerCase();
  const soilKey = String(zoneSoilType || 'LOAM').toUpperCase();
  const keywords = SOIL_KEYWORDS[soilKey] || SOIL_KEYWORDS.LOAM;

  if (pref.includes(soilKey.toLowerCase())) return 15;
  if (keywords.some((kw) => pref.includes(kw))) return soilKey === 'LOAM' ? 14 : 12;
  if (soilKey === 'LOAM') return 12;
  return 7;
}

function parseMonths(val) {
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function getZoneRecommendations(zoneId, options = {}) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found.`);
  }
  const garden = await Garden.findByPk(zone.garden_id);

  const hemisphere = detectHemisphere({
    latitude: garden ? garden.latitude : null,
    region: garden ? garden.location_address : null
  });
  const activeMonth = options.month !== undefined && options.month !== ''
    ? Math.max(1, Math.min(12, Number(options.month)))
    : (new Date().getUTCMonth() + 1);

  const zonePlants = await ZonePlant.findAll({ where: { zone_id: zone.id } });
  const activePlants = zonePlants.filter((zp) => zp.status !== 'HARVESTED' && zp.status !== 'DEAD');

  const catalogWhere = {};
  if (options.category && options.category !== 'ALL') {
    catalogWhere.category = String(options.category).toUpperCase();
  }
  const allCatalog = await PlantCatalog.findAll({ order: [['common_name', 'ASC']] });
  const catMap = new Map(allCatalog.map((c) => [Number(c.id), c.toJSON ? c.toJSON() : { ...c }]));

  const currentSpecies = [];
  let occupiedArea = 0;
  for (const zp of activePlants) {
    const cat = catMap.get(Number(zp.plant_catalog_id));
    if (cat) {
      currentSpecies.push(cat);
      const spacing = Number(cat.spacing_cm || 30);
      const rowSpacing = Number(cat.row_spacing_cm || 45);
      occupiedArea += Number(zp.quantity || 1) * ((spacing * rowSpacing) / 10000);
    }
  }

  const totalArea = Number(zone.area_sq_m || 0);
  const freeArea = Math.max(0, Math.round((totalArea - occupiedArea) * 100) / 100);

  const candidates = options.category && options.category !== 'ALL'
    ? allCatalog.filter((c) => c.category === catalogWhere.category)
    : allCatalog;

  const scored = candidates.map((row) => {
    const species = row.toJSON ? row.toJSON() : { ...row };
    const adjustedSow = shiftMonthsForHemisphere(parseMonths(species.planting_months), hemisphere);
    const footprint = (Number(species.spacing_cm || 30) * Number(species.row_spacing_cm || 45)) / 10000;
    const maxQty = totalArea > 0 && footprint > 0 ? Math.max(0, Math.floor(freeArea / footprint)) : 0;

    const sunlightScore = scoreSunlight(species.sunlight_req, zone.sunlight_level);
    const seasonScore = scoreSeason(adjustedSow, activeMonth, zone);
    const soilScore = scoreSoil(species.soil_pref, zone.soil_type, zone.zone_type);
    const spaceScore = maxQty >= 1 ? 15 : (totalArea > 0 && (occupiedArea + footprint) <= totalArea * 1.1 ? 8 : 2);

    let synCount = 0;
    let confCount = 0;
    const synergies_with_zone = [];
    const conflicts_with_zone = [];
    for (const cur of currentSpecies) {
      if (Number(cur.id) === Number(species.id)) continue;
      const pair = evaluatePair(cur, species);
      if (pair.relation === 'SYNERGY') {
        synCount++;
        synergies_with_zone.push(cur.common_name);
      } else if (pair.relation === 'CONFLICT') {
        confCount++;
        conflicts_with_zone.push(cur.common_name);
      }
    }
    const companionScore = Math.max(0, Math.min(10, 5 + (3 * synCount) - (5 * confCount)));
    const totalScore = sunlightScore + seasonScore + soilScore + spaceScore + companionScore;

    const reasons = [];
    if (sunlightScore >= 35) reasons.push(`Exact ${zone.sunlight_level} match`);
    else if (sunlightScore >= 20) reasons.push(`Adaptable to ${zone.sunlight_level}`);
    if (seasonScore >= 25) reasons.push('Optimal planting month');
    else if (seasonScore >= 20 && !zone.is_outdoor) reasons.push('Protected indoor/greenhouse growing');
    if (synergies_with_zone.length > 0) reasons.push(`Synergizes with ${synergies_with_zone.join(', ')}`);
    if (conflicts_with_zone.length > 0) reasons.push(`Conflict warning with ${conflicts_with_zone.join(', ')}`);
    if (maxQty >= 1) reasons.push(`Fits up to ${maxQty} plants in ${freeArea.toFixed(2)} m² free space`);
    else reasons.push('Limited remaining bed area');

    return {
      plant_catalog_id: species.id,
      common_name: species.common_name,
      scientific_name: species.scientific_name,
      category: species.category,
      sunlight_req: species.sunlight_req,
      soil_pref: species.soil_pref,
      spacing_cm: Number(species.spacing_cm || 30),
      row_spacing_cm: Number(species.row_spacing_cm || 45),
      footprint_sq_m: Math.round(footprint * 1000) / 1000,
      max_recommended_quantity: maxQty,
      already_in_zone: currentSpecies.some((c) => Number(c.id) === Number(species.id)),
      total_score: totalScore,
      breakdown: {
        sunlight: sunlightScore,
        season: seasonScore,
        soil: soilScore,
        space: spaceScore,
        companions: companionScore
      },
      synergies_with_zone,
      conflicts_with_zone,
      rationale: reasons.join(' · ')
    };
  });

  scored.sort((a, b) => b.total_score - a.total_score || a.common_name.localeCompare(b.common_name));

  const limit = options.limit ? Math.max(1, Math.min(50, Number(options.limit))) : 15;

  return {
    zone: {
      id: zone.id,
      garden_id: zone.garden_id,
      name: zone.name,
      zone_type: zone.zone_type,
      soil_type: zone.soil_type,
      sunlight_level: zone.sunlight_level,
      is_outdoor: Boolean(zone.is_outdoor),
      total_area_sq_m: totalArea,
      occupied_area_sq_m: Math.round(occupiedArea * 100) / 100,
      free_area_sq_m: freeArea
    },
    hemisphere,
    active_month: activeMonth,
    recommendations: scored.slice(0, limit)
  };
}

module.exports = {
  getZoneRecommendations
};
