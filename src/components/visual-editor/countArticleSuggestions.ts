import { editorHasAtLeast25Edits, editorIsExperienced } from '@/config'

import { detectSuggestions } from './engine/checks'
import { applySuggestionSettings, suggestionSettings } from './settings'
import type { VisualEditorPage } from './useVisualEditorArticle'

function parseArticleHtml(html: string): Document {
  return new DOMParser().parseFromString(`<div class="mw-parser-output">${html}</div>`, 'text/html')
}

export interface ArticleSuggestionCount {
  count: number
  /** `data-mw-section-id`s containing a suggestion (every enclosing section). */
  sections: Set<string>
}

/**
 * Count enabled suggestions for settings-panel shortfall and read-mode indicators (load-time only).
 * `onQuick` gets a first count from the fast, offline detectors so the read-mode indicator can
 * show as soon as the article loads; the returned count adds the slower API-based ones.
 */
export async function countArticleSuggestions(
  html: string,
  page: VisualEditorPage,
  editCount: number,
  onQuick?: (result: ArticleSuggestionCount) => void,
): Promise<ArticleSuggestionCount> {
  if (!suggestionSettings.enabled) return { count: 0, sections: new Set() }
  const options = {
    experiencedEditor: editorIsExperienced(editCount),
    atLeast25Edits: editorHasAtLeast25Edits(editCount),
  }
  if (onQuick) {
    const quick = await countWith(html, page, { ...options, syncOnly: true })
    if (quick.count > 0) onQuick(quick)
  }
  return countWith(html, page, options)
}

async function countWith(
  html: string,
  page: VisualEditorPage,
  options: Parameters<typeof detectSuggestions>[2],
): Promise<ArticleSuggestionCount> {
  const sections = new Set<string>()
  const root = parseArticleHtml(html).querySelector('.mw-parser-output')
  if (!root) return { count: 0, sections }
  // Same filtering as the editor (enabled types + "number of suggestions" limit),
  // so read mode and edit mode agree on the count.
  const list = applySuggestionSettings(await detectSuggestions(root, page, options))
  for (const f of list) {
    const node = f.element ?? f.ranges[0]?.startContainer
    let el = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null
    while ((el = el?.closest('section[data-mw-section-id]') ?? null)) {
      sections.add(el.getAttribute('data-mw-section-id')!)
      el = el.parentElement
    }
  }
  return { count: list.length, sections }
}
