import { defineStore } from 'pinia';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    plants: [],
    selectedPlant: null,
    total: 0,
    page: 1,
    limit: 12
  }),

  actions: {
    setPlants(data, total) {
      this.plants = data;
      this.total = total;
    },
    setSelectedPlant(plant) {
      this.selectedPlant = plant;
    }
  }
});
