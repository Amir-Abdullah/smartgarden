<template>
  <UContainer class="py-10">
    <div class="mx-auto max-w-4xl space-y-6">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-life-buoy">
          Knowledge Base
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Help Center
        </h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          Search setup guides, zone capacity math troubleshooting, IoT key onboarding, and role permissions.
        </p>
      </div>

      <UInput v-model="query" placeholder="Search troubleshooting topics..." icon="i-lucide-search" class="max-w-md" />

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UCard v-for="topic in filteredTopics" :key="topic.title">
          <template #header>
            <h2 class="text-sm font-bold text-zinc-900 dark:text-white">{{ topic.title }}</h2>
          </template>
          <p class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{{ topic.answer }}</p>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup>
import { ref, computed } from 'vue';

const query = ref('');

const topics = [
  {
    title: 'Why did a zone trigger a ZONE_OVERCROWDED warning?',
    answer: 'SmartGarden multiplies each planted crop quantity by its catalog footprint area (spacing_cm × row_spacing_cm). Reduce crop quantity or increase zone area_sq_m to bring utilization below 100%.'
  },
  {
    title: 'How do I pair an ESP32 or CLI sensor simulator?',
    answer: 'Open Sensors Console -> Register Device as a garden Owner. Copy your one-time sg_live_ key immediately and pass it via header X-Device-Key to POST /api/sensors/ingest.'
  },
  {
    title: 'What is the difference between Owner, Family, and Guest roles?',
    answer: 'Owners control members, invitations, alert thresholds, and automation rules. Family co-gardeners can mutate zones, crops, tasks, and journal notes. Guests have read-only access.'
  },
  {
    title: 'How do I share my garden in 3D publicly?',
    answer: 'Open Settings -> Public Grower Showcase Profile, pick a unique handle slug, switch visibility to Public, and share /u/<your-handle>.'
  }
];

const filteredTopics = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return topics;
  return topics.filter((t) => `${t.title} ${t.answer}`.toLowerCase().includes(q));
});
</script>
