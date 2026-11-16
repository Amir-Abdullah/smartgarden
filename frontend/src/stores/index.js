import { createPinia } from 'pinia';

export const pinia = createPinia();
export { useAuthStore } from './auth';
export { useGardensStore } from './gardens';
export { useCatalogStore } from './catalog';
