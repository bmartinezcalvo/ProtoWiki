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

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
  const options = {
    experiencedEditor: suggestionSettings.editCount === 'experienced',
    atLeast25Edits: suggestionSettings.editCount !== 'new',
  }
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
/** Section the editor was opened from (`data-mw-section-id`), or null for the whole page. */
const editSection = ref<string | null>(null)
const readerRef = ref<{ $el: HTMLElement } | null>(null)
const sidebarOpen = ref(false)
const detectedCount = ref<number | null>(null)
const publishedToast = ref(0)
/** Published edits replace the article for the rest of the visit. */
const publishedHtml = ref<string | null>(null)

const html = computed(() => publishedHtml.value ?? article.value?.html ?? '')
const page = computed(() =>
  article.value ? { title: article.value.title, lang: article.value.lang, host: article.value.host } : null,
)

function startEditing(section: string | null = null) {
  if (!article.value || editing.value) return
  editSection.value = section
  editKey.value++
  editing.value = true
  // Desktop keeps the reader's place (the editor then scrolls to the section);
  // Minerva's editor opens at the top.
  if (isMobile.value) window.scrollTo({ top: 0 })
}

/**
 * Read mode section edit links. Desktop gets Vector's `[edit]` after each
 * section heading; Minerva's renderer already draws a pencil per section.
 */
function decorateSections() {
  const root = readerRef.value?.$el
  if (!root || isMobile.value) return
  root.querySelectorAll<HTMLElement>('section[data-mw-section-id] > :is(h2, h3, h4, h5, h6)').forEach((heading) => {
    const id = heading.parentElement?.getAttribute('data-mw-section-id')
    if (!id || Number(id) <= 0 || heading.querySelector('.mw-editsection')) return
    const wrap = document.createElement('span')
    wrap.className = 'mw-editsection'
    wrap.innerHTML =
      '<span class="mw-editsection-bracket">[</span><a href="#" class="ve-section-edit"></a><span class="mw-editsection-bracket">]</span>'
    const link = wrap.querySelector('a')!
    link.textContent = 'edit'
    link.title = `Edit section: ${heading.textContent?.trim() ?? ''}`
    link.dataset.section = id
    heading.appendChild(wrap)
  })
}

function onReaderClick(e: MouseEvent) {
  const target = e.target as Element | null
  const trigger = target?.closest('.ve-section-edit, .protowiki-mobile-h2__edit')
  if (!trigger) return
  const section =
    (trigger as HTMLElement).dataset.section ?? trigger.closest('section[data-mw-section-id]')?.getAttribute('data-mw-section-id')
  if (!section) return
  e.preventDefault()
  e.stopPropagation()
  startEditing(Number(section) > 0 ? section : null)
}

let listeningOn: HTMLElement | null = null
watch(
  () => [readerRef.value?.$el, html.value, skin.value, editing.value] as const,
  async () => {
    await nextTick()
    // Minerva's heading enhancements run after the renderer's own nextTick.
    setTimeout(() => {
      const root = readerRef.value?.$el ?? null
      if (root !== listeningOn) {
        listeningOn?.removeEventListener('click', onReaderClick, true)
        root?.addEventListener('click', onReaderClick, true)
        listeningOn = root
      }
      decorateSections()
    }, 0)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => listeningOn?.removeEventListener('click', onReaderClick, true))

function stopEditing() {
  editing.value = false
  sidebarOpen.value = false
}

function onEditClick() {
  // The Edit tab toggles back to reading, as in the original prototype.
  if (editing.value) stopEditing()
  else startEditing(null)
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
            :section="editSection"
            @exit="stopEditing"
            @published="onPublished"
            @sidebar="(open) => (sidebarOpen = open)"
            @detected="(n) => (detectedCount = n)"
          />
          <ArticleRenderer v-else ref="readerRef" :key="`${article.title}-${publishedToast}`">
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
/*
 * Desktop with suggestions: the article column (title, tabs, toolbar, content)
 * keeps its reading width and moves left; the 325px sidebar sits outside it,
 * 24px to the right.
 */
.ve-page--sidebar :deep(.article[data-skin='desktop']) {
  --ve-sidebar-room: calc(325px + 24px);
  max-width: min(calc(984px + 2 * var(--spacing-100, 16px)), calc(100% - var(--ve-sidebar-room) - 32px));
  margin-inline-start: max(16px, calc((100% - (984px + 2 * var(--spacing-100, 16px)) - var(--ve-sidebar-room)) / 2));
  margin-inline-end: auto;
  transition: margin 250ms ease;
}

.ve-page__loading {
  margin: var(--spacing-75, 12px) 0 0;
  color: var(--color-subtle, #54595d);
  font-size: var(--font-size-small, 14px);
}

/* Vector's section edit links: "[edit]" after each heading. */
.ve-page :deep(.mw-editsection) {
  margin-inline-start: 13px;
  font-family: var(--font-family-base, sans-serif);
  font-size: 0.8125rem;
  font-weight: var(--font-weight-normal, 400);
  line-height: 1;
  white-space: nowrap;
  vertical-align: baseline;
  unicode-bidi: isolate;
}

.ve-page :deep(.mw-editsection-bracket) {
  color: var(--color-base, #202122);
}

.ve-page :deep(.mw-editsection a) {
  color: var(--color-progressive, #36c);
  text-decoration: none;
}

.ve-page :deep(.mw-editsection a:hover) {
  text-decoration: underline;
}

/* In edit mode the tagline moves under the editor toolbar (rendered by the editor). */
.ve-page--editing :deep(.article-header__tagline) {
  display: none;
}

/* Minerva read mode: a section's edit pencil only shows while it's expanded. */
.ve-page[data-skin='mobile'] :deep(.protowiki-mobile-h2--collapsed .protowiki-mobile-h2__edit) {
  display: none;
}

/* Minerva edit mode: like production, no page title or page actions — just the editor. */
.ve-page--editing[data-skin='mobile'] :deep(.article-header) {
  display: none;
}

/* Clear the fixed 48px editor toolbar; wide tables scroll inside the article, not the page. */
.ve-page--editing[data-skin='mobile'] :deep(.article) {
  padding-top: 48px;
  overflow-x: clip;
}

.ve-page--editing[data-skin='mobile'] :deep(.ve-editor__surface table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}
</style>
