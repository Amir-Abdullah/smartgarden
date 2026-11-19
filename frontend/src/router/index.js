import { createRouter, createWebHistory } from 'vue-router';

import PublicLayout from '../layouts/PublicLayout.vue';
import AuthLayout from '../layouts/AuthLayout.vue';
import DashboardLayout from '../layouts/DashboardLayout.vue';

import LandingView from '../views/public/LandingView.vue';
import AboutView from '../views/public/AboutView.vue';
import ContactView from '../views/public/ContactView.vue';
import InviteAcceptView from '../views/public/InviteAcceptView.vue';
import PlantCatalogView from '../views/shared/PlantCatalogView.vue';

import LoginView from '../views/auth/LoginView.vue';
import RegisterView from '../views/auth/RegisterView.vue';
import ForgotPasswordView from '../views/auth/ForgotPasswordView.vue';
import ResetPasswordView from '../views/auth/ResetPasswordView.vue';

import OverviewView from '../views/dashboard/OverviewView.vue';
import GardensView from '../views/dashboard/GardensView.vue';
import GardenDetailView from '../views/dashboard/GardenDetailView.vue';
import ZonePlantsView from '../views/dashboard/ZonePlantsView.vue';
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
        component: ComingSoonView,
        meta: { feature: 'pricing', title: 'Pricing & Plans' }
      },
      {
        path: 'docs',
        name: 'Docs',
        component: ComingSoonView,
        meta: { feature: 'docs', title: 'Documentation & Guides' }
      },
      {
        path: 'blog',
        name: 'Blog',
        component: ComingSoonView,
        meta: { feature: 'blog', title: 'Agronomy Blog' }
      },
      {
        path: 'changelog',
        name: 'Changelog',
        component: ComingSoonView,
        meta: { feature: 'changelog', title: 'Release Changelog' }
      },
      {
        path: 'help',
        name: 'Help',
        component: ComingSoonView,
        meta: { feature: 'help', title: 'Help Center' }
      },
      {
        path: 'privacy',
        name: 'Privacy',
        component: ComingSoonView,
        meta: { feature: 'privacy', title: 'Privacy Policy' }
      },
      {
        path: 'terms',
        name: 'Terms',
        component: ComingSoonView,
        meta: { feature: 'terms', title: 'Terms of Service' }
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
        meta: { requiresAuth: true, feature: 'F3', title: 'Dashboard Overview' }
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
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F6', title: 'Care Tasks & Schedules' }
      },
      {
        path: 'sensors',
        name: 'Sensors',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F7', title: 'IoT Soil & Climate Sensors' }
      },
      {
        path: 'alerts',
        name: 'Alerts',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F8', title: 'Smart Threshold Alerts' }
      },
      {
        path: 'automations',
        name: 'Automations',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F9', title: 'Irrigation & Climate Automations' }
      },
      {
        path: 'weather',
        name: 'Weather',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F10', title: 'Hyperlocal Weather & Frost' }
      },
      {
        path: 'calendar',
        name: 'PlantingCalendar',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F11', title: 'Dynamic Planting Calendar' }
      },
      {
        path: 'journal',
        name: 'Journal',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F12', title: 'Garden Journal & Photos' }
      },
      {
        path: 'analytics',
        name: 'Analytics',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F13', title: 'Yield & Soil Analytics' }
      },
      {
        path: 'ai-diagnosis',
        name: 'AiDiagnosis',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F14', title: 'AI Pest & Disease Diagnosis' }
      },
      {
        path: 'ai-assistant',
        name: 'AiAssistant',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F15', title: 'AI Agronomist Assistant' }
      },
      {
        path: 'community',
        name: 'Community',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'F16', title: 'Community Garden Exchange' }
      },
      {
        path: 'help',
        name: 'DashboardHelp',
        component: ComingSoonView,
        meta: { requiresAuth: true, feature: 'help', title: 'Help Center' }
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
