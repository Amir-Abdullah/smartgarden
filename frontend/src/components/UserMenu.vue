<template>
  <UDropdownMenu :items="menuItems" :content="{ align: 'end', sideOffset: 8 }">
    <UButton
      color="neutral"
      variant="ghost"
      class="gap-2 px-2"
      aria-label="Account menu"
    >
      <UAvatar
        :alt="displayName"
        size="xs"
        class="bg-emerald-600 text-white"
      />
      <span v-if="!compact" class="hidden max-w-32 truncate text-sm font-medium sm:inline">
        {{ displayName }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="size-4 text-zinc-400" />
    </UButton>
  </UDropdownMenu>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDark, useToggle } from '@vueuse/core';
import { useAuthStore } from '../stores/auth.js';

defineProps({
  compact: { type: Boolean, default: false }
});

const router = useRouter();
const authStore = useAuthStore();
const isDark = useDark();
const toggleDark = useToggle(isDark);

const displayName = computed(() => authStore.userName || authStore.userEmail || 'Gardener');

const menuItems = computed(() => [
  [
    {
      type: 'label',
      label: displayName.value,
      description: authStore.userEmail || 'Signed in'
    }
  ],
  [
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/dashboard'
    },
    {
      label: 'My Gardens',
      icon: 'i-lucide-trees',
      to: '/dashboard/gardens'
    },
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      to: '/dashboard/settings'
    }
  ],
  [
    {
      label: isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
      icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: () => toggleDark()
    }
  ],
  [
    {
      label: 'Sign out',
      icon: 'i-lucide-log-out',
      color: 'error',
      onSelect: () => {
        authStore.logout();
        router.push('/');
      }
    }
  ]
]);
</script>
