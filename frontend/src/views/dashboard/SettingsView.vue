<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Settings">
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
      <div class="mx-auto max-w-4xl space-y-6">
        <!-- Profile Section -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-user-cog" class="size-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Account Profile
                  </h2>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Loaded from your authenticated session (/api/auth/me)
                  </p>
                </div>
              </div>
              <UBadge v-if="authStore.isAdmin" color="primary" variant="soft" size="xs">
                Admin
              </UBadge>
            </div>
          </template>

          <div v-if="loadingProfile" class="space-y-3">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>

          <form v-else class="space-y-4" @submit.prevent="handleSaveProfile">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Full Name">
                <UInput v-model="profileForm.name" icon="i-lucide-user" class="w-full" />
              </UFormField>
              <UFormField label="Email Address">
                <UInput v-model="profileForm.email" type="email" icon="i-lucide-mail" disabled class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Climate / USDA Zone">
              <UInput
                v-model="profileForm.location_region"
                icon="i-lucide-map-pin"
                placeholder="e.g. Zone 8b, Pacific Northwest"
                class="w-full"
              />
            </UFormField>

            <div class="flex items-center justify-between gap-3 pt-2">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">
                Account ID: #{{ authStore.user?.id || '—' }}
              </span>
              <UButton type="submit" color="primary" icon="i-lucide-save">
                Save Profile
              </UButton>
            </div>
          </form>
        </UCard>

        <!-- Security Section -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2.5">
              <UIcon name="i-lucide-shield-check" class="size-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Security &amp; Password
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Manage your password recovery flow and session authentication
                </p>
              </div>
            </div>
          </template>

          <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div class="space-y-1">
              <p class="text-sm font-medium text-zinc-900 dark:text-white">
                Password Recovery &amp; Token Reset
              </p>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                Request a tokenized password reset link or enter an existing recovery token to rotate your password.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UButton to="/forgot-password" color="primary" variant="soft" icon="i-lucide-key-round">
                Request Reset Token
              </UButton>
              <UButton to="/reset-password" color="neutral" variant="outline" icon="i-lucide-lock-keyhole">
                Enter Reset Token
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Coming Soon Settings Modules -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <UCard
            v-for="card in soonSettingsCards"
            :key="card.id"
            class="cursor-pointer transition-colors hover:border-emerald-400 dark:hover:border-emerald-700"
            @click="open(card.featureKey)"
          >
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <UIcon :name="card.icon" class="size-4" />
                </div>
                <UBadge color="primary" variant="subtle" size="xs" icon="i-lucide-clock">
                  Sprint {{ card.sprint }}
                </UBadge>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
                  {{ card.title }}
                </h3>
                <p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {{ card.description }}
                </p>
              </div>

              <div class="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span>View planned scope</span>
                <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.js';
import { useComingSoon } from '../../composables/useComingSoon.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const authStore = useAuthStore();
const { open, notify } = useComingSoon();

const loadingProfile = ref(false);

const profileForm = reactive({
  name: '',
  email: '',
  location_region: ''
});

const soonSettingsCards = [
  {
    id: 'notifications',
    featureKey: 'F21',
    title: 'Notifications & Digests',
    description: 'Configure email, Web Push, and Slack/Discord alerts for frost warnings and daily care queues.',
    icon: 'i-lucide-mail',
    sprint: 5
  },
  {
    id: 'billing',
    featureKey: 'pricing',
    title: 'Billing & Workspace Plan',
    description: 'Manage Hobby, Family Co-op, and Pro Telemetry subscription tiers and sensor quotas.',
    icon: 'i-lucide-credit-card',
    sprint: 3
  },
  {
    id: 'apikeys',
    featureKey: 'F24',
    title: 'Developer API Keys',
    description: 'Generate scoped personal access tokens for Home Assistant, MQTT bridges, and custom scripts.',
    icon: 'i-lucide-key-round',
    sprint: 5
  }
];

function syncProfileForm() {
  profileForm.name = authStore.user?.name || '';
  profileForm.email = authStore.user?.email || '';
  profileForm.location_region = authStore.user?.location_region || '';
}

function handleSaveProfile() {
  notify('Profile updates', 'Profile update endpoint arrives in a later sprint.');
}

onMounted(async () => {
  syncProfileForm();
  loadingProfile.value = true;
  try {
    await authStore.fetchMe();
    syncProfileForm();
  } finally {
    loadingProfile.value = false;
  }
});
</script>
