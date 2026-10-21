<script setup lang="ts">
import { cdxIconEdit, cdxIconMenu } from '@wikimedia/codex-icons'

definePage({
  meta: {
    title: 'Visual Editor',
    description: 'Template for prototyping the Visual Editor.',
    category: 'template',
    platform: 'web',
    order: 4.5,
    icon: cdxIconEdit,
  },
})

import { computed, ref } from 'vue'
import { CdxButton, CdxIcon } from '@wikimedia/codex'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import SettingsPopover from '@/components/settings/SettingsPopover.vue'
import { provideChromeSearchHandlers } from '@/composables/useChromeSearch'
import { useWikiPageTitleQuery } from '@/composables/useWikiPageTitleQuery'
import { globalSkin } from '@/theme'

import SuggestionSettingsPanel from '@/components/settings/SuggestionSettingsPanel.vue'

const { titleFromQuery, setWikiPageTitle } = useWikiPageTitleQuery()

const skin = computed(() => globalSkin.value)
const isMobile = computed(() => skin.value === 'mobile')

const editing = ref(false)
const suggestionCount = ref<number | null>(null)

const article = computed(() => titleFromQuery.value)

provideChromeSearchHandlers({
  onSelect(title) {
    setWikiPageTitle(title)
  },
  onSubmit({ title }) {
    if (!title) setWikiPageTitle(title)
  },
})

function onTitleResolved(title: string) {
  if (title?.trim()) setWikiPageTitle(title)
}
</script>

<template>
  <ChromeWrapper :show-footer="!(isMobile && editing)">
    <template v-if="isMobile && editing" #header><span /></template>

    <template #menu>
      <SettingsPopover>
        <template #default="{ toggle }">
          <CdxButton
            v-if="!isMobile"
            class="chrome-header__menu-btn"
            weight="quiet"
            aria-label="Main menu"
            aria-haspopup="dialog"
            @click="toggle"
          >
            <CdxIcon :icon="cdxIconMenu" />
          </CdxButton>
          <CdxButton
            v-else
            weight="quiet"
            size="large"
            aria-label="Main menu"
            aria-haspopup="dialog"
            @click="toggle"
          >
            <CdxIcon :icon="cdxIconMenu" />
          </CdxButton>
        </template>
        <template #panel>
          <SuggestionSettingsPanel :detected-count="suggestionCount" />
        </template>
      </SettingsPopover>
    </template>

    <ArticleLive
      v-model:editing="editing"
      v-model:suggestion-count="suggestionCount"
      editable
      start-in-edit-mode
      read-route="/template-article"
      :article="article"
      @title-resolved="onTitleResolved"
    />
  </ChromeWrapper>
</template>
