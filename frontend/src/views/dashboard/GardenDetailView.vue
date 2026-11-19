<template>
  <UDashboardPanel id="garden-detail">
    <template #header>
      <UDashboardNavbar :title="garden?.name || 'Garden Workspace'">
        <template #leading>
          <UDashboardSidebarCollapse />
          <UBreadcrumb :items="breadcrumbItems" class="hidden sm:flex" />
        </template>
        <template #right>
          <UColorModeButton />
          <UButton
            v-if="canManageGarden && garden"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-pencil"
            @click="openEditGardenModal"
          >
            Edit Garden
          </UButton>
          <UButton
            v-if="canManageGarden && garden"
            color="error"
            variant="soft"
            size="sm"
            icon="i-lucide-trash-2"
            @click="isDeleteGardenOpen = true"
          >
            Delete
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div class="sm:hidden">
          <UBreadcrumb :items="breadcrumbItems" />
        </div>

        <UAlert
          v-if="gardensStore.error || membersStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="gardensStore.error || membersStore.error"
        />

        <!-- Loading -->
        <UCard v-if="gardensStore.loading && !garden">
          <USkeleton class="mb-3 h-7 w-1/3" />
          <USkeleton class="mb-2 h-4 w-2/3" />
          <USkeleton class="h-6 w-1/2" />
        </UCard>

        <template v-else-if="garden">
          <!-- Garden Header Card -->
          <UCard>
            <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h2 class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {{ garden.name }}
                  </h2>
                  <UBadge :color="roleColor(currentRole)" variant="soft" size="sm">
                    {{ currentRole }}
                  </UBadge>
                </div>

                <p v-if="garden.description" class="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
                  {{ garden.description }}
                </p>

                <div class="flex flex-wrap gap-2 pt-1">
                  <UBadge color="neutral" variant="subtle" size="sm" icon="i-lucide-clock">
                    Timezone: {{ garden.timezone || 'UTC' }}
                  </UBadge>
                  <UBadge color="neutral" variant="subtle" size="sm" icon="i-lucide-ruler">
                    Area: {{ Number(garden.area_sq_m || 0).toFixed(1) }} m&sup2;
                  </UBadge>
                  <UBadge
                    v-if="garden.location_address"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-map-pin"
                  >
                    {{ garden.location_address }}
                  </UBadge>
                  <UBadge
                    v-if="garden.latitude !== null && garden.latitude !== undefined && garden.longitude !== null && garden.longitude !== undefined"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    icon="i-lucide-globe"
                  >
                    {{ Number(garden.latitude).toFixed(4) }}, {{ Number(garden.longitude).toFixed(4) }}
                  </UBadge>
                </div>
              </div>

              <div v-if="canEditZones" class="flex shrink-0 items-center gap-2">
                <UButton color="primary" icon="i-lucide-plus" @click="openZoneModal()">
                  Add Growing Zone
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Tabs: Zones, Members, Invitations, Devices [Soon], Activity [Soon] -->
          <UTabs
            v-model="activeTab"
            :items="tabItems"
            variant="link"
            class="w-full"
            @update:model-value="handleTabChange"
          >
            <!-- TAB 1: ZONES -->
            <template #zones>
              <div class="space-y-4 pt-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                      Microclimate Growing Zones
                    </h3>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400">
                      Configure soil chemistry, sunlight levels, and bed dimensions for each zone.
                    </p>
                  </div>
                  <UButton
                    v-if="canEditZones"
                    color="primary"
                    size="sm"
                    icon="i-lucide-plus"
                    @click="openZoneModal()"
                  >
                    Add Growing Zone
                  </UButton>
                </div>

                <UEmpty
                  v-if="gardensStore.zones.length === 0"
                  icon="i-lucide-sprout"
                  title="No growing zones defined yet"
                  description="Create an outdoor bed, raised bed, greenhouse, indoor pot collection, or hydroponic bay."
                  :actions="
                    canEditZones
                      ? [{ label: 'Add First Zone', color: 'primary', icon: 'i-lucide-plus', onClick: () => openZoneModal() }]
                      : []
                  "
                />

                <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <UCard
                    v-for="zone in gardensStore.zones"
                    :key="zone.id"
                    class="flex flex-col justify-between"
                  >
                    <div class="space-y-3">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <h4 class="text-base font-semibold text-zinc-900 dark:text-white">
                            {{ zone.name }}
                          </h4>
                          <div class="mt-1 flex flex-wrap items-center gap-1.5">
                            <UBadge
                              :color="zone.is_outdoor ? 'warning' : 'info'"
                              variant="subtle"
                              size="xs"
                              :icon="zone.is_outdoor ? 'i-lucide-sun' : 'i-lucide-home'"
                            >
                              {{ zone.is_outdoor ? 'Outdoor' : 'Indoor' }}
                            </UBadge>
                            <UBadge color="neutral" variant="outline" size="xs">
                              {{ formatEnum(zone.zone_type) }}
                            </UBadge>
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-300">
                        <div>
                          <span class="text-zinc-400">Soil:</span>
                          <strong class="ml-1 text-zinc-800 dark:text-zinc-100">{{ formatEnum(zone.soil_type) }}</strong>
                        </div>
                        <div>
                          <span class="text-zinc-400">Light:</span>
                          <strong class="ml-1 text-zinc-800 dark:text-zinc-100">{{ formatEnum(zone.sunlight_level) }}</strong>
                        </div>
                        <div>
                          <span class="text-zinc-400">Area:</span>
                          <strong class="ml-1 text-zinc-800 dark:text-zinc-100">{{ Number(zone.area_sq_m || 0).toFixed(2) }} m&sup2;</strong>
                        </div>
                        <div>
                          <span class="text-zinc-400">Crops:</span>
                          <strong class="ml-1 text-zinc-800 dark:text-zinc-100">{{ zone.plant_count || 0 }}</strong>
                        </div>
                      </div>

                      <p v-if="zone.dimensions_description" class="text-xs text-zinc-500 dark:text-zinc-400">
                        Dimensions: {{ zone.dimensions_description }}
                      </p>
                    </div>

                    <template #footer>
                      <div class="flex items-center justify-between gap-2">
                        <UButton
                          :to="`/dashboard/zones/${zone.id}/plants`"
                          size="xs"
                          color="primary"
                          variant="soft"
                          icon="i-lucide-sprout"
                        >
                          Manage Plants ({{ zone.plant_count || 0 }})
                        </UButton>

                        <div class="flex items-center gap-1">
                          <UButton
                            v-if="canEditZones"
                            size="xs"
                            color="neutral"
                            variant="ghost"
                            icon="i-lucide-pencil"
                            aria-label="Edit zone"
                            @click="openZoneModal(zone)"
                          />
                          <UButton
                            v-if="canManageGarden"
                            size="xs"
                            color="error"
                            variant="ghost"
                            icon="i-lucide-trash-2"
                            aria-label="Delete zone"
                            @click="confirmDeleteZone(zone)"
                          />
                        </div>
                      </div>
                    </template>
                  </UCard>
                </div>
              </div>
            </template>

            <!-- TAB 2: MEMBERS -->
            <template #members>
              <div class="space-y-4 pt-4">
                <UCard>
                  <template #header>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                          Garden Members &amp; Roles (F2)
                        </h3>
                        <p class="text-xs text-zinc-500 dark:text-zinc-400">
                          Owners manage members and zones; Family edits beds &amp; plants; Guests have read-only access.
                        </p>
                      </div>
                      <UButton
                        v-if="canManageGarden"
                        size="sm"
                        color="primary"
                        variant="soft"
                        icon="i-lucide-user-plus"
                        @click="activeTab = 'invitations'"
                      >
                        Invite Collaborator
                      </UButton>
                    </div>
                  </template>

                  <UTable :data="membersStore.members" :columns="memberColumns">
                    <template #name-cell="{ row }">
                      <div class="flex items-center gap-2.5">
                        <UAvatar
                          :alt="row.original.user?.name || `User #${row.original.user_id}`"
                          size="xs"
                          class="bg-emerald-600 text-white"
                        />
                        <div>
                          <div class="font-medium text-zinc-900 dark:text-white">
                            {{ row.original.user?.name || `User #${row.original.user_id}` }}
                          </div>
                          <div class="text-xs text-zinc-500 dark:text-zinc-400">
                            {{ row.original.user?.email || '—' }}
                          </div>
                        </div>
                      </div>
                    </template>

                    <template #role-cell="{ row }">
                      <USelect
                        v-if="canManageGarden"
                        :model-value="row.original.role"
                        :items="memberRoleOptions"
                        value-key="value"
                        size="xs"
                        class="w-32"
                        :disabled="membersStore.actionLoading"
                        @update:model-value="(val) => handleRoleChange(row.original.user_id, val)"
                      />
                      <UBadge v-else :color="roleColor(row.original.role)" variant="soft" size="xs">
                        {{ row.original.role }}
                      </UBadge>
                    </template>

                    <template #created_at-cell="{ row }">
                      <span class="text-xs text-zinc-500 dark:text-zinc-400">
                        {{ formatDate(row.original.created_at) }}
                      </span>
                    </template>

                    <template #actions-cell="{ row }">
                      <div class="flex justify-end">
                        <UButton
                          v-if="canManageGarden || (authStore.user && authStore.user.id === row.original.user_id)"
                          size="xs"
                          color="error"
                          variant="soft"
                          icon="i-lucide-user-minus"
                          :disabled="membersStore.actionLoading"
                          @click="handleRemoveMember(row.original.user_id)"
                        >
                          {{ authStore.user && authStore.user.id === row.original.user_id ? 'Leave' : 'Remove' }}
                        </UButton>
                      </div>
                    </template>
                  </UTable>
                </UCard>
              </div>
            </template>

            <!-- TAB 3: INVITATIONS -->
            <template #invitations>
              <div class="space-y-4 pt-4">
                <UAlert
                  v-if="!canManageGarden"
                  color="info"
                  variant="soft"
                  icon="i-lucide-lock"
                  title="Owner Permissions Required"
                  description="Only garden Owners can send, inspect, or revoke collaborator invitations."
                />

                <template v-else>
                  <UCard>
                    <template #header>
                      <div>
                        <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                          Invite Collaborator
                        </h3>
                        <p class="text-xs text-zinc-500 dark:text-zinc-400">
                          Generate a tokenized invitation link for Family co-gardeners or Guest viewers.
                        </p>
                      </div>
                    </template>

                    <form class="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end" @submit.prevent="handleSendInvite">
                      <UFormField label="Collaborator Email" required class="sm:col-span-5">
                        <UInput
                          v-model="inviteForm.email"
                          type="email"
                          icon="i-lucide-mail"
                          placeholder="collaborator@example.com"
                          class="w-full"
                          required
                        />
                      </UFormField>

                      <UFormField label="Role" required class="sm:col-span-3">
                        <USelect
                          v-model="inviteForm.role"
                          :items="inviteRoleOptions"
                          value-key="value"
                          class="w-full"
                        />
                      </UFormField>

                      <UFormField label="Expires (Days)" class="sm:col-span-2">
                        <UInput
                          v-model.number="inviteForm.expiresInDays"
                          type="number"
                          min="1"
                          max="30"
                          class="w-full"
                        />
                      </UFormField>

                      <div class="sm:col-span-2">
                        <UButton
                          type="submit"
                          color="primary"
                          block
                          icon="i-lucide-send"
                          :loading="membersStore.actionLoading"
                        >
                          Send Invite
                        </UButton>
                      </div>
                    </form>

                    <div
                      v-if="lastInviteUrl"
                      class="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:flex-row sm:items-center"
                    >
                      <div class="min-w-0 space-y-1">
                        <p class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          Shareable Invitation Link Created
                        </p>
                        <code class="block truncate text-xs text-zinc-700 dark:text-zinc-300">
                          {{ lastInviteUrl }}
                        </code>
                      </div>
                      <UButton
                        size="xs"
                        color="primary"
                        variant="soft"
                        icon="i-lucide-copy"
                        class="shrink-0"
                        @click="copyInviteUrl"
                      >
                        Copy Link
                      </UButton>
                    </div>
                  </UCard>

                  <UCard>
                    <template #header>
                      <div class="flex items-center justify-between">
                        <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
                          Invitations History
                        </h3>
                        <UBadge color="neutral" variant="subtle" size="xs">
                          {{ membersStore.pendingInvitations.length }} pending
                        </UBadge>
                      </div>
                    </template>

                    <UEmpty
                      v-if="membersStore.invitations.length === 0"
                      icon="i-lucide-mail"
                      title="No invitations sent yet"
                      description="Send an invitation above to add family members or temporary guests to this garden."
                    />

                    <UTable v-else :data="membersStore.invitations" :columns="invitationColumns">
                      <template #invitee_email-cell="{ row }">
                        <span class="font-medium text-zinc-900 dark:text-white">
                          {{ row.original.invitee_email || row.original.email }}
                        </span>
                      </template>

                      <template #role-cell="{ row }">
                        <UBadge :color="roleColor(row.original.role)" variant="soft" size="xs">
                          {{ row.original.role }}
                        </UBadge>
                      </template>

                      <template #status-cell="{ row }">
                        <UBadge
                          :color="inviteStatusColor(row.original.status)"
                          variant="subtle"
                          size="xs"
                        >
                          {{ row.original.status }}
                        </UBadge>
                      </template>

                      <template #expires_at-cell="{ row }">
                        <span class="text-xs text-zinc-500 dark:text-zinc-400">
                          {{ formatDate(row.original.expires_at) }}
                        </span>
                      </template>

                      <template #actions-cell="{ row }">
                        <div class="flex justify-end">
                          <UButton
                            v-if="row.original.status === 'PENDING'"
                            size="xs"
                            color="error"
                            variant="soft"
                            icon="i-lucide-x"
                            :disabled="membersStore.actionLoading"
                            @click="handleRevokeInvite(row.original.id)"
                          >
                            Cancel
                          </UButton>
                        </div>
                      </template>
                    </UTable>
                  </UCard>
                </template>
              </div>
            </template>

            <!-- TAB 4: DEVICES [SOON] -->
            <template #devices>
              <div class="pt-4">
                <UCard>
                  <div class="flex flex-col items-center space-y-4 py-8 text-center">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <UIcon name="i-lucide-cpu" class="size-7" />
                    </div>
                    <div class="space-y-1.5">
                      <UBadge color="primary" variant="subtle" size="sm" icon="i-lucide-clock">
                        F7 &amp; F9 &bull; Coming in Sprint 2&ndash;3
                      </UBadge>
                      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                        Connected IoT Sensors &amp; Irrigation Valves
                      </h3>
                      <p class="mx-auto max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
                        Pair ESP32 moisture probes, greenhouse climate nodes, and automated drip valves directly to your zones in Sprint 2.
                      </p>
                    </div>
                    <UButton color="primary" variant="soft" icon="i-lucide-sparkles" @click="open('F7')">
                      Preview Sensor Roadmap
                    </UButton>
                  </div>
                </UCard>
              </div>
            </template>

            <!-- TAB 5: ACTIVITY [SOON] -->
            <template #activity>
              <div class="pt-4">
                <UCard>
                  <div class="flex flex-col items-center space-y-4 py-8 text-center">
                    <div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <UIcon name="i-lucide-notebook-pen" class="size-7" />
                    </div>
                    <div class="space-y-1.5">
                      <UBadge color="primary" variant="subtle" size="sm" icon="i-lucide-clock">
                        F12 &bull; Coming in Sprint 4
                      </UBadge>
                      <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                        Garden Activity Feed &amp; Field Journal
                      </h3>
                      <p class="mx-auto max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
                        Track chronological watering events, team role changes, germination logs, and seasonal photos in Sprint 4.
                      </p>
                    </div>
                    <UButton color="primary" variant="soft" icon="i-lucide-sparkles" @click="open('F12')">
                      Preview Journal Roadmap
                    </UButton>
                  </div>
                </UCard>
              </div>
            </template>
          </UTabs>
        </template>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create / Edit Zone Modal -->
  <UModal
    v-model:open="isZoneModalOpen"
    :title="editingZoneId ? 'Edit Growing Zone' : 'Add Growing Zone'"
    description="Configure microclimate zone type, soil composition, sunlight exposure, and usable area."
  >
    <template #body>
      <form id="zone-form" class="space-y-4" @submit.prevent="handleSaveZone">
        <UAlert
          v-if="zoneModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="zoneModalError"
        />

        <UFormField label="Zone Name" required>
          <UInput
            v-model="zoneForm.name"
            placeholder="e.g. South Raised Bed"
            class="w-full"
            required
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Zone Type" required>
            <USelect
              v-model="zoneForm.zone_type"
              :items="zoneTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Environment" required>
            <USelect
              v-model="zoneForm.is_outdoor"
              :items="environmentOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Soil Type" required>
            <USelect
              v-model="zoneForm.soil_type"
              :items="soilTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sunlight Level" required>
            <USelect
              v-model="zoneForm.sunlight_level"
              :items="sunlightLevelOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Usable Bed Area (m²)" required>
            <UInput
              v-model.number="zoneForm.area_sq_m"
              type="number"
              step="0.1"
              min="0.1"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="Dimensions Note">
            <UInput
              v-model="zoneForm.dimensions_description"
              placeholder="e.g. 3m x 1.2m"
              class="w-full"
            />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isZoneModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="zone-form"
          color="primary"
          icon="i-lucide-check"
          :loading="gardensStore.actionLoading"
        >
          {{ editingZoneId ? 'Save Zone' : 'Create Zone' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete Zone Confirmation Modal -->
  <UModal
    v-model:open="isDeleteZoneOpen"
    title="Delete Growing Zone"
    :description="`Remove '${zoneToDelete?.name || ''}' and all crop allocations inside it?`"
  >
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isDeleteZoneOpen = false">
          Cancel
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          :loading="gardensStore.actionLoading"
          @click="handleDeleteZone"
        >
          Delete Zone
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Edit Garden Modal -->
  <UModal
    v-model:open="isEditGardenOpen"
    title="Edit Garden"
    description="Update garden details, coordinates, timezone, and total area."
  >
    <template #body>
      <form id="detail-edit-garden-form" class="space-y-4" @submit.prevent="handleUpdateGarden">
        <UAlert
          v-if="gardenModalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="gardenModalError"
        />
        <UFormField label="Garden Name" required>
          <UInput v-model="gardenForm.name" class="w-full" required />
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="gardenForm.description" :rows="2" class="w-full" />
        </UFormField>
        <UFormField label="Location Address">
          <UInput v-model="gardenForm.location_address" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Latitude">
            <UInput v-model="gardenForm.latitude" type="number" step="0.0001" min="-90" max="90" class="w-full" />
          </UFormField>
          <UFormField label="Longitude">
            <UInput v-model="gardenForm.longitude" type="number" step="0.0001" min="-180" max="180" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="IANA Timezone" required>
            <USelectMenu
              v-model="gardenForm.timezone"
              :items="timezoneOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Area (m²)">
            <UInput v-model.number="gardenForm.area_sq_m" type="number" step="0.1" min="0" class="w-full" />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isEditGardenOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="detail-edit-garden-form"
          color="primary"
          icon="i-lucide-check"
          :loading="gardensStore.actionLoading"
        >
          Update Garden
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete Garden Confirmation Modal -->
  <UModal
    v-model:open="isDeleteGardenOpen"
    title="Delete Garden"
    :description="`Permanently delete '${garden?.name || ''}' along with all zones, crops, and collaborator memberships?`"
  >
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isDeleteGardenOpen = false">
          Cancel
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          :loading="gardensStore.actionLoading"
          @click="handleDeleteGarden"
        >
          Delete Garden
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useMembersStore } from '../../stores/members.js';
import { useAuthStore } from '../../stores/auth.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const gardensStore = useGardensStore();
const membersStore = useMembersStore();
const authStore = useAuthStore();
const { open } = useComingSoon();

const activeTab = ref('zones');
const isZoneModalOpen = ref(false);
const editingZoneId = ref(null);
const zoneModalError = ref('');

const isDeleteZoneOpen = ref(false);
const zoneToDelete = ref(null);

const isEditGardenOpen = ref(false);
const gardenModalError = ref('');
const isDeleteGardenOpen = ref(false);
const lastInviteUrl = ref('');

const zoneForm = reactive({
  name: '',
  is_outdoor: true,
  zone_type: 'RAISED_BED',
  soil_type: 'LOAM',
  sunlight_level: 'FULL_SUN',
  area_sq_m: 4.0,
  dimensions_description: ''
});

const gardenForm = reactive({
  name: '',
  timezone: 'UTC',
  area_sq_m: 0,
  location_address: '',
  latitude: '',
  longitude: '',
  description: ''
});

const inviteForm = reactive({
  email: '',
  role: 'FAMILY',
  expiresInDays: 7
});

// Exact backend enum lists
const zoneTypeOptions = [
  { label: 'Outdoor Bed (OUTDOOR_BED)', value: 'OUTDOOR_BED' },
  { label: 'Raised Bed (RAISED_BED)', value: 'RAISED_BED' },
  { label: 'Greenhouse (GREENHOUSE)', value: 'GREENHOUSE' },
  { label: 'Indoor Pots (INDOOR_POTS)', value: 'INDOOR_POTS' },
  { label: 'Hydroponic (HYDROPONIC)', value: 'HYDROPONIC' }
];

const soilTypeOptions = [
  { label: 'Loam (LOAM)', value: 'LOAM' },
  { label: 'Clay (CLAY)', value: 'CLAY' },
  { label: 'Sandy (SANDY)', value: 'SANDY' },
  { label: 'Silt (SILT)', value: 'SILT' },
  { label: 'Peat (PEAT)', value: 'PEAT' },
  { label: 'Chalky (CHALKY)', value: 'CHALKY' }
];

const sunlightLevelOptions = [
  { label: 'Full Sun (6+ hrs)', value: 'FULL_SUN' },
  { label: 'Part Shade (3–6 hrs)', value: 'PART_SHADE' },
  { label: 'Full Shade (< 3 hrs)', value: 'FULL_SHADE' }
];

const environmentOptions = [
  { label: 'Outdoor (Rain-Aware)', value: true },
  { label: 'Indoor / Enclosed', value: false }
];

const memberRoleOptions = [
  { label: 'OWNER', value: 'OWNER' },
  { label: 'FAMILY', value: 'FAMILY' },
  { label: 'GUEST', value: 'GUEST' }
];

const inviteRoleOptions = [
  { label: 'FAMILY (Co-Gardener)', value: 'FAMILY' },
  { label: 'GUEST (Read-Only)', value: 'GUEST' }
];

const commonTimezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dhaka',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const timezoneOptions = computed(() => {
  const list = [...commonTimezones];
  if (gardenForm.timezone && !list.includes(gardenForm.timezone)) {
    list.unshift(gardenForm.timezone);
  }
  return list.map((tz) => ({ label: tz, value: tz }));
});

const garden = computed(() => gardensStore.activeGarden);
const currentRole = computed(() => garden.value?.role || membersStore.currentUserRole || 'GUEST');
const canManageGarden = computed(() => currentRole.value === 'OWNER' || currentRole.value === 'ADMIN' || authStore.isAdmin);
const canEditZones = computed(() => ['OWNER', 'FAMILY', 'ADMIN'].includes(currentRole.value) || authStore.isAdmin);

const breadcrumbItems = computed(() => [
  { label: 'Gardens', icon: 'i-lucide-trees', to: '/dashboard/gardens' },
  { label: garden.value?.name || 'Garden Workspace' }
]);

const tabItems = computed(() => [
  {
    label: 'Zones',
    value: 'zones',
    slot: 'zones',
    icon: 'i-lucide-sprout',
    badge: String(gardensStore.zones.length)
  },
  {
    label: 'Members',
    value: 'members',
    slot: 'members',
    icon: 'i-lucide-users',
    badge: String(membersStore.members.length)
  },
  {
    label: 'Invitations',
    value: 'invitations',
    slot: 'invitations',
    icon: 'i-lucide-mail',
    badge: membersStore.pendingInvitations.length > 0 ? String(membersStore.pendingInvitations.length) : undefined
  },
  {
    label: 'Devices',
    value: 'devices',
    slot: 'devices',
    icon: 'i-lucide-cpu',
    badge: { label: 'Soon', color: 'primary', variant: 'subtle' }
  },
  {
    label: 'Activity',
    value: 'activity',
    slot: 'activity',
    icon: 'i-lucide-notebook-pen',
    badge: { label: 'Soon', color: 'primary', variant: 'subtle' }
  }
]);

const memberColumns = [
  { id: 'name', header: 'Collaborator' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'created_at', header: 'Joined' },
  { id: 'actions', header: '' }
];

const invitationColumns = [
  { accessorKey: 'invitee_email', header: 'Invitee Email' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'expires_at', header: 'Expires' },
  { id: 'actions', header: '' }
];

function roleColor(role) {
  if (role === 'OWNER') return 'success';
  if (role === 'FAMILY') return 'primary';
  if (role === 'ADMIN') return 'info';
  return 'warning';
}

function inviteStatusColor(status) {
  if (status === 'PENDING') return 'primary';
  if (status === 'ACCEPTED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELED') return 'error';
  return 'neutral';
}

function formatEnum(val) {
  if (!val) return '—';
  return String(val)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function loadGardenData(gardenId) {
  gardensStore.clearMessages();
  membersStore.clearMessages();
  lastInviteUrl.value = '';
  try {
    const data = await gardensStore.fetchGardenDetail(gardenId);
    if (data.members) {
      membersStore.members = data.members;
      membersStore.activeGardenId = Number(gardenId);
      if (data.garden?.role) {
        membersStore.currentUserRole = data.garden.role;
      }
    }
    if (canManageGarden.value) {
      await membersStore.fetchInvitations(gardenId).catch(() => {});
    } else {
      membersStore.invitations = [];
    }
  } catch {
    // Error handled in store
  }
}

async function handleTabChange(val) {
  if (!garden.value) return;
  if (val === 'members') {
    await membersStore.fetchMembers(garden.value.id).catch(() => {});
  } else if (val === 'invitations' && canManageGarden.value) {
    await membersStore.fetchInvitations(garden.value.id).catch(() => {});
  }
}

function openZoneModal(zone = null) {
  zoneModalError.value = '';
  if (zone) {
    editingZoneId.value = zone.id;
    zoneForm.name = zone.name || '';
    zoneForm.is_outdoor = Boolean(zone.is_outdoor);
    zoneForm.zone_type = zone.zone_type || 'RAISED_BED';
    zoneForm.soil_type = zone.soil_type || 'LOAM';
    zoneForm.sunlight_level = zone.sunlight_level || 'FULL_SUN';
    zoneForm.area_sq_m = Number(zone.area_sq_m || 4.0);
    zoneForm.dimensions_description = zone.dimensions_description || '';
  } else {
    editingZoneId.value = null;
    zoneForm.name = '';
    zoneForm.is_outdoor = true;
    zoneForm.zone_type = 'RAISED_BED';
    zoneForm.soil_type = 'LOAM';
    zoneForm.sunlight_level = 'FULL_SUN';
    zoneForm.area_sq_m = 4.0;
    zoneForm.dimensions_description = '';
  }
  isZoneModalOpen.value = true;
}

async function handleSaveZone() {
  zoneModalError.value = '';
  if (!zoneForm.name.trim()) {
    zoneModalError.value = 'Zone name is required.';
    return;
  }

  const payload = {
    name: zoneForm.name.trim(),
    is_outdoor: Boolean(zoneForm.is_outdoor),
    zone_type: zoneForm.zone_type,
    soil_type: zoneForm.soil_type,
    sunlight_level: zoneForm.sunlight_level,
    area_sq_m: Number(zoneForm.area_sq_m || 1.0),
    dimensions_description: zoneForm.dimensions_description.trim() || null
  };

  try {
    if (editingZoneId.value) {
      await gardensStore.updateZone(editingZoneId.value, payload);
      toast.add({
        title: 'Zone updated',
        description: `"${payload.name}" saved.`,
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    } else {
      await gardensStore.createZone(garden.value.id, payload);
      toast.add({
        title: 'Zone created',
        description: `"${payload.name}" added to ${garden.value.name}.`,
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    }
    isZoneModalOpen.value = false;
  } catch (err) {
    zoneModalError.value = gardensStore.error || err.message || 'Failed to save zone.';
  }
}

function confirmDeleteZone(zone) {
  zoneToDelete.value = zone;
  isDeleteZoneOpen.value = true;
}

async function handleDeleteZone() {
  if (!zoneToDelete.value) return;
  const target = zoneToDelete.value;
  try {
    await gardensStore.deleteZone(target.id);
    isDeleteZoneOpen.value = false;
    zoneToDelete.value = null;
    toast.add({
      title: 'Zone removed',
      description: `"${target.name}" has been deleted.`,
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Unable to delete zone',
      description: gardensStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

function openEditGardenModal() {
  if (!garden.value) return;
  gardenModalError.value = '';
  gardenForm.name = garden.value.name || '';
  gardenForm.timezone = garden.value.timezone || 'UTC';
  gardenForm.area_sq_m = Number(garden.value.area_sq_m || 0);
  gardenForm.location_address = garden.value.location_address || '';
  gardenForm.latitude = garden.value.latitude !== null && garden.value.latitude !== undefined ? String(garden.value.latitude) : '';
  gardenForm.longitude = garden.value.longitude !== null && garden.value.longitude !== undefined ? String(garden.value.longitude) : '';
  gardenForm.description = garden.value.description || '';
  isEditGardenOpen.value = true;
}

async function handleUpdateGarden() {
  gardenModalError.value = '';
  if (!gardenForm.name.trim()) {
    gardenModalError.value = 'Garden name is required.';
    return;
  }
  const latVal = gardenForm.latitude === '' || gardenForm.latitude === null ? null : Number(gardenForm.latitude);
  const lngVal = gardenForm.longitude === '' || gardenForm.longitude === null ? null : Number(gardenForm.longitude);
  if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
    gardenModalError.value = 'Latitude must be between -90 and 90.';
    return;
  }
  if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
    gardenModalError.value = 'Longitude must be between -180 and 180.';
    return;
  }
  try {
    await gardensStore.updateGarden(garden.value.id, {
      name: gardenForm.name.trim(),
      timezone: gardenForm.timezone,
      area_sq_m: Number(gardenForm.area_sq_m || 0),
      location_address: gardenForm.location_address.trim() || null,
      latitude: latVal,
      longitude: lngVal,
      description: gardenForm.description.trim() || null
    });
    isEditGardenOpen.value = false;
    toast.add({
      title: 'Garden updated',
      description: 'Garden settings saved.',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    gardenModalError.value = gardensStore.error || err.message || 'Failed to update garden.';
  }
}

async function handleDeleteGarden() {
  try {
    await gardensStore.deleteGarden(garden.value.id);
    isDeleteGardenOpen.value = false;
    toast.add({
      title: 'Garden deleted',
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
    router.push('/dashboard/gardens');
  } catch (err) {
    toast.add({
      title: 'Delete failed',
      description: gardensStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleRoleChange(userId, newRole) {
  try {
    await membersStore.updateMemberRole(garden.value.id, userId, newRole);
    toast.add({
      title: 'Role updated',
      description: `Member role updated to ${newRole}.`,
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Role update blocked',
      description: membersStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleRemoveMember(userId) {
  try {
    await membersStore.removeMember(garden.value.id, userId);
    toast.add({
      title: 'Member removed',
      description: membersStore.successMessage || 'Collaborator removed from garden.',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
    if (authStore.user && authStore.user.id === userId) {
      router.push('/dashboard/gardens');
    }
  } catch (err) {
    toast.add({
      title: 'Unable to remove member',
      description: membersStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleSendInvite() {
  try {
    const res = await membersStore.createInvitation(garden.value.id, { ...inviteForm });
    lastInviteUrl.value = res?.invite_url || `/invitations/accept?token=${res?.token}`;
    toast.add({
      title: 'Invitation sent',
      description: `Invitation link generated for ${inviteForm.email}.`,
      icon: 'i-lucide-mail',
      color: 'success'
    });
    inviteForm.email = '';
  } catch (err) {
    toast.add({
      title: 'Invitation failed',
      description: membersStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function handleRevokeInvite(inviteId) {
  try {
    await membersStore.revokeInvitation(garden.value.id, inviteId);
    toast.add({
      title: 'Invitation canceled',
      icon: 'i-lucide-check-circle-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Revoke failed',
      description: membersStore.error || err.message,
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

async function copyInviteUrl() {
  if (!lastInviteUrl.value || typeof navigator === 'undefined' || !navigator.clipboard) return;
  const fullUrl = lastInviteUrl.value.startsWith('http')
    ? lastInviteUrl.value
    : `${window.location.origin}${lastInviteUrl.value}`;
  try {
    await navigator.clipboard.writeText(fullUrl);
    toast.add({
      title: 'Link copied to clipboard',
      icon: 'i-lucide-clipboard-check',
      color: 'success'
    });
  } catch {
    // ignore clipboard failures
  }
}

onMounted(() => {
  loadGardenData(route.params.id);
});

watch(
  () => route.params.id,
  (newId) => {
    if (newId) loadGardenData(newId);
  }
);
</script>
