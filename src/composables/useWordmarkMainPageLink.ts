import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { mergedLocationQuery } from '@/appearance/url-query'

/** English Wikipedia main page title (`ArticleWrapper` applies Main Page header chrome). */
export const WIKIPEDIA_MAIN_PAGE_TITLE = 'Main Page'

/** Router **`to`** for the Wikipedia wordmark — Main Page on the current prototype route. */
export function useWordmarkMainPageLink() {
  const route = useRoute()

  return computed(() => ({
    path: route.path,
    query: mergedLocationQuery(route.query, { title: WIKIPEDIA_MAIN_PAGE_TITLE }),
  }))
}
