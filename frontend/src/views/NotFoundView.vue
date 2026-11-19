<template>
  <div class="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
    <UCard class="w-full max-w-lg text-center shadow-sm">
      <div class="flex flex-col items-center space-y-4 py-4">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <UIcon name="i-lucide-compass" class="size-8" />
        </div>

        <UBadge color="neutral" variant="subtle" size="sm">
          404 &bull; Route Not Found
        </UBadge>

        <h1 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          This garden path doesn&rsquo;t exist
        </h1>

        <p class="max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          The page you requested may have moved or been renamed. Head back to the home page or jump into your SmartGarden workspace.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <UButton to="/" color="neutral" variant="outline" icon="i-lucide-home">
            Back to Home
          </UButton>
          <UButton
            to="/dashboard"
            color="primary"
            icon="i-lucide-layout-dashboard"
          >
            Open Dashboard
          </UButton>
          <UButton
            v-if="!authStore.isAuthenticated"
            to="/catalog"
            color="neutral"
            variant="ghost"
            icon="i-lucide-book-open"
          >
            Browse Plant Catalog
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth.js';

const authStore = useAuthStore();
</script>
