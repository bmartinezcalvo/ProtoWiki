import { ref, shallowRef } from 'vue'

import { fetchArticleBody } from '@/components/article/shared/fetchArticleBody'
import { selectRandomArticle } from '@/components/article/shared/selectRandomArticle'
import { wikiHostFromLang } from '@/config'

export interface LoadedArticle {
  title: string
  lang: string
  host: string
  html: string
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<div class="mw-parser-output">${html}</div>`, 'text/html')
}

/**
 * Loads one random live article. Optional `countSuggestions` runs on the parsed
 * HTML for display only (e.g. settings shortfall) — it never re-rolls the title.
 */
export function useSuggestionArticle(
  countSuggestions?: (doc: Document, article: LoadedArticle) => Promise<number>,
) {
  const article = shallowRef<LoadedArticle | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Suggestions counted on load (before the settings filter in the editor). */
  const count = ref<number | null>(null)

  let token = 0

  async function load({ fresh = false }: { fresh?: boolean } = {}) {
    const current = ++token
    loading.value = true
    error.value = null
    count.value = null
    try {
      const selected = await selectRandomArticle({ fresh })
      if (current !== token) return
      const host = wikiHostFromLang(selected.lang)
      const body = await fetchArticleBody(selected.title, host)
      if (current !== token) return

      const loaded: LoadedArticle = { title: selected.title, lang: selected.lang, host, html: body.html }
      article.value = loaded
      if (countSuggestions) {
        count.value = await countSuggestions(parse(body.html), loaded)
      }
    } catch (err) {
      if (current !== token) return
      error.value = err instanceof Error ? err.message : String(err)
      article.value = null
    } finally {
      if (current === token) loading.value = false
    }
  }

  /** A specific article (e.g. picked from search). */
  async function loadTitle(title: string, lang = 'en') {
    const current = ++token
    loading.value = true
    error.value = null
    count.value = null
    try {
      const host = wikiHostFromLang(lang)
      const body = await fetchArticleBody(title, host)
      if (current !== token) return
      article.value = { title, lang, host, html: body.html }
    } catch (err) {
      if (current === token) error.value = err instanceof Error ? err.message : String(err)
      article.value = null
    } finally {
      if (current === token) loading.value = false
    }
  }

  async function refreshCount() {
    const loaded = article.value
    if (!loaded || !countSuggestions) return
    count.value = await countSuggestions(parse(loaded.html), loaded)
  }

  return { article, loading, error, count, load, loadTitle, refreshCount }
}
