<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-3xl space-y-6">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-lock">
          Data Governance
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Privacy Policy
        </h1>
        <p class="text-xs text-zinc-500">Effective Date: November 2026</p>
      </div>

      <UCard>
        <div class="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <p>
            <strong>Zero Third-Party Telemetry Resale:</strong> Soil moisture, climate readings, growth photos, and garden bed layouts belong exclusively to you and your invited workspace collaborators.
          </p>
          <p>
            <strong>Private Location Precision:</strong> When querying weather forecasts, garden coordinates are snapped to a 1.1 km coarse spatial grid (`grid_key`). Opt-in public showcase profiles (`/u/:handle`) never display your email address or exact coordinates.
          </p>
          <p>
            <strong>Full Data Portability:</strong> Export telemetry and irrigation histories anytime in CSV or PDF-1.4 format from Analytics, and revoke personal access tokens (`sg_pat_`) or device keys instantly in Settings.
          </p>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
