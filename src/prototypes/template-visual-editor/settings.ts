import { reactive, watch } from 'vue'

import { SUGGESTION_TYPES, type SuggestionTypeId } from './engine/checks'

/**
 * Mock Suggestion Mode settings, edited from the header's user menu. Persisted
 * per browser (a convenience only — the prototype works without storage).
 */
export type EditCountBucket = 'new' | 'intermediate' | 'experienced'

export interface SuggestionSettings {
  /** `null` = every detected suggestion, as production does (99+ cap in the badge only). */
  limit: number | null
  types: Record<SuggestionTypeId, boolean>
  /**
   * First time in Suggestion Mode: production starts the desktop toggle off
   * until the editor turns it on once (`visualeditor-editcheck-suggestions-toggle`).
   * Mobile always starts with suggestions visible.
   */
  firstTime: boolean
  /** Desktop toggle state remembered from the last session (production user option). */
  rememberedToggle: boolean
  /**
   * Editor's edit count: ≤10 shows the publish-path card after the first
   * completed suggestion (`showPublishPath`); ≥1000 unlocks "Add a link".
   */
  editCount: EditCountBucket
}

const STORAGE_KEY = 'protowiki:template-visual-editor:settings:v1'

function defaults(): SuggestionSettings {
  return {
    limit: null,
    types: Object.fromEntries(SUGGESTION_TYPES.map((t) => [t.id, true])) as Record<SuggestionTypeId, boolean>,
    firstTime: false,
    rememberedToggle: true,
    editCount: 'experienced',
  }
}

function load(): SuggestionSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw)
    return {
      ...base,
      ...saved,
      types: { ...base.types, ...(saved?.types ?? {}) },
    }
  } catch {
    return base
  }
}

export const suggestionSettings = reactive<SuggestionSettings>(load())

watch(
  suggestionSettings,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* storage unavailable */
    }
  },
  { deep: true },
)

export function resetSuggestionSettings() {
  Object.assign(suggestionSettings, defaults())
}

export const MIN_LIMIT = 5
export const MAX_LIMIT = 99

/**
 * Applies the type filter and the custom count. A custom count keeps the
 * suggestions spread through the article (evenly sampled, document order kept).
 */
export function applySuggestionSettings<T extends { type: string }>(items: T[]): T[] {
  const enabled = items.filter((item) => suggestionSettings.types[item.type as SuggestionTypeId] !== false)
  const limit = suggestionSettings.limit
  if (!limit || enabled.length <= limit) return enabled
  const picked: T[] = []
  for (let i = 0; i < limit; i++) picked.push(enabled[Math.floor((i * enabled.length) / limit)])
  return picked
}
