<script setup>
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const status = ref('Authenticating with Google...');
const errorMessage = ref(null);

onMounted(async () => {
  try {
    // Supabase redirects with URL hash: #access_token=...&refresh_token=...&expires_in=...
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token') || route.query.access_token;
    const error = params.get('error') || route.query.error;
    const errorDescription = params.get('error_description') || route.query.error_description;

    if (error || errorDescription) {
      throw new Error(errorDescription || error || 'Google sign-in was cancelled or denied.');
    }

    if (!accessToken) {
      throw new Error('No authorization token received from provider.');
    }

    status.value = 'Completing authentication and linking account...';

    // Verify token with backend and generate session
    await authStore.loginWithOAuth({
      provider: 'google',
      access_token: accessToken
    });

    status.value = 'Success! Redirecting to dashboard...';
    setTimeout(() => {
      router.replace('/dashboard');
    }, 600);
  } catch (err) {
    console.error('[OAuth Callback Error]', err);
    errorMessage.value = err.message || 'Authentication failed. Please try again.';
  }
});
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[320px] p-6 text-center">
    <div v-if="!errorMessage" class="space-y-4">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent"></div>
      <h2 class="text-xl font-semibold text-slate-800 dark:text-slate-100">
        {{ status }}
      </h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Please wait while we establish your secure session.
      </p>
    </div>

    <div v-else class="space-y-4 max-w-md">
      <div class="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl font-bold">
        ✕
      </div>
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">
        Authentication Failed
      </h2>
      <p class="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-lg border border-rose-200 dark:border-rose-900">
        {{ errorMessage }}
      </p>
      <div class="pt-2">
        <router-link
          to="/login"
          class="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          Return to Sign In
        </router-link>
      </div>
    </div>
  </div>
</template>
