import { ref, shallowRef } from 'vue'

import { fetchArticleBody } from '@/components/article/shared/fetchArticleBody'
import { selectRandomArticle } from '@/components/article/shared/selectRandomArticle'
import { wikiHostFromLang } from '@/config'

/** Suggestion Mode needs something to suggest: re-roll articles with fewer than this. */
export const MIN_SUGGESTIONS_PER_ARTICLE = 5

/** Give up re-rolling after this many random articles and keep the best one seen. */
const MAX_ATTEMPTS = 12

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
 * Loads a random live article that has at least `minimum()` suggestions, as
 * counted by `countSuggestions` on the parsed Parsoid HTML. Suggestions are
 * never invented: an article that falls short is replaced by another random one.
 */
export function useSuggestionArticle(
  countSuggestions: (doc: Document, article: LoadedArticle, minimum: number) => Promise<number>,
  minimum: () => number = () => MIN_SUGGESTIONS_PER_ARTICLE,
) {
  const article = shallowRef<LoadedArticle | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Suggestions counted while choosing the article (at least this many). */
  const count = ref<number | null>(null)

  let token = 0

  async function load({ fresh = false }: { fresh?: boolean } = {}) {
    const current = ++token
    loading.value = true
    error.value = null
    const min = minimum()

    let best: { article: LoadedArticle; count: number } | null = null
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const selected = await selectRandomArticle({ fresh: fresh || attempt > 0 })
        if (current !== token) return
        const host = wikiHostFromLang(selected.lang)
        let body: { html: string }
        try {
          body = await fetchArticleBody(selected.title, host)
        } catch {
          // e.g. a 404 for a page deleted since it was picked: try another one.
          if (current !== token) return
          continue
        }
        if (current !== token) return

        const candidate: LoadedArticle = { title: selected.title, lang: selected.lang, host, html: body.html }
        const n = await countSuggestions(parse(body.html), candidate, min)
        if (current !== token) return

        if (!best || n > best.count) best = { article: candidate, count: n }
        if (n >= min) break
      }
      article.value = best?.article ?? null
      count.value = best?.count ?? null
    } catch (err) {
      if (current !== token) return
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (current === token) loading.value = false
    }
  }

  /** A specific article (e.g. picked from search) — shown whatever its count. */
  async function loadTitle(title: string, lang = 'en') {
    const current = ++token
    loading.value = true
    error.value = null
    try {
      const host = wikiHostFromLang(lang)
      const body = await fetchArticleBody(title, host)
      if (current !== token) return
      article.value = { title, lang, host, html: body.html }
      count.value = null
    } catch (err) {
      if (current === token) error.value = err instanceof Error ? err.message : String(err)
    } finally {
      if (current === token) loading.value = false
    }
  }

  return { article, loading, error, count, load, loadTitle }
}
