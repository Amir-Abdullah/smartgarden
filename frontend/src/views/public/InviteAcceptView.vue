<template>
  <UContainer class="flex min-h-[70vh] items-center justify-center py-12">
    <UCard class="w-full max-w-lg text-center shadow-sm">
      <div class="mb-6 flex flex-col items-center">
        <div class="mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <UIcon name="i-lucide-sprout" class="size-7" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Garden Collaboration Invitation
        </h1>
        <p class="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          You have been invited to collaborate on a SmartGarden workspace.
        </p>
      </div>

      <!-- Feedback Alerts -->
      <div class="mb-5 space-y-3 text-left">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="error"
        />
        <UAlert
          v-if="successMessage"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle-2"
          :title="successMessage"
        />
      </div>

      <!-- State 1: Missing Token -->
      <div v-if="!token && !error" class="space-y-4">
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          No invitation token was found in this link. Please check your invitation email.
        </p>
        <UButton to="/gardens" color="neutral" variant="outline" icon="i-lucide-trees">
          Go to My Gardens
        </UButton>
      </div>

      <!-- State 2: Unauthenticated -->
      <div v-else-if="!authStore.isAuthenticated" class="space-y-5">
        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          Please sign in or create an account to accept this invitation.
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton :to="loginRedirectUrl" color="primary" icon="i-lucide-log-in">
            Sign In
          </UButton>
          <UButton :to="registerRedirectUrl" color="neutral" variant="outline" icon="i-lucide-user-plus">
            Create Account
          </UButton>
        </div>
      </div>

      <!-- State 3: Authenticated & Pending Action -->
      <div v-else-if="!acceptedGardenId" class="space-y-5">
        <div class="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <UIcon name="i-lucide-user-check" class="size-4 text-emerald-500" />
          <span class="text-zinc-600 dark:text-zinc-400">Signed in as</span>
          <strong class="text-zinc-900 dark:text-white">{{ authStore.userEmail }}</strong>
        </div>

        <p class="text-sm text-zinc-600 dark:text-zinc-400">
          Would you like to accept this invitation and join the garden team?
        </p>

        <div class="flex flex-wrap justify-center gap-3">
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="membersStore.actionLoading"
            :disabled="membersStore.actionLoading"
            @click="handleAccept"
          >
            {{ membersStore.actionLoading ? 'Processing...' : 'Accept Invitation' }}
          </UButton>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-x"
            :disabled="membersStore.actionLoading"
            @click="handleReject"
          >
            Decline
          </UButton>
        </div>
      </div>

      <!-- State 4: Accepted Success -->
      <div v-else class="space-y-4">
        <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Redirecting you to your garden...
        </p>
        <UButton :to="`/gardens/${acceptedGardenId}`" color="primary" icon="i-lucide-arrow-right">
          Enter Garden
        </UButton>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.js';
import { useMembersStore } from '../../stores/members.js';

const props = defineProps({
  tokenProp: {
    type: String,
    default: ''
  }
});

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const membersStore = useMembersStore();

const acceptedGardenId = ref(null);
const localError = ref('');

const token = computed(() => {
  return props.tokenProp || route.params.token || route.query.token || '';
});

const loginRedirectUrl = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);
const registerRedirectUrl = computed(() => `/register?redirect=${encodeURIComponent(route.fullPath)}`);

const error = computed(() => localError.value || membersStore.error);
const successMessage = computed(() => membersStore.successMessage);

onMounted(() => {
  membersStore.clearMessages();
  if (!token.value) {
    localError.value = 'Invalid invitation link: missing invitation token.';
  }
});

async function handleAccept() {
  if (!token.value) return;
  localError.value = '';
  try {
    const result = await membersStore.acceptInvitation(token.value);
    acceptedGardenId.value = result.gardenId;
    setTimeout(() => {
      if (result.gardenId) {
        router.push(`/gardens/${result.gardenId}`);
      } else {
        router.push('/gardens');
      }
    }, 1500);
  } catch {
    // error stored in membersStore.error
  }
}

async function handleReject() {
  if (!token.value) return;
  localError.value = '';
  try {
    await membersStore.rejectInvitation(token.value);
    setTimeout(() => {
      router.push('/gardens');
    }, 1500);
  } catch {
    // error stored in membersStore.error
  }
}
</script>
