<template>
  <div class="invite-accept-container">
    <div class="invite-card">
      <div class="invite-header">
        <span class="invite-icon">🌱</span>
        <h2>Garden Collaboration Invitation</h2>
        <p class="invite-subtitle">You have been invited to collaborate on a Smart Garden.</p>
      </div>

      <!-- Feedback Messages -->
      <div v-if="error" class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span>{{ error }}</span>
      </div>
      <div v-if="successMessage" class="alert alert-success">
        <span class="alert-icon">✓</span>
        <span>{{ successMessage }}</span>
      </div>

      <!-- State 1: Missing Token -->
      <div v-if="!token && !error" class="unauth-prompt">
        <p>No invitation token was found in this link. Please check your invitation email.</p>
        <router-link to="/gardens" class="btn btn-secondary">Go to My Gardens</router-link>
      </div>

      <!-- State 2: Unauthenticated -->
      <div v-else-if="!authStore.isAuthenticated" class="unauth-prompt">
        <p>Please log in or create an account to accept this invitation.</p>
        <div class="action-buttons">
          <router-link :to="loginRedirectUrl" class="btn btn-primary">Sign In</router-link>
          <router-link :to="registerRedirectUrl" class="btn btn-secondary">Create Account</router-link>
        </div>
      </div>

      <!-- State 3: Authenticated & Pending Action -->
      <div v-else-if="!acceptedGardenId" class="accept-prompt">
        <div class="user-greeting">
          Signed in as: <strong>{{ authStore.userEmail }}</strong>
        </div>
        <p>Would you like to accept this invitation and join the garden team?</p>
        
        <div class="action-buttons">
          <button
            @click="handleAccept"
            class="btn btn-primary"
            :disabled="membersStore.actionLoading"
          >
            <span v-if="membersStore.actionLoading">Processing...</span>
            <span v-else>Accept Invitation</span>
          </button>
          <button
            @click="handleReject"
            class="btn btn-danger"
            :disabled="membersStore.actionLoading"
          >
            Decline
          </button>
        </div>
      </div>

      <!-- State 4: Accepted Success -->
      <div v-else class="accepted-state">
        <p>Redirecting you to your garden...</p>
        <router-link :to="`/gardens/${acceptedGardenId}`" class="btn btn-primary">
          Enter Garden
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useMembersStore } from '../stores/members.js';

export default {
  name: 'InviteAcceptView',
  props: {
    tokenProp: {
      type: String,
      default: ''
    }
  },
  setup(props) {
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

    onMounted(async () => {
      membersStore.clearMessages();
      if (!token.value) {
        localError.value = 'Invalid invitation link: missing invitation token.';
      }
    });

    const handleAccept = async () => {
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
      } catch (err) {
        // error stored in membersStore.error
      }
    };

    const handleReject = async () => {
      if (!token.value) return;
      localError.value = '';
      try {
        await membersStore.rejectInvitation(token.value);
        setTimeout(() => {
          router.push('/gardens');
        }, 1500);
      } catch (err) {
        // error stored in membersStore.error
      }
    };

    return {
      authStore,
      membersStore,
      token,
      acceptedGardenId,
      loginRedirectUrl,
      registerRedirectUrl,
      error,
      successMessage,
      handleAccept,
      handleReject
    };
  }
};
</script>

<style scoped>
.invite-accept-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 2rem 1rem;
}

.invite-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  max-width: 520px;
  width: 100%;
  padding: 2.5rem 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  text-align: center;
}

.invite-header {
  margin-bottom: 1.5rem;
}

.invite-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 0.5rem;
}

.invite-header h2 {
  font-size: 1.5rem;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

.invite-subtitle {
  color: #4a5568;
  font-size: 0.95rem;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
}

.alert-error {
  background-color: #fff5f5;
  border: 1px solid #feb2b2;
  color: #c53030;
}

.alert-success {
  background-color: #f0fff4;
  border: 1px solid #9ae6b4;
  color: #276749;
}

.user-greeting {
  background: #f7fafc;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #2d3748;
  margin-bottom: 1rem;
  display: inline-block;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.65rem 1.25rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #2e7d32;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1b5e20;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #2d3748;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #cbd5e0;
}

.btn-danger {
  background-color: #e53e3e;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c53030;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.accepted-state p {
  color: #2e7d32;
  font-weight: 500;
  margin-bottom: 1rem;
}
</style>
