const { Zone, ZonePlant, PlantCatalog, Garden } = require('../models');

const ALIAS_GROUPS = {
  brassicas: ['cabbage', 'broccoli', 'kale', 'cauliflower', 'brussels sprouts', 'kohlrabi'],
  alliums: ['onion', 'garlic', 'chives', 'leek', 'shallot'],
  'aromatic herbs': ['sage', 'rosemary', 'thyme', 'mint', 'lavender', 'oregano'],
  tomato: ['tomato', 'roma tomato', 'cherry tomato'],
  basil: ['basil', 'sweet basil'],
  marigold: ['marigold', 'french marigold'],
  pepper: ['bell pepper', 'chili pepper', 'jalapeno', 'pepper'],
  beans: ['green bean', 'beans', 'bush bean', 'pole bean', 'pea', 'peas']
};

function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function parseJsonList(val) {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Matches whether a catalog companion token (e.g. 'Tomato', 'Brassicas', 'Aromatic Herbs')
 * refers to targetCommonName (e.g. 'Roma Tomato', 'Cabbage', 'Rosemary').
 */
function tokenMatchesPlant(token, targetCommonName) {
  const t = normalizeName(token);
  const target = normalizeName(targetCommonName);
  if (!t || !target) return false;
  if (t === target) return true;
  if (target.includes(t) || t.includes(target)) return true;

  const groupMembers = ALIAS_GROUPS[t];
  if (groupMembers && groupMembers.some((m) => target === m || target.includes(m))) {
    return true;
  }

  for (const members of Object.values(ALIAS_GROUPS)) {
    if (members.includes(t) && members.some((m) => target === m || target.includes(m))) {
      return true;
    }
  }

  return false;
}

function evaluatePair(catA, catB) {
  const nameA = catA.common_name;
  const nameB = catB.common_name;

  const goodA = parseJsonList(catA.good_companions);
  const goodB = parseJsonList(catB.good_companions);
  const badA = parseJsonList(catA.bad_companions);
  const badB = parseJsonList(catB.bad_companions);

  const conflictAB = badA.some((tok) => tokenMatchesPlant(tok, nameB));
  const conflictBA = badB.some((tok) => tokenMatchesPlant(tok, nameA));
  if (conflictAB || conflictBA) {
    return {
      relation: 'CONFLICT',
      scoreDelta: -25,
      note: `${nameA} and ${nameB} exhibit antagonistic growth, allelopathy, or shared pest risk.`,
      recommendation: `Separate ${nameA} and ${nameB} into distinct beds or buffer with neutral herbs.`
    };
  }

  const synergyAB = goodA.some((tok) => tokenMatchesPlant(tok, nameB));
  const synergyBA = goodB.some((tok) => tokenMatchesPlant(tok, nameA));
  if (synergyAB || synergyBA) {
    return {
      relation: 'SYNERGY',
      scoreDelta: 10,
      note: `${nameA} and ${nameB} form a beneficial companion guild (pest masking & vigor).`
    };
  }

  return {
    relation: 'NEUTRAL',
    scoreDelta: 0,
    note: `${nameA} and ${nameB} coexist neutrally without known allelopathic conflict.`
  };
}

function analyzeSpeciesList(speciesList) {
  const synergies = [];
  const conflicts = [];
  const seenPairs = new Set();

  for (let i = 0; i < speciesList.length; i++) {
    for (let j = i + 1; j < speciesList.length; j++) {
      const a = speciesList[i];
      const b = speciesList[j];
      if (Number(a.id) === Number(b.id)) continue;
      const pairKey = [Number(a.id), Number(b.id)].sort((x, y) => x - y).join('-');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const res = evaluatePair(a, b);
      if (res.relation === 'SYNERGY') {
        synergies.push({ plantA: a.common_name, plantB: b.common_name, reason: res.note });
      } else if (res.relation === 'CONFLICT') {
        conflicts.push({
          plantA: a.common_name,
          plantB: b.common_name,
          reason: res.note,
          recommendation: res.recommendation
        });
      }
    }
  }

  // Deduplicate species for square N x N matrix display
  const uniqueSpecies = [];
  const seenIds = new Set();
  for (const s of speciesList) {
    if (!seenIds.has(Number(s.id))) {
      seenIds.add(Number(s.id));
      uniqueSpecies.push(s);
    }
  }

  const matrix = uniqueSpecies.map((rowPlant) => ({
    plant_id: rowPlant.id,
    common_name: rowPlant.common_name,
    is_candidate: Boolean(rowPlant._isCandidate),
    cells: uniqueSpecies.map((colPlant) => {
      if (Number(rowPlant.id) === Number(colPlant.id)) {
        return {
          target_id: colPlant.id,
          target_name: colPlant.common_name,
          relation: 'SELF',
          scoreDelta: 0,
          note: 'Same species'
        };
      }
      const res = evaluatePair(rowPlant, colPlant);
      return {
        target_id: colPlant.id,
        target_name: colPlant.common_name,
        relation: res.relation,
        scoreDelta: res.scoreDelta,
        note: res.note
      };
    })
  }));

  const rawScore = 70 + (10 * synergies.length) - (25 * conflicts.length);
  const overall_score = Math.max(0, Math.min(100, rawScore));
  const guild_status = overall_score >= 90
    ? 'OPTIMAL_GUILD'
    : (overall_score >= 65 ? 'BALANCED' : 'CONFLICT_DETECTED');

  return {
    overall_score,
    guild_status,
    synergies,
    conflicts,
    species: uniqueSpecies.map((s) => ({
      id: s.id,
      common_name: s.common_name,
      category: s.category,
      is_candidate: Boolean(s._isCandidate)
    })),
    matrix
  };
}

async function getZoneCompanionAnalysis(zoneId, candidateCatalogIds = []) {
  const zone = await Zone.findByPk(zoneId);
  if (!zone) {
    throw createHttpError(404, 'ZONE_NOT_FOUND', `Zone ${zoneId} not found.`);
  }
  const garden = await Garden.findByPk(zone.garden_id);

  const zonePlants = await ZonePlant.findAll({ where: { zone_id: zone.id }, order: [['id', 'ASC']] });
  const activePlants = zonePlants.filter((zp) => zp.status !== 'HARVESTED' && zp.status !== 'DEAD');

  const allCatalog = await PlantCatalog.findAll({ order: [['common_name', 'ASC']] });
  const catMap = new Map(allCatalog.map((c) => [Number(c.id), c.toJSON ? c.toJSON() : { ...c }]));

  const currentSpecies = [];
  const currentIds = new Set();
  for (const zp of activePlants) {
    const cat = catMap.get(Number(zp.plant_catalog_id));
    if (cat && !currentIds.has(Number(cat.id))) {
      currentIds.add(Number(cat.id));
      currentSpecies.push({ ...cat, _isCandidate: false });
    }
  }

  const baseline = analyzeSpeciesList(currentSpecies);

  const normalizedCandidates = (Array.isArray(candidateCatalogIds) ? candidateCatalogIds : [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0 && !currentIds.has(id));

  let simulated = null;
  if (normalizedCandidates.length > 0) {
    const combinedSpecies = [...currentSpecies];
    for (const cid of normalizedCandidates) {
      const cat = catMap.get(cid);
      if (cat) combinedSpecies.push({ ...cat, _isCandidate: true });
    }
    simulated = analyzeSpeciesList(combinedSpecies);
  }

  // Recommend top catalog species that add synergies with 0 conflicts against current zone plants
  const recommended_companions = [];
  for (const cat of allCatalog) {
    const rawCat = cat.toJSON ? cat.toJSON() : { ...cat };
    if (currentIds.has(Number(rawCat.id))) continue;

    let synCount = 0;
    let confCount = 0;
    const matchedWith = [];
    for (const cur of currentSpecies) {
      const pair = evaluatePair(cur, rawCat);
      if (pair.relation === 'SYNERGY') {
        synCount++;
        matchedWith.push(cur.common_name);
      } else if (pair.relation === 'CONFLICT') {
        confCount++;
      }
    }
    if (synCount > 0 && confCount === 0) {
      recommended_companions.push({
        id: rawCat.id,
        common_name: rawCat.common_name,
        category: rawCat.category,
        synergy_count: synCount,
        helps_crops: matchedWith,
        sunlight_req: rawCat.sunlight_req
      });
    }
  }
  recommended_companions.sort((a, b) => b.synergy_count - a.synergy_count);

  return {
    zone: {
      id: zone.id,
      garden_id: zone.garden_id,
      garden_name: garden ? garden.name : '',
      name: zone.name,
      sunlight_level: zone.sunlight_level,
      soil_type: zone.soil_type
    },
    ...(simulated || baseline),
    baseline_score: baseline.overall_score,
    simulated_delta: simulated ? (simulated.overall_score - baseline.overall_score) : 0,
    recommended_companions: recommended_companions.slice(0, 8)
  };
}

module.exports = {
  tokenMatchesPlant,
  evaluatePair,
  analyzeSpeciesList,
  getZoneCompanionAnalysis
};
