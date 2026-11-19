<template>
  <UApp>
    <RouterView />
    <ComingSoonModal />
  </UApp>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth.js';
import ComingSoonModal from './components/ComingSoonModal.vue';

const authStore = useAuthStore();

onMounted(() => {
  if (authStore.token && !authStore.user) {
    authStore.fetchMe().catch(() => {});
  }
});
</script>
