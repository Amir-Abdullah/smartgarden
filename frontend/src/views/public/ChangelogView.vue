<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-4xl space-y-8">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-sparkles">
          Platform Evolution
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Release Changelog
        </h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          Complete release history across Sprints 1–5 bringing all 24 SmartGarden modules and Three.js 3D Garden Twins live.
        </p>
      </div>

      <div class="space-y-4">
        <UCard v-for="release in releases" :key="release.version">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <UBadge color="success" variant="soft" size="sm">{{ release.version }}</UBadge>
                <span class="font-bold text-zinc-900 dark:text-white">{{ release.title }}</span>
              </div>
              <span class="text-xs text-zinc-400">{{ release.date }}</span>
            </div>
          </template>
          <ul class="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
            <li v-for="note in release.notes" :key="note">{{ note }}</li>
          </ul>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup>
const releases = [
  {
    version: 'v5.0.0',
    title: 'Sprint 5 — Notifications, Sustainability, Seed Vault, 3D Twins & Developer API',
    date: 'Nov 2026',
    notes: [
      'Interactive Three.js 3D Garden Twin & Hero raised-bed diorama with WebGL/2D fallback.',
      'F21 Multi-Channel Notifications, inbox, quiet hours, and SSRF-safe signed HTTPS webhooks.',
      'F22 Water & Sustainability scorecard, rainwater/compost logs & drip savings metrics.',
      'F23 Seed Vault viability tracking & 1-click sowing allocation into ZonePlant beds.',
      'F24 Scoped sg_pat_ personal access tokens & opt-in /u/:handle public showcase pages.',
      'Full public suite (/pricing, /docs, /blog, /changelog, /help, /privacy, /terms), PWA manifest & CI.'
    ]
  },
  {
    version: 'v4.0.0',
    title: 'Sprint 4 — Growth Journal, Analytics, AI Diagnosis/Assistant & Community',
    date: 'Nov 2026',
    notes: [
      'F16–F20 live with binary photo storage, daily telemetry rollups, CSV/PDF export, Gemini Vision/Chat fallbacks, and Community Hub.'
    ]
  },
  {
    version: 'v3.0.0',
    title: 'Sprint 3 — Weather, Calendar, Care Plans, Recommendations & Companions',
    date: 'Nov 2026',
    notes: [
      'F11–F15 live with spatial grid caching, RFC 5545 .ics export, calibrated care plans, and companion heatmaps.'
    ]
  },
  {
    version: 'v2.0.0',
    title: 'Sprint 2 — Care Tasks, IoT Sensors, Realtime WS/SSE, Alerts & Automations',
    date: 'Nov 2026',
    notes: [
      'F6–F10 live with SHA-256 device keys, WebSocket/SSE live stream, quiet-hours alerts, and 3-layer rule engine.'
    ]
  },
  {
    version: 'v1.0.0',
    title: 'Sprint 1 — Core Authentication, RBAC, Gardens, Zones & Plant Catalog',
    date: 'Nov 2026',
    notes: [
      'F1–F5 baseline foundation with Supabase PostgreSQL compatibility, OAuth, and bed capacity geometry.'
    ]
  }
];
</script>
