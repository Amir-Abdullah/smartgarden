<template>
  <UContainer class="py-12 lg:py-16">
    <div class="mx-auto max-w-5xl space-y-12">
      <div class="mx-auto max-w-2xl text-center">
        <UBadge color="primary" variant="subtle" class="mb-3">Contact &amp; Support</UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          Get in Touch with SmartGarden
        </h1>
        <p class="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          Have a question about companion data, community garden onboarding, or upcoming sensor integrations? Send us a note below.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <!-- Contact Info Cards -->
        <div class="space-y-4 lg:col-span-5">
          <UCard v-for="card in contactCards" :key="card.title">
            <div class="flex items-start gap-4">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UIcon :name="card.icon" class="size-5" />
              </div>
              <div>
                <h3 class="font-semibold text-zinc-900 dark:text-white">{{ card.title }}</h3>
                <p class="mt-0.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {{ card.detail }}
                </p>
                <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {{ card.description }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Client-side Validated Contact Form -->
        <UCard class="lg:col-span-7">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Send a Message</h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400">
                  Client-side validated preview form
                </p>
              </div>
              <UBadge color="primary" variant="subtle" size="xs">Preview</UBadge>
            </div>
          </template>

          <UForm
            :state="formState"
            :validate="validateForm"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField label="Full Name" name="name" required>
              <UInput
                v-model="formState.name"
                placeholder="Elena Vance"
                icon="i-lucide-user"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Email Address" name="email" required>
              <UInput
                v-model="formState.email"
                type="email"
                placeholder="you@example.com"
                icon="i-lucide-mail"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Topic" name="topic" required>
              <USelect
                v-model="formState.topic"
                :items="topicItems"
                value-key="value"
                placeholder="Select a topic"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Message" name="message" required>
              <UTextarea
                v-model="formState.message"
                placeholder="Tell us about your garden setup, question, or feature request..."
                :rows="4"
                class="w-full"
              />
            </UFormField>

            <div class="flex items-center justify-end gap-3 pt-2">
              <UButton type="button" color="neutral" variant="ghost" @click="resetForm">
                Clear
              </UButton>
              <UButton type="submit" color="primary" icon="i-lucide-send">
                Send Message
              </UButton>
            </div>
          </UForm>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>

<script setup>
import { reactive } from 'vue';
import { useToast } from '@nuxt/ui/composables';

const toast = useToast();

const formState = reactive({
  name: '',
  email: '',
  topic: 'general',
  message: ''
});

const topicItems = [
  { label: 'General Question', value: 'general' },
  { label: 'Plant Catalog & Species Request', value: 'catalog' },
  { label: 'Community Garden Partnership', value: 'community' },
  { label: 'IoT Hardware & Sensors (Sprint 2+)', value: 'hardware' },
  { label: 'Bug Report or Feedback', value: 'bug' }
];

const contactCards = [
  {
    icon: 'i-lucide-mail',
    title: 'Email Support',
    detail: 'hello@smartgarden.app',
    description: 'For general inquiries, partnerships, and catalog species requests.'
  },
  {
    icon: 'i-lucide-sprout',
    title: 'Community Gardens',
    detail: 'coop@smartgarden.app',
    description: 'Dedicated onboarding for shared plots, schools, and urban farms.'
  },
  {
    icon: 'i-lucide-cpu',
    title: 'Hardware & API Beta',
    detail: 'Sprint 2–3 Pilot',
    description: 'Early access for ESP32, LoRaWAN, and Home Assistant bridge testers.'
  }
];

function validateForm(state) {
  const errors = [];
  if (!state.name || !state.name.trim()) {
    errors.push({ name: 'name', message: 'Please enter your name.' });
  }
  if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) {
    errors.push({ name: 'email', message: 'Please enter a valid email address.' });
  }
  if (!state.topic) {
    errors.push({ name: 'topic', message: 'Please select a topic.' });
  }
  if (!state.message || state.message.trim().length < 10) {
    errors.push({ name: 'message', message: 'Message must be at least 10 characters.' });
  }
  return errors;
}

function resetForm() {
  formState.name = '';
  formState.email = '';
  formState.topic = 'general';
  formState.message = '';
}

function onSubmit() {
  toast.add({
    title: 'Message received (Preview)',
    description: 'Messaging backend coming in a later sprint',
    icon: 'i-lucide-sparkles',
    color: 'primary'
  });
  resetForm();
}
</script>
