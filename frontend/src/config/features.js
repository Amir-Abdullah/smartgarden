/**
 * SmartGarden Feature & Navigation Registry (F1-F24)
 * All 24 features F1-F24 are live across Sprints 1-5.
 */

export const FEATURES = [
  // Live Features (F1 - F5, Sprint 1)
  {
    id: 'F1',
    code: 'F1',
    slug: 'accounts-security',
    title: 'Accounts & Security',
    shortTitle: 'Auth & Security',
    status: 'live',
    sprint: 1,
    section: 'platform',
    icon: 'i-lucide-shield-check',
    to: '/login',
    summary: 'Stateless JWT authentication, bcrypt password hashing, profile management, and tokenized password recovery.'
  },
  {
    id: 'F2',
    code: 'F2',
    slug: 'collaboration-rbac',
    title: 'Collaboration & RBAC',
    shortTitle: 'Team & RBAC',
    status: 'live',
    sprint: 1,
    section: 'platform',
    icon: 'i-lucide-users',
    to: '/dashboard/gardens',
    summary: 'Role-based access control (Owner, Family, Guest) with tokenized email invitations and sole-owner safeguards.'
  },
  {
    id: 'F3',
    code: 'F3',
    slug: 'gardens-zones',
    title: 'Gardens & Microclimate Zones',
    shortTitle: 'Gardens & Zones',
    status: 'live',
    sprint: 1,
    section: 'main',
    icon: 'i-lucide-map-pin',
    to: '/dashboard/gardens',
    summary: 'Multi-plot garden management with coordinates, timezones, bed dimensions, soil types, and sun exposure.'
  },
  {
    id: 'F4',
    code: 'F4',
    slug: 'plant-catalog',
    title: 'Botanical Plant Catalog',
    shortTitle: 'Plant Catalog',
    status: 'live',
    sprint: 1,
    section: 'main',
    icon: 'i-lucide-book-open',
    to: '/catalog',
    summary: 'Searchable reference encyclopedia of 32+ species with moisture/temperature thresholds, spacing footprints, and companion data.'
  },
  {
    id: 'F5',
    code: 'F5',
    slug: 'zone-inventory',
    title: 'Zone Crop Inventory',
    shortTitle: 'Zone Inventory',
    status: 'live',
    sprint: 1,
    section: 'main',
    icon: 'i-lucide-sprout',
    to: '/dashboard/gardens',
    summary: 'Live bed capacity utilization gauges, overcrowding warnings, and automated companion synergy/conflict analysis.'
  },

  // Live Features (F6 - F10, Sprint 2)
  {
    id: 'F6',
    code: 'F6',
    slug: 'care-tasks',
    title: 'Recurring Care Tasks & Watering',
    shortTitle: 'Care Tasks',
    status: 'live',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-check-square',
    to: '/dashboard/care-tasks',
    summary: 'Timezone-aware recurring watering, fertilizing, and pruning task queues with atomic water usage logging.',
    highlights: [
      'Recurring watering & feeding schedules per zone and crop',
      'Team member task assignments & atomic water volume logs',
      'Auto-rescheduling in garden timezone on completion'
    ]
  },
  {
    id: 'F7',
    code: 'F7',
    slug: 'sensors',
    title: 'IoT Sensor Ingestion & Telemetry',
    shortTitle: 'Sensors',
    status: 'live',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-activity',
    to: '/dashboard/sensors',
    summary: 'Real-time soil moisture, ambient temperature, humidity, and light telemetry with SHA-256 device keys and 30d rollups.',
    highlights: [
      'One-time sg_live_ API key provisioning, claim & key rotation',
      'Clock-skew normalized sensor ingestion & bounds validation',
      'Interactive SVG telemetry charts & 30-day daily statistics'
    ]
  },
  {
    id: 'F8',
    code: 'F8',
    slug: 'realtime-dashboard',
    title: 'Real-Time Live WebSocket Dashboard',
    shortTitle: 'Live Dashboard',
    status: 'live',
    sprint: 2,
    section: 'platform',
    icon: 'i-lucide-radio',
    to: '/dashboard',
    summary: 'Live WebSocket telemetry streaming with automatic SSE fallback, exponential backoff, and REST reconciliation.',
    highlights: [
      'Sub-second SENSOR_UPDATE, ALERT_TRIGGERED, and TASK_UPDATED streams',
      'Automatic SSE fallback when WebSockets are unavailable',
      'Idempotent REST state reconciliation on reconnect'
    ]
  },
  {
    id: 'F9',
    code: 'F9',
    slug: 'alerts',
    title: 'Smart Threshold Alerts & Quiet Hours',
    shortTitle: 'Alerts',
    status: 'live',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-bell-ring',
    to: '/dashboard/alerts',
    summary: 'Proactive moisture, temperature, humidity, light, and offline-device alerts with per-zone thresholds and IANA quiet hours.',
    highlights: [
      'Per-zone thresholds backed by botanical catalog defaults',
      'Midnight-crossing IANA quiet hours & cooldown suppression',
      'Severity-ranked alert inbox with live unread bell badge'
    ]
  },
  {
    id: 'F10',
    code: 'F10',
    slug: 'automations',
    title: 'Automation Rule Engine',
    shortTitle: 'Automations',
    status: 'live',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-workflow',
    to: '/dashboard/automations',
    summary: 'Condition-action automation rules with 3-layer deduplication, atomic daily execution caps, and scheduled evaluation.',
    highlights: [
      'Visual IF [metric] [operator] [value] AND [weather] THEN [action] builder',
      'Open-task deduplication and atomic daily execution caps',
      'Instant enable/disable switch and trigger history tracking'
    ]
  },

  // Live Sprint 3 Features (F11 - F15)
  {
    id: 'F11',
    code: 'F11',
    slug: 'weather',
    title: 'Weather-Aware Planning & Spatial Cache',
    shortTitle: 'Weather',
    status: 'live',
    sprint: 3,
    section: 'ops',
    icon: 'i-lucide-cloud-sun',
    to: '/dashboard/weather',
    summary: '7-day microclimate forecasts, spatial grid caching, frost watchdogs, and automatic rain-delay watering skips.',
    highlights: [
      'Coordinate-accurate rainfall & frost forecasts via Open-Meteo',
      '24h rain-skip irrigation adjustments',
      'Weather-aware automation rule evaluation'
    ]
  },
  {
    id: 'F12',
    code: 'F12',
    slug: 'calendar',
    title: 'Seasonal Planting Calendar',
    shortTitle: 'Planting Calendar',
    status: 'live',
    sprint: 3,
    section: 'ops',
    icon: 'i-lucide-calendar-days',
    to: '/dashboard/calendar',
    summary: 'Regional sowing, transplanting, and harvest timelines with hemisphere awareness and RFC 5545 .ics export.',
    highlights: [
      'Indoor seed-start vs direct-sow seasonal windows',
      'Southern Hemisphere +6 month seasonal offset',
      '1-click .ics calendar export'
    ]
  },
  {
    id: 'F13',
    code: 'F13',
    slug: 'care-plan-generator',
    title: 'Personalized Care Plan Generator',
    shortTitle: 'Care Plans',
    status: 'live',
    sprint: 3,
    section: 'insights',
    icon: 'i-lucide-sparkles',
    to: '/dashboard/care-plans',
    summary: 'Calibrates watering and feeding frequencies from each zone’s soil type, sun exposure, and active species.',
    highlights: [
      'Soil drainage & sun multiplier calibration',
      'Preview schedules before creating recurring tasks',
      'Tagged CARE_PLAN task generation'
    ]
  },
  {
    id: 'F14',
    code: 'F14',
    slug: 'plant-recommendations',
    title: 'Plant Recommendation Engine',
    shortTitle: 'Recommendations',
    status: 'live',
    sprint: 3,
    section: 'insights',
    icon: 'i-lucide-compass',
    to: '/dashboard/recommendations',
    summary: '100-point multi-factor scorer ranking catalog species by sunlight, season, soil compatibility, bed area, and companions.',
    highlights: [
      'Explainable 5-factor compatibility breakdown',
      'Spatial fit check against remaining zone area',
      '1-click add recommended crop to zone'
    ]
  },
  {
    id: 'F15',
    code: 'F15',
    slug: 'companion-advisor',
    title: 'Companion Planting Advisor',
    shortTitle: 'Companion Advisor',
    status: 'live',
    sprint: 3,
    section: 'insights',
    icon: 'i-lucide-heart-handshake',
    to: '/dashboard/companions',
    summary: 'Pairwise synergy and conflict matrix with group alias matching and interactive bed compatibility heatmaps.',
    highlights: [
      'Pairwise guild scoring across candidate crops',
      'Botanical family & group alias resolution',
      'Visual compatibility heatmap matrix'
    ]
  },

  // Live Features (F16 - F20, Sprint 4)
  {
    id: 'F16',
    code: 'F16',
    slug: 'journal',
    title: 'Growth Journal & Photo Timeline',
    shortTitle: 'Growth Journal',
    status: 'live',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-notebook-pen',
    to: '/dashboard/journal',
    summary: 'Chronological field notes, plant height tracking, and visual growth photo timelines across seasons.',
    highlights: [
      'Photo timelines tagged to zones and crops',
      'Height progression & before/after comparisons',
      'Searchable field observation logs'
    ]
  },
  {
    id: 'F17',
    code: 'F17',
    slug: 'analytics',
    title: 'Analytics & Data Export',
    shortTitle: 'Analytics',
    status: 'live',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-bar-chart-3',
    to: '/dashboard/analytics',
    summary: 'Daily sensor rollups, water consumption analytics, and formatted PDF/CSV seasonal reports.',
    highlights: [
      'Water usage & moisture stability trendlines',
      'Zone-to-zone performance comparisons',
      'Formatted PDF & CSV data exports'
    ]
  },
  {
    id: 'F18',
    code: 'F18',
    slug: 'ai-diagnosis',
    title: 'AI Leaf Disease & Pest Diagnosis',
    shortTitle: 'AI Diagnosis',
    status: 'live',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-scan-search',
    to: '/dashboard/ai-diagnosis',
    summary: 'Upload leaf or stem photos to identify nutrient deficiencies, fungal blights, and common garden pests.',
    highlights: [
      'Vision-powered symptom classification',
      'Organic & biological treatment guides',
      'Deterministic offline diagnostic fallback'
    ]
  },
  {
    id: 'F19',
    code: 'F19',
    slug: 'ai-assistant',
    title: 'AI Gardening Assistant',
    shortTitle: 'AI Assistant',
    status: 'live',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-bot',
    to: '/dashboard/ai-assistant',
    summary: 'Context-aware gardening copilot that reads your zones, soil types, live sensors, and alerts before answering.',
    highlights: [
      'Zone-aware crop rotation & troubleshooting',
      'Grounded in live inventory and telemetry',
      'Context-aware responses with deterministic fallback'
    ]
  },
  {
    id: 'F20',
    code: 'F20',
    slug: 'community',
    title: 'Community Hub & Social Feed',
    shortTitle: 'Community',
    status: 'live',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-globe',
    to: '/dashboard/community',
    summary: 'Share proven bed tips, local climate notes, threaded discussions, and moderated community posts.',
    highlights: [
      'Grower feed with likes, follows & threaded comments',
      'Regional microclimate knowledge exchange',
      'Built-in community moderation controls'
    ]
  },

  // Live Features (F21 - F24, Sprint 5)
  {
    id: 'F21',
    code: 'F21',
    slug: 'notifications',
    title: 'Multi-Channel Notifications',
    shortTitle: 'Notifications',
    status: 'live',
    sprint: 5,
    section: 'account',
    icon: 'i-lucide-mail',
    to: '/dashboard/settings',
    summary: 'Unified notification inbox with per-garden overrides, email digests, Web Push, and SSRF-guarded webhooks.',
    highlights: [
      'Digest frequency & quiet-hours controls',
      'Web Push & Slack/Discord webhooks',
      'Per-garden notification overrides'
    ]
  },
  {
    id: 'F22',
    code: 'F22',
    slug: 'sustainability',
    title: 'Water & Sustainability Metrics',
    shortTitle: 'Sustainability',
    status: 'live',
    sprint: 5,
    section: 'insights',
    icon: 'i-lucide-droplets',
    to: '/dashboard/sustainability',
    summary: 'Measure rainwater catchment usage, drip irrigation savings, and compost carbon offsets.',
    highlights: [
      'Litres saved vs overhead watering baseline',
      'Rainwater barrel reserve tracking',
      'Seasonal sustainability scorecard'
    ]
  },
  {
    id: 'F23',
    code: 'F23',
    slug: 'seed-inventory',
    title: 'Seed Vault & Germination Logs',
    shortTitle: 'Seed Vault',
    status: 'live',
    sprint: 5,
    section: 'ops',
    icon: 'i-lucide-package',
    to: '/dashboard/seed-vault',
    summary: 'Track seed packet expiry, germination rates, and heirloom provenance linked directly to catalog species.',
    highlights: [
      'Packet lot numbers & viability tracking',
      'Low-stock reorder reminders',
      '1-click allocate from vault to zone'
    ]
  },
  {
    id: 'F24',
    code: 'F24',
    slug: 'api-developer',
    title: 'Public Profiles & Scoped API Keys',
    shortTitle: 'Public & API Keys',
    status: 'live',
    sprint: 5,
    section: 'account',
    icon: 'i-lucide-key-round',
    to: '/dashboard/settings',
    summary: 'Scoped personal access tokens for custom Home Assistant integrations, plus shareable public garden pages.',
    highlights: [
      'Scoped REST & WebSocket API tokens (sg_pat_)',
      'Opt-in public grower profiles & garden showcases',
      'Profile & timezone settings management'
    ]
  }
];

export const PUBLIC_COMING_SOON_PAGES = {
  pricing: {
    id: 'pricing',
    title: 'Pricing & Plans',
    sprint: 3,
    icon: 'i-lucide-credit-card',
    summary: 'SmartGarden is free during Sprint 1 for home gardeners and small teams. Pro sensor quotas and AI agronomy tiers arrive in Sprint 3.',
    highlights: [
      'Free Forever Hobby tier (up to 3 gardens)',
      'Family & Community Co-op shared seats',
      'Pro Telemetry & AI Agronomy add-on'
    ]
  },
  docs: {
    id: 'docs',
    title: 'Documentation & Guides',
    sprint: 2,
    icon: 'i-lucide-file-text',
    summary: 'Interactive API references, ESP32 sensor wiring guides, and companion planting manuals are being compiled.',
    highlights: [
      'REST API & JWT authentication guide',
      'Microclimate zone sizing & spacing formulas',
      'MQTT sensor onboarding walkthrough'
    ]
  },
  blog: {
    id: 'blog',
    title: 'Agronomy Blog',
    sprint: 4,
    icon: 'i-lucide-newspaper',
    summary: 'Deep dives on polyculture guilds, drip automation, and soil biology from the SmartGarden team.',
    highlights: [
      'Companion planting science explained',
      'Designing frost-resilient raised beds',
      'Building low-power LoRa moisture nodes'
    ]
  },
  changelog: {
    id: 'changelog',
    title: 'Release Changelog',
    sprint: 2,
    icon: 'i-lucide-sparkles',
    summary: 'Sprint 1 shipped F1–F5 and Sprint 2 shipped F6–F10 with care tasks, live IoT sensors, WebSockets, smart alerts, and automation rules.',
    highlights: [
      'v1.0: Auth, RBAC, Gardens, Zones, Catalog & Inventory',
      'v2.0: Care Tasks, Sensors, Realtime WS/SSE, Smart Alerts & Rules'
    ]
  },
  help: {
    id: 'help',
    title: 'Help Center',
    sprint: 2,
    icon: 'i-lucide-life-buoy',
    summary: 'Searchable troubleshooting articles and interactive onboarding tutorials are scheduled for Sprint 2.',
    highlights: [
      'Troubleshooting zone capacity warnings',
      'Managing family & guest invitations',
      'Direct support ticket portal'
    ]
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    sprint: 2,
    icon: 'i-lucide-lock',
    summary: 'Your garden coordinates and sensor telemetry remain strictly private to your workspace members.',
    highlights: [
      'Zero third-party telemetry resale',
      'Full JSON/CSV data export anytime',
      'GDPR-aligned account deletion'
    ]
  },
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    sprint: 2,
    icon: 'i-lucide-scale',
    summary: 'Clear, plain-language platform terms covering community sharing, API fair use, and open-source components.',
    highlights: [
      'You retain 100% ownership of garden data',
      'Transparent uptime & API fair-use policy'
    ]
  }
};

export const LIVE_FEATURES = FEATURES.filter((f) => f.status === 'live');
export const SOON_FEATURES = FEATURES.filter((f) => f.status === 'soon');

export function getFeatureById(idOrSlug) {
  if (!idOrSlug) return null;
  const key = String(idOrSlug).toLowerCase();
  return (
    FEATURES.find(
      (f) => f.id.toLowerCase() === key || f.slug.toLowerCase() === key || f.to.toLowerCase() === key
    ) ||
    PUBLIC_COMING_SOON_PAGES[key] ||
    null
  );
}

const SPRINT_LABELS = {
  1: 'Sprint 1 — Live Foundation',
  2: 'Sprint 2 — Live Operations & Telemetry',
  3: 'Sprint 3 — Live Horticultural Intelligence',
  4: 'Sprint 4 — Live Media, Analytics, AI & Community',
  5: 'Sprint 5 — Live Notifications, Sustainability, Seed Vault, 3D & Developer Platform'
};

export function getFeaturesBySprint() {
  const groups = new Map();
  for (const feature of FEATURES) {
    const sprintNum = feature.sprint || 1;
    if (!groups.has(sprintNum)) {
      groups.set(sprintNum, {
        sprint: sprintNum,
        label: '',
        status: 'soon',
        features: []
      });
    }
    groups.get(sprintNum).features.push(feature);
  }
  return Array.from(groups.values())
    .sort((a, b) => a.sprint - b.sprint)
    .map((group) => {
      const allLive = group.features.length > 0 && group.features.every((f) => f.status === 'live');
      return {
        ...group,
        status: allLive ? 'live' : 'soon',
        label: allLive
          ? (SPRINT_LABELS[group.sprint] || `Sprint ${group.sprint} — Live`)
          : `Sprint ${group.sprint} — Planned`
      };
    });
}

export const PUBLIC_NAV_ITEMS = [
  { label: 'Features', to: '/#features', status: 'live' },
  { label: 'Plant Catalog', to: '/catalog', status: 'live' },
  { label: 'About', to: '/about', status: 'live' },
  { label: 'Contact', to: '/contact', status: 'live' },
  { label: 'Pricing', to: '/pricing', status: 'live' }
];

export const DASHBOARD_NAV_SECTIONS = {
  main: [
    { label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/dashboard', status: 'live' },
    { label: 'Gardens', icon: 'i-lucide-trees', to: '/dashboard/gardens', status: 'live' },
    { label: 'Plant Catalog', icon: 'i-lucide-book-open', to: '/dashboard/catalog', status: 'live' }
  ],
  ops: FEATURES.filter((f) => f.section === 'ops').map((f) => ({
    id: f.id,
    label: f.shortTitle,
    icon: f.icon,
    to: f.to,
    status: f.status,
    sprint: f.sprint
  })),
  insights: FEATURES.filter((f) => f.section === 'insights').map((f) => ({
    id: f.id,
    label: f.shortTitle,
    icon: f.icon,
    to: f.to,
    status: f.status,
    sprint: f.sprint
  }))
};

export const FOOTER_COLUMNS = [
  {
    label: 'Product',
    children: [
      { label: 'Features', to: '/#features' },
      { label: 'Plant Catalog', to: '/catalog' },
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Pricing', to: '/pricing' }
    ]
  },
  {
    label: 'Resources',
    children: [
      { label: 'Documentation', to: '/docs' },
      { label: 'Agronomy Blog', to: '/blog' },
      { label: 'Changelog', to: '/changelog' },
      { label: 'Help Center', to: '/help' }
    ]
  },
  {
    label: 'Company',
    children: [
      { label: 'About SmartGarden', to: '/about' },
      { label: 'Roadmap', to: '/about#roadmap' },
      { label: 'Contact Us', to: '/contact' }
    ]
  },
  {
    label: 'Legal',
    children: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' }
    ]
  }
];
