<template>
  <UDashboardGroup storage="local" storage-key="smartgarden-dashboard">
    <UDashboardSidebar
      id="main-sidebar"
      v-model:open="sidebarOpen"
      v-model:collapsed="sidebarCollapsed"
      collapsible
      resizable
      :min-size="14"
      :default-size="18"
      :max-size="26"
      :ui="{ footer: 'border-t border-zinc-200/80 dark:border-zinc-800/80' }"
    >
      <template #header="{ collapsed }">
        <div class="flex w-full items-center justify-between gap-2">
          <AppLogo :compact="collapsed" to="/dashboard" size="sm" />
          <UDashboardSidebarCollapse v-if="!collapsed" class="hidden lg:inline-flex" />
        </div>
      </template>

      <template #default="{ collapsed }">
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto py-1">
          <UNavigationMenu
            :collapsed="collapsed"
            :items="navGroups"
            orientation="vertical"
            tooltip
            highlight
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full flex-col gap-2 py-1">
          <UNavigationMenu
            :collapsed="collapsed"
            :items="footerNavItems"
            orientation="vertical"
            tooltip
          />

          <USeparator />

          <div
            class="flex items-center justify-between gap-2 px-1"
            :class="collapsed ? 'flex-col' : ''"
          >
            <UTooltip :text="healthTooltip">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                @click="checkApiHealth"
              >
                <span class="relative flex size-2.5 shrink-0">
                  <span
                    v-if="healthStatus === 'online'"
                    class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                  />
                  <span
                    class="relative inline-flex size-2.5 rounded-full"
                    :class="healthDotClass"
                  />
                </span>
                <span v-if="!collapsed" class="truncate">{{ healthLabel }}</span>
              </button>
            </UTooltip>

            <UserMenu :compact="collapsed" />
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <RouterView v-slot="{ Component, route: childRoute }">
      <UDashboardPanel
        v-if="childRoute.meta?.wrapInPanel"
        :id="String(childRoute.name || 'dashboard-shared')"
      >
        <template #header>
          <UDashboardNavbar :title="String(childRoute.meta?.title || 'SmartGarden')">
            <template #leading>
              <UDashboardSidebarCollapse />
            </template>
            <template #right>
              <AlertBellButton />
              <UColorModeButton />
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <component :is="Component" />
        </template>
      </UDashboardPanel>

      <component :is="Component" v-else />
    </RouterView>
  </UDashboardGroup>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../services/api.js';
import { DASHBOARD_NAV_SECTIONS } from '../config/features.js';
import { useGardensStore } from '../stores/gardens.js';
import { useAlertsStore } from '../stores/alerts.js';
import AppLogo from '../components/AppLogo.vue';
import UserMenu from '../components/UserMenu.vue';
import AlertBellButton from '../components/AlertBellButton.vue';

const gardensStore = useGardensStore();
const alertsStore = useAlertsStore();

const sidebarOpen = ref(false);
const sidebarCollapsed = ref(false);

const healthStatus = ref('checking'); // 'online' | 'degraded' | 'checking' | 'offline'
const healthDb = ref('');
let healthIntervalId = null;

function mapNavItem(item) {
  let target = item.to;
  if (item.id === 'F23') {
    target = '/dashboard/calendar?feature=F23';
  } else if (item.id === 'F22') {
    target = '/dashboard/analytics?feature=F22';
  }

  let badge;
  if (item.status === 'soon') {
    badge = {
      label: 'Soon',
      color: 'primary',
      variant: 'subtle',
      size: 'xs'
    };
  } else if (item.id === 'F9' && alertsStore.unreadCount > 0) {
    badge = {
      label: String(alertsStore.unreadCount),
      color: 'error',
      variant: 'soft',
      size: 'xs'
    };
  }

  return {
    label: item.label,
    icon: item.icon,
    to: target,
    ...(badge ? { badge } : {})
  };
}

const navGroups = computed(() => [
  [
    { type: 'label', label: 'Main' },
    ...DASHBOARD_NAV_SECTIONS.main.map((item) => ({
      label: item.label,
      icon: item.icon,
      to: item.to,
      exact: item.to === '/dashboard'
    }))
  ],
  [
    { type: 'label', label: 'Garden Ops' },
    ...DASHBOARD_NAV_SECTIONS.ops.map(mapNavItem)
  ],
  [
    { type: 'label', label: 'Insights' },
    ...DASHBOARD_NAV_SECTIONS.insights.map(mapNavItem)
  ]
]);

const footerNavItems = computed(() => [
  [
    {
      label: 'Settings',
      icon: 'i-lucide-settings',
      to: '/dashboard/settings'
    },
    {
      label: 'Help & Guides',
      icon: 'i-lucide-life-buoy',
      to: '/dashboard/help',
      badge: {
        label: 'Soon',
        color: 'primary',
        variant: 'subtle',
        size: 'xs'
      }
    }
  ]
]);

const healthDotClass = computed(() => {
  if (healthStatus.value === 'online') return 'bg-emerald-500';
  if (healthStatus.value === 'degraded' || healthStatus.value === 'checking') return 'bg-amber-500';
  return 'bg-rose-500';
});

const healthLabel = computed(() => {
  if (healthStatus.value === 'online') return 'API Online';
  if (healthStatus.value === 'degraded') return 'API Degraded';
  if (healthStatus.value === 'checking') return 'Checking API...';
  return 'API Offline';
});

const healthTooltip = computed(() => {
  if (healthStatus.value === 'online') {
    return `Backend healthy (DB: ${healthDb.value || 'connected'}). Click to refresh.`;
  }
  if (healthStatus.value === 'degraded') {
    return `API reachable, DB status: ${healthDb.value || 'unknown'}. Click to refresh.`;
  }
  if (healthStatus.value === 'checking') {
    return 'Checking backend /api/health...';
  }
  return 'Unable to reach /api/health. Click to retry.';
});

async function checkApiHealth() {
  try {
    const res = await api.get('/health', { timeout: 5000 });
    const data = res.data || {};
    healthDb.value = data.db || 'unknown';
    if (data.status === 'ok' && data.db === 'connected') {
      healthStatus.value = 'online';
    } else if (data.status === 'ok') {
      healthStatus.value = 'degraded';
    } else {
      healthStatus.value = 'offline';
    }
  } catch {
    healthStatus.value = 'offline';
    healthDb.value = 'unreachable';
  }
}

async function preloadWorkspaceState() {
  try {
    const gardens = gardensStore.gardens.length
      ? gardensStore.gardens
      : await gardensStore.fetchGardens();
    const targetId = gardensStore.activeGarden?.id || gardens?.[0]?.id;
    if (targetId && alertsStore.activeGardenId === null) {
      alertsStore.setActiveGarden(targetId);
      await alertsStore.fetchGardenAlerts(targetId).catch(() => {});
    }
  } catch {
    // ignore preload failures when offline
  }
}

onMounted(() => {
  checkApiHealth();
  preloadWorkspaceState();
  healthIntervalId = setInterval(checkApiHealth, 30000);
});

onUnmounted(() => {
  if (healthIntervalId) {
    clearInterval(healthIntervalId);
    healthIntervalId = null;
  }
});
</script>
