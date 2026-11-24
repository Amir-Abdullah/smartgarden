import { createPinia } from 'pinia';

export const pinia = createPinia();
export { useAuthStore } from './auth';
export { useGardensStore } from './gardens';
export { useCatalogStore } from './catalog';
export { useMembersStore } from './members';
export { useTasksStore } from './tasks';
export { useSensorsStore } from './sensors';
export { useAlertsStore } from './alerts';
export { useRulesStore } from './rules';
