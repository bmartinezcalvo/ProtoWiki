import type { ComputedRef, InjectionKey } from 'vue'

/**
 * Suggestions discoverability, provided by `ArticleLive` when
 * `suggestionsIndicator` is set:
 * - read mode: lightbulb badge on the Edit buttons (`ArticleHeader`, Minerva
 *   section headings in `ArticleRenderer`);
 * - edit mode: `VeEditor` runs the discoverability flows (loading messages,
 *   welcome / "Before you go" dialogs, pulse and bounce nudges).
 */
export interface EditSuggestionsIndicatorContext {
  /** Show the lightbulb badge (read mode, article has suggestions). */
  show: ComputedRef<boolean>
  /** Pulse around the badge (first time using suggestion mode). */
  pulse: ComputedRef<boolean>
  /** `data-mw-section-id`s of sections with suggestions (nested ones included). */
  sections: ComputedRef<Set<string>>
}

export const PROTOWIKI_EDIT_SUGGESTIONS_INDICATOR: InjectionKey<EditSuggestionsIndicatorContext> =
  Symbol('protowiki-edit-suggestions-indicator')

const BADGE_PATHS =
  '<path d="M7.84615 12H4.15385V10.8H7.84615V12Z"/>' +
  '<path d="M6 0C7.19241 0 8.20276 0.333393 8.92007 0.986133C9.64163 1.64275 10 2.56229 10 3.6C10 4.93159 9.29275 5.83918 8.74459 6.43652C8.34865 6.86802 8.15385 7.41601 8.15385 8.0332V9.6H3.84615V8.0332C3.84615 7.41601 3.65136 6.86802 3.25541 6.43652C2.70725 5.83918 2 4.93159 2 3.6C2 2.62372 2.36504 1.71301 3.07272 1.04707C3.78125 0.380328 4.78878 0 6 0Z"/>'

/** Badge markup for DOM built outside Vue (Minerva section headings). */
export const EDIT_SUGGESTIONS_BADGE_HTML = `<svg class="edit-suggestions-indicator__badge" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">${BADGE_PATHS}</svg>`

export const EDIT_SUGGESTIONS_PULSE_HTML = '<span class="edit-suggestions-indicator__pulse"></span>'
