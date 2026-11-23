<template>
  <div class="space-y-6">
    <UAuthForm
      title="Create your SmartGarden account"
      description="Start organizing microclimate beds, crop spacing, and companion guilds."
      icon="i-lucide-user-plus"
      :fields="fields"
      :providers="providers"
      :validate="validateForm"
      :loading="isLoading"
      :submit="{ label: 'Create account', block: true, color: 'primary', size: 'lg' }"
      @submit="handleRegister"
    >
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
        <p class="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?
          <RouterLink
            :to="loginLink"
            class="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Sign in
          </RouterLink>
        </p>
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
const errorMessage = ref('');
const successMessage = ref('');

const fields = [
  {
    name: 'name',
    type: 'text',
    label: 'Full Name',
    placeholder: 'Elena Vance',
    required: true,
    defaultValue: ''
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email address',
    placeholder: 'you@example.com',
    required: true,
    defaultValue: ''
  },
  {
    name: 'location_region',
    type: 'text',
    label: 'Climate / USDA Zone (Optional)',
    placeholder: 'e.g. Zone 7b, Pacific Northwest',
    required: false,
    defaultValue: ''
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password (min 8 characters)',
    placeholder: 'At least 8 characters',
    required: true,
    defaultValue: ''
  }
];

function signupWithGoogle() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bpfpjnhaawwrgykxduef.supabase.co';
  const redirectUrl = `${window.location.origin}/auth/callback`;
  window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
}

const providers = [
  {
    label: 'Sign up with Google',
    icon: 'i-simple-icons-google',
    onClick: signupWithGoogle
  },
  {
    label: 'Sign up with GitHub',
    icon: 'i-simple-icons-github',
    onClick: () => notify('Social sign-in', 'GitHub OAuth sign-up is scheduled for a later sprint.')
  }
];

const loginLink = computed(() => {
  const redirect = route.query.redirect;
  return redirect ? { path: '/login', query: { redirect } } : '/login';
});

function validateForm(state) {
  const errors = [];
  if (!state.name || !String(state.name).trim()) {
    errors.push({ name: 'name', message: 'Full name is required.' });
  }
  if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(state.email).trim())) {
    errors.push({ name: 'email', message: 'Please enter a valid email address.' });
  }
  if (!state.password || String(state.password).length < 8) {
    errors.push({ name: 'password', message: 'Password must be at least 8 characters.' });
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

async function handleRegister(event) {
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;
  try {
    await authStore.register({
      name: event.data.name,
      email: event.data.email,
      password: event.data.password,
      location_region: event.data.location_region || undefined
    });
    successMessage.value = 'Account created successfully! Redirecting...';
    toast.add({
      title: 'Welcome to SmartGarden!',
      description: 'Your account has been created.',
      icon: 'i-lucide-sprout',
      color: 'success'
    });
    await router.push(resolveRedirectTarget());
  } catch (err) {
    errorMessage.value = authStore.error || err.message || 'Registration failed.';
  } finally {
    isLoading.value = false;
  }
}
</script>
