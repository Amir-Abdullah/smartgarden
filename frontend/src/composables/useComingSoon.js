import { ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { getFeatureById } from '../config/features.js';

const isModalOpen = ref(false);
const activeFeature = ref(null);

function resolveFeaturePayload(input, fallbackDescription) {
  if (!input) {
    return {
      title: 'Feature in Development',
      sprint: 2,
      icon: 'i-lucide-sparkles',
      summary: fallbackDescription || 'This capability is scheduled for an upcoming SmartGarden sprint.',
      highlights: []
    };
  }

  if (typeof input === 'string') {
    const matched = getFeatureById(input);
    if (matched) return matched;
    return {
      title: input,
      sprint: 2,
      icon: 'i-lucide-sparkles',
      summary: fallbackDescription || `${input} is currently in active development and will arrive in an upcoming sprint.`,
      highlights: []
    };
  }

  return {
    title: input.title || input.label || 'Feature in Development',
    code: input.code || input.id || '',
    sprint: input.sprint || 2,
    icon: input.icon || 'i-lucide-sparkles',
    summary: input.summary || fallbackDescription || 'Scheduled for an upcoming SmartGarden release.',
    highlights: Array.isArray(input.highlights) ? input.highlights : []
  };
}

export function useComingSoon() {
  const toast = useToast();

  function open(featureOrKey, fallbackDescription) {
    activeFeature.value = resolveFeaturePayload(featureOrKey, fallbackDescription);
    isModalOpen.value = true;
  }

  function close() {
    isModalOpen.value = false;
  }

  function notify(featureOrTitle, customDescription) {
    const resolved = resolveFeaturePayload(featureOrTitle, customDescription);
    const sprintTag = resolved.sprint ? `Sprint ${resolved.sprint}` : 'Upcoming Sprint';

    toast.add({
      title: `${resolved.title} — Coming in ${sprintTag}`,
      description: customDescription || resolved.summary,
      icon: resolved.icon || 'i-lucide-sparkles',
      color: 'primary'
    });
  }

  return {
    isOpen: isModalOpen,
    activeFeature,
    open,
    close,
    notify
  };
}
