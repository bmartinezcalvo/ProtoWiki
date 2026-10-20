<script setup lang="ts">
/**
 * "Mock Suggestion Mode settings" — opened from the header's user menu, in
 * the same style as ProtoWiki's mock user settings.
 */
import { computed } from 'vue'
import { CdxButton, CdxCheckbox, CdxField, CdxRadio, CdxSelect, CdxTextInput, CdxToggleSwitch } from '@wikimedia/codex'

import { SUGGESTION_TYPES } from './engine/checks'
import { MAX_LIMIT, MIN_LIMIT, resetSuggestionSettings, suggestionSettings, type EditCountBucket } from './settings'

import '@/components/settings/settingsPanel.css'

const props = defineProps<{
  articleTitle?: string
  /** Suggestions detected in the current article (before the settings filter). */
  detectedCount?: number | null
  loading?: boolean
}>()

const emit = defineEmits<{ loadAnother: [] }>()

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

const editCountItems: { value: EditCountBucket; label: string }[] = [
  { value: 'new', label: '10 edits or fewer' },
  { value: 'intermediate', label: '11–999 edits' },
  { value: 'experienced', label: '1,000 edits or more' },
]

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
</script>

<template>
  <div class="settings-panel suggestion-settings-panel">
    <div class="settings-panel__intro">
      <h2 class="settings-panel__title">Mock Suggestion Mode settings</h2>
      <p class="settings-panel__description">
        Preview Suggestion Mode with different articles, suggestion types and editors.
      </p>
    </div>

    <CdxField v-if="articleTitle">
      <template #label>Article</template>
      <template #help-text>
        <template v-if="detectedCount != null">{{ detectedCount }} suggestions found in this article.</template>
      </template>
      <div class="settings-panel__row">
        <span class="suggestion-settings-panel__article">{{ articleTitle }}</span>
        <CdxButton weight="quiet" :disabled="loading" @click="emit('loadAnother')">Load another</CdxButton>
      </div>
    </CdxField>

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
        This article only has {{ detectedCount }}. Load another article to see {{ suggestionSettings.limit }}.
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
      <template #label>Editor</template>
      <template #help-text>
        10 edits or fewer: the first completed suggestion offers to publish. "Add a link" needs 1,000 edits or more.
      </template>
      <CdxSelect v-model:selected="suggestionSettings.editCount" :menu-items="editCountItems" />
    </CdxField>

    <CdxField>
      <CdxToggleSwitch v-model="suggestionSettings.firstTime">First time using Suggestion Mode</CdxToggleSwitch>
      <template #help-text>
        On desktop, suggestions start turned off until the editor turns them on. On mobile they're always on.
      </template>
    </CdxField>

    <div>
      <CdxButton weight="quiet" action="destructive" @click="resetSuggestionSettings">Reset settings</CdxButton>
    </div>
  </div>
</template>

<style scoped>
/* Minerva: the popover is a bottom sheet — use its full width. */
:global(.cdx-popover--bottom-sheet) .suggestion-settings-panel {
  max-width: none;
  width: 100%;
}

.suggestion-settings-panel {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  padding-inline-end: var(--spacing-25, 4px);
}

.suggestion-settings-panel__article {
  flex: 1;
  min-width: 0;
  font-weight: var(--font-weight-bold, 700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggestion-settings-panel__types {
  padding-inline-start: var(--spacing-150, 24px);
}

.suggestion-settings-panel :deep(.cdx-select-vue) {
  width: 100%;
}
</style>
