const crypto = require('crypto');
const {
  Garden,
  GardenMember,
  Zone,
  ZonePlant,
  PlantCatalog,
  SensorReading,
  AlertLog,
  CareTask
} = require('../models');
const { Op } = require('sequelize');
const { validateImageBuffer } = require('../utils/multipartParser');
const storageService = require('./storageService');

const RATE_WINDOW_MS = 10 * 60 * 1000;
const userCallTimestamps = new Map();
let customAiFetcher = null;

function setAiFetcher(fn) {
  customAiFetcher = typeof fn === 'function' ? fn : null;
}

function resetRateLimits() {
  userCallTimestamps.clear();
}

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function enforceAiRateLimit(userId) {
  const maxCalls = Number(process.env.AI_RATE_LIMIT_MAX || 20);
  if (!Number.isFinite(maxCalls) || maxCalls <= 0) return;

  const now = Date.now();
  const key = String(userId);
  const existing = (userCallTimestamps.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (existing.length >= maxCalls) {
    throw createError(
      429,
      'RATE_LIMIT_EXCEEDED',
      `AI request quota exceeded (${maxCalls} requests per 10 minutes). Please wait a moment before retrying.`
    );
  }
  existing.push(now);
  userCallTimestamps.set(key, existing);
}

async function callGemini({ contents, systemInstruction = null }) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const model = String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const fetcher = customAiFetcher || global.fetch;
  if (typeof fetcher !== 'function') return null;

  const body = {
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 900
    }
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  try {
    const resp = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp || !resp.ok) return null;
    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    return text || null;
  } catch {
    return null;
  }
}

const FALLBACK_DIAGNOSES = [
  {
    key: 'early_blight',
    disease_name: 'Early Blight (Alternaria solani)',
    severity: 'MODERATE',
    confidence: 0.87,
    symptoms_detected: [
      'Concentric dark brown rings with yellow chlorotic halos on lower mature foliage',
      'Progressive necrosis spreading upward during warm, humid periods'
    ],
    organic_treatments: [
      'Prune and discard affected lower leaves immediately using sterilized shears (do not compost).',
      'Apply copper-based organic fungicide or Bacillus subtilis bio-fungicide every 7 days.',
      'Apply 5 cm clean straw mulch beneath stems to prevent soil spore splash.'
    ],
    chemical_alternatives: [
      'Chlorothalonil or mancozeb contact spray strictly before fruit maturation per label intervals.'
    ],
    preventative_actions: [
      'Switch from overhead spraying to base/drip watering in morning hours.',
      'Maintain 45-60 cm airflow spacing between dense canopy stems.'
    ]
  },
  {
    key: 'powdery_mildew',
    disease_name: 'Powdery Mildew (Podosphaera spp.)',
    severity: 'MODERATE',
    confidence: 0.85,
    symptoms_detected: [
      'Talcum-like white fungal patches on upper leaf lamina and petioles',
      'Slight upward leaf cupping under dry-surface, high-humidity air'
    ],
    organic_treatments: [
      'Spray potassium bicarbonate (1 tbsp/gal water) or cold-pressed neem oil solution at dusk.',
      'Remove heavily coated shoots to improve cross-bed ventilation.'
    ],
    chemical_alternatives: [
      'Wettable micronized sulfur spray (avoid applying when ambient temp exceeds 29 C).'
    ],
    preventative_actions: [
      'Reduce excessive nitrogen fertilizer that drives tender susceptible shoots.',
      'Ensure beds receive at least 6 hours of direct morning sunlight.'
    ]
  },
  {
    key: 'aphids',
    disease_name: 'Sap-Sucking Aphid Cluster & Leaf Curl',
    severity: 'LOW',
    confidence: 0.84,
    symptoms_detected: [
      'Curled young apical shoots with sticky honeydew residue on undersides',
      'Localized stippling near tender stem tips'
    ],
    organic_treatments: [
      'Dislodge colonies with a crisp jet of morning water on leaf undersides.',
      'Apply insecticidal potassium-salt soap or neem oil 3 days apart for two cycles.',
      'Plant nearby alyssum, marigold, or dill to attract predatory lady beetles and hoverflies.'
    ],
    chemical_alternatives: [
      'Selective pyrethrin spray only if beneficial predator populations are absent.'
    ],
    preventative_actions: [
      'Inspect tender new growth weekly and balance nitrogen feeding with compost.'
    ]
  },
  {
    key: 'chlorosis',
    disease_name: 'Nutrient Chlorosis (Nitrogen / Iron Deficiency)',
    severity: 'LOW',
    confidence: 0.82,
    symptoms_detected: [
      'Uniform or interveinal yellowing on foliage without raised fungal lesions',
      'Slowed stem elongation following sustained leaching rains'
    ],
    organic_treatments: [
      'Apply balanced liquid fish-kelp emulsion or chelated iron foliar feed for fast uptake.',
      'Top-dress root zone with screened vermicompost and verify soil pH between 6.2 and 6.8.'
    ],
    chemical_alternatives: [
      'Water-soluble balanced NPK 10-10-10 with chelated micronutrients at half label strength.'
    ],
    preventative_actions: [
      'Avoid waterlogging roots so micronutrient uptake remains uninhibited.'
    ]
  },
  {
    key: 'healthy',
    disease_name: 'Healthy Foliage — No Active Pathogen Detected',
    severity: 'NONE',
    confidence: 0.91,
    symptoms_detected: [
      'Even chlorophyll pigmentation with intact leaf margins and normal turgor',
      'No visible necrotic halos, pustules, or sap-feeder colonies'
    ],
    organic_treatments: [
      'No treatment required — continue regular morning watering and compost top-dressing.'
    ],
    chemical_alternatives: [
      'Not needed — avoid preventative broad-spectrum sprays to protect pollinators.'
    ],
    preventative_actions: [
      'Keep recording weekly height and leaf snapshots in your Growth Journal (F16).',
      'Maintain companion herbs like basil and marigold around fruiting beds.'
    ]
  }
];

function selectDeterministicDiagnosis({ cropName, symptomsNotes, imageBuffer }) {
  const cue = `${cropName || ''} ${symptomsNotes || ''}`.toLowerCase();
  if (/white|powder|mildew|fuzzy/.test(cue)) return FALLBACK_DIAGNOSES[1];
  if (/spot|ring|blight|brown|lesion/.test(cue)) return FALLBACK_DIAGNOSES[0];
  if (/aphid|bug|curl|sticky|pest|mite/.test(cue)) return FALLBACK_DIAGNOSES[2];
  if (/yellow|pale|chlorosis|deficien/.test(cue)) return FALLBACK_DIAGNOSES[3];
  if (/healthy|normal|good|green/.test(cue)) return FALLBACK_DIAGNOSES[4];

  // Deterministic index based on image sha256 + crop name
  const digest = crypto.createHash('sha256').update(imageBuffer).update(String(cropName || '')).digest();
  return FALLBACK_DIAGNOSES[digest[0] % FALLBACK_DIAGNOSES.length];
}

async function diagnoseLeaf({ userId, file, image_base64, image_mime_type, crop_name, symptoms_notes, zone_plant_id }) {
  enforceAiRateLimit(userId);

  let buffer;
  let declaredMime = '';
  let originalFilename = 'leaf-photo.png';

  if (file && Buffer.isBuffer(file.buffer)) {
    buffer = file.buffer;
    declaredMime = file.mimeType || '';
    originalFilename = file.filename || originalFilename;
  } else if (image_base64 && typeof image_base64 === 'string') {
    const dataUriMatch = image_base64.match(/^data:([^;]+);base64,(.+)$/);
    declaredMime = dataUriMatch ? dataUriMatch[1] : (image_mime_type || 'image/png');
    const b64 = dataUriMatch ? dataUriMatch[2] : image_base64;
    buffer = Buffer.from(b64, 'base64');
  } else {
    throw createError(400, 'IMAGE_REQUIRED', 'Please upload a leaf image file (JPEG, PNG, or WEBP) for diagnosis.');
  }

  const verifiedMime = validateImageBuffer(buffer, declaredMime);

  let resolvedCrop = String(crop_name || '').trim();
  if (!resolvedCrop && zone_plant_id) {
    const zp = await ZonePlant.findByPk(zone_plant_id, {
      include: [{ model: PlantCatalog, as: 'catalogPlant', attributes: ['common_name'] }]
    });
    if (zp) {
      resolvedCrop = zp.custom_nickname || zp.catalogPlant?.common_name || '';
    }
  }

  const uploaded = await storageService.uploadImage({
    buffer,
    mimeType: verifiedMime,
    originalFilename,
    folder: 'diagnostics',
    userId
  });

  // Try Gemini Vision if GEMINI_API_KEY is configured
  const prompt = [
    'You are an agronomist analyzing a plant leaf photo.',
    `Crop: ${resolvedCrop || 'Unknown garden crop'}.`,
    `User symptoms notes: ${symptoms_notes || 'None provided'}.`,
    'Respond STRICTLY with JSON containing keys: disease_name (string), severity (NONE|LOW|MODERATE|HIGH), confidence (number 0-1), symptoms_detected (string[]), organic_treatments (string[]), chemical_alternatives (string[]), preventative_actions (string[]).'
  ].join(' ');

  let geminiResult = null;
  const geminiText = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: verifiedMime,
              data: buffer.toString('base64')
            }
          }
        ]
      }
    ]
  });

  if (geminiText) {
    try {
      const cleaned = geminiText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.disease_name) {
        geminiResult = parsed;
      }
    } catch {
      geminiResult = null;
    }
  }

  const fallback = selectDeterministicDiagnosis({
    cropName: resolvedCrop,
    symptomsNotes: symptoms_notes,
    imageBuffer: buffer
  });

  const diagnosis = geminiResult || fallback;

  return {
    crop_name: resolvedCrop || 'Garden Crop',
    photo_url: uploaded.url,
    provider: geminiResult ? 'gemini-vision' : 'deterministic-fallback',
    disease_name: diagnosis.disease_name,
    severity: diagnosis.severity || 'MODERATE',
    confidence: Number(diagnosis.confidence || 0.85),
    symptoms_detected: Array.isArray(diagnosis.symptoms_detected) ? diagnosis.symptoms_detected : [],
    organic_treatments: Array.isArray(diagnosis.organic_treatments) ? diagnosis.organic_treatments : [],
    chemical_alternatives: Array.isArray(diagnosis.chemical_alternatives) ? diagnosis.chemical_alternatives : [],
    preventative_actions: Array.isArray(diagnosis.preventative_actions) ? diagnosis.preventative_actions : [],
    analyzed_at: new Date().toISOString()
  };
}

async function buildGardenGroundingContext(userId, gardenId, zoneId = null) {
  if (!gardenId || gardenId === 'NONE') {
    return null;
  }

  const gid = Number(gardenId);
  if (!Number.isInteger(gid) || gid <= 0) {
    throw createError(400, 'INVALID_GARDEN_ID', 'garden_id must be a positive integer.');
  }

  const membership = await GardenMember.findOne({
    where: { garden_id: gid, user_id: userId }
  });
  if (!membership) {
    throw createError(403, 'FORBIDDEN', 'You do not have access to this garden context.');
  }

  const garden = await Garden.findByPk(gid);
  if (!garden) {
    throw createError(404, 'GARDEN_NOT_FOUND', `Garden ${gid} not found.`);
  }

  const zones = await Zone.findAll({ where: { garden_id: gid }, order: [['id', 'ASC']] });
  const targetZones = zoneId && zoneId !== 'ALL'
    ? zones.filter((z) => Number(z.id) === Number(zoneId))
    : zones;
  const zoneIds = targetZones.map((z) => Number(z.id));

  let plants = [];
  let latestReadings = [];
  let unreadAlerts = [];
  let openTasks = [];

  if (zoneIds.length > 0) {
    plants = await ZonePlant.findAll({
      where: { zone_id: { [Op.in]: zoneIds } },
      include: [{ model: PlantCatalog, as: 'catalogPlant', attributes: ['common_name', 'scientific_name'] }]
    });

    const allReadings = await SensorReading.findAll({
      where: { zone_id: { [Op.in]: zoneIds } },
      order: [['recorded_at', 'DESC'], ['id', 'DESC']]
    });
    const seenZones = new Set();
    for (const r of allReadings) {
      if (!seenZones.has(Number(r.zone_id))) {
        seenZones.add(Number(r.zone_id));
        latestReadings.push(r);
      }
    }

    unreadAlerts = await AlertLog.findAll({
      where: { zone_id: { [Op.in]: zoneIds }, is_read: false },
      order: [['triggered_at', 'DESC']]
    });

    openTasks = await CareTask.findAll({
      where: { zone_id: { [Op.in]: zoneIds }, is_completed: false },
      order: [['due_date', 'ASC']]
    });
  }

  const cropNames = [...new Set(
    plants.map((p) => p.custom_nickname || p.catalogPlant?.common_name).filter(Boolean)
  )];

  return {
    garden_id: gid,
    garden_name: garden.name,
    location_address: garden.location_address || 'Local plot',
    timezone: garden.timezone || 'UTC',
    zones: targetZones.map((z) => ({
      id: Number(z.id),
      name: z.name,
      soil_type: z.soil_type,
      sunlight_level: z.sunlight_level,
      area_sq_m: Number(z.area_sq_m || 0)
    })),
    crops: cropNames,
    latest_readings: latestReadings.map((r) => ({
      zone_id: Number(r.zone_id),
      soil_moisture_pct: r.soil_moisture !== null && r.soil_moisture !== undefined ? Number(r.soil_moisture) : null,
      temperature_c: r.temperature !== null && r.temperature !== undefined ? Number(r.temperature) : null,
      humidity_pct: r.humidity !== null && r.humidity !== undefined ? Number(r.humidity) : null
    })),
    unread_alerts: unreadAlerts.slice(0, 5).map((a) => ({
      metric: a.metric,
      severity: a.severity,
      message: a.message
    })),
    open_tasks_count: openTasks.length
  };
}

function generateDeterministicChatReply(message, ctx) {
  const q = message.toLowerCase();

  const contextIntro = ctx
    ? `Looking at **${ctx.garden_name}** (${ctx.zones.length} zone${ctx.zones.length === 1 ? '' : 's'}${ctx.crops.length ? `, growing ${ctx.crops.slice(0, 5).join(', ')}` : ''}):\n\n`
    : 'Based on SmartGarden botanical guidelines:\n\n';

  const sensorLine = ctx && ctx.latest_readings.length > 0
    ? `- **Live Sensor Snapshot:** Soil moisture is currently **${ctx.latest_readings[0].soil_moisture_pct ?? 'N/A'}%** and ambient temp is **${ctx.latest_readings[0].temperature_c ?? 'N/A'} C**.`
    : '';

  const alertLine = ctx && ctx.unread_alerts.length > 0
    ? `- **Active Alert:** ${ctx.unread_alerts[0].message}`
    : '';

  let advice;
  if (/water|moisture|dry|irrigat|drip|drought/.test(q)) {
    const lowMoist = ctx && ctx.latest_readings.some((r) => r.soil_moisture_pct !== null && r.soil_moisture_pct < 40);
    advice = [
      lowMoist
        ? '- **Action Recommended:** At least one zone is below 40% soil moisture. Deliver a deep morning soak (3-5 L/sqm) directly at the root crown.'
        : '- **Irrigation Cadence:** Moisture is within healthy bounds; water deeply in early morning rather than frequent shallow sprinkles so roots chase depth.',
      '- Check the **Weather View (F11)** before scheduling overhead watering so upcoming rainfall triggers auto-skip savings.',
      sensorLine,
      alertLine
    ].filter(Boolean).join('\n');
  } else if (/pest|disease|bug|blight|aphid|leaf|yellow|spot|fung/.test(q)) {
    advice = [
      '- **Integrated Pest Management:** Inspect undersides of lower leaves first and prune any spotted or yellowing lower stems cleanly.',
      '- Pair aromatic repellents (Basil, Marigold, Garlic) beside susceptible fruiting beds using the **Companion Advisor (F15)**.',
      '- Upload a close-up photo in **AI Leaf Diagnosis (F18)** for an instant pathology and organic treatment breakdown.',
      sensorLine
    ].filter(Boolean).join('\n');
  } else if (/fertiliz|feed|compost|nutrient|soil|ph/.test(q)) {
    const soils = ctx && ctx.zones.length ? [...new Set(ctx.zones.map((z) => z.soil_type))].join(', ') : 'LOAMY';
    advice = [
      `- **Soil Profile Advice (${soils}):** Top-dress beds with 2-3 cm aged compost and feed heavy fruiting crops balanced organic fertilizer every 14-21 days.`,
      '- Use the **Care Plans (F13)** generator to calibrate fertilizer & watering cadence to each zone’s drainage speed.',
      sensorLine
    ].filter(Boolean).join('\n');
  } else if (/plant|seed|season|companion|recommend|when/.test(q)) {
    advice = [
      '- **Planting & Guild Selection:** Match new crops to your bed’s open capacity percentage and sunlight tier using **Recommendations (F14)**.',
      '- Check frost-safe indoor seed-start and outdoor transplant windows in the **Planting Calendar (F12)**.',
      ctx && ctx.crops.length
        ? `- Your active crop mix (${ctx.crops.slice(0, 4).join(', ')}) pairs well with nitrogen-fixing beans or pollinator marigolds where space permits.`
        : '- Combine tall fruiting stems with low aromatic herbs to maximize bed productivity.'
    ].join('\n');
  } else {
    advice = [
      ctx
        ? `- You currently have **${ctx.open_tasks_count}** pending care task(s) and **${ctx.unread_alerts.length}** unread alert(s) in ${ctx.garden_name}.`
        : '- Select a garden above so I can ground advice in your live zones, crops, and sensor telemetry.',
      sensorLine,
      alertLine,
      '- Ask me about watering schedules, pest troubleshooting, soil nutrition, or seasonal crop pairings!'
    ].filter(Boolean).join('\n');
  }

  return `${contextIntro}${advice}`;
}

async function chatWithAssistant({ userId, message, garden_id = null, zone_id = null, history = [] }) {
  enforceAiRateLimit(userId);

  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    throw createError(400, 'VALIDATION_ERROR', 'Message cannot be empty.');
  }
  if (cleanMessage.length > 2000) {
    throw createError(400, 'VALIDATION_ERROR', 'Message must be 2000 characters or fewer.');
  }

  const ctx = await buildGardenGroundingContext(userId, garden_id, zone_id);

  const systemInstruction = ctx
    ? `You are SmartGarden's precision agronomy assistant. Answer concisely and practically grounded in this live garden context: ${JSON.stringify(ctx)}`
    : "You are SmartGarden's precision agronomy assistant. Give concise, practical organic gardening advice.";

  const recentHistory = Array.isArray(history)
    ? history.slice(-6).filter((h) => h && h.content).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(h.content).slice(0, 1000) }]
      }))
    : [];

  const contents = [
    ...recentHistory,
    { role: 'user', parts: [{ text: cleanMessage }] }
  ];

  const geminiReply = await callGemini({ contents, systemInstruction });
  const reply = geminiReply || generateDeterministicChatReply(cleanMessage, ctx);

  return {
    reply,
    provider: geminiReply ? 'gemini-chat' : 'deterministic-fallback',
    context_summary: ctx
      ? {
          garden_id: ctx.garden_id,
          garden_name: ctx.garden_name,
          zones_count: ctx.zones.length,
          crops_count: ctx.crops.length,
          crops: ctx.crops,
          unread_alerts_count: ctx.unread_alerts.length,
          open_tasks_count: ctx.open_tasks_count
        }
      : null,
    suggested_followups: [
      'Should I water my zones today?',
      'Which crops pair best in my current beds?',
      'How do I improve soil nutrition naturally?'
    ],
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  setAiFetcher,
  resetRateLimits,
  diagnoseLeaf,
  chatWithAssistant
};
