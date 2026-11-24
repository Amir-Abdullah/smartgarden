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
                    {{ t('settings.profile') }}
                  </h2>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Synced live with GET/PUT /api/auth/me
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

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Climate / USDA Zone">
                <UInput
                  v-model="profileForm.location_region"
                  icon="i-lucide-map-pin"
                  placeholder="e.g. Zone 8b, Pacific Northwest"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('settings.language')">
                <USelect
                  :model-value="locale"
                  :items="localeOptions"
                  value-key="value"
                  class="w-full"
                  @update:model-value="setLocale"
                />
              </UFormField>
            </div>

            <div class="flex items-center justify-between gap-3 pt-2">
              <span class="text-xs text-zinc-500 dark:text-zinc-400">
                Account ID: #{{ authStore.user?.id || '—' }}
              </span>
              <UButton type="submit" color="primary" icon="i-lucide-save" :loading="savingProfile">
                {{ t('settings.saveProfile') }}
              </UButton>
            </div>
          </form>
        </UCard>

        <!-- Multi-Channel Notifications & Webhooks (F21) -->
        <UCard data-testid="settings-notifications-card">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-mail" class="size-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Multi-Channel Notifications &amp; Webhooks (F21)
                  </h2>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Manage inbox digests, quiet hours, and SSRF-protected HTTPS webhook signatures
                  </p>
                </div>
              </div>
              <UButton
                v-if="sprint5Store.unreadCount > 0"
                size="xs"
                color="primary"
                variant="soft"
                @click="sprint5Store.markAllNotificationsRead()"
              >
                Mark All Read ({{ sprint5Store.unreadCount }})
              </UButton>
            </div>
          </template>

          <div class="space-y-5">
            <form class="space-y-4" @submit.prevent="handleSavePreferences">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <UFormField label="Email Digest Frequency">
                  <USelect v-model="prefForm.email_digest_freq" :items="digestOptions" value-key="value" class="w-full" />
                </UFormField>
                <UFormField label="Quiet Hours Start">
                  <UInput v-model="prefForm.quiet_hours_start" placeholder="22:00" class="w-full" />
                </UFormField>
                <UFormField label="Quiet Hours End">
                  <UInput v-model="prefForm.quiet_hours_end" placeholder="07:00" class="w-full" />
                </UFormField>
              </div>

              <UFormField label="Public HTTPS Webhook URL">
                <UInput
                  v-model="prefForm.webhook_url"
                  placeholder="https://hooks.example.com/smartgarden"
                  class="w-full"
                />
              </UFormField>

              <div class="flex flex-wrap items-center gap-2">
                <UButton type="submit" size="sm" color="primary" :loading="savingPrefs">
                  Save Notification Preferences
                </UButton>
                <UButton
                  type="button"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-send"
                  :disabled="!prefForm.webhook_url"
                  @click="handleTestWebhook"
                >
                  Send Test Webhook
                </UButton>
              </div>
            </form>

            <!-- Recent Notification Inbox -->
            <div v-if="sprint5Store.notifications.length > 0" class="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Notification Inbox</h3>
              <div
                v-for="item in sprint5Store.notifications.slice(0, 5)"
                :key="item.id"
                class="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
              >
                <div>
                  <div class="flex items-center gap-1.5">
                    <UBadge :color="item.is_read ? 'neutral' : 'primary'" variant="soft" size="xs">
                      {{ item.channel }}
                    </UBadge>
                    <span class="font-semibold text-zinc-900 dark:text-white">{{ item.title }}</span>
                  </div>
                  <p class="mt-0.5 text-zinc-600 dark:text-zinc-300">{{ item.message }}</p>
                </div>
                <UButton
                  v-if="!item.is_read"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="sprint5Store.markNotificationRead(item.id)"
                >
                  Mark Read
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Public Grower Showcase Profile (F24) -->
        <UCard data-testid="settings-public-profile-card">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-globe" class="size-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
                    Public Grower Showcase Profile (F24)
                  </h2>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Share a read-only 3D Garden Twin showcase without exposing private email or coordinates
                  </p>
                </div>
              </div>
              <UButton
                v-if="pubForm.is_public && pubForm.handle"
                :to="`/u/${pubForm.handle}`"
                size="xs"
                color="primary"
                variant="soft"
                trailing-icon="i-lucide-external-link"
              >
                View Public Page
              </UButton>
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="handleSavePublicProfile">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Public Handle Slug">
                <UInput v-model="pubForm.handle" placeholder="e.g. demo-gardener" class="w-full" />
              </UFormField>
              <UFormField label="Visibility">
                <USelect
                  v-model="pubForm.is_public"
                  :items="visibilityOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Grower Bio">
              <UTextarea v-model="pubForm.bio" :rows="2" placeholder="Describe your soil methods, crops, and microclimate..." class="w-full" />
            </UFormField>

            <UButton type="submit" size="sm" color="primary" :loading="savingPublic">
              Save Public Showcase
            </UButton>
          </form>
        </UCard>

        <!-- Scoped Developer API Keys (F24) -->
        <UCard data-testid="settings-api-keys-card">
          <template #header>
            <div class="flex items-center gap-2.5">
              <UIcon name="i-lucide-key-round" class="size-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Developer API Keys (sg_pat_) (F24)
                </h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Issue scoped personal access tokens for Home Assistant, cron jobs, and custom scripts
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <UAlert
              v-if="sprint5Store.lastCreatedToken"
              color="success"
              variant="soft"
              icon="i-lucide-key-round"
              title="Copy Your Personal Access Token Now (Shown Once)"
              :description="sprint5Store.lastCreatedToken"
            />

            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="handleCreateKey">
              <UInput v-model="newKeyName" placeholder="e.g. Home Assistant Read Token" class="flex-1" />
              <UButton type="submit" color="primary" icon="i-lucide-plus" :loading="creatingKey">
                Generate sg_pat_ Key
              </UButton>
            </form>

            <div v-if="sprint5Store.apiKeys.length > 0" class="divide-y divide-zinc-200 dark:divide-zinc-800">
              <div
                v-for="key in sprint5Store.apiKeys"
                :key="key.id"
                class="flex items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-zinc-900 dark:text-white">{{ key.name }}</span>
                    <UBadge :color="key.is_active ? 'success' : 'error'" variant="soft" size="xs">
                      {{ key.is_active ? 'Active' : 'Revoked' }}
                    </UBadge>
                  </div>
                  <p class="font-mono text-[11px] text-zinc-500">
                    {{ key.key_prefix }}... &bull; {{ key.scopes.join(', ') }}
                  </p>
                </div>
                <UButton
                  v-if="key.is_active"
                  size="xs"
                  color="error"
                  variant="ghost"
                  @click="sprint5Store.revokeDeveloperKey(key.id)"
                >
                  Revoke
                </UButton>
              </div>
            </div>
          </div>
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
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useSprint5Store } from '../../stores/sprint5.js';
import { useI18n } from '../../composables/useI18n.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const authStore = useAuthStore();
const sprint5Store = useSprint5Store();
const { locale, setLocale, t } = useI18n();

const loadingProfile = ref(false);
const savingProfile = ref(false);
const savingPrefs = ref(false);
const savingPublic = ref(false);
const creatingKey = ref(false);
const newKeyName = ref('');

const localeOptions = [
  { label: 'English (EN)', value: 'en' },
  { label: 'Español (ES)', value: 'es' }
];

const digestOptions = [
  { label: 'Instant', value: 'INSTANT' },
  { label: 'Daily Summary', value: 'DAILY' },
  { label: 'Weekly Summary', value: 'WEEKLY' },
  { label: 'Paused (Off)', value: 'OFF' }
];

const visibilityOptions = [
  { label: 'Public (/u/handle enabled)', value: true },
  { label: 'Private (Hidden)', value: false }
];

const profileForm = reactive({
  name: '',
  email: '',
  location_region: ''
});

const prefForm = reactive({
  email_digest_freq: 'INSTANT',
  quiet_hours_start: '',
  quiet_hours_end: '',
  webhook_url: ''
});

const pubForm = reactive({
  handle: '',
  is_public: false,
  bio: ''
});

function syncProfileForm() {
  profileForm.name = authStore.user?.name || '';
  profileForm.email = authStore.user?.email || '';
  profileForm.location_region = authStore.user?.location_region || '';
}

async function handleSaveProfile() {
  savingProfile.value = true;
  try {
    await authStore.updateProfile({
      name: profileForm.name,
      location_region: profileForm.location_region
    });
    syncProfileForm();
    toast.add({ title: 'Profile Saved', description: 'Your account profile was updated.', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Profile Save Failed',
      description: err?.response?.data?.error?.message || 'Unable to save profile.',
      color: 'error'
    });
  } finally {
    savingProfile.value = false;
  }
}

async function handleSavePreferences() {
  savingPrefs.value = true;
  try {
    await sprint5Store.updatePreferences({ ...prefForm });
    toast.add({ title: 'Notification Preferences Saved', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Invalid Preference',
      description: err?.response?.data?.error?.message || 'Check webhook URL format.',
      color: 'error'
    });
  } finally {
    savingPrefs.value = false;
  }
}

async function handleTestWebhook() {
  try {
    await sprint5Store.sendTestWebhook(prefForm.webhook_url);
    toast.add({ title: 'Test Webhook Dispatched', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Webhook Blocked',
      description: err?.response?.data?.error?.message || 'Unable to dispatch webhook.',
      color: 'error'
    });
  }
}

async function handleSavePublicProfile() {
  savingPublic.value = true;
  try {
    const updated = await sprint5Store.updatePublicProfile({
      handle: pubForm.handle,
      is_public: pubForm.is_public,
      bio: pubForm.bio
    });
    pubForm.handle = updated.handle;
    pubForm.is_public = updated.is_public;
    pubForm.bio = updated.bio;
    toast.add({ title: 'Public Profile Updated', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Public Profile Failed',
      description: err?.response?.data?.error?.message || 'Unable to update public showcase.',
      color: 'error'
    });
  } finally {
    savingPublic.value = false;
  }
}

async function handleCreateKey() {
  if (!newKeyName.value.trim()) return;
  creatingKey.value = true;
  try {
    await sprint5Store.createDeveloperKey({ name: newKeyName.value.trim() });
    newKeyName.value = '';
    toast.add({ title: 'API Key Issued', color: 'success' });
  } finally {
    creatingKey.value = false;
  }
}

onMounted(async () => {
  syncProfileForm();
  loadingProfile.value = true;
  try {
    await authStore.fetchMe();
    syncProfileForm();
    const [prefs, pub] = await Promise.all([
      sprint5Store.fetchPreferences().catch(() => null),
      sprint5Store.fetchPublicProfile().catch(() => null),
      sprint5Store.fetchNotifications().catch(() => []),
      sprint5Store.fetchDeveloperKeys().catch(() => [])
    ]);
    if (prefs) {
      prefForm.email_digest_freq = prefs.email_digest_freq || 'INSTANT';
      prefForm.quiet_hours_start = prefs.quiet_hours_start || '';
      prefForm.quiet_hours_end = prefs.quiet_hours_end || '';
      prefForm.webhook_url = prefs.webhook_url || '';
    }
    if (pub) {
      pubForm.handle = pub.handle || '';
      pubForm.is_public = Boolean(pub.is_public);
      pubForm.bio = pub.bio || '';
    }
  } finally {
    loadingProfile.value = false;
  }
});
</script>
