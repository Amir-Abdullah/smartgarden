<template>
  <div class="supa-auth-wrapper">
    <div class="supa-auth-container">
      <!-- Brand & Header -->
      <div class="supa-brand-header">
        <router-link to="/" class="supa-brand-link">
          <span class="supa-logo-icon">🌱</span>
          <span class="supa-logo-text">Smart Garden</span>
        </router-link>
        <p class="supa-tagline">Precision Agriculture & Garden Intelligence Platform</p>
      </div>

      <!-- Authenticated Profile Card -->
      <div v-if="authStore.isAuthenticated && currentView !== 'update_password'" class="supa-auth-card profile-mode">
        <div class="profile-header-area">
          <div class="profile-avatar">
            {{ userInitials }}
          </div>
          <div class="profile-meta">
            <h3>{{ authStore.userName || 'Gardener' }}</h3>
            <span class="profile-email">{{ authStore.userEmail }}</span>
            <div class="badge-row">
              <span class="role-pill" :class="{ 'admin-pill': authStore.isAdmin }">
                {{ authStore.isAdmin ? '👑 Platform Administrator' : '🌿 Garden Member' }}
              </span>
            </div>
          </div>
        </div>

        <div class="profile-details-grid">
          <div class="detail-box">
            <span class="detail-lbl">User ID</span>
            <span class="detail-val">#{{ authStore.user?.id || '—' }}</span>
          </div>
          <div class="detail-box">
            <span class="detail-lbl">Climate Region</span>
            <span class="detail-val">{{ authStore.user?.location_region || 'Temperate Zone' }}</span>
          </div>
          <div class="detail-box">
            <span class="detail-lbl">Joined Platform</span>
            <span class="detail-val">{{ formatDate(authStore.user?.created_at) }}</span>
          </div>
        </div>

        <div class="profile-action-group">
          <router-link to="/dashboard" class="supa-btn supa-btn-primary">
            Launch Gardener Dashboard &rarr;
          </router-link>
          <button @click="handleLogout" class="supa-btn supa-btn-outline">
            Sign Out
          </button>
        </div>
      </div>

      <!-- Unauthenticated Supa-Kit Auth Card -->
      <div v-else class="supa-auth-card">
        <!-- Card Title & Subtitle based on active view -->
        <div class="supa-card-header">
          <h2 class="supa-card-title">{{ currentHeader.title }}</h2>
          <p class="supa-card-subtitle">{{ currentHeader.subtitle }}</p>
        </div>

        <!-- Alert Banners -->
        <div v-if="errorMessage" class="supa-alert supa-alert-error" role="alert">
          <svg class="alert-svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="alert-msg">{{ errorMessage }}</span>
        </div>

        <div v-if="successMessage" class="supa-alert supa-alert-success" role="alert">
          <svg class="alert-svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span class="alert-msg">{{ successMessage }}</span>
        </div>

        <!-- VIEW 1: SIGN IN (sign_in) -->
        <form v-if="currentView === 'sign_in'" @submit.prevent="handleLogin" class="supa-form">
          <div class="supa-field">
            <label for="signin-email" class="supa-label">Email address</label>
            <input
              id="signin-email"
              v-model="loginForm.email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="supa-input"
              required
            />
          </div>

          <div class="supa-field">
            <div class="label-with-link">
              <label for="signin-password" class="supa-label">Password</label>
              <button type="button" @click="setView('forgotten_password')" class="supa-text-link">
                Forgot your password?
              </button>
            </div>
            <div class="input-password-wrap">
              <input
                id="signin-password"
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="supa-input"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="password-toggle-btn"
                tabindex="-1"
              >
                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
          </div>

          <button type="submit" class="supa-btn supa-btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span>{{ isLoading ? 'Signing in...' : 'Sign In' }}</span>
          </button>

          <!-- Quick Test Demo Logins -->
          <div class="supa-divider">
            <span class="divider-text">or continue with</span>
          </div>

          <div class="demo-buttons">
            <button
              type="button"
              class="supa-btn supa-btn-subtle"
              @click="fillDemoAccount('demo.gardener@example.com', 'PlantCare2026!')"
            >
              🌱 Fill Demo Gardener
            </button>
            <button
              type="button"
              class="supa-btn supa-btn-subtle"
              @click="fillDemoAccount('admin@smartgarden.local', 'AdminMaster2026!')"
            >
              🛡️ Fill Admin Account
            </button>
          </div>

          <!-- Footer Switcher -->
          <div class="supa-card-footer">
            <span>Don't have an account?</span>
            <button type="button" @click="setView('sign_up')" class="supa-text-link font-semibold">
              Sign up
            </button>
          </div>
        </form>

        <!-- VIEW 2: SIGN UP (sign_up) -->
        <form v-else-if="currentView === 'sign_up'" @submit.prevent="handleRegister" class="supa-form">
          <div class="supa-field">
            <label for="signup-name" class="supa-label">Full Name</label>
            <input
              id="signup-name"
              v-model="registerForm.name"
              type="text"
              autocomplete="name"
              placeholder="Elena Vance"
              class="supa-input"
              required
            />
          </div>

          <div class="supa-field">
            <label for="signup-email" class="supa-label">Email address</label>
            <input
              id="signup-email"
              v-model="registerForm.email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="supa-input"
              required
            />
          </div>

          <div class="supa-field">
            <label for="signup-region" class="supa-label">Climate / USDA Hardiness Zone (Optional)</label>
            <input
              id="signup-region"
              v-model="registerForm.location_region"
              type="text"
              placeholder="e.g. Zone 7b, Pacific Northwest"
              class="supa-input"
            />
          </div>

          <div class="supa-field">
            <label for="signup-password" class="supa-label">Password (min 8 characters)</label>
            <div class="input-password-wrap">
              <input
                id="signup-password"
                v-model="registerForm.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="At least 8 characters"
                class="supa-input"
                required
                minlength="8"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="password-toggle-btn"
                tabindex="-1"
              >
                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
          </div>

          <button type="submit" class="supa-btn supa-btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span>{{ isLoading ? 'Creating Account...' : 'Sign Up' }}</span>
          </button>

          <!-- Footer Switcher -->
          <div class="supa-card-footer">
            <span>Already have an account?</span>
            <button type="button" @click="setView('sign_in')" class="supa-text-link font-semibold">
              Sign in
            </button>
          </div>
        </form>

        <!-- VIEW 3: FORGOTTEN PASSWORD (forgotten_password) -->
        <form v-else-if="currentView === 'forgotten_password'" @submit.prevent="handleForgotPassword" class="supa-form">
          <div class="supa-field">
            <label for="forgot-email" class="supa-label">Email address</label>
            <input
              id="forgot-email"
              v-model="forgotEmail"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="supa-input"
              required
            />
          </div>

          <button type="submit" class="supa-btn supa-btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span>{{ isLoading ? 'Sending Instructions...' : 'Send Reset Instructions' }}</span>
          </button>

          <!-- Footer Switcher -->
          <div class="supa-card-footer">
            <button type="button" @click="setView('sign_in')" class="supa-text-link font-semibold">
              &larr; Back to Sign In
            </button>
          </div>
        </form>

        <!-- VIEW 4: UPDATE PASSWORD (update_password) -->
        <form v-else-if="currentView === 'update_password'" @submit.prevent="handleResetPassword" class="supa-form">
          <div class="supa-field">
            <label for="reset-token" class="supa-label">Reset Token</label>
            <input
              id="reset-token"
              v-model="resetToken"
              type="text"
              placeholder="Paste token received in instructions"
              class="supa-input"
              required
            />
          </div>

          <div class="supa-field">
            <label for="reset-password" class="supa-label">New Password (min 8 characters)</label>
            <input
              id="reset-password"
              v-model="newPassword"
              type="password"
              placeholder="Enter new secure password"
              class="supa-input"
              required
              minlength="8"
            />
          </div>

          <button type="submit" class="supa-btn supa-btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span>{{ isLoading ? 'Updating Password...' : 'Update Password' }}</span>
          </button>

          <!-- Footer Switcher -->
          <div class="supa-card-footer">
            <button type="button" @click="setView('sign_in')" class="supa-text-link font-semibold">
              &larr; Back to Sign In
            </button>
          </div>
        </form>
      </div>

      <!-- Trust & Platform Info -->
      <div class="supa-security-footer">
        <span class="security-lock">🔒</span>
        <span>Secured with JWT and bcrypt password encryption. Dual-dialect MariaDB & SQLite.</span>
      </div>
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

    // Map internal views: 'sign_in', 'sign_up', 'forgotten_password', 'update_password'
    const resolveInitialView = (mode) => {
      switch (mode) {
        case 'register':
          return 'sign_up';
        case 'forgot':
          return 'forgotten_password';
        case 'reset':
          return 'update_password';
        default:
          return 'sign_in';
      }
    };

    const currentView = ref(resolveInitialView(props.mode));
    const showPassword = ref(false);
    const errorMessage = ref('');
    const successMessage = ref('');
    const isLoading = ref(false);

    // Form Models
    const loginForm = ref({ email: '', password: '' });
    const registerForm = ref({ name: '', email: '', password: '', location_region: '' });
    const forgotEmail = ref('');
    const resetToken = ref(props.token || route.query.token || '');
    const newPassword = ref('');

    watch(
      () => props.mode,
      (newMode) => {
        currentView.value = resolveInitialView(newMode);
        clearAlerts();
      }
    );

    watch(
      () => route.query.token,
      (newToken) => {
        if (newToken) {
          resetToken.value = newToken;
          currentView.value = 'update_password';
        }
      }
    );

    const setView = (viewName) => {
      currentView.value = viewName;
      clearAlerts();
    };

    const clearAlerts = () => {
      errorMessage.value = '';
      successMessage.value = '';
    };

    const currentHeader = computed(() => {
      switch (currentView.value) {
        case 'sign_up':
          return {
            title: 'Create an account',
            subtitle: 'Start organizing your precision microclimate plots and crops'
          };
        case 'forgotten_password':
          return {
            title: 'Reset your password',
            subtitle: 'Enter your email address and we will generate reset instructions'
          };
        case 'update_password':
          return {
            title: 'Update your password',
            subtitle: 'Enter your reset token and your new password'
          };
        default:
          return {
            title: 'Sign in to your account',
            subtitle: 'Welcome back! Enter your credentials to manage your gardens'
          };
      }
    });

    const userInitials = computed(() => {
      const name = authStore.userName || 'G';
      return name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    });

    const handleLogin = async () => {
      clearAlerts();
      isLoading.value = true;
      try {
        await authStore.login(loginForm.value);
        successMessage.value = 'Signed in successfully! Redirecting...';
        const redirect = route.query.redirect || '/dashboard';
        setTimeout(() => {
          router.push(redirect);
        }, 600);
      } catch (err) {
        errorMessage.value = authStore.error || err.message || 'Invalid email or password.';
      } finally {
        isLoading.value = false;
      }
    };

    const handleRegister = async () => {
      clearAlerts();
      isLoading.value = true;
      try {
        await authStore.register(registerForm.value);
        successMessage.value = 'Account created successfully! Welcome to Smart Garden.';
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } catch (err) {
        errorMessage.value = authStore.error || err.message || 'Registration failed.';
      } finally {
        isLoading.value = false;
      }
    };

    const handleForgotPassword = async () => {
      clearAlerts();
      isLoading.value = true;
      try {
        const res = await authStore.forgotPassword(forgotEmail.value);
        successMessage.value =
          authStore.successMessage || 'Password reset instructions have been generated.';
        if (res && res.data && res.data.reset_token) {
          resetToken.value = res.data.reset_token;
          setTimeout(() => {
            currentView.value = 'update_password';
          }, 1500);
        }
      } catch (err) {
        errorMessage.value = authStore.error || err.message || 'Unable to request reset.';
      } finally {
        isLoading.value = false;
      }
    };

    const handleResetPassword = async () => {
      clearAlerts();
      isLoading.value = true;
      try {
        await authStore.resetPassword({
          token: resetToken.value,
          new_password: newPassword.value
        });
        successMessage.value = 'Password updated successfully! Please sign in with your new password.';
        setTimeout(() => {
          currentView.value = 'sign_in';
          loginForm.value.password = '';
        }, 1200);
      } catch (err) {
        errorMessage.value = authStore.error || err.message || 'Failed to update password.';
      } finally {
        isLoading.value = false;
      }
    };

    const handleLogout = () => {
      authStore.logout();
      currentView.value = 'sign_in';
      clearAlerts();
    };

    const fillDemoAccount = (email, password) => {
      loginForm.value.email = email;
      loginForm.value.password = password;
      clearAlerts();
    };

    const formatDate = (isoString) => {
      if (!isoString) return '—';
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    onMounted(() => {
      if (authStore.token && !authStore.user) {
        authStore.fetchMe().catch(() => {});
      }
    });

    return {
      authStore,
      currentView,
      currentHeader,
      showPassword,
      errorMessage,
      successMessage,
      isLoading,
      loginForm,
      registerForm,
      forgotEmail,
      resetToken,
      newPassword,
      userInitials,
      setView,
      handleLogin,
      handleRegister,
      handleForgotPassword,
      handleResetPassword,
      handleLogout,
      fillDemoAccount,
      formatDate
    };
  }
};
</script>

<style scoped>
.supa-auth-wrapper {
  min-height: calc(80vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.supa-auth-container {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Brand Header */
.supa-brand-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.supa-brand-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.supa-logo-icon {
  font-size: 1.75rem;
}

.supa-tagline {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0;
}

/* Supa Auth Card */
.supa-auth-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  padding: 2rem 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-sizing: border-box;
}

.supa-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.supa-card-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.01em;
}

.supa-card-subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.45;
}

/* Alert Boxes */
.supa-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.alert-svg {
  width: 1.2rem;
  height: 1.2rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.supa-alert-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.supa-alert-success {
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

/* Forms & Fields */
.supa-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.supa-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label-with-link {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.supa-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.supa-input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.925rem;
  color: #0f172a;
  background-color: #ffffff;
  transition: all 0.15s ease;
  box-sizing: border-box;
  outline: none;
}

.supa-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.supa-input::placeholder {
  color: #94a3b8;
}

.input-password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-password-wrap .supa-input {
  padding-right: 2.5rem;
}

.password-toggle-btn {
  position: absolute;
  right: 0.6rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: #64748b;
  padding: 0.25rem;
}

/* Buttons */
.supa-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  font-size: 0.925rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  text-decoration: none;
  box-sizing: border-box;
}

.supa-btn-primary {
  background-color: #10b981;
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
}

.supa-btn-primary:hover:not(:disabled) {
  background-color: #059669;
}

.supa-btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.supa-btn-outline {
  background: transparent;
  border-color: #cbd5e1;
  color: #475569;
}

.supa-btn-outline:hover {
  background-color: #f8fafc;
  color: #0f172a;
}

.supa-btn-subtle {
  background-color: #f1f5f9;
  color: #334155;
  font-size: 0.8rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid #e2e8f0;
}

.supa-btn-subtle:hover {
  background-color: #e2e8f0;
  color: #0f172a;
}

.supa-text-link {
  background: transparent;
  border: none;
  color: #059669;
  font-size: 0.825rem;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
  transition: color 0.15s ease;
}

.supa-text-link:hover {
  color: #047857;
  text-decoration: underline;
}

/* Divider & Demo */
.supa-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 0.5rem 0;
}

.supa-divider::before,
.supa-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}

.divider-text {
  padding: 0 0.75rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  font-weight: 500;
}

.demo-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

/* Card Footer */
.supa-card-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #64748b;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

/* Profile Mode Card */
.profile-mode {
  gap: 1.5rem;
}

.profile-header-area {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #10b981;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.25);
}

.profile-meta h3 {
  margin: 0 0 0.15rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #0f172a;
}

.profile-email {
  font-size: 0.85rem;
  color: #64748b;
  display: block;
  margin-bottom: 0.35rem;
}

.role-pill {
  display: inline-block;
  font-size: 0.725rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  background-color: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.admin-pill {
  background-color: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.profile-details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.85rem;
  background-color: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
}

.detail-box {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.detail-lbl {
  font-size: 0.725rem;
  color: #94a3b8;
  text-transform: uppercase;
  font-weight: 600;
}

.detail-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
}

.profile-action-group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* Security Footer */
.supa-security-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: #94a3b8;
  text-align: center;
  line-height: 1.4;
  padding: 0 1rem;
}

/* Inline Spinner */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
