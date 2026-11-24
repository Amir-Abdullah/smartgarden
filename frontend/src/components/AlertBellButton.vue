<template>
  <UPopover v-model:open="isOpen" :content="{ align: 'end', sideOffset: 8 }">
    <UChip
      :show="unreadCount > 0"
      color="error"
      size="2xl"
      inset
    >
      <template #content>
        <span data-testid="alert-unread-badge" class="tabular-nums">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </template>

      <UButton
        data-testid="alert-bell-btn"
        icon="i-lucide-bell"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Unread alerts"
      />
    </UChip>

    <template #content="{ close }">
      <div class="w-80 space-y-3 p-3 sm:w-96">
        <div class="flex items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bell-ring" class="size-4 text-emerald-600 dark:text-emerald-400" />
            <span class="text-sm font-semibold text-zinc-900 dark:text-white">
              Unread Alerts
            </span>
            <UBadge
              v-if="unreadCount > 0"
              color="error"
              variant="soft"
              size="xs"
            >
              {{ unreadCount }}
            </UBadge>
          </div>
          <UButton
            v-if="unreadCount > 0 && targetGardenId"
            size="xs"
            color="neutral"
            variant="ghost"
            :loading="alertsStore.actionLoading"
            @click="handleMarkAllRead"
          >
            Mark all read
          </UButton>
        </div>

        <div v-if="recentUnread.length === 0" class="py-6 text-center">
          <UIcon name="i-lucide-check-circle-2" class="mx-auto mb-2 size-6 text-emerald-500" />
          <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            All caught up!
          </p>
          <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            No unread threshold or device alerts.
          </p>
        </div>

        <ul v-else class="max-h-72 space-y-2 overflow-y-auto">
          <li
            v-for="alert in recentUnread"
            :key="String(alert.id)"
            class="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <UBadge :color="severityColor(alert.severity)" variant="soft" size="xs">
                    {{ alert.severity || 'WARNING' }}
                  </UBadge>
                  <span v-if="alert.zone_name" class="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {{ alert.zone_name }}
                  </span>
                </div>
                <p class="text-xs leading-snug text-zinc-700 dark:text-zinc-200">
                  {{ alert.message }}
                </p>
                <p class="text-[11px] text-zinc-400">
                  {{ formatTimeAgo(alert.triggered_at) }}
                </p>
              </div>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-check"
                aria-label="Mark alert read"
                @click="handleMarkRead(alert.id)"
              />
            </div>
          </li>
        </ul>

        <div class="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <UButton
            to="/dashboard/alerts"
            color="primary"
            variant="soft"
            size="xs"
            block
            trailing-icon="i-lucide-arrow-right"
            @click="close"
          >
            View all alerts
          </UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAlertsStore } from '../stores/alerts.js';
import { useGardensStore } from '../stores/gardens.js';

const alertsStore = useAlertsStore();
const gardensStore = useGardensStore();
const isOpen = ref(false);

const targetGardenId = computed(
  () => alertsStore.activeGardenId || gardensStore.activeGarden?.id || gardensStore.gardens[0]?.id || null
);

const unreadCount = computed(() => alertsStore.unreadCount);
const recentUnread = computed(() => alertsStore.unreadAlerts.slice(0, 6));

function severityColor(severity) {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'info';
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

async function handleMarkRead(alertId) {
  try {
    await alertsStore.markAlertRead(alertId);
  } catch {
    // store captures error
  }
}

async function handleMarkAllRead() {
  if (!targetGardenId.value) return;
  try {
    await alertsStore.markAllRead(targetGardenId.value);
  } catch {
    // store captures error
  }
}
</script>
