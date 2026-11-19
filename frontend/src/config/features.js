/**
 * SmartGarden Feature & Navigation Registry (F1-F20)
 * F1-F5 are live in Sprint 1; F6-F20 are scheduled across Sprints 2-6.
 */

export const FEATURES = [
  // Live Features (F1 - F5)
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

  // Upcoming Features (F6 - F20)
  {
    id: 'F6',
    code: 'F6',
    slug: 'care-tasks',
    title: 'Care Tasks & Schedules',
    shortTitle: 'Care Tasks',
    status: 'soon',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-check-square',
    to: '/dashboard/care-tasks',
    summary: 'Automated watering, fertilizing, and pruning task queues generated from each zone plant\'s botanical cadence.',
    highlights: [
      'Recurring watering & feeding schedules per species',
      'Team member task assignments & completion logs',
      'Rain-delay snoozing tied to local weather'
    ]
  },
  {
    id: 'F7',
    code: 'F7',
    slug: 'sensors',
    title: 'IoT Soil & Climate Sensors',
    shortTitle: 'Sensors',
    status: 'soon',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-activity',
    to: '/dashboard/sensors',
    summary: 'Real-time soil moisture, ambient temperature, humidity, and PAR light telemetry streamed over WebSockets.',
    highlights: [
      'MQTT & HTTP sensor bridge for ESP32 / LoRaWAN nodes',
      'Live zone telemetry charts and battery diagnostics',
      'Calibration profiles by soil type'
    ]
  },
  {
    id: 'F8',
    code: 'F8',
    slug: 'alerts',
    title: 'Smart Threshold Alerts',
    shortTitle: 'Alerts',
    status: 'soon',
    sprint: 2,
    section: 'ops',
    icon: 'i-lucide-bell-ring',
    to: '/dashboard/alerts',
    summary: 'Proactive frost, drought, and heat-stress alerts triggered when telemetry drifts outside plant catalog ideals.',
    highlights: [
      'Per-species moisture & temperature threshold rules',
      'Frost protection warnings 24 hours ahead',
      'Severity-ranked alert feed with acknowledgement'
    ]
  },
  {
    id: 'F9',
    code: 'F9',
    slug: 'automations',
    title: 'Irrigation & Climate Automations',
    shortTitle: 'Automations',
    status: 'soon',
    sprint: 3,
    section: 'ops',
    icon: 'i-lucide-workflow',
    to: '/dashboard/automations',
    summary: 'Rule-based drip valve, greenhouse vent, and grow-light automations driven by moisture and time windows.',
    highlights: [
      'Visual trigger-condition-action automation builder',
      'Moisture-gated drip irrigation valves',
      'Fail-safe max-runtime guards'
    ]
  },
  {
    id: 'F10',
    code: 'F10',
    slug: 'weather',
    title: 'Hyperlocal Weather & Frost',
    shortTitle: 'Weather',
    status: 'soon',
    sprint: 3,
    section: 'ops',
    icon: 'i-lucide-cloud-sun',
    to: '/dashboard/weather',
    summary: '7-day microclimate forecasts, evapotranspiration estimates, and precipitation tracking per garden coordinate.',
    highlights: [
      'Coordinate-accurate rainfall & UV index forecasts',
      'Growing degree days (GDD) accumulation',
      'Automatic watering skip recommendations'
    ]
  },
  {
    id: 'F11',
    code: 'F11',
    slug: 'calendar',
    title: 'Dynamic Planting Calendar',
    shortTitle: 'Planting Calendar',
    status: 'soon',
    sprint: 3,
    section: 'ops',
    icon: 'i-lucide-calendar-days',
    to: '/dashboard/calendar',
    summary: 'Season-by-season sowing, transplanting, and harvest timelines tailored to your USDA zone and last frost date.',
    highlights: [
      'Indoor seed-start vs direct-sow windows',
      'Succession planting reminders',
      'iCal / Google Calendar feed export'
    ]
  },
  {
    id: 'F12',
    code: 'F12',
    slug: 'journal',
    title: 'Garden Journal & Photos',
    shortTitle: 'Journal',
    status: 'soon',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-notebook-pen',
    to: '/dashboard/journal',
    summary: 'Chronological field notes, germination logs, and visual growth comparisons across seasons.',
    highlights: [
      'Photo timelines tagged to zones and crops',
      'Seasonal comparison & frost date logs',
      'Searchable markdown field observations'
    ]
  },
  {
    id: 'F13',
    code: 'F13',
    slug: 'analytics',
    title: 'Yield & Soil Analytics',
    shortTitle: 'Analytics',
    status: 'soon',
    sprint: 4,
    section: 'insights',
    icon: 'i-lucide-bar-chart-3',
    to: '/dashboard/analytics',
    summary: 'Harvest weight tracking, bed productivity benchmarks, and multi-month moisture stability trends.',
    highlights: [
      'Harvest yield per square meter by crop',
      'Zone-to-zone performance comparisons',
      'CSV / JSON seasonal export'
    ]
  },
  {
    id: 'F14',
    code: 'F14',
    slug: 'ai-diagnosis',
    title: 'AI Pest & Disease Diagnosis',
    shortTitle: 'AI Diagnosis',
    status: 'soon',
    sprint: 5,
    section: 'insights',
    icon: 'i-lucide-scan-search',
    to: '/dashboard/ai-diagnosis',
    summary: 'Upload leaf or stem photos to identify nutrient deficiencies, fungal blights, and common garden pests.',
    highlights: [
      'Computer-vision symptom classification',
      'Organic & biological treatment guides',
      'Quarantine & companion prevention tips'
    ]
  },
  {
    id: 'F15',
    code: 'F15',
    slug: 'ai-assistant',
    title: 'AI Agronomist Assistant',
    shortTitle: 'AI Assistant',
    status: 'soon',
    sprint: 5,
    section: 'insights',
    icon: 'i-lucide-bot',
    to: '/dashboard/ai-assistant',
    summary: 'Context-aware gardening copilot that reads your zones, soil types, and companion layout before answering.',
    highlights: [
      'Zone-aware crop rotation suggestions',
      'Instant troubleshooting using live inventory',
      'Natural-language bed layout planning'
    ]
  },
  {
    id: 'F16',
    code: 'F16',
    slug: 'community',
    title: 'Community Garden Exchange',
    shortTitle: 'Community',
    status: 'soon',
    sprint: 5,
    section: 'insights',
    icon: 'i-lucide-globe',
    to: '/dashboard/community',
    summary: 'Share proven bed templates, local climate notes, and surplus harvest swaps with nearby growers.',
    highlights: [
      'Regional microclimate grower circles',
      'Cloneable zone & companion blueprints',
      'Seed & seedling swap boards'
    ]
  },
  {
    id: 'F17',
    code: 'F17',
    slug: 'notifications',
    title: 'Multi-Channel Notifications',
    shortTitle: 'Notifications',
    status: 'soon',
    sprint: 6,
    section: 'account',
    icon: 'i-lucide-mail',
    to: '/dashboard/settings',
    summary: 'Granular email, web push, and webhook digests for team invitations, frost warnings, and daily care tasks.',
    highlights: [
      'Digest frequency & quiet-hours controls',
      'Web Push & Slack/Discord webhooks',
      'Per-garden notification overrides'
    ]
  },
  {
    id: 'F18',
    code: 'F18',
    slug: 'sustainability',
    title: 'Water & Sustainability Metrics',
    shortTitle: 'Water Tracking',
    status: 'soon',
    sprint: 6,
    section: 'insights',
    icon: 'i-lucide-droplets',
    to: '/dashboard/analytics',
    summary: 'Measure rainwater catchment usage, drip irrigation savings, and compost carbon offsets.',
    highlights: [
      'Litres saved vs overhead watering baseline',
      'Rainwater barrel reserve tracking',
      'Seasonal sustainability scorecard'
    ]
  },
  {
    id: 'F19',
    code: 'F19',
    slug: 'seed-inventory',
    title: 'Seed Vault & Germination Logs',
    shortTitle: 'Seed Vault',
    status: 'soon',
    sprint: 6,
    section: 'ops',
    icon: 'i-lucide-package',
    to: '/dashboard/calendar',
    summary: 'Track seed packet expiry, germination rates, and heirloom provenance linked directly to catalog species.',
    highlights: [
      'Packet lot numbers & viability tracking',
      'Low-stock reorder reminders',
      '1-click allocate from vault to zone'
    ]
  },
  {
    id: 'F20',
    code: 'F20',
    slug: 'api-developer',
    title: 'Public Profiles & API Keys',
    shortTitle: 'API & Billing',
    status: 'soon',
    sprint: 6,
    section: 'account',
    icon: 'i-lucide-key-round',
    to: '/dashboard/settings',
    summary: 'Scoped personal access tokens for custom Home Assistant integrations, plus shareable public garden pages.',
    highlights: [
      'Scoped REST & WebSocket API tokens',
      'Home Assistant & Webhook connectors',
      'Team billing & plan management'
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
    summary: 'Sprint 1 shipped F1–F5 with full Nuxt UI 4 interface, 32-species catalog, and MariaDB/SQLite parity.',
    highlights: [
      'v1.0: Auth, RBAC, Gardens, Zones, Catalog & Inventory',
      'v1.1 (Next): Care Tasks, Sensors & Smart Alerts'
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

export function getFeaturesBySprint() {
  const groups = new Map();
  for (const feature of FEATURES) {
    const sprintNum = feature.sprint || 1;
    if (!groups.has(sprintNum)) {
      groups.set(sprintNum, {
        sprint: sprintNum,
        label: sprintNum === 1 ? 'Sprint 1 — Live Foundation' : `Sprint ${sprintNum} — Planned`,
        status: sprintNum === 1 ? 'live' : 'soon',
        features: []
      });
    }
    groups.get(sprintNum).features.push(feature);
  }
  return Array.from(groups.values()).sort((a, b) => a.sprint - b.sprint);
}

export const PUBLIC_NAV_ITEMS = [
  { label: 'Features', to: '/#features', status: 'live' },
  { label: 'Plant Catalog', to: '/catalog', status: 'live' },
  { label: 'About', to: '/about', status: 'live' },
  { label: 'Contact', to: '/contact', status: 'live' },
  { label: 'Pricing', key: 'pricing', status: 'soon' }
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
      { label: 'Pricing', comingSoonKey: 'pricing', badge: 'Soon' }
    ]
  },
  {
    label: 'Resources',
    children: [
      { label: 'Documentation', comingSoonKey: 'docs', badge: 'Soon' },
      { label: 'Agronomy Blog', comingSoonKey: 'blog', badge: 'Soon' },
      { label: 'Changelog', comingSoonKey: 'changelog', badge: 'Soon' },
      { label: 'Help Center', comingSoonKey: 'help', badge: 'Soon' }
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
      { label: 'Privacy Policy', comingSoonKey: 'privacy', badge: 'Soon' },
      { label: 'Terms of Service', comingSoonKey: 'terms', badge: 'Soon' }
    ]
  }
];
