<template>
  <div class="space-y-6">
    <UAuthForm
      title="Sign in to SmartGarden"
      description="Welcome back! Enter your credentials to manage your gardens and zones."
      icon="i-lucide-sprout"
      :fields="fields"
      :providers="providers"
      :validate="validateForm"
      :loading="isLoading"
      :submit="{ label: 'Sign in', block: true, color: 'primary', size: 'lg' }"
      @submit="handleLogin"
    >
      <template #password-hint>
        <RouterLink
          to="/forgot-password"
          class="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Forgot password?
        </RouterLink>
      </template>

      <template #validation>
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="errorMessage"
        />
        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          :title="successMessage"
        />
      </template>

      <template #footer>
        <div class="space-y-4">
          <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-zinc-900 dark:text-white">
                  Exploring SmartGarden?
                </p>
                <p class="truncate text-xs text-zinc-600 dark:text-zinc-400">
                  Instant login as <span class="font-mono">demo@smartgarden.app</span>
                </p>
              </div>
              <UButton
                color="primary"
                variant="soft"
                size="sm"
                icon="i-lucide-play"
                :loading="demoLoading"
                :disabled="isLoading"
                @click="handleDemoLogin"
              >
                Try the demo
              </UButton>
            </div>
          </div>

          <p class="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Don&rsquo;t have an account?
            <RouterLink
              :to="registerLink"
              class="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Create one free
            </RouterLink>
          </p>
        </div>
      </template>
    </UAuthForm>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const { notify } = useComingSoon();

const isLoading = ref(false);
const demoLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const fields = [
  {
    name: 'email',
    type: 'email',
    label: 'Email address',
    placeholder: 'you@example.com',
    required: true,
    defaultValue: ''
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
    required: true,
    defaultValue: ''
  }
];

function loginWithGoogle() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bpfpjnhaawwrgykxduef.supabase.co';
  const redirectUrl = `${window.location.origin}/auth/callback`;
  window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
}

const providers = [
  {
    label: 'Continue with Google',
    icon: 'i-simple-icons-google',
    onClick: loginWithGoogle
  },
  {
    label: 'Continue with GitHub',
    icon: 'i-simple-icons-github',
    onClick: () => notify('Social sign-in', 'GitHub OAuth sign-in is scheduled for a later sprint.')
  }
];

const registerLink = computed(() => {
  const redirect = route.query.redirect;
  return redirect ? { path: '/register', query: { redirect } } : '/register';
});

function validateForm(state) {
  const errors = [];
  if (!state.email || !String(state.email).trim()) {
    errors.push({ name: 'email', message: 'Email is required.' });
  }
  if (!state.password || !String(state.password).trim()) {
    errors.push({ name: 'password', message: 'Password is required.' });
  }
  return errors;
}

function resolveRedirectTarget() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect;
  }
  return '/dashboard';
}

async function handleLogin(event) {
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;
  try {
    await authStore.login({
      email: event.data.email,
      password: event.data.password
    });
    successMessage.value = 'Signed in successfully! Redirecting...';
    toast.add({
      title: 'Welcome back!',
      description: `Signed in as ${authStore.userEmail || event.data.email}`,
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
    await router.push(resolveRedirectTarget());
  } catch (err) {
    errorMessage.value = authStore.error || err.message || 'Invalid email or password.';
  } finally {
    isLoading.value = false;
  }
}

async function handleDemoLogin() {
  errorMessage.value = '';
  successMessage.value = '';
  demoLoading.value = true;
  isLoading.value = true;
  try {
    await authStore.login({
      email: 'demo@smartgarden.app',
      password: 'DemoGarden123!'
    });
    successMessage.value = 'Signed in to the demo garden! Redirecting...';
    toast.add({
      title: 'Demo session started',
      description: 'Logged in as demo@smartgarden.app',
      icon: 'i-lucide-sprout',
      color: 'success'
    });
    await router.push(resolveRedirectTarget());
  } catch (err) {
    errorMessage.value =
      authStore.error ||
      err.message ||
      'Demo login failed. Ensure the demo seed script has been run.';
  } finally {
    demoLoading.value = false;
    isLoading.value = false;
  }
}
</script>
