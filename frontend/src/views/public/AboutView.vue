<template>
  <div>
    <UPageHero
      title="Building Calm, Science-Backed Tools for Modern Growers"
      description="SmartGarden bridges botanical science, spatial garden planning, and real-time environmental telemetry in an approachable workspace."
      :links="[
        { label: 'Explore Plant Catalog', to: '/catalog', color: 'primary', size: 'lg', icon: 'i-lucide-book-open' },
        { label: 'Contact Our Team', to: '/contact', color: 'neutral', variant: 'outline', size: 'lg', icon: 'i-lucide-mail' }
      ]"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle" size="lg" icon="i-lucide-sprout">
          About SmartGarden
        </UBadge>
      </template>
    </UPageHero>

    <!-- Mission & Story -->
    <UContainer class="py-12 lg:py-16">
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
        <div class="space-y-4">
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Our Mission &amp; Story
          </h2>
          <p class="leading-relaxed text-zinc-600 dark:text-zinc-300">
            Home growers and community gardens shouldn&rsquo;t need scattered spreadsheets and guesswork to pair companion crops or prevent root overcrowding. SmartGarden started with a simple question: what if your garden layout checked plant spacing, soil preferences, and companion conflicts automatically?
          </p>
          <p class="leading-relaxed text-zinc-600 dark:text-zinc-300">
            In Sprint 1, we shipped the core platform (F1&ndash;F5) powered by a dual-dialect MariaDB/SQLite Fastify API and a Nuxt UI 4 frontend. Over Sprints 2&ndash;6, we are layering on care task queues, live IoT sensor streams, hyperlocal frost alerts, and context-aware AI agronomy.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UCard v-for="val in values" :key="val.title">
            <div class="mb-3 flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <UIcon :name="val.icon" class="size-5" />
            </div>
            <h3 class="font-semibold text-zinc-900 dark:text-white">{{ val.title }}</h3>
            <p class="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{{ val.description }}</p>
          </UCard>
        </div>
      </div>
    </UContainer>

    <!-- Team -->
    <section class="border-y border-zinc-200/80 bg-zinc-50/70 py-14 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <UContainer>
        <div class="mx-auto mb-10 max-w-2xl text-center">
          <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Meet the Product &amp; Agronomy Team
          </h2>
          <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Horticulturists, embedded engineers, and product designers cultivating open garden tooling.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <UCard v-for="member in team" :key="member.name" class="text-center">
            <div class="flex flex-col items-center">
              <UAvatar :alt="member.name" size="xl" class="mb-3 bg-emerald-600 text-white" />
              <h3 class="font-semibold text-zinc-900 dark:text-white">{{ member.name }}</h3>
              <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{ member.role }}</p>
              <p class="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{{ member.bio }}</p>
            </div>
          </UCard>
        </div>
      </UContainer>
    </section>

    <!-- Dynamic Sprint Roadmap derived from FEATURES -->
    <UContainer id="roadmap" class="py-16">
      <div class="mx-auto mb-10 max-w-2xl text-center">
        <UBadge color="primary" variant="subtle" class="mb-3">Live Product Roadmap</UBadge>
        <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          Sprint Roadmap (F1&ndash;F20)
        </h2>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Dynamically generated from our feature registry — click any upcoming module to inspect its upcoming scope.
        </p>
      </div>

      <div class="space-y-8">
        <UCard v-for="group in sprintGroups" :key="group.sprint">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <UIcon
                  :name="group.status === 'live' ? 'i-lucide-check-circle-2' : 'i-lucide-calendar-clock'"
                  class="size-5"
                  :class="group.status === 'live' ? 'text-emerald-500' : 'text-zinc-400'"
                />
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                  {{ group.label }}
                </h3>
              </div>
              <UBadge :color="group.status === 'live' ? 'success' : 'primary'" variant="soft">
                {{ group.status === 'live' ? 'Shipped' : `${group.features.length} Planned` }}
              </UBadge>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="feat in group.features"
              :key="feat.id"
              class="flex flex-col justify-between rounded-xl border border-zinc-200 p-4 transition-colors hover:border-emerald-400 dark:border-zinc-800 dark:hover:border-emerald-700"
              :class="feat.status === 'soon' ? 'cursor-pointer' : ''"
              @click="feat.status === 'soon' ? open(feat) : null"
            >
              <div>
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <UIcon :name="feat.icon" class="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="text-xs font-bold text-zinc-400">{{ feat.code }}</span>
                  </div>
                  <UBadge
                    :color="feat.status === 'live' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ feat.status === 'live' ? 'Live' : 'Soon' }}
                  </UBadge>
                </div>
                <h4 class="font-semibold text-zinc-900 dark:text-white">{{ feat.title }}</h4>
                <p class="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {{ feat.summary }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>

    <UContainer class="pb-16">
      <UPageCTA
        title="Want to shape Sprint 2 & beyond?"
        description="Reach out with sensor hardware requests, regional plant species suggestions, or community garden partnerships."
        variant="subtle"
        :links="[
          { label: 'Get in Touch', to: '/contact', color: 'primary', size: 'lg' },
          { label: 'Start Growing Free', to: '/register', color: 'neutral', variant: 'outline', size: 'lg' }
        ]"
      />
    </UContainer>
  </div>
</template>

<script setup>
import { getFeaturesBySprint } from '../../config/features.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const { open } = useComingSoon();
const sprintGroups = getFeaturesBySprint();

const values = [
  {
    icon: 'i-lucide-microscope',
    title: 'Botanical Accuracy',
    description: 'Every spacing, moisture, and companion rule is grounded in practical horticulture.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Privacy First',
    description: 'Garden locations and member lists stay strictly inside your invited workspace.'
  },
  {
    icon: 'i-lucide-layers',
    title: 'Honest Roadmapping',
    description: 'Live modules work end-to-end today; upcoming modules clearly show their target sprint.'
  },
  {
    icon: 'i-lucide-users',
    title: 'Built for Teams',
    description: 'Designed equally for solo balcony growers, families, and multi-plot cooperatives.'
  }
];

const team = [
  {
    name: 'Dr. Clara Soto',
    role: 'Lead Agronomist',
    bio: 'Curates the 32+ botanical catalog and companion synergy matrices.'
  },
  {
    name: 'Liam O’Connor',
    role: 'Platform Architect',
    bio: 'Leads the Fastify API, dual-dialect Sequelize layer, and JWT security.'
  },
  {
    name: 'Aisha Patel',
    role: 'IoT & Telemetry Lead',
    bio: 'Designing Sprint 2–3 MQTT sensor bridges and irrigation fail-safes.'
  },
  {
    name: 'Noah Lindqvist',
    role: 'Product Designer',
    bio: 'Crafts calm Nuxt UI workflows for desktop planning and greenhouse tablets.'
  }
];
</script>
