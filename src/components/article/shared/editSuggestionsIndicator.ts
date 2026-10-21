import type { ComputedRef, InjectionKey } from 'vue'

/**
 * Read-mode suggestions indicator on the Edit button (lightbulb badge on the
 * pencil). Provided by `ArticleLive` when `suggestionsIndicator` is set;
 * `ArticleHeader` (Minerva icon toolbar, Vector sticky header) injects it.
 */
export interface EditSuggestionsIndicatorContext {
  /** Show the lightbulb badge (read mode, article has suggestions). */
  show: ComputedRef<boolean>
  /** Pulse around the badge (first time using suggestion mode). */
  pulse: ComputedRef<boolean>
}

export const PROTOWIKI_EDIT_SUGGESTIONS_INDICATOR: InjectionKey<EditSuggestionsIndicatorContext> =
  Symbol('protowiki-edit-suggestions-indicator')
