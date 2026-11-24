import { createRouter, createWebHistory } from 'vue-router';

import PublicLayout from '../layouts/PublicLayout.vue';
import AuthLayout from '../layouts/AuthLayout.vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';

import LandingView from '../views/public/LandingView.vue';
import AboutView from '../views/public/AboutView.vue';
import ContactView from '../views/public/ContactView.vue';
import InviteAcceptView from '../views/public/InviteAcceptView.vue';
import PublicProfileView from '../views/public/PublicProfileView.vue';
import PricingView from '../views/public/PricingView.vue';
import DocsView from '../views/public/DocsView.vue';
import BlogView from '../views/public/BlogView.vue';
import ChangelogView from '../views/public/ChangelogView.vue';
import HelpCenterView from '../views/public/HelpCenterView.vue';
import PrivacyView from '../views/public/PrivacyView.vue';
import TermsView from '../views/public/TermsView.vue';
import PlantCatalogView from '../views/shared/PlantCatalogView.vue';

import LoginView from '../views/auth/LoginView.vue';
import RegisterView from '../views/auth/RegisterView.vue';
import ForgotPasswordView from '../views/auth/ForgotPasswordView.vue';
import ResetPasswordView from '../views/auth/ResetPasswordView.vue';
import OAuthCallbackView from '../views/auth/OAuthCallbackView.vue';

import OverviewView from '../views/dashboard/OverviewView.vue';
import GardensView from '../views/dashboard/GardensView.vue';
import GardenDetailView from '../views/dashboard/GardenDetailView.vue';
import ZonePlantsView from '../views/dashboard/ZonePlantsView.vue';
import CareTasksView from '../views/dashboard/CareTasksView.vue';
import SensorsView from '../views/dashboard/SensorsView.vue';
import AlertsView from '../views/dashboard/AlertsView.vue';
import AutomationsView from '../views/dashboard/AutomationsView.vue';
import WeatherView from '../views/dashboard/WeatherView.vue';
import CalendarView from '../views/dashboard/CalendarView.vue';
import CarePlansView from '../views/dashboard/CarePlansView.vue';
import RecommendationsView from '../views/dashboard/RecommendationsView.vue';
import CompanionsView from '../views/dashboard/CompanionsView.vue';
import JournalView from '../views/dashboard/JournalView.vue';
import AnalyticsView from '../views/dashboard/AnalyticsView.vue';
import AiDiagnosisView from '../views/dashboard/AiDiagnosisView.vue';
import AiAssistantView from '../views/dashboard/AiAssistantView.vue';
import CommunityView from '../views/dashboard/CommunityView.vue';
import SustainabilityView from '../views/dashboard/SustainabilityView.vue';
import SeedVaultView from '../views/dashboard/SeedVaultView.vue';
import SettingsView from '../views/dashboard/SettingsView.vue';

import ComingSoonView from '../views/ComingSoonView.vue';
import NotFoundView from '../views/NotFoundView.vue';

const routes = [
  // Public Pages (PublicLayout)
  {
    path: '/',
    component: PublicLayout,
    children: [
      {
        path: '',
        name: 'Landing',
        component: LandingView,
        meta: { title: 'Precision Gardening Platform' }
      },
      {
        path: 'catalog',
        name: 'PlantCatalog',
        component: PlantCatalogView,
        meta: { feature: 'F4', title: 'Botanical Plant Catalog' }
      },
      {
        path: 'about',
        name: 'About',
        component: AboutView,
        meta: { title: 'About SmartGarden' }
      },
      {
        path: 'contact',
        name: 'Contact',
        component: ContactView,
        meta: { title: 'Contact Us' }
      },
      {
        path: 'invitations/accept',
        name: 'InviteAccept',
        component: InviteAcceptView,
        meta: { feature: 'F2', title: 'Garden Invitation' }
      },
      {
        path: 'pricing',
        name: 'Pricing',
        component: PricingView,
        meta: { title: 'Pricing & Plans' }
      },
      {
        path: 'docs',
        name: 'Docs',
        component: DocsView,
        meta: { title: 'Documentation & Guides' }
      },
      {
        path: 'blog',
        name: 'Blog',
        component: BlogView,
        meta: { title: 'Agronomy Blog' }
      },
      {
        path: 'changelog',
        name: 'Changelog',
        component: ChangelogView,
        meta: { title: 'Release Changelog' }
      },
      {
        path: 'help',
        name: 'Help',
        component: HelpCenterView,
        meta: { title: 'Help Center' }
      },
      {
        path: 'privacy',
        name: 'Privacy',
        component: PrivacyView,
        meta: { title: 'Privacy Policy' }
      },
      {
        path: 'terms',
        name: 'Terms',
        component: TermsView,
        meta: { title: 'Terms of Service' }
      },
      {
        path: 'u/:handle',
        name: 'PublicProfile',
        component: PublicProfileView,
        meta: { feature: 'F24', title: 'Grower Showcase' }
      }
    ]
  },

  // Authentication Routes (AuthLayout)
  {
    path: '/',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        name: 'Login',
        component: LoginView,
        meta: { guestOnly: true, feature: 'F1', title: 'Sign In' }
      },
      {
        path: 'register',
        name: 'Register',
        component: RegisterView,
        meta: { guestOnly: true, feature: 'F1', title: 'Create Account' }
      },
      {
        path: 'forgot-password',
        name: 'ForgotPassword',
        component: ForgotPasswordView,
        meta: { feature: 'F1', title: 'Forgot Password' }
      },
      {
        path: 'reset-password',
        name: 'ResetPassword',
        component: ResetPasswordView,
        meta: { feature: 'F1', title: 'Reset Password' }
      },
      {
        path: 'auth/callback',
        name: 'AuthCallback',
        component: OAuthCallbackView,
        meta: { title: 'Authenticating...' }
      }
    ]
  },

  // Dashboard Routes (DashboardLayout)
  {
    path: '/dashboard',
    component: DashboardLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'DashboardOverview',
        component: OverviewView,
        meta: { requiresAuth: true, feature: 'F8', title: 'Dashboard Overview' }
      },
      {
        path: 'gardens',
        name: 'DashboardGardens',
        component: GardensView,
        meta: { requiresAuth: true, feature: 'F3', title: 'My Gardens' }
      },
      {
        path: 'gardens/:id',
        name: 'GardenDetail',
        component: GardenDetailView,
        meta: { requiresAuth: true, feature: 'F3', title: 'Garden Workspace' }
      },
      {
        path: 'zones/:zoneId/plants',
        name: 'ZonePlants',
        component: ZonePlantsView,
        meta: { requiresAuth: true, feature: 'F5', title: 'Zone Crop Inventory' }
      },
      {
        path: 'catalog',
        name: 'DashboardCatalog',
        component: PlantCatalogView,
        meta: { requiresAuth: true, feature: 'F4', title: 'Plant Catalog', wrapInPanel: true }
      },
      {
        path: 'settings',
        name: 'DashboardSettings',
        component: SettingsView,
        meta: { requiresAuth: true, feature: 'F1', title: 'Settings' }
      },
      {
        path: 'care-tasks',
        name: 'CareTasks',
        component: CareTasksView,
        meta: { requiresAuth: true, feature: 'F6', title: 'Care Tasks & Watering' }
      },
      {
        path: 'sensors',
        name: 'Sensors',
        component: SensorsView,
        meta: { requiresAuth: true, feature: 'F7', title: 'IoT Sensors & Telemetry' }
      },
      {
        path: 'alerts',
        name: 'Alerts',
        component: AlertsView,
        meta: { requiresAuth: true, feature: 'F9', title: 'Smart Threshold Alerts' }
      },
      {
        path: 'automations',
        name: 'Automations',
        component: AutomationsView,
        meta: { requiresAuth: true, feature: 'F10', title: 'Automation Rules' }
      },
      {
        path: 'weather',
        name: 'Weather',
        component: WeatherView,
        meta: { requiresAuth: true, feature: 'F11', title: 'Weather-Aware Planning & Spatial Cache' }
      },
      {
        path: 'calendar',
        name: 'PlantingCalendar',
        component: CalendarView,
        meta: { requiresAuth: true, feature: 'F12', title: 'Seasonal Planting Calendar' }
      },
      {
        path: 'care-plans',
        name: 'CarePlans',
        component: CarePlansView,
        meta: { requiresAuth: true, feature: 'F13', title: 'Personalized Care Plan Generator' }
      },
      {
        path: 'recommendations',
        name: 'Recommendations',
        component: RecommendationsView,
        meta: { requiresAuth: true, feature: 'F14', title: 'Plant Recommendation Engine' }
      },
      {
        path: 'companions',
        name: 'Companions',
        component: CompanionsView,
        meta: { requiresAuth: true, feature: 'F15', title: 'Companion Planting Advisor' }
      },
      {
        path: 'journal',
        name: 'Journal',
        component: JournalView,
        meta: { requiresAuth: true, feature: 'F16', title: 'Growth Journal & Photo Timeline' }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: AnalyticsView,
        meta: { requiresAuth: true, feature: 'F17', title: 'Analytics & Data Export' }
      },
      {
        path: 'ai-diagnosis',
        name: 'AiDiagnosis',
        component: AiDiagnosisView,
        meta: { requiresAuth: true, feature: 'F18', title: 'AI Leaf Disease & Pest Diagnosis' }
      },
      {
        path: 'ai-assistant',
        name: 'AiAssistant',
        component: AiAssistantView,
        meta: { requiresAuth: true, feature: 'F19', title: 'AI Gardening Assistant' }
      },
      {
        path: 'community',
        name: 'Community',
        component: CommunityView,
        meta: { requiresAuth: true, feature: 'F20', title: 'Community Hub & Social Feed' }
      },
      {
        path: 'sustainability',
        name: 'Sustainability',
        component: SustainabilityView,
        meta: { requiresAuth: true, feature: 'F22', title: 'Water & Sustainability Metrics' }
      },
      {
        path: 'seed-vault',
        name: 'SeedVault',
        component: SeedVaultView,
        meta: { requiresAuth: true, feature: 'F23', title: 'Seed Vault & Germination Logs' }
      },
      {
        path: 'help',
        name: 'DashboardHelp',
        component: HelpCenterView,
        meta: { requiresAuth: true, wrapInPanel: true, title: 'Help Center' }
      }
    ]
  },

  // Legacy Redirects
  {
    path: '/landing',
    redirect: '/'
  },
  {
    path: '/auth',
    redirect: '/login'
  },
  {
    path: '/gardens',
    redirect: '/dashboard/gardens'
  },
  {
    path: '/gardens/:id',
    redirect: (to) => `/dashboard/gardens/${to.params.id}`
  },
  {
    path: '/zones/:zoneId/plants',
    redirect: (to) => `/dashboard/zones/${to.params.zoneId}/plants`
  },

  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFoundView,
    meta: { title: 'Page Not Found' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    return { top: 0 };
  }
});

router.beforeEach((to) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sg_token') : null;
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth);
  const guestOnly = to.matched.some((record) => record.meta?.guestOnly);

  if (requiresAuth && !token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    };
  }

  if (guestOnly && token) {
    return { path: '/dashboard' };
  }

  return true;
});

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    const pageTitle = to.meta?.title;
    document.title = pageTitle
      ? `${pageTitle} — SmartGarden`
      : 'SmartGarden — Precision Gardening Platform';
  }
});

export default router;
