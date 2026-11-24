import { ref } from 'vue';

const MESSAGES = {
  en: {
    'nav.overview': 'Overview',
    'nav.gardens': 'Gardens',
    'nav.sustainability': 'Sustainability',
    'nav.seedVault': 'Seed Vault',
    'settings.profile': 'Account Profile',
    'settings.saveProfile': 'Save Profile',
    'settings.language': 'Display Language'
  },
  es: {
    'nav.overview': 'Resumen',
    'nav.gardens': 'Jardines',
    'nav.sustainability': 'Sostenibilidad',
    'nav.seedVault': 'Banco de Semillas',
    'settings.profile': 'Perfil de Cuenta',
    'settings.saveProfile': 'Guardar Perfil',
    'settings.language': 'Idioma'
  }
};

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('sg_locale') : 'en';
const currentLocale = ref(MESSAGES[saved] ? saved : 'en');

export function useI18n() {
  function setLocale(next) {
    const clean = MESSAGES[next] ? next : 'en';
    currentLocale.value = clean;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sg_locale', clean);
    }
  }

  function t(key) {
    return MESSAGES[currentLocale.value]?.[key] || MESSAGES.en[key] || key;
  }

  return {
    locale: currentLocale,
    setLocale,
    t
  };
}
