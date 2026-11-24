<template>
  <UContainer class="py-12">
    <div class="mx-auto max-w-4xl space-y-8">
      <div class="space-y-2">
        <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-file-text">
          Developer &amp; Hardware Documentation
        </UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Documentation &amp; Guides
        </h1>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          Connect ESP32 soil sensors, automate irrigation rules with scoped API tokens, and integrate Home Assistant or MQTT bridges.
        </p>
      </div>

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
            1. Device Telemetry Ingestion (`X-Device-Key` / `sg_live_`)
          </h2>
        </template>
        <pre class="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-emerald-300"><code>curl -X POST https://smartgarden-backend-6ie1.onrender.com/api/sensors/ingest \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: sg_live_your_device_key" \
  -d '{"soil_moisture": 54.2, "temperature": 22.8, "humidity": 61.5, "light_lux": 24800}'</code></pre>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
            2. Scoped Personal Access Tokens (`sg_pat_`)
          </h2>
        </template>
        <p class="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
          Generate a scoped token in Settings &rarr; Developer API Keys, then pass it as a standard Bearer header:
        </p>
        <pre class="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-sky-300"><code>curl https://smartgarden-backend-6ie1.onrender.com/api/gardens \
  -H "Authorization: Bearer sg_pat_your_personal_access_token"</code></pre>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-zinc-900 dark:text-white">
            3. MQTT Topic Bridge Format
          </h2>
        </template>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          Publish JSON telemetry to topic <code class="font-mono text-emerald-600">smartgarden/&lt;deviceUid&gt;/telemetry</code> containing <code class="font-mono">device_key</code>, <code class="font-mono">soil_moisture</code>, <code class="font-mono">temperature</code>, <code class="font-mono">humidity</code>, and <code class="font-mono">light_lux</code>. See <code class="font-mono">firmware/esp32_smartgarden_node/esp32_smartgarden_node.ino</code> for a full wiring &amp; WiFi HTTPS sketch.
        </p>
      </UCard>
    </div>
  </UContainer>
</template>
