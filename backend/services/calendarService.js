const { PlantCatalog, Garden, Zone, ZonePlant, CareTask } = require('../models');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseMonthArray(val) {
  if (Array.isArray(val)) return val.map(Number).filter((m) => m >= 1 && m <= 12);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(Number).filter((m) => m >= 1 && m <= 12) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function detectHemisphere({ latitude, region, hemisphere }) {
  if (hemisphere) {
    return String(hemisphere).toUpperCase().startsWith('S') ? 'SOUTHERN' : 'NORTHERN';
  }
  if (latitude !== undefined && latitude !== null && latitude !== '' && Number.isFinite(Number(latitude))) {
    return Number(latitude) < 0 ? 'SOUTHERN' : 'NORTHERN';
  }
  if (region && typeof region === 'string') {
    const r = region.trim().toUpperCase();
    if (/^(AU|NZ|ZA|AR|CL|BR|UY|SOUTHERN|SH\b|SOUTH[-_]AMERICA|OCEANIA)/.test(r)) {
      return 'SOUTHERN';
    }
  }
  return 'NORTHERN';
}

function shiftMonthsForHemisphere(months, hemisphere) {
  if (hemisphere !== 'SOUTHERN') {
    return [...new Set(months)].sort((a, b) => a - b);
  }
  const shifted = months.map((m) => ((Number(m) - 1 + 6) % 12) + 1);
  return [...new Set(shifted)].sort((a, b) => a - b);
}

function computeIndoorStartMonths(directSowMonths, species) {
  if (!directSowMonths.length) return [];
  const needsWarmStart = Number(species.ideal_temp_min || 10) >= 15 ||
    ['VEGETABLE', 'FRUIT'].includes(String(species.category || '').toUpperCase());
  if (!needsWarmStart) return [];

  const firstSow = directSowMonths[0];
  const prevMonth = ((firstSow - 2 + 12) % 12) + 1;
  return directSowMonths.includes(prevMonth) ? [] : [prevMonth];
}

async function getSeasonalCalendar(options = {}) {
  let region = options.region || 'Temperate Northern';
  let latitude = options.latitude !== undefined && options.latitude !== '' ? Number(options.latitude) : null;
  let garden = null;
  let activeZonePlantings = [];

  if (options.gardenId) {
    garden = await Garden.findByPk(options.gardenId);
    if (garden) {
      if (garden.latitude !== null && garden.latitude !== undefined) {
        latitude = Number(garden.latitude);
      }
      if (garden.location_address) {
        region = garden.location_address;
      }
      const zones = await Zone.findAll({ where: { garden_id: garden.id }, order: [['id', 'ASC']] });
      const zoneMap = new Map(zones.map((z) => [z.id, z]));
      const catalogList = await PlantCatalog.findAll();
      const catMap = new Map(catalogList.map((c) => [c.id, c]));
      for (const z of zones) {
        const zps = await ZonePlant.findAll({ where: { zone_id: z.id } });
        for (const zp of zps) {
          if (zp.status === 'HARVESTED' || zp.status === 'DEAD') continue;
          const cat = catMap.get(zp.plant_catalog_id);
          activeZonePlantings.push({
            zone_plant_id: zp.id,
            zone_id: z.id,
            zone_name: zoneMap.get(z.id)?.name || '',
            common_name: cat ? cat.common_name : zp.custom_nickname,
            custom_nickname: zp.custom_nickname,
            status: zp.status,
            planted_date: zp.planted_date,
            expected_harvest_date: zp.expected_harvest_date
          });
        }
      }
    }
  }

  const hemisphere = detectHemisphere({
    latitude,
    region,
    hemisphere: options.hemisphere
  });

  const activeMonth = options.month !== undefined && options.month !== ''
    ? Math.max(1, Math.min(12, Number(options.month)))
    : (new Date().getUTCMonth() + 1);

  const where = {};
  if (options.category && options.category !== 'ALL') {
    where.category = String(options.category).toUpperCase();
  }

  const allSpecies = await PlantCatalog.findAll({
    where,
    order: [['common_name', 'ASC']]
  });

  const matrix = allSpecies.map((row) => {
    const raw = row.toJSON ? row.toJSON() : { ...row };
    const baseSow = parseMonthArray(raw.planting_months);
    const baseHarvest = parseMonthArray(raw.harvest_months);
    const directSowMonths = shiftMonthsForHemisphere(baseSow, hemisphere);
    const harvestMonths = shiftMonthsForHemisphere(baseHarvest, hemisphere);
    const indoorSowMonths = computeIndoorStartMonths(directSowMonths, raw);

    return {
      id: raw.id,
      common_name: raw.common_name,
      scientific_name: raw.scientific_name,
      category: raw.category,
      sunlight_req: raw.sunlight_req,
      watering_freq_days: Number(raw.watering_freq_days || 3),
      indoor_sow_months: indoorSowMonths,
      direct_sow_months: directSowMonths,
      harvest_months: harvestMonths
    };
  });

  const current_month_plan = {
    month: activeMonth,
    month_label: MONTH_NAMES[activeMonth - 1],
    indoor_sow: matrix.filter((s) => s.indoor_sow_months.includes(activeMonth)),
    direct_sow: matrix.filter((s) => s.direct_sow_months.includes(activeMonth)),
    harvest_ready: matrix.filter((s) => s.harvest_months.includes(activeMonth))
  };

  return {
    hemisphere,
    region,
    latitude,
    active_month: activeMonth,
    active_month_label: MONTH_NAMES[activeMonth - 1],
    month_labels: MONTH_NAMES,
    current_month_plan,
    matrix,
    active_zone_plantings: activeZonePlantings
  };
}

function formatIcsDate(isoDateStr) {
  return String(isoDateStr).slice(0, 10).replace(/-/g, '');
}

function escapeIcsText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

async function generateIcsExport(options = {}) {
  const calendar = await getSeasonalCalendar(options);
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const year = new Date().getUTCFullYear();
  const monthStr = String(calendar.active_month).padStart(2, '0');
  const defaultEventDate = `${year}${monthStr}01`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartGarden//Seasonal Planting Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`SmartGarden Calendar (${calendar.hemisphere})`)}`
  ];

  const emitEvent = ({ uid, dtstart, summary, description }) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}@smartgarden.app`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (description) {
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    lines.push('END:VEVENT');
  };

  // Emit sowing & harvest events for active month
  for (const s of calendar.current_month_plan.direct_sow.slice(0, 15)) {
    emitEvent({
      uid: `sow-${s.id}-${year}-${monthStr}`,
      dtstart: defaultEventDate,
      summary: `Sow ${s.common_name} (${s.category})`,
      description: `Ideal sunlight: ${s.sunlight_req}. Hemisphere: ${calendar.hemisphere}.`
    });
  }
  for (const s of calendar.current_month_plan.indoor_sow.slice(0, 10)) {
    emitEvent({
      uid: `indoor-${s.id}-${year}-${monthStr}`,
      dtstart: defaultEventDate,
      summary: `Start Indoors: ${s.common_name}`,
      description: `Start seeds indoors 4 weeks ahead of outdoor transplant.`
    });
  }

  // Emit garden harvest dates & upcoming care tasks if gardenId supplied
  for (const p of calendar.active_zone_plantings) {
    if (p.expected_harvest_date) {
      emitEvent({
        uid: `harvest-zp-${p.zone_plant_id}`,
        dtstart: formatIcsDate(p.expected_harvest_date),
        summary: `Expected Harvest: ${p.custom_nickname || p.common_name} (${p.zone_name})`,
        description: `Status: ${p.status}`
      });
    }
  }

  if (options.gardenId) {
    const zones = await Zone.findAll({ where: { garden_id: Number(options.gardenId) } });
    for (const z of zones) {
      const tasks = await CareTask.findAll({
        where: { zone_id: z.id, is_completed: false },
        limit: 20
      });
      for (const t of tasks) {
        emitEvent({
          uid: `task-${t.id}`,
          dtstart: formatIcsDate(t.due_date),
          summary: `[${t.task_type}] ${z.name}`,
          description: t.notes || `Scheduled ${t.task_type} care task.`
        });
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = {
  detectHemisphere,
  shiftMonthsForHemisphere,
  getSeasonalCalendar,
  generateIcsExport
};
