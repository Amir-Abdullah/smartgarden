import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import router from './router/index.js';
import App from './App.vue';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ui);

app.mount('#app');

if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
