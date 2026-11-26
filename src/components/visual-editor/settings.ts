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
  /**
   * Unselected highlighted text. `railHighlight`: grey background plus the rail
   * (the blue / yellow line beside it). `rail`: transparent background, rail only.
   */
  highlightStyle: 'railHighlight' | 'rail'
  /**
   * Suggestion icons: `lightbulb` for every suggestion, `contextual` icons per category (V1), or
   * `contextualBadge` (V2): the lightbulb with the contextual icon as an x-small badge bottom right.
   */
  suggestionIcons: 'lightbulb' | 'contextual' | 'contextualBadge'
  /** Contextual icons V1 — "With lightbulb indicator": an x-small lightbulb before the open suggestion's description. */
  lightbulbIndicator: boolean
  /** "Show stacked suggestions": at least one paragraph has more than one suggestion. */
  showStacked: boolean
  /**
   * "Empty state in ToggleButton" (0 suggestions): popover under the toggle, a toast,
   * `selectable` (the toggle turns on / off and shows a "0" badge), or `nothing` (toggle hidden).
   */
  emptyState: 'popover' | 'toast' | 'selectable' | 'nothing'
  /** "Empty state when completed/declined all suggestions": nothing, the "No more suggestions" card, or a toast. */
  allReviewedState: 'nothing' | 'card' | 'toast'
  /**
   * Minerva — "Prominence between highlighted text and bottom sheet": `nothing` (as is) or
   * `overlay` (a light backdrop covers everything but the selected block, the highlight wipes in),
   * `proximityOnly` ("No highlighted text when unselected": the selected text sits 32px above the
   * sheet, unselected suggestions have no highlight, unselected checks a faint one, one-line
   * highlights wipe in), or `proximity` ("Colored bottom sheet": selected text 40px above a sheet
   * tinted by suggestion/check, small quiet rail buttons, line-by-line wipe).
   */
  sheetProminence: 'nothing' | 'overlay' | 'proximity' | 'proximityOnly'
  /**
   * Desktop — "No highlighted text when unselected" (Improve distinction between states):
   * unselected suggestions have no highlight, unselected checks a faint warning one, and
   * one-line highlights wipe in when selected.
   */
  desktopNoHighlight: boolean
}

const STORAGE_KEY = 'protowiki:template-visual-editor:settings:v2'

function defaults(): SuggestionSettings {
  return {
    enabled: true,
    limit: null,
    // Experimental suggestion types are off by default.
    types: Object.fromEntries(SUGGESTION_TYPES.map((t) => [t.id, !t.label.includes('(experimental)')])) as Record<
      SuggestionTypeId,
      boolean
    >,
    firstTime: false,
    rememberedToggle: true,
    hideBeforeYouGo: false,
    experiment: 1,
    highlightStyle: 'railHighlight',
    suggestionIcons: 'lightbulb',
    lightbulbIndicator: true,
    showStacked: false,
    emptyState: 'selectable',
    allReviewedState: 'nothing',
    sheetProminence: 'proximityOnly',
    desktopNoHighlight: true,
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
      // "Empty state in ToggleButton" is no longer exposed; always the empty button with a 0 badge.
      emptyState: 'selectable',
      types: { ...base.types, ...(rest?.types ?? {}) },
      // Renamed option ("Gradient behind bottom sheet" → "Proximity").
      sheetProminence: rest?.sheetProminence === 'gradient' ? 'proximity' : (rest?.sheetProminence ?? base.sheetProminence),
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
