<template>
  <UDashboardPanel id="ai-assistant-view">
    <template #header>
      <UDashboardNavbar title="AI Gardening Assistant">
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
      <div class="space-y-4">
        <!-- Context Grounding Bar -->
        <UCard>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <UFormField label="Ground Answers in Garden Context" class="w-full sm:max-w-sm">
              <USelect
                v-model="selectedGardenId"
                :items="gardenOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                v-if="sprint4Store.lastContextSummary"
                color="success"
                variant="soft"
                icon="i-lucide-database"
              >
                Grounded: {{ sprint4Store.lastContextSummary.garden_name }}
                ({{ sprint4Store.lastContextSummary.crops_count }} crops)
              </UBadge>
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-rotate-ccw"
                @click="sprint4Store.clearChat()"
              >
                New Chat
              </UButton>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-for="prompt in sprint4Store.suggestedFollowups"
              :key="prompt"
              size="xs"
              color="primary"
              variant="soft"
              @click="sendPrompt(prompt)"
            >
              {{ prompt }}
            </UButton>
          </div>
        </UCard>

        <UAlert
          v-if="sprint4Store.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="sprint4Store.error"
        />

        <!-- Chat Thread -->
        <UCard>
          <div class="max-h-[420px] min-h-[240px] space-y-3 overflow-y-auto pr-1" data-testid="ai-chat-thread">
            <div
              v-if="sprint4Store.chatMessages.length === 0"
              class="py-10 text-center text-sm text-zinc-500"
            >
              Ask a question about irrigation, pests, soil care, or companion pairings. Select a garden above to inject live crop and sensor context.
            </div>

            <div
              v-for="msg in sprint4Store.chatMessages"
              :key="msg.id"
              :class="[
                'rounded-xl px-4 py-3 text-sm whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'ml-auto max-w-2xl bg-emerald-600 text-white'
                  : 'mr-auto max-w-3xl border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
              ]"
            >
              <div class="mb-1 flex items-center justify-between gap-2 text-[11px] opacity-75">
                <span class="font-semibold uppercase">{{ msg.role === 'user' ? 'You' : 'SmartGarden Copilot' }}</span>
                <span v-if="msg.provider">{{ msg.provider }}</span>
              </div>
              <div>{{ msg.content }}</div>
            </div>
          </div>

          <template #footer>
            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="handleSend">
              <UInput
                v-model="draftMessage"
                placeholder="Ask SmartGarden AI about watering, pests, fertilizer, or companions..."
                class="flex-1"
                :disabled="sprint4Store.chatLoading"
              />
              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-send"
                :loading="sprint4Store.chatLoading"
                :disabled="!draftMessage.trim()"
              >
                Send
              </UButton>
            </form>
          </template>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useGardensStore } from '../../stores/gardens.js';
import { useSprint4Store } from '../../stores/sprint4.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const gardensStore = useGardensStore();
const sprint4Store = useSprint4Store();

const selectedGardenId = ref('NONE');
const draftMessage = ref('');

const gardenOptions = computed(() => [
  { label: 'General Mode (No Garden Selected)', value: 'NONE' },
  ...gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
]);

async function sendPrompt(text) {
  await sprint4Store.sendChatMessage({
    message: text,
    gardenId: selectedGardenId.value
  });
}

async function handleSend() {
  const msg = draftMessage.value.trim();
  if (!msg) return;
  draftMessage.value = '';
  await sendPrompt(msg);
}

onMounted(async () => {
  const gardens = await gardensStore.fetchGardens().catch(() => []);
  if (gardens.length > 0) {
    const primary = [...gardens].sort((a, b) => Number(a.id) - Number(b.id))[0];
    selectedGardenId.value = String(primary.id);
  }
});
</script>
