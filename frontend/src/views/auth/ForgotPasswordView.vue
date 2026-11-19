<template>
  <div class="space-y-6">
    <UAuthForm
      title="Reset your password"
      description="Enter your account email and we will generate password reset instructions."
      icon="i-lucide-key-round"
      :fields="fields"
      :validate="validateForm"
      :loading="isLoading"
      :submit="{ label: 'Send reset instructions', block: true, color: 'primary', size: 'lg' }"
      @submit="handleForgotPassword"
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

        <!-- Dev Reset Token Link Display when returned by API -->
        <div
          v-if="devResetToken"
          class="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/30"
        >
          <div class="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <UIcon name="i-lucide-terminal" class="size-4 shrink-0" />
            <span>Development Reset Token Generated</span>
          </div>
          <p class="break-all font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
            {{ devResetToken }}
          </p>
          <UButton
            :to="{ path: '/reset-password', query: { token: devResetToken } }"
            color="primary"
            size="xs"
            icon="i-lucide-arrow-right"
          >
            Continue to Reset Password
          </UButton>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <RouterLink
            to="/login"
            class="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <UIcon name="i-lucide-arrow-left" class="size-3.5" />
            <span>Back to Sign In</span>
          </RouterLink>
          <RouterLink
            to="/reset-password"
            class="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Already have a token?
          </RouterLink>
        </div>
      </template>
    </UAuthForm>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../../stores/auth.js';

const authStore = useAuthStore();

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const devResetToken = ref('');

const fields = [
  {
    name: 'email',
    type: 'email',
    label: 'Email address',
    placeholder: 'you@example.com',
    required: true,
    defaultValue: ''
  }
];

function validateForm(state) {
  const errors = [];
  if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(state.email).trim())) {
    errors.push({ name: 'email', message: 'Please enter a valid email address.' });
  }
  return errors;
}

async function handleForgotPassword(event) {
  errorMessage.value = '';
  successMessage.value = '';
  devResetToken.value = '';
  isLoading.value = true;
  try {
    const res = await authStore.forgotPassword(event.data.email);
    successMessage.value =
      authStore.successMessage ||
      'If an account with that email exists, reset instructions have been sent.';

    const token =
      res?.data?._debug_token ||
      res?._debug_token ||
      res?.data?.reset_token ||
      '';
    if (token) {
      devResetToken.value = token;
    }
  } catch (err) {
    errorMessage.value = authStore.error || err.message || 'Unable to request password reset.';
  } finally {
    isLoading.value = false;
  }
}
</script>
