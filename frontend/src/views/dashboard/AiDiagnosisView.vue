<template>
  <UDashboardPanel id="ai-diagnosis-view">
    <template #header>
      <UDashboardNavbar title="AI Leaf Disease & Pest Diagnosis">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- Input Panel -->
        <UCard class="lg:col-span-5">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                  Leaf Pathology Upload (F18)
                </h3>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Upload a photo (JPEG, PNG, WEBP up to 5 MB) or test a sample leaf scan
                </p>
              </div>
              <UIcon name="i-lucide-scan-search" class="size-5 text-emerald-600" />
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="handleAnalyzeUpload">
            <UFormField label="Crop Name">
              <UInput v-model="cropName" placeholder="e.g. Roma Tomato" class="w-full" />
            </UFormField>

            <UFormField label="Observed Symptoms">
              <UTextarea
                v-model="symptomsNotes"
                :rows="3"
                placeholder="e.g. White powdery spots or brown concentric rings on lower leaves..."
                class="w-full"
              />
            </UFormField>

            <UFormField label="Leaf Photo">
              <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 dark:text-zinc-300 dark:file:bg-emerald-950 dark:file:text-emerald-300"
                @change="onFileChange"
              />
            </UFormField>

            <div class="flex flex-wrap gap-2">
              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-sparkles"
                :disabled="!selectedFile || sprint4Store.diagnosisLoading"
                :loading="sprint4Store.diagnosisLoading"
              >
                Diagnose Uploaded Photo
              </UButton>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-lucide-flask-conical"
                :loading="sprint4Store.diagnosisLoading"
                @click="handleAnalyzeSample"
              >
                Analyze Sample Leaf
              </UButton>
            </div>
          </form>
        </UCard>

        <!-- Output Report -->
        <div class="lg:col-span-7">
          <UAlert
            v-if="sprint4Store.error"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :title="sprint4Store.error"
            class="mb-4"
          />

          <UCard v-if="!result">
            <UEmpty
              icon="i-lucide-microscope"
              title="Ready for Leaf Inspection"
              description="Upload a leaf photo or click 'Analyze Sample Leaf' to inspect symptoms, severity, organic treatments, and preventative care steps."
            />
          </UCard>

          <UCard v-else data-testid="diagnosis-report-card">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-lg font-bold text-zinc-900 dark:text-white">
                    {{ result.disease_name }}
                  </h3>
                  <p class="text-xs text-zinc-500">
                    Crop: {{ result.crop_name }} &bull; Confidence: {{ Math.round((result.confidence || 0.85) * 100) }}%
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="severityColor(result.severity)" variant="soft">
                    Severity: {{ result.severity }}
                  </UBadge>
                  <UBadge color="neutral" variant="outline" size="xs">
                    {{ result.provider }}
                  </UBadge>
                </div>
              </div>
            </template>

            <div class="space-y-4 text-sm">
              <div v-if="result.symptoms_detected?.length">
                <h4 class="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  Symptoms Detected
                </h4>
                <ul class="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                  <li v-for="(s, idx) in result.symptoms_detected" :key="idx">{{ s }}</li>
                </ul>
              </div>

              <div v-if="result.organic_treatments?.length">
                <h4 class="mb-1.5 text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                  Organic &amp; Biological Treatments
                </h4>
                <ul class="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                  <li v-for="(t, idx) in result.organic_treatments" :key="idx">{{ t }}</li>
                </ul>
              </div>

              <div v-if="result.preventative_actions?.length">
                <h4 class="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  Preventative Actions
                </h4>
                <ul class="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
                  <li v-for="(p, idx) in result.preventative_actions" :key="idx">{{ p }}</li>
                </ul>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useSprint4Store } from '../../stores/sprint4.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const sprint4Store = useSprint4Store();

const cropName = ref('Heirloom Cherry Tomato');
const symptomsNotes = ref('White powdery patches spotted on upper leaves');
const fileInputRef = ref(null);
const selectedFile = ref(null);

const result = computed(() => sprint4Store.diagnosisResult);

function severityColor(sev) {
  if (sev === 'HIGH') return 'error';
  if (sev === 'MODERATE') return 'warning';
  if (sev === 'LOW') return 'info';
  return 'success';
}

function onFileChange(e) {
  selectedFile.value = e.target?.files?.[0] || null;
}

async function submitBlob(fileOrBlob, filename) {
  const fd = new FormData();
  fd.append('crop_name', cropName.value || 'Garden Crop');
  fd.append('symptoms_notes', symptomsNotes.value || '');
  fd.append('photo', fileOrBlob, filename);
  await sprint4Store.diagnoseLeaf(fd);
  toast.add({
    title: 'Leaf Diagnosis Complete',
    description: sprint4Store.diagnosisResult?.disease_name || 'Structured diagnosis ready.',
    color: 'success'
  });
}

async function handleAnalyzeUpload() {
  if (!selectedFile.value) return;
  try {
    await submitBlob(selectedFile.value, selectedFile.value.name || 'leaf.png');
  } catch {
    toast.add({ title: 'Diagnosis Failed', color: 'error' });
  }
}

async function handleAnalyzeSample() {
  // Minimal valid 1x1 PNG binary so real multipart upload & magic-byte validation execute end-to-end
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  try {
    await submitBlob(blob, 'sample-leaf.png');
  } catch {
    toast.add({ title: 'Sample Diagnosis Failed', color: 'error' });
  }
}
</script>
