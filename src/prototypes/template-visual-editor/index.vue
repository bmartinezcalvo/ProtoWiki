<script setup lang="ts">
import { cdxIconEdit } from '@wikimedia/codex-icons'

definePage({
  meta: {
    title: 'VisualEditor',
    description: 'Template for an article page using VisualEditor in edit mode.',
    category: 'template',
    platform: 'web',
    order: 4.5,
    icon: cdxIconEdit,
  },
})

import { computed, ref } from 'vue'
import { CdxButton, CdxIcon, CdxMessage, CdxProgressBar, CdxToast } from '@wikimedia/codex'
import { cdxIconDownTriangle, cdxIconUserAvatar, cdxIconUserAvatarOutline } from '@wikimedia/codex-icons'

import ArticleRenderer from '@/components/article/ArticleRenderer.vue'
import ArticleWrapper from '@/components/article/ArticleWrapper.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import SettingsPopover from '@/components/settings/SettingsPopover.vue'
import { provideChromeSearchHandlers } from '@/composables/useChromeSearch'
import { globalSkin } from '@/theme'

import SuggestionSettingsPanel from './SuggestionSettingsPanel.vue'
import VeEditor from './VeEditor.vue'
import { detectSuggestions } from './engine/checks'
import { STR } from './engine/strings'
import { MIN_LIMIT, suggestionSettings } from './settings'
import { MIN_SUGGESTIONS_PER_ARTICLE, useSuggestionArticle } from './useSuggestionArticle'

const skin = computed(() => globalSkin.value)
const isMobile = computed(() => skin.value === 'mobile')

/** Suggestions an article must have: 5, or the custom count if larger. */
const minimum = () => Math.max(MIN_SUGGESTIONS_PER_ARTICLE, suggestionSettings.limit ?? MIN_LIMIT)

const { article, loading, error, count, load, loadTitle } = useSuggestionArticle(async (doc, page, min) => {
  const root = doc.querySelector('.mw-parser-output')!
  const enabled = (list: { type: string }[]) =>
    list.filter((f) => suggestionSettings.types[f.type as keyof typeof suggestionSettings.types] !== false).length
  const options = { experiencedEditor: suggestionSettings.editCount === 'experienced' }
  // Rule-based detectors first; the API-based ones only if that isn't enough.
  const quick = enabled(await detectSuggestions(root, page, { ...options, syncOnly: true }))
  if (quick >= min) return quick
  return enabled(await detectSuggestions(root, page, options))
}, minimum)

void load()

provideChromeSearchHandlers({
  onSelect(title) {
    editing.value = false
    void loadTitle(title)
  },
  onSubmit({ title }) {
    if (!title) return
    editing.value = false
    void loadTitle(title)
  },
})

const editing = ref(false)
const editKey = ref(0)
const sidebarOpen = ref(false)
const detectedCount = ref<number | null>(null)
const publishedToast = ref(0)
/** Published edits replace the article for the rest of the visit. */
const publishedHtml = ref<string | null>(null)

const html = computed(() => publishedHtml.value ?? article.value?.html ?? '')
const page = computed(() =>
  article.value ? { title: article.value.title, lang: article.value.lang, host: article.value.host } : null,
)

function startEditing() {
  if (!article.value || editing.value) return
  editKey.value++
  editing.value = true
  window.scrollTo({ top: 0 })
}

function stopEditing() {
  editing.value = false
  sidebarOpen.value = false
}

function onEditClick() {
  // The Edit tab toggles back to reading, as in the original prototype.
  if (editing.value) stopEditing()
  else startEditing()
}

function onPublished(newHtml: string) {
  publishedHtml.value = newHtml
  stopEditing()
  publishedToast.value++
  window.scrollTo({ top: 0 })
}

async function loadAnother() {
  stopEditing()
  publishedHtml.value = null
  detectedCount.value = null
  await load({ fresh: true })
}

const shownCount = computed(() => detectedCount.value ?? count.value)
</script>

<template>
  <ChromeWrapper :show-footer="!(isMobile && editing)">
    <!-- Minerva's editor is full-screen: no site header while editing. -->
    <template v-if="isMobile && editing" #header><span /></template>

    <template #user-menu>
      <SettingsPopover>
        <template #default="{ toggle }">
          <CdxButton
            v-if="!isMobile"
            weight="quiet"
            aria-label="User menu"
            aria-haspopup="dialog"
            @click="toggle"
          >
            <CdxIcon :icon="cdxIconUserAvatar" />
            <CdxIcon :icon="cdxIconDownTriangle" size="small" />
          </CdxButton>
          <CdxButton v-else weight="quiet" size="large" aria-label="User menu" aria-haspopup="dialog" @click="toggle">
            <CdxIcon :icon="cdxIconUserAvatarOutline" />
          </CdxButton>
        </template>
        <template #panel>
          <SuggestionSettingsPanel
            :article-title="article?.title"
            :detected-count="shownCount"
            :loading="loading"
            @load-another="loadAnother"
          />
        </template>
      </SettingsPopover>
    </template>

    <div class="ve-page" :class="{ 've-page--sidebar': sidebarOpen, 've-page--editing': editing }" :data-skin="skin">
      <ArticleWrapper
        :title="article?.title"
        :active-view="editing ? 'edit' : 'read'"
        @edit-click="onEditClick"
        @read-click="stopEditing"
      >
        <CdxProgressBar v-if="loading" inline aria-label="Loading article" />
        <p v-if="loading" class="ve-page__loading">Finding an article with suggestions…</p>
        <CdxMessage v-if="error" type="error" :allow-user-dismiss="false">
          Couldn't load an article: {{ error }}
        </CdxMessage>

        <template v-if="article && !loading">
          <VeEditor
            v-if="editing && page"
            :key="editKey"
            :html="html"
            :skin="skin"
            :page="page"
            @exit="stopEditing"
            @published="onPublished"
            @sidebar="(open) => (sidebarOpen = open)"
            @detected="(n) => (detectedCount = n)"
          />
          <ArticleRenderer v-else :key="`${article.title}-${publishedToast}`">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-html="html" />
          </ArticleRenderer>
        </template>
      </ArticleWrapper>
    </div>

    <CdxToast v-if="publishedToast" :key="publishedToast" type="success" auto-dismiss>
      {{ STR.editPublished }}
    </CdxToast>
  </ChromeWrapper>
</template>

<style scoped>
/* Desktop: the sidebar takes extra room, so the article column widens (32 + article + 24 + 325 + 32). */
.ve-page--sidebar :deep(.article[data-skin='desktop']) {
  max-width: none;
  padding-inline: 32px;
}

.ve-page__loading {
  margin: var(--spacing-75, 12px) 0 0;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 14px);
}

/* Minerva edit mode: the page actions toolbar gives way to the editor toolbar. */
.ve-page--editing[data-skin='mobile'] :deep(.article-header__icon-toolbar),
.ve-page--editing[data-skin='mobile'] :deep(.article-header__toolbar) {
  display: none;
}

/* Clear the fixed 48px editor toolbar. */
.ve-page--editing[data-skin='mobile'] :deep(.article) {
  padding-top: calc(48px + var(--spacing-100, 16px));
}
</style>
