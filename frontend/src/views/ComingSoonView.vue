<template>
  <UDashboardPanel v-if="isDashboard" :id="`coming-soon-${featureData.id || 'page'}`">
    <template #header>
      <UDashboardNavbar :title="featureData.title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UColorModeButton />
          <UButton
            to="/dashboard"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-arrow-left"
          >
            Overview
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-3xl py-6">
        <UCard class="overflow-hidden">
          <div class="space-y-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UIcon :name="featureData.icon || 'i-lucide-sparkles'" class="size-7" />
              </div>

              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge v-if="featureData.code" color="neutral" variant="subtle" size="sm">
                    {{ featureData.code }}
                  </UBadge>
                  <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-clock">
                    Coming in Sprint {{ featureData.sprint || 2 }}
                  </UBadge>
                  <UBadge color="warning" variant="subtle" size="sm">
                    Under Development
                  </UBadge>
                </div>

                <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {{ featureData.title }}
                </h1>
                <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {{ featureData.summary }}
                </p>
              </div>
            </div>

            <div
              v-if="featureData.highlights && featureData.highlights.length"
              class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <h2 class="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                Planned Capabilities
              </h2>
              <ul class="space-y-2.5">
                <li
                  v-for="(item, idx) in featureData.highlights"
                  :key="idx"
                  class="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div class="flex flex-wrap items-center gap-2">
                <UButton to="/dashboard" color="neutral" variant="outline" icon="i-lucide-layout-dashboard">
                  Back to Overview
                </UButton>
                <UButton to="/dashboard/gardens" color="neutral" variant="ghost" icon="i-lucide-trees">
                  My Gardens
                </UButton>
              </div>
              <UButton color="primary" icon="i-lucide-bell" @click="handleNotifyMe">
                Notify Me
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>

  <UContainer v-else class="py-16">
    <div class="mx-auto max-w-3xl">
      <UCard class="overflow-hidden">
        <div class="space-y-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <UIcon :name="featureData.icon || 'i-lucide-sparkles'" class="size-7" />
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge v-if="featureData.code" color="neutral" variant="subtle" size="sm">
                  {{ featureData.code }}
                </UBadge>
                <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-clock">
                  Coming in Sprint {{ featureData.sprint || 2 }}
                </UBadge>
                <UBadge color="warning" variant="subtle" size="sm">
                  Under Development
                </UBadge>
              </div>

              <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                {{ featureData.title }}
              </h1>
              <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {{ featureData.summary }}
              </p>
            </div>
          </div>

          <div
            v-if="featureData.highlights && featureData.highlights.length"
            class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <h2 class="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              What&rsquo;s Included
            </h2>
            <ul class="space-y-2.5">
              <li
                v-for="(item, idx) in featureData.highlights"
                :key="idx"
                class="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div class="flex flex-wrap items-center gap-2">
              <UButton to="/" color="neutral" variant="outline" icon="i-lucide-home">
                Back to Home
              </UButton>
              <UButton to="/about#roadmap" color="neutral" variant="ghost" icon="i-lucide-map">
                View Full Roadmap
              </UButton>
            </div>
            <UButton color="primary" icon="i-lucide-bell" @click="handleNotifyMe">
              Notify Me
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { getFeatureById } from '../config/features.js';

const route = useRoute();
const toast = useToast();

const isDashboard = computed(() => route.path.startsWith('/dashboard'));

const featureData = computed(() => {
  const key =
    (typeof route.query.feature === 'string' && route.query.feature) ||
    route.meta?.feature ||
    route.params?.slug ||
    route.path;

  const matched = getFeatureById(key) || getFeatureById(route.path);
  if (matched) return matched;

  return {
    id: 'upcoming',
    title: route.meta?.title || 'Feature in Development',
    sprint: 2,
    icon: 'i-lucide-sparkles',
    summary: 'This SmartGarden module is scheduled for an upcoming sprint.',
    highlights: []
  };
});

function handleNotifyMe() {
  const sprint = featureData.value?.sprint || 2;
  toast.add({
    title: 'Interest noted!',
    description: `We'll highlight "${featureData.value.title}" in release notes when Sprint ${sprint} ships.`,
    icon: 'i-lucide-check-circle-2',
    color: 'success'
  });
}
</script>
