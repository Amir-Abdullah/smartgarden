<template>
  <div class="relative overflow-hidden">
    <AmbientBotanicalBg3D />
    <UPageSection
      headline="Transparent Plans"
      title="Pricing & Plans"
      description="Grow for free as a hobby gardener or scale up shared plots, long-term telemetry, and AI agronomy teams."
    >
      <template #body>
        <div class="mb-8 flex items-center justify-center gap-2">
          <UButton
            size="sm"
            :color="!annual ? 'primary' : 'neutral'"
            :variant="!annual ? 'solid' : 'outline'"
            @click="annual = false"
          >
            Monthly
          </UButton>
          <UButton
            size="sm"
            :color="annual ? 'primary' : 'neutral'"
            :variant="annual ? 'solid' : 'outline'"
            @click="annual = true"
          >
            Annual (Save 20%)
          </UButton>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <UCard
            v-for="tier in tiers"
            :key="tier.name"
            :class="tier.featured ? 'ring-2 ring-emerald-500 dark:ring-emerald-400' : ''"
          >
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold text-zinc-900 dark:text-white">{{ tier.name }}</h3>
                <UBadge v-if="tier.featured" color="primary" variant="soft" size="xs">Popular</UBadge>
              </div>
              <div class="mt-2 flex items-baseline gap-1">
                <span class="text-3xl font-extrabold text-zinc-900 dark:text-white">
                  {{ annual ? tier.annualPrice : tier.monthlyPrice }}
                </span>
                <span class="text-xs text-zinc-500">{{ tier.cadence }}</span>
              </div>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{{ tier.summary }}</p>
            </template>

            <ul class="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li v-for="feat in tier.features" :key="feat" class="flex items-center gap-2">
                <UIcon name="i-lucide-check-circle-2" class="size-4 shrink-0 text-emerald-600" />
                <span>{{ feat }}</span>
              </li>
            </ul>

            <template #footer>
              <UButton :to="tier.to" :color="tier.featured ? 'primary' : 'neutral'" :variant="tier.featured ? 'solid' : 'outline'" block>
                {{ tier.cta }}
              </UButton>
            </template>
          </UCard>
        </div>
      </template>
    </UPageSection>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AmbientBotanicalBg3D from '../../components/three/AmbientBotanicalBg3D.vue';

const annual = ref(true);

const tiers = [
  {
    name: 'Hobby Free',
    monthlyPrice: '$0',
    annualPrice: '$0',
    cadence: '/ forever',
    summary: 'Everything individual home gardeners need across F1–F24 + 3D Garden Twins.',
    featured: false,
    cta: 'Start Free',
    to: '/register',
    features: [
      'Up to 3 active gardens & unlimited zones',
      'Full 32+ species botanical catalog & companion guild math',
      'Interactive 3D Garden Twin & Seed Vault',
      'Deterministic AI leaf diagnosis & advisor'
    ]
  },
  {
    name: 'Family & Co-op',
    monthlyPrice: '$9',
    annualPrice: '$7',
    cadence: '/ month',
    summary: 'Built for shared backyard beds, household teams, and IoT sensor plots.',
    featured: true,
    cta: 'Open Workspace',
    to: '/register',
    features: [
      'Unlimited gardens & Owner / Family / Guest seats',
      'Real-time WebSocket & SSE telemetry streaming',
      'Automated rain-skip & frost watchdogs',
      'HTTPS signed webhooks & 5 scoped sg_pat_ API keys'
    ]
  },
  {
    name: 'Pro Agronomy',
    monthlyPrice: '$24',
    annualPrice: '$19',
    cadence: '/ month',
    summary: 'For urban micro-farms, greenhouses, and Home Assistant automation fleets.',
    featured: false,
    cta: 'Contact Team',
    to: '/contact',
    features: [
      'Priority Gemini Vision diagnostics & custom prompts',
      'Unlimited sensor ingestion & MQTT telemetry bridge',
      'Automated CSV & PDF seasonal export scheduling',
      'Dedicated SLA support & public grower showcase'
    ]
  }
];
</script>
