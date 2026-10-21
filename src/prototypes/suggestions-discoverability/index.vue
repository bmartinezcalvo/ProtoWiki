<script setup lang="ts">
definePage({
  meta: {
    platform: 'web',
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
      :article="article"
      @title-resolved="onTitleResolved"
    />
  </ChromeWrapper>
</template>
