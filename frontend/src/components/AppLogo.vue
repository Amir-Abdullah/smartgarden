<template>
  <RouterLink :to="to" class="group inline-flex items-center gap-2.5 focus:outline-none">
    <span
      class="brand-gradient flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-emerald-500/20 transition-transform duration-200 group-hover:scale-105"
      :class="sizeClasses.box"
    >
      <UIcon name="i-lucide-sprout" :class="sizeClasses.icon" />
    </span>
    <span v-if="!compact" class="flex flex-col leading-none">
      <span
        class="font-bold tracking-tight"
        :class="[sizeClasses.title, light ? 'text-white' : 'text-zinc-900 dark:text-white']"
      >
        Smart<span :class="light ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'">Garden</span>
      </span>
      <span
        v-if="showTagline"
        class="mt-0.5 text-[10px] font-medium tracking-wider uppercase"
        :class="light ? 'text-emerald-100/80' : 'text-zinc-500 dark:text-zinc-400'"
      >
        Precision Cultivation
      </span>
    </span>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  to: { type: [String, Object], default: '/' },
  compact: { type: Boolean, default: false },
  showTagline: { type: Boolean, default: false },
  light: { type: Boolean, default: false },
  size: {
    type: String,
    default: 'md',
    validator: (val) => ['sm', 'md', 'lg'].includes(val)
  }
});

const sizeClasses = computed(() => {
  if (props.size === 'sm') {
    return { box: 'size-8', icon: 'size-4', title: 'text-base' };
  }
  if (props.size === 'lg') {
    return { box: 'size-10', icon: 'size-6', title: 'text-xl' };
  }
  return { box: 'size-9', icon: 'size-5', title: 'text-lg' };
});
</script>
