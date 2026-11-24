<template>
  <div class="flex min-h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <UHeader :toggle="{ color: 'neutral', variant: 'ghost' }">
      <template #left>
        <AppLogo size="md" />
      </template>

      <UNavigationMenu :items="desktopNavItems" variant="link" class="hidden lg:flex" />

      <template #right>
        <UColorModeButton />

        <template v-if="authStore.isAuthenticated">
          <UButton
            to="/dashboard"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-layout-dashboard"
            class="hidden sm:inline-flex"
          >
            Open dashboard
          </UButton>
          <UserMenu />
        </template>

        <template v-else>
          <UButton
            to="/login"
            color="neutral"
            variant="ghost"
            size="sm"
            class="hidden sm:inline-flex"
          >
            Sign in
          </UButton>
          <UButton
            to="/register"
            color="primary"
            size="sm"
            class="hidden sm:inline-flex"
          >
            Get started
          </UButton>
        </template>
      </template>

      <template #body>
        <div class="space-y-6 py-2">
          <UNavigationMenu
            :items="mobileNavItems"
            orientation="vertical"
            class="-mx-2.5"
          />

          <USeparator />

          <div v-if="authStore.isAuthenticated" class="flex flex-col gap-2">
            <UButton
              to="/dashboard"
              color="primary"
              block
              icon="i-lucide-layout-dashboard"
            >
              Open dashboard
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              block
              icon="i-lucide-log-out"
              @click="handleSignOut"
            >
              Sign out
            </UButton>
          </div>
          <div v-else class="flex flex-col gap-2">
            <UButton to="/login" color="neutral" variant="outline" block>
              Sign in
            </UButton>
            <UButton to="/register" color="primary" block>
              Get started
            </UButton>
          </div>
        </div>
      </template>
    </UHeader>

    <UMain class="flex-1">
      <slot>
        <RouterView />
      </slot>
    </UMain>

    <USeparator />

    <UFooter :ui="{ top: 'py-10 lg:py-12 border-b border-zinc-200 dark:border-zinc-800' }">
      <template #top>
        <UContainer>
          <div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div class="space-y-4 lg:col-span-4">
              <AppLogo show-tagline />
              <p class="max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                Precision gardening platform for microclimate planning, bed capacity optimization, companion planting, and team collaboration.
              </p>

              <form class="max-w-sm space-y-2 pt-1" @submit.prevent="handleNewsletterSubmit">
                <label class="block text-xs font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
                  Seasonal Agronomy Newsletter
                  <UBadge size="xs" color="primary" variant="subtle" class="ml-1.5">Soon</UBadge>
                </label>
                <div class="flex gap-2">
                  <UInput
                    v-model="newsletterEmail"
                    type="email"
                    placeholder="you@garden.app"
                    size="sm"
                    class="flex-1"
                    aria-label="Newsletter email"
                  />
                  <UButton type="submit" size="sm" color="primary" variant="soft">
                    Subscribe
                  </UButton>
                </div>
              </form>
            </div>

            <div class="lg:col-span-8">
              <UFooterColumns :columns="footerColumns">
                <template #link="{ link }">
                  <button
                    v-if="link.comingSoonKey"
                    type="button"
                    class="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                    @click="open(link.comingSoonKey)"
                  >
                    <span>{{ link.label }}</span>
                    <UBadge v-if="link.badge" size="xs" color="primary" variant="subtle">
                      {{ link.badge }}
                    </UBadge>
                  </button>
                  <RouterLink
                    v-else
                    :to="link.to"
                    class="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    <span>{{ link.label }}</span>
                  </RouterLink>
                </template>
              </UFooterColumns>
            </div>
          </div>
        </UContainer>
      </template>

      <template #left>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">
          &copy; {{ currentYear }} SmartGarden. Built for resilient growing.
        </p>
      </template>

      <template #right>
        <div class="flex items-center gap-1">
          <UButton
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="GitHub"
            @click="notify('GitHub Open Source Repository', 'Public SDK & ESP32 firmware templates arrive in Sprint 2.')"
          />
          <UButton
            icon="i-simple-icons-x"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="X / Twitter"
            @click="notify('Social Updates', 'Community channels launch alongside Sprint 2.')"
          />
          <UButton
            icon="i-simple-icons-discord"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Discord Community"
            @click="notify('Grower Discord', 'Community garden exchange opens in Sprint 5.')"
          />
        </div>
      </template>
    </UFooter>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { FOOTER_COLUMNS } from '../config/features.js';
import { useComingSoon } from '../composables/useComingSoon.js';
import AppLogo from '../components/AppLogo.vue';
import UserMenu from '../components/UserMenu.vue';

const router = useRouter();
const authStore = useAuthStore();
const { open, notify } = useComingSoon();

const newsletterEmail = ref('');
const currentYear = new Date().getFullYear();
const footerColumns = FOOTER_COLUMNS;

const desktopNavItems = computed(() => [
  { label: 'Features', to: '/#features' },
  { label: 'Plant Catalog', to: '/catalog' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
  { label: 'Pricing', to: '/pricing' }
]);

const mobileNavItems = computed(() => [
  { label: 'Features', icon: 'i-lucide-sparkles', to: '/#features' },
  { label: 'Plant Catalog', icon: 'i-lucide-book-open', to: '/catalog' },
  { label: 'About', icon: 'i-lucide-info', to: '/about' },
  { label: 'Contact', icon: 'i-lucide-mail', to: '/contact' },
  { label: 'Pricing', icon: 'i-lucide-credit-card', to: '/pricing' }
]);

function handleNewsletterSubmit() {
  notify('Seasonal Agronomy Newsletter', 'Email digest subscriptions will go live in Sprint 2.');
  newsletterEmail.value = '';
}

function handleSignOut() {
  authStore.logout();
  router.push('/');
}
</script>
