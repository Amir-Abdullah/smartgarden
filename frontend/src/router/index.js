import { createRouter, createWebHistory } from 'vue-router';
import LandingView from '../views/LandingView.vue';
import DashboardView from '../views/DashboardView.vue';
import AuthView from '../views/AuthView.vue';
import GardenDetailView from '../views/GardenDetailView.vue';
import PlantCatalogView from '../views/PlantCatalogView.vue';
import ZonePlantsView from '../views/ZonePlantsView.vue';
import InviteAcceptView from '../views/InviteAcceptView.vue';

const routes = [
  {
    path: '/',
    name: 'Landing',
    component: LandingView
  },
  {
    path: '/landing',
    redirect: '/'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView
  },
  {
    path: '/gardens',
    redirect: '/dashboard'
  },
  {
    path: '/gardens/:id',
    name: 'GardenDetail',
    component: GardenDetailView
  },
  {
    path: '/zones/:zoneId/plants',
    name: 'ZonePlants',
    component: ZonePlantsView
  },
  {
    path: '/catalog',
    name: 'PlantCatalog',
    component: PlantCatalogView
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView
  },
  {
    path: '/login',
    name: 'Login',
    component: AuthView,
    props: { mode: 'login' }
  },
  {
    path: '/register',
    name: 'Register',
    component: AuthView,
    props: { mode: 'register' }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: AuthView,
    props: { mode: 'forgot' }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: AuthView,
    props: (route) => ({ mode: 'reset', token: route.query.token || '' })
  },
  {
    path: '/invitations/accept',
    name: 'InviteAccept',
    component: InviteAcceptView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sg_token') : null;
  const publicPaths = ['/', '/landing', '/auth', '/login', '/register', '/forgot-password', '/reset-password', '/catalog', '/invitations/accept'];
  const isPublic = publicPaths.includes(to.path);

  if (!isPublic && !token) {
    return next({ path: '/auth', query: { redirect: to.fullPath } });
  }
  next();
});

export default router;
