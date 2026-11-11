import { editorHasAtLeast25Edits, editorIsExperienced } from '@/config'

import { detectSuggestions } from './engine/checks'
import { suggestionSettings } from './settings'
import type { VisualEditorPage } from './useVisualEditorArticle'

function parseArticleHtml(html: string): Document {
  return new DOMParser().parseFromString(`<div class="mw-parser-output">${html}</div>`, 'text/html')
}

export interface ArticleSuggestionCount {
  count: number
  /** `data-mw-section-id`s containing a suggestion (every enclosing section). */
  sections: Set<string>
}

/** Count enabled suggestions for settings-panel shortfall and read-mode indicators (load-time only). */
export async function countArticleSuggestions(
  html: string,
  page: VisualEditorPage,
  editCount: number,
): Promise<ArticleSuggestionCount> {
  const sections = new Set<string>()
  if (!suggestionSettings.enabled) return { count: 0, sections }
  const root = parseArticleHtml(html).querySelector('.mw-parser-output')
  if (!root) return { count: 0, sections }
  const options = {
    experiencedEditor: editorIsExperienced(editCount),
    atLeast25Edits: editorHasAtLeast25Edits(editCount),
  }
  const list = (await detectSuggestions(root, page, options)).filter(
    (f) => suggestionSettings.types[f.type as keyof typeof suggestionSettings.types] !== false,
  )
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
