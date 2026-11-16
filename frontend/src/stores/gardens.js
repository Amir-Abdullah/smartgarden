import { defineStore } from 'pinia';

export const useGardensStore = defineStore('gardens', {
  state: () => ({
    gardens: [],
    activeGarden: null,
    loading: false
  }),

  actions: {
    setGardens(list) {
      this.gardens = list;
    },
    setActiveGarden(garden) {
      this.activeGarden = garden;
    }
  }
});
