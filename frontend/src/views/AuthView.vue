<template>
  <div class="auth-container">
    <!-- Authenticated State Card -->
    <div v-if="authStore.isAuthenticated && currentMode !== 'reset'" class="auth-card profile-card">
      <div class="profile-header">
        <div class="avatar-circle">
          {{ userInitials }}
        </div>
        <div>
          <h3>{{ authStore.userName || 'Gardener' }}</h3>
          <p class="profile-email">{{ authStore.userEmail }}</p>
          <span class="role-badge" :class="{ 'admin-badge': authStore.isAdmin }">
            {{ authStore.isAdmin ? 'Platform Administrator' : 'Active Member' }}
          </span>
        </div>
      </div>

      <div class="profile-details" v-if="authStore.user">
        <div class="detail-row">
          <span class="detail-label">User ID:</span>
          <span class="detail-value">#{{ authStore.user.id }}</span>
        </div>
        <div class="detail-row" v-if="authStore.user.location_region">
          <span class="detail-label">Climate Region:</span>
          <span class="detail-value">{{ authStore.user.location_region }}</span>
        </div>
        <div class="detail-row" v-if="authStore.user.created_at">
          <span class="detail-label">Member Since:</span>
          <span class="detail-value">{{ formatDate(authStore.user.created_at) }}</span>
        </div>
      </div>

      <div class="auth-actions">
        <router-link to="/gardens" class="btn btn-primary">Go to Gardens Dashboard</router-link>
        <button @click="handleLogout" class="btn btn-secondary">Sign Out</button>
      </div>
    </div>

    <!-- Unauthenticated Auth Forms Card -->
    <div v-else class="auth-card">
      <!-- Mode Tabs -->
      <div class="auth-tabs">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: currentMode === 'login' }"
          @click="switchMode('login')"
        >
          Sign In
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: currentMode === 'register' }"
          @click="switchMode('register')"
        >
          Register
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: currentMode === 'forgot' }"
          @click="switchMode('forgot')"
        >
          Forgot
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: currentMode === 'reset' }"
          @click="switchMode('reset')"
        >
          Reset
        </button>
      </div>

      <!-- Feedback Messages -->
      <div v-if="errorMessage" class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span>{{ errorMessage }}</span>
      </div>
      <div v-if="successMessage" class="alert alert-success">
        <span class="alert-icon">✓</span>
        <span>{{ successMessage }}</span>
      </div>

      <!-- 1. LOGIN FORM -->
      <form v-if="currentMode === 'login'" @submit.prevent="handleLogin" class="auth-form" novalidate>
        <div class="form-title">
          <h3>Welcome Back</h3>
          <p>Access your gardens, zones, and IoT sensor telemetry.</p>
        </div>

        <div class="form-group">
          <label for="login-email">Email Address</label>
          <input
            id="login-email"
            v-model="loginForm.email"
            type="email"
            placeholder="name@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <div class="label-with-link">
            <label for="login-password">Password</label>
            <a href="#" @click.prevent="switchMode('forgot')" class="inline-link">Forgot?</a>
          </div>
          <input
            id="login-password"
            v-model="loginForm.password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="authStore.loading">
          <span v-if="authStore.loading">Signing in...</span>
          <span v-else>Sign In</span>
        </button>

        <p class="form-footer">
          Don't have an account?
          <a href="#" @click.prevent="switchMode('register')" class="inline-link">Register here</a>
        </p>
      </form>

      <!-- 2. REGISTER FORM -->
      <form v-else-if="currentMode === 'register'" @submit.prevent="handleRegister" class="auth-form" novalidate>
        <div class="form-title">
          <h3>Create an Account</h3>
          <p>Start tracking your crops and autonomous garden rules.</p>
        </div>

        <div class="form-group">
          <label for="reg-name">Full Name</label>
          <input
            id="reg-name"
            v-model="regForm.name"
            type="text"
            placeholder="Jane Gardener"
            required
            autocomplete="name"
          />
        </div>

        <div class="form-group">
          <label for="reg-email">Email Address</label>
          <input
            id="reg-email"
            v-model="regForm.email"
            type="email"
            placeholder="name@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="reg-password">Password</label>
          <input
            id="reg-password"
            v-model="regForm.password"
            type="password"
            placeholder="At least 6 characters"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label for="reg-region">Climate / Hardiness Zone (Optional)</label>
          <input
            id="reg-region"
            v-model="regForm.location_region"
            type="text"
            placeholder="e.g. US-Zone-6b or Mediterranean"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="authStore.loading">
          <span v-if="authStore.loading">Creating Account...</span>
          <span v-else>Register</span>
        </button>

        <p class="form-footer">
          Already registered?
          <a href="#" @click.prevent="switchMode('login')" class="inline-link">Sign In</a>
        </p>
      </form>

      <!-- 3. FORGOT PASSWORD FORM -->
      <form v-else-if="currentMode === 'forgot'" @submit.prevent="handleForgotPassword" class="auth-form" novalidate>
        <div class="form-title">
          <h3>Reset Password</h3>
          <p>Enter your account email to receive a secure password reset token.</p>
        </div>

        <div class="form-group">
          <label for="forgot-email">Account Email</label>
          <input
            id="forgot-email"
            v-model="forgotForm.email"
            type="email"
            placeholder="name@example.com"
            required
            autocomplete="email"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="authStore.loading">
          <span v-if="authStore.loading">Sending Instructions...</span>
          <span v-else>Send Reset Instructions</span>
        </button>

        <p class="form-footer">
          Remember your password?
          <a href="#" @click.prevent="switchMode('login')" class="inline-link">Back to Sign In</a>
        </p>
      </form>

      <!-- 4. RESET PASSWORD FORM -->
      <form v-else-if="currentMode === 'reset'" @submit.prevent="handleResetPassword" class="auth-form" novalidate>
        <div class="form-title">
          <h3>Set New Password</h3>
          <p>Enter your 32-byte hex reset token and choose a new password.</p>
        </div>

        <div class="form-group">
          <label for="reset-token">Reset Token</label>
          <input
            id="reset-token"
            v-model="resetForm.token"
            type="text"
            placeholder="Paste your 64-char hex token"
            required
          />
        </div>

        <div class="form-group">
          <label for="reset-new-password">New Password</label>
          <input
            id="reset-new-password"
            v-model="resetForm.new_password"
            type="password"
            placeholder="At least 6 characters"
            required
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label for="reset-confirm-password">Confirm New Password</label>
          <input
            id="reset-confirm-password"
            v-model="resetForm.confirm_password"
            type="password"
            placeholder="Re-enter your new password"
            required
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="authStore.loading">
          <span v-if="authStore.loading">Resetting Password...</span>
          <span v-else>Update Password</span>
        </button>

        <p class="form-footer">
          Back to
          <a href="#" @click.prevent="switchMode('login')" class="inline-link">Sign In</a>
        </p>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

export default {
  name: 'AuthView',
  props: {
    mode: {
      type: String,
      default: 'login'
    },
    token: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const authStore = useAuthStore();

    const currentMode = ref(props.mode || 'login');
    const localError = ref('');
    const localSuccess = ref('');

    const loginForm = ref({
      email: '',
      password: ''
    });

    const regForm = ref({
      name: '',
      email: '',
      password: '',
      location_region: ''
    });

    const forgotForm = ref({
      email: ''
    });

    const resetForm = ref({
      token: props.token || '',
      new_password: '',
      confirm_password: ''
    });

    // Detect mode from route path or props
    const syncModeFromRoute = () => {
      if (route.path === '/register') {
        currentMode.value = 'register';
      } else if (route.path === '/forgot-password') {
        currentMode.value = 'forgot';
      } else if (route.path === '/reset-password') {
        currentMode.value = 'reset';
        if (route.query.token) {
          resetForm.value.token = route.query.token;
        }
      } else if (route.path === '/login') {
        currentMode.value = 'login';
      } else if (props.mode) {
        currentMode.value = props.mode;
      }
    };

    onMounted(async () => {
      syncModeFromRoute();
      if (authStore.token && !authStore.user) {
        await authStore.fetchMe();
      }
    });

    watch(() => route.path, () => {
      syncModeFromRoute();
      localError.value = '';
      localSuccess.value = '';
    });

    const switchMode = (mode) => {
      currentMode.value = mode;
      localError.value = '';
      localSuccess.value = '';
      authStore.error = null;
      authStore.successMessage = null;

      // Sync route URL cleanly
      if (mode === 'login' && route.path !== '/login') router.push('/login');
      else if (mode === 'register' && route.path !== '/register') router.push('/register');
      else if (mode === 'forgot' && route.path !== '/forgot-password') router.push('/forgot-password');
      else if (mode === 'reset' && route.path !== '/reset-password') router.push('/reset-password');
    };

    const errorMessage = computed(() => localError.value || authStore.error);
    const successMessage = computed(() => localSuccess.value || authStore.successMessage);

    const userInitials = computed(() => {
      if (!authStore.userName) return 'SG';
      const parts = authStore.userName.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    });

    const formatDate = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    const handleLogin = async () => {
      localError.value = '';
      localSuccess.value = '';
      if (!loginForm.value.email || !loginForm.value.password) {
        localError.value = 'Please provide both email and password.';
        return;
      }
      try {
        await authStore.login({
          email: loginForm.value.email,
          password: loginForm.value.password
        });
        localSuccess.value = 'Logged in successfully! Redirecting...';
        setTimeout(() => {
          router.push('/gardens');
        }, 600);
      } catch (err) {
        // error captured in authStore
      }
    };

    const handleRegister = async () => {
      localError.value = '';
      localSuccess.value = '';
      if (!regForm.value.name || !regForm.value.email || !regForm.value.password) {
        localError.value = 'Name, email, and password are required.';
        return;
      }
      if (regForm.value.password.length < 6) {
        localError.value = 'Password must be at least 6 characters.';
        return;
      }
      try {
        await authStore.register({
          name: regForm.value.name,
          email: regForm.value.email,
          password: regForm.value.password,
          location_region: regForm.value.location_region || undefined
        });
        localSuccess.value = 'Account created successfully! Redirecting...';
        setTimeout(() => {
          router.push('/gardens');
        }, 600);
      } catch (err) {
        // error captured in authStore
      }
    };

    const handleForgotPassword = async () => {
      localError.value = '';
      localSuccess.value = '';
      if (!forgotForm.value.email) {
        localError.value = 'Please enter your account email address.';
        return;
      }
      try {
        await authStore.forgotPassword(forgotForm.value.email);
        localSuccess.value = 'If an account exists with that email, reset instructions have been sent.';
      } catch (err) {
        // error captured in authStore
      }
    };

    const handleResetPassword = async () => {
      localError.value = '';
      localSuccess.value = '';
      if (!resetForm.value.token || !resetForm.value.new_password) {
        localError.value = 'Reset token and new password are required.';
        return;
      }
      if (resetForm.value.new_password.length < 6) {
        localError.value = 'Password must be at least 6 characters.';
        return;
      }
      if (resetForm.value.confirm_password && resetForm.value.new_password !== resetForm.value.confirm_password) {
        localError.value = 'Passwords do not match.';
        return;
      }
      try {
        await authStore.resetPassword({
          token: resetForm.value.token,
          new_password: resetForm.value.new_password
        });
        localSuccess.value = 'Password reset successfully! You may now sign in.';
        setTimeout(() => {
          switchMode('login');
        }, 1200);
      } catch (err) {
        // error captured in authStore
      }
    };

    const handleLogout = () => {
      authStore.logout();
      localSuccess.value = 'Signed out successfully.';
      switchMode('login');
    };

    return {
      authStore,
      currentMode,
      switchMode,
      errorMessage,
      successMessage,
      userInitials,
      formatDate,
      loginForm,
      regForm,
      forgotForm,
      resetForm,
      handleLogin,
      handleRegister,
      handleForgotPassword,
      handleResetPassword,
      handleLogout
    };
  }
};
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2.5rem 1rem;
  min-height: calc(100vh - 160px);
}

.auth-card {
  width: 100%;
  max-width: 460px;
  background-color: var(--card-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 2rem;
  box-sizing: border-box;
}

.auth-tabs {
  display: flex;
  border-bottom: 2px solid var(--border-color, #e2e8f0);
  margin-bottom: 1.5rem;
  gap: 0.25rem;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 0.65rem 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary, #718096);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--primary-color, #2e7d32);
}

.tab-btn.active {
  color: var(--primary-color, #2e7d32);
  border-bottom-color: var(--primary-color, #2e7d32);
}

.form-title {
  margin-bottom: 1.5rem;
}

.form-title h3 {
  margin: 0 0 0.4rem 0;
  font-size: 1.35rem;
  color: var(--text-primary, #1a202c);
}

.form-title p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #718096);
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: var(--text-primary, #1a202c);
}

.label-with-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-group input {
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 0.95rem;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus {
  border-color: var(--primary-color, #2e7d32);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.15);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
  text-decoration: none;
  box-sizing: border-box;
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background-color: var(--primary-color, #2e7d32);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #256628;
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #2d3748;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #cbd5e0;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
  margin-top: 0.5rem;
}

.inline-link {
  color: var(--primary-color, #2e7d32);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.inline-link:hover {
  text-decoration: underline;
}

.form-footer {
  margin-top: 1.5rem;
  margin-bottom: 0;
  font-size: 0.875rem;
  text-align: center;
  color: var(--text-secondary, #718096);
}

.alert {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.alert-error {
  background-color: #fed7d7;
  color: #9b2c2c;
  border: 1px solid #feb2b2;
}

.alert-success {
  background-color: #c6f6d5;
  color: #22543d;
  border: 1px solid #9ae6b4;
}

/* Profile Card Styling */
.profile-card {
  text-align: left;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  margin-bottom: 1.25rem;
}

.avatar-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--primary-color, #2e7d32);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  font-weight: bold;
}

.profile-email {
  margin: 0.2rem 0 0.4rem 0;
  color: var(--text-secondary, #718096);
  font-size: 0.9rem;
}

.role-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  background-color: #e2e8f0;
  color: #4a5568;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.role-badge.admin-badge {
  background-color: #feebc8;
  color: #7b341e;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  padding: 0.4rem 0;
  border-bottom: 1px dashed #edf2f7;
}

.detail-label {
  color: var(--text-secondary, #718096);
}

.detail-value {
  font-weight: 500;
  color: var(--text-primary, #1a202c);
}

.auth-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
