import { reactive, watch } from 'vue'

import { protowikiConfig } from '@/appearance'
import { isConfigMockEditorEditCount } from '@/config'

import { SUGGESTION_TYPES, type SuggestionTypeId } from './engine/checks'

/**
 * Suggestion mode settings, edited from the gallery toolbar or VE main menu.
 * Persisted
 * per browser (a convenience only — the prototype works without storage).
 */
export interface SuggestionSettings {
  /** Master switch: suggestion detection, Edit Check, and the toolbar lightbulb in the VE prototype. */
  enabled: boolean
  /** `null` = every detected suggestion, as production does (99+ cap in the badge only). */
  limit: number | null
  types: Record<SuggestionTypeId, boolean>
  /**
   * First time in Suggestion Mode. Exposed as “First time using suggestion mode”
   * in Suggestion mode settings. Suggestions start on regardless (desktop and mobile).
   */
  firstTime: boolean
  /** Desktop toggle state remembered from the last session (production user option). */
  rememberedToggle: boolean
  /** "Don't show this again" ticked in "Before you go" (discoverability). */
  hideBeforeYouGo: boolean
  /**
   * Discoverability experiment. `1`: lightbulb badge on the read-mode Edit
   * buttons. `2`: no read-mode badge.
   */
  experiment: 1 | 2
}

/**
 * Discoverability experiment this branch is built for. Mock settings are
 * hidden here, so the experiment, "First time using suggestion mode" and the
 * suggestion types / count always use these defaults (stored values ignored).
 */
const EXPERIMENT: SuggestionSettings['experiment'] = 2

/** Experimental suggestion types: off by default on this branch. */
const EXPERIMENTAL_TYPES = new Set<SuggestionTypeId>([
  'fakeHeading',
  'leadLength',
  'redirect',
  'requiredTemplateParam',
  'llmSuggestion',
])

const STORAGE_KEY = 'protowiki:template-visual-editor:settings:v2'

function defaults(): SuggestionSettings {
  return {
    enabled: true,
    limit: null,
    types: Object.fromEntries(
      SUGGESTION_TYPES.map((t) => [t.id, !EXPERIMENTAL_TYPES.has(t.id)]),
    ) as Record<SuggestionTypeId, boolean>,
    firstTime: true,
    rememberedToggle: true,
    hideBeforeYouGo: false,
    experiment: EXPERIMENT,
  }
}

function load(): SuggestionSettings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw)
    if (isConfigMockEditorEditCount(saved?.editCount)) {
      protowikiConfig.value = {
        ...protowikiConfig.value,
        mockEditorEditCountByUser: {
          ...protowikiConfig.value.mockEditorEditCountByUser,
          new: saved.editCount === 'experienced' ? 'none' : saved.editCount,
          experienced: saved.editCount,
        },
      }
    }
    const { editCount: _removed, ...rest } = saved ?? {}
    return {
      ...base,
      ...rest,
      // The master switch is no longer exposed in the settings; always on.
      enabled: true,
      // Not exposed on this branch (Mock settings hidden): always the defaults.
      experiment: base.experiment,
      firstTime: base.firstTime,
      limit: base.limit,
      types: base.types,
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

export const MIN_LIMIT = 0
export const MAX_LIMIT = 99

/**
 * Applies the type filter and the custom count. A custom count keeps the
 * suggestions spread through the article (evenly sampled, document order kept).
 */
export function applySuggestionSettings<T extends { type: string }>(items: T[]): T[] {
  if (!suggestionSettings.enabled) return []
  const enabled = items.filter(
    (item) => suggestionSettings.types[item.type as SuggestionTypeId] !== false,
  )
  const limit = suggestionSettings.limit
  if (limit === null) return enabled
  if (limit === 0) return []
  if (enabled.length <= limit) return enabled
  const picked: T[] = []
  for (let i = 0; i < limit; i++) picked.push(enabled[Math.floor((i * enabled.length) / limit)])
  return picked
}
