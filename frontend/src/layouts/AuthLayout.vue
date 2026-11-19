<template>
  <div class="grid min-h-screen grid-cols-1 bg-zinc-50 dark:bg-zinc-950 lg:grid-cols-2">
    <!-- Left Brand Panel (hidden on mobile) -->
    <aside class="brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
      <div class="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-400/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-teal-300/15 blur-3xl" />

      <div class="relative z-10">
        <AppLogo light show-tagline size="lg" />
      </div>

      <div class="relative z-10 my-auto max-w-md space-y-8 py-12">
        <div class="space-y-4">
          <UBadge color="neutral" variant="soft" class="bg-white/15 text-white ring-1 ring-white/25">
            Precision Microclimate & Companion Platform
          </UBadge>
          <h1 class="text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
            Cultivate thriving beds without guesswork.
          </h1>
          <p class="text-base leading-relaxed text-emerald-50/90">
            Plan raised beds, prevent overcrowding with real spatial math, and pair synergistic crops alongside your family or team.
          </p>
        </div>

        <ul class="space-y-3.5 text-sm text-emerald-50">
          <li class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-5 shrink-0 text-emerald-200" />
            <span><strong>32+ botanical species</strong> with ideal moisture, temperature, and spacing profiles.</span>
          </li>
          <li class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-5 shrink-0 text-emerald-200" />
            <span><strong>Live bed capacity gauge</strong> catching overcrowding before you transplant.</span>
          </li>
          <li class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-5 shrink-0 text-emerald-200" />
            <span><strong>Companion synergy analyzer</strong> highlighting helpful pairings and conflicts.</span>
          </li>
          <li class="flex items-start gap-3">
            <UIcon name="i-lucide-check-circle-2" class="mt-0.5 size-5 shrink-0 text-emerald-200" />
            <span><strong>Role-based collaboration</strong> for Owners, Family members, and Guests.</span>
          </li>
        </ul>
      </div>

      <div class="relative z-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
        <p class="text-sm leading-relaxed text-emerald-50">
          &ldquo;We cut our raised-bed crowding conflicts to zero in the first season. Having tomato, basil, and marigold companions checked automatically is a lifesaver.&rdquo;
        </p>
        <div class="mt-4 flex items-center gap-3">
          <UAvatar alt="Maya Lin" size="sm" class="bg-emerald-200 text-emerald-950" />
          <div class="text-xs">
            <p class="font-semibold text-white">Maya Lin</p>
            <p class="text-emerald-100/80">Urban Rooftop Grower &bull; Zone 8b</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right Auth Card Panel -->
    <main class="flex flex-col justify-between p-6 sm:p-10">
      <div class="flex items-center justify-between gap-4">
        <div class="lg:hidden">
          <AppLogo size="sm" />
        </div>
        <div class="ml-auto flex items-center gap-2">
          <UButton
            to="/"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-arrow-left"
          >
            Back to home
          </UButton>
          <UColorModeButton />
        </div>
      </div>

      <div class="mx-auto my-auto w-full max-w-md py-8">
        <UCard class="shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-800">
          <slot>
            <RouterView />
          </slot>
        </UCard>
      </div>

      <p class="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Secured with JWT authentication and bcrypt encryption.
      </p>
    </main>
  </div>
</template>

<script setup>
import AppLogo from '../components/AppLogo.vue';
</script>
