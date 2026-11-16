import { createRouter, createWebHistory } from 'vue-router';
import AuthView from '../views/AuthView.vue';
import GardensView from '../views/GardensView.vue';
import GardenDetailView from '../views/GardenDetailView.vue';
import PlantCatalogView from '../views/PlantCatalogView.vue';
import ZonePlantsView from '../views/ZonePlantsView.vue';

const routes = [
  {
    path: '/',
    redirect: '/gardens'
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
    path: '/gardens',
    name: 'Gardens',
    component: GardensView
  },
  {
    path: '/gardens/:id',
    name: 'GardenDetail',
    component: GardenDetailView
  },
  {
    path: '/catalog',
    name: 'PlantCatalog',
    component: PlantCatalogView
  },
  {
    path: '/zones/:zoneId/plants',
    name: 'ZonePlants',
    component: ZonePlantsView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
