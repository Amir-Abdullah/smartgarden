<template>
  <UModal
    v-model:open="isOpen"
    :title="activeFeature?.title || 'Under Development'"
    :description="sprintSubtitle"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <UIcon :name="activeFeature?.icon || 'i-lucide-sparkles'" class="size-5" />
          </div>
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge v-if="activeFeature?.code" color="neutral" variant="subtle" size="sm">
                {{ activeFeature.code }}
              </UBadge>
              <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-clock">
                Coming in Sprint {{ activeFeature?.sprint || 2 }}
              </UBadge>
            </div>
            <p class="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {{ activeFeature?.summary }}
            </p>
          </div>
        </div>

        <div v-if="activeFeature?.highlights?.length" class="space-y-2">
          <h4 class="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Planned Capabilities
          </h4>
          <ul class="space-y-2">
            <li
              v-for="(item, idx) in activeFeature.highlights"
              :key="idx"
              class="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton
          to="/about#roadmap"
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-map"
          @click="close"
        >
          View Roadmap
        </UButton>
        <div class="flex items-center gap-2">
          <UButton variant="outline" color="neutral" @click="close">
            Close
          </UButton>
          <UButton color="primary" icon="i-lucide-bell" @click="requestNotification">
            Notify Me
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { computed } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useComingSoon } from '../composables/useComingSoon.js';

const { isOpen, activeFeature, close } = useComingSoon();
const toast = useToast();

const sprintSubtitle = computed(() => {
  const sprint = activeFeature.value?.sprint || 2;
  return `Scheduled for Sprint ${sprint} — Active Product Roadmap`;
});

function requestNotification() {
  const title = activeFeature.value?.title || 'This feature';
  toast.add({
    title: 'Interest noted!',
    description: `We'll highlight "${title}" in release notes when Sprint ${activeFeature.value?.sprint || 2} ships.`,
    icon: 'i-lucide-check',
    color: 'success'
  });
  close();
}
</script>
