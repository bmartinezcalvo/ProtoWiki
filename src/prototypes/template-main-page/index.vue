<script setup lang="ts">
import { cdxIconHome } from '@wikimedia/codex-icons'

definePage({
  meta: {
    title: 'Main page',
    description: "Template for prototyping English Wikipedia's Main Page",
    category: 'template',
    platform: 'web',
    order: 8,
    icon: cdxIconHome,
  },
})

import { computed, onMounted } from 'vue'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import { provideChromeSearchHandlers } from '@/composables/useChromeSearch'
import { useWikiPageTitleQuery } from '@/composables/useWikiPageTitleQuery'

const { titleFromQuery, setWikiPageTitle } = useWikiPageTitleQuery()

const effectiveTitle = computed(() => titleFromQuery.value ?? 'Main Page')

provideChromeSearchHandlers({
  onSelect(title) {
    setWikiPageTitle(title)
  },
  onSubmit({ title }) {
    if (title) setWikiPageTitle(title)
  },
})

function onTitleResolved(title: string) {
  setWikiPageTitle(title)
}

onMounted(() => {
  if (!titleFromQuery.value) setWikiPageTitle('Main Page')
})
</script>

<template>
  <ChromeWrapper>
    <!-- ArticleWrapper detects title "Main Page" and applies production Main Page header chrome. -->
    <ArticleLive editable :article="effectiveTitle" @title-resolved="onTitleResolved" />

    <!-- Other wikis use different main-page titles; set lang/host and article accordingly. -->
    <!-- <ArticleLive lang="fr" article="Wikipédia:Accueil principal" /> -->
  </ChromeWrapper>
</template>
