<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-5xl space-y-8">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-newspaper">
          SmartGarden Editorial
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Agronomy Blog
        </h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          Practical guides on companion polycultures, drip irrigation calibration, and low-power greenhouse telemetry.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="cat in ['ALL', 'Companion Planting', 'Irrigation', 'IoT & 3D']"
          :key="cat"
          size="xs"
          :color="activeCat === cat ? 'primary' : 'neutral'"
          :variant="activeCat === cat ? 'solid' : 'outline'"
          @click="activeCat = cat"
        >
          {{ cat }}
        </UButton>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <UCard v-for="post in filteredPosts" :key="post.title">
          <template #header>
            <UBadge color="primary" variant="subtle" size="xs">{{ post.category }}</UBadge>
            <h2 class="mt-2 text-base font-bold text-zinc-900 dark:text-white">{{ post.title }}</h2>
          </template>
          <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{{ post.summary }}</p>
          <template #footer>
            <span class="text-xs text-zinc-400">{{ post.readTime }} &bull; {{ post.date }}</span>
          </template>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup>
import { ref, computed } from 'vue';

const activeCat = ref('ALL');

const articles = [
  {
    category: 'Companion Planting',
    title: 'Designing Three-Tier Polycultures in Raised Cedar Beds',
    summary: 'Combine tall trellised tomatoes with mid-canopy Genovese basil and dwarf French marigolds to suppress nematodes and maximize vertical photosynthesis.',
    readTime: '5 min read',
    date: 'Nov 2026'
  },
  {
    category: 'Irrigation',
    title: 'Why 24-Hour Rain-Skip Cuts Backyard Water Usage by 40%',
    summary: 'Pairing open-meteo precipitation probability thresholds with deep morning drip cycles prevents shallow roots and fungal leaf spotting.',
    readTime: '4 min read',
    date: 'Nov 2026'
  },
  {
    category: 'IoT & 3D',
    title: 'Calibrating ESP32 Capacitive Soil Probes for Your Digital Twin',
    summary: 'Map wet vs dry ADC readings to clean volumetric percentages that drive real-time moisture halos in the 3D Garden Twin.',
    readTime: '6 min read',
    date: 'Nov 2026'
  }
];

const filteredPosts = computed(() =>
  activeCat.value === 'ALL' ? articles : articles.filter((a) => a.category === activeCat.value)
);
</script>
