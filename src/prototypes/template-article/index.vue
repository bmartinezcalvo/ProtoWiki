<script setup lang="ts">
import { cdxIconArticle } from '@wikimedia/codex-icons'

definePage({
  meta: {
    title: 'Article',
    description: 'Template for prototyping the article page.',
    category: 'template',
    platform: 'web',
    order: 2,
    icon: cdxIconArticle,
  },
})

import { computed } from 'vue'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import { provideChromeSearchHandlers } from '@/composables/useChromeSearch'
import { useWikiPageTitleQuery } from '@/composables/useWikiPageTitleQuery'

const { titleFromQuery, setWikiPageTitle } = useWikiPageTitleQuery()

/** Fixed title from `?title=`; omit prop for random article when absent. */
const article = computed(() => titleFromQuery.value)

provideChromeSearchHandlers({
  onSelect(title) {
    if (title?.trim()) setWikiPageTitle(title)
  },
  onSubmit({ title }) {
    if (title) setWikiPageTitle(title)
  },
})

function onTitleResolved(title: string) {
  if (title?.trim()) setWikiPageTitle(title)
}
</script>

<template>
  <ChromeWrapper>
    <ArticleLive
      edit-route="/template-visual-editor"
      :article="article"
      @title-resolved="onTitleResolved"
    />

    <!-- Draw from Wikipedia's Vital articles instead of a purely random page: -->
    <!-- <ArticleLive source="vital" /> -->

    <!-- Random across several languages (one chosen per load): -->
    <!-- <ArticleLive :langs="['en', 'fr', 'es']" /> -->

    <!-- Pin a specific article (fixed, not random): -->
    <!-- <ArticleLive article="Wet Leg" /> -->
  </ChromeWrapper>
</template>
