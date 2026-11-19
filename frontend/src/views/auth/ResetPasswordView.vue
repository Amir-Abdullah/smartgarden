<template>
  <div class="space-y-6">
    <UAuthForm
      ref="authFormRef"
      title="Set a new password"
      description="Enter your reset token and choose a new password for your account."
      icon="i-lucide-lock-keyhole"
      :fields="fields"
      :validate="validateForm"
      :loading="isLoading"
      :submit="{ label: 'Update password', block: true, color: 'primary', size: 'lg' }"
      @submit="handleResetPassword"
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
        <div class="flex items-center justify-between text-sm">
          <RouterLink
            to="/login"
            class="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <UIcon name="i-lucide-arrow-left" class="size-3.5" />
            <span>Back to Sign In</span>
          </RouterLink>
          <RouterLink
            to="/forgot-password"
            class="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Request new token
          </RouterLink>
        </div>
      </template>
    </UAuthForm>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const authFormRef = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const initialToken = typeof route.query.token === 'string' ? route.query.token : '';

const fields = [
  {
    name: 'token',
    type: 'text',
    label: 'Reset Token',
    placeholder: 'Paste your password reset token',
    required: true,
    defaultValue: initialToken
  },
  {
    name: 'new_password',
    type: 'password',
    label: 'New Password (min 8 characters)',
    placeholder: 'Enter new secure password',
    required: true,
    defaultValue: ''
  },
  {
    name: 'confirm_password',
    type: 'password',
    label: 'Confirm New Password',
    placeholder: 'Repeat your new password',
    required: true,
    defaultValue: ''
  }
];

watch(
  () => route.query.token,
  (newToken) => {
    if (typeof newToken === 'string' && newToken && authFormRef.value?.state) {
      authFormRef.value.state.token = newToken;
    }
  }
);

function validateForm(state) {
  const errors = [];
  if (!state.token || !String(state.token).trim()) {
    errors.push({ name: 'token', message: 'Reset token is required.' });
  }
  if (!state.new_password || String(state.new_password).length < 8) {
    errors.push({ name: 'new_password', message: 'New password must be at least 8 characters.' });
  }
  if (state.confirm_password !== state.new_password) {
    errors.push({ name: 'confirm_password', message: 'Passwords do not match.' });
  }
  return errors;
}

async function handleResetPassword(event) {
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;
  try {
    await authStore.resetPassword({
      token: String(event.data.token).trim(),
      new_password: event.data.new_password
    });
    successMessage.value = 'Password updated successfully! Redirecting to Sign In...';
    toast.add({
      title: 'Password updated',
      description: 'You can now sign in with your new password.',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
    setTimeout(() => {
      router.push('/login');
    }, 1200);
  } catch (err) {
    errorMessage.value = authStore.error || err.message || 'Failed to update password.';
  } finally {
    isLoading.value = false;
  }
}
</script>
