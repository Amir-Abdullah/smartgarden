<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-3xl space-y-6">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-scale">
          Legal Terms
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Terms of Service
        </h1>
        <p class="text-xs text-zinc-500">Effective Date: November 2026</p>
      </div>

      <UCard>
        <div class="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <p>
            <strong>Workspace Ownership:</strong> You retain 100% ownership over all uploaded photos, sensor streams, automation rules, and seed vault inventories created inside your SmartGarden account.
          </p>
          <p>
            <strong>API &amp; Webhook Acceptable Use:</strong> Personal access tokens (`sg_pat_`) and device keys (`sg_live_`) are subject to platform rate limits. Webhooks must point to verified public HTTPS endpoints.
          </p>
          <p>
            <strong>Horticultural Guidance Disclaimer:</strong> AI leaf diagnosis, planting calendars, and weather advisories are decision-support aids and do not guarantee agricultural yield outcomes under extreme local weather events.
          </p>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
