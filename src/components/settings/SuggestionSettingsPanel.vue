<script setup lang="ts">
/**
 * "Suggestion Mode settings" — gallery toolbar or VE main menu, same style as
 * ProtoWiki's other mock settings panels.
 */
import { computed } from 'vue'
import { CdxButton, CdxCheckbox, CdxField, CdxRadio, CdxTextInput, CdxToggleSwitch } from '@wikimedia/codex'

import { SUGGESTION_TYPES } from '@/components/visual-editor/engine/checks'
import {
  MAX_LIMIT,
  MIN_LIMIT,
  resetSuggestionSettings,
  suggestionSettings,
} from '@/components/visual-editor/settings'

import './settingsPanel.css'

const props = defineProps<{
  /** Suggestions detected in the current article (before the settings filter). */
  detectedCount?: number | null
}>()

const limitMode = computed({
  get: () => (suggestionSettings.limit === null ? 'all' : 'custom'),
  set: (mode: string) => {
    suggestionSettings.limit = mode === 'all' ? null : (suggestionSettings.limit ?? 10)
  },
})

const limitText = computed({
  get: () => String(suggestionSettings.limit ?? ''),
  set: (value: string) => {
    const n = Number.parseInt(value, 10)
    if (Number.isFinite(n)) suggestionSettings.limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, n))
  },
})

const allTypesOn = computed(() => SUGGESTION_TYPES.every((t) => suggestionSettings.types[t.id]))
function setAllTypes(on: boolean) {
  for (const t of SUGGESTION_TYPES) suggestionSettings.types[t.id] = on
}

const shortfall = computed(
  () =>
    suggestionSettings.limit !== null &&
    props.detectedCount != null &&
    props.detectedCount < suggestionSettings.limit,
)

/** Inverse of `suggestionSettings.firstTime` (production user option after first enable). */
const hasTurnedOnSuggestionMode = computed({
  get: () => !suggestionSettings.firstTime,
  set: (on: boolean) => {
    suggestionSettings.firstTime = !on
  },
})
</script>

<template>
  <div class="settings-panel suggestion-settings-panel">
    <div class="settings-panel__intro">
      <h2 class="settings-panel__title">Suggestion Mode settings</h2>
      <p class="settings-panel__description">
        Configure how suggestions appear within the Visual Editor.
      </p>
    </div>

    <CdxField is-fieldset>
      <template #label>Number of suggestions</template>
      <CdxRadio v-model="limitMode" name="suggestion-limit" input-value="all">
        All suggestions found (as in production)
      </CdxRadio>
      <CdxRadio v-model="limitMode" name="suggestion-limit" input-value="custom">
        Custom
        <template v-if="limitMode === 'custom'" #custom-input>
          <CdxTextInput v-model="limitText" input-type="number" :min="MIN_LIMIT" :max="MAX_LIMIT" aria-label="Number of suggestions" />
        </template>
      </CdxRadio>
      <template v-if="shortfall" #help-text>
        This article only has {{ detectedCount }} suggestions.
      </template>
    </CdxField>

    <CdxField is-fieldset>
      <template #label>Suggestion types</template>
      <CdxCheckbox :model-value="allTypesOn" @update:model-value="setAllTypes">All types</CdxCheckbox>
      <div class="suggestion-settings-panel__types">
        <CdxCheckbox v-for="type in SUGGESTION_TYPES" :key="type.id" v-model="suggestionSettings.types[type.id]">
          {{ type.label }}
        </CdxCheckbox>
      </div>
    </CdxField>

    <CdxField>
      <CdxToggleSwitch v-model="hasTurnedOnSuggestionMode">User has turned on Suggestion Mode</CdxToggleSwitch>
      <template #help-text>
        On desktop, suggestions start turned off until the editor turns them on. On mobile they're always on.
      </template>
    </CdxField>

    <div>
      <CdxButton @click="resetSuggestionSettings">Reset settings</CdxButton>
    </div>
  </div>
</template>

<style scoped>
/* Minerva: the popover is a bottom sheet — use its full width. */
:global(.cdx-popover--bottom-sheet) .suggestion-settings-panel {
  max-width: none;
  width: 100%;
}

.suggestion-settings-panel__types {
  padding-inline-start: var(--spacing-150, 24px);
}

</style>
