<script lang="ts">
import type { RandomArticleSource } from './shared/selectRandomArticle'
import type { Skin, Theme } from '@/theme'

interface ArticleLiveCommonProps {
  lang?: string
  dir?: 'ltr' | 'rtl'
  header?: string
  host?: string
  skin?: Skin
  theme?: Theme
  languagesCount?: number
  /** Web Visual Editor: Edit tab opens in-place editor (ignored when **`app`**). */
  editable?: boolean
  /** Open edit mode once the article body has loaded (**`editable`** only). */
  startInEditMode?: boolean
}

/** Fixed article: `article` set; the random-only props are forbidden. */
export type ArticleLiveFixedProps = ArticleLiveCommonProps & {
  article: string
  app?: boolean
  source?: never
  langs?: never
}

/** Random article: `article` omitted; optional `source` / `langs` / `vitalLevel`. */
export type ArticleLiveRandomProps = ArticleLiveCommonProps & {
  article?: undefined
  app?: boolean
  source?: RandomArticleSource
  langs?: string[]
  vitalLevel?: number
}

/**
 * Public prop contract for **`ArticleLive`** — `source` / `langs` are
 * type-gated to the no-`article` (random) case. Annotate call sites against
 * this type to catch e.g. `<ArticleLive article="X" source="vital" />`.
 */
export type ArticleLiveProps = ArticleLiveFixedProps | ArticleLiveRandomProps
</script>

<script setup lang="ts">
/**
 * Live article from REST `page/html`, rendered through {@link ArticleRenderer}
 * inside {@link ArticleWrapper}. **`app`** swaps the web chrome for the apps'
 * lead block and in-app reading affordances; everything else is shared.
 *
 * App articles are deliberately **not** REST `page/mobile-html` / PCS. PCS ships
 * stylesheets rooted at `html` / `body` sized by viewport media queries, so it
 * only renders correctly in a document of its own — and an iframe puts the
 * article beyond the reach of ProtoWiki CSS, Codex components and devtools, which
 * is the opposite of what prototypes need. Staying in one document is the point:
 * `parserReady` hands out a plain element, so `<Teleport>` and any Codex
 * component work with no plumbing.
 */
import { computed, inject, nextTick, ref, watch } from 'vue'
import { CdxMessage, CdxProgressBar } from '@wikimedia/codex'

import ArticleRenderer from './ArticleRenderer.vue'
import ArticleWrapper from './ArticleWrapper.vue'
import { fetchArticleBody } from './shared/fetchArticleBody'
import { fetchArticleView, type ArticleView } from './shared/fetchArticleView'
import { DEFAULT_RANDOM_SOURCE, selectRandomArticle } from './shared/selectRandomArticle'
import VisualEditorArticleShell from '@/components/visual-editor/VisualEditorArticleShell.vue'
import VisualEditorPageLayout from '@/components/visual-editor/VisualEditorPageLayout.vue'
import { countArticleSuggestions } from '@/components/visual-editor/countArticleSuggestions'
import { useEffectiveEditorEditCount } from '@/composables/useEffectiveEditorEditCount'
import { wikiHostFromLang } from '@/config'
import { globalSkin, PROTOWIKI_CHROME_SKIN } from '@/theme'

interface Props {
  lang?: string
  dir?: 'ltr' | 'rtl'
  /**
   * Wiki page title for REST **`page/html/{title}`**.
   * When **`header`** is **`undefined`**, seeds **`ArticleWrapper`** **`title`** (and thus **`ArticleHeader`**) from this value (normalized).
   *
   * **Omit `article` to load a random article on each mount** (see **`source`** / **`langs`**).
   */
  article?: string
  /** Reader-visible title override for **`ArticleHeader`**. **`undefined`** → derive from **`article`**. */
  header?: string
  /** Wiki hostname. **`undefined`** → derived from **`lang`** (default **`en.wikipedia.org`**). */
  host?: string
  /**
   * In-app article screen: the apps' lead block (image, title, short
   * description) replaces web chrome, end matter folds away, wide tables become
   * collapsed widgets, and the skin is pinned to **`'mobile'`**. Pair it with
   * **`AppChromeWrapper`**. Works in random mode too — the lead block fills in
   * once the title resolves.
   */
  app?: boolean
  /**
   * Random-mode pool — only meaningful when **`article`** is omitted.
   * **`'random'`** (default) draws a live random page; **`'vital'`** draws a Wikipedia Vital article.
   */
  source?: RandomArticleSource
  /**
   * Random-mode languages — only meaningful when **`article`** is omitted.
   * One is chosen at random per mount (default **`['en']`**); the wiki host is derived from it.
   */
  langs?: string[]
  /**
   * Vital articles level to draw from — only meaningful when **`article`** is omitted and **`source`** is **`'vital'`** (default **`2`** ≈ 100 titles; **`3`** ≈ 1,000).
   */
  vitalLevel?: number
  skin?: Skin
  theme?: Theme
  /** Forwarded **`ArticleWrapper`** → **`ArticleHeader`** (**`languagesCount` languages**). */
  languagesCount?: number
  editable?: boolean
  startInEditMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lang: undefined,
  dir: undefined,
  article: undefined,
  header: undefined,
  host: undefined,
  app: false,
  source: undefined,
  langs: undefined,
  vitalLevel: undefined,
  skin: undefined,
  theme: undefined,
  languagesCount: undefined,
  editable: false,
  startInEditMode: false,
})

const editing = defineModel<boolean>('editing', { default: false })
const suggestionCount = defineModel<number | null>('suggestionCount', { default: null })

const emit = defineEmits<{
  /** Parser root, once the body is in the DOM — for `<Teleport>` and in-article overlays. */
  parserReady: [root: HTMLElement]
  /** Wiki page title once known (fixed prop, random pick, or REST-normalized title). */
  titleResolved: [title: string]
}>()

const effectiveEditable = computed(() => props.editable && !props.app)

const inheritedSkin = inject(PROTOWIKI_CHROME_SKIN, null)
const effectiveSkin = computed(
  () => props.skin ?? inheritedSkin?.value ?? globalSkin.value,
)

const liveHtml = ref<string | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
/** Lead-block metadata (title, description, image) — app articles only. */
const view = ref<ArticleView | null>(null)
const rendererRef = ref<InstanceType<typeof ArticleRenderer> | null>(null)
const veShellRef = ref<InstanceType<typeof VisualEditorArticleShell> | null>(null)
const veSidebarOpen = ref(false)

/** Title shown in chrome — the live `view` title, the `article` prop, or the random pick. */
const resolvedTitle = ref<string | null>(props.article ?? null)

const defaultHost = computed(() => wikiHostFromLang(props.lang ?? 'en'))
/** Host actually being read — `host` prop, `lang`, or the random language. */
const resolvedHost = ref(props.host ?? defaultHost.value)
const resolvedLang = ref(props.lang ?? 'en')

const prefetchSuggestionCount = ref<number | null>(null)
const { editCount, editCountReady } = useEffectiveEditorEditCount()

const vePage = computed(() => {
  if (!resolvedTitle.value || liveHtml.value === null) return null
  return {
    title: resolvedTitle.value,
    lang: resolvedLang.value,
    host: resolvedHost.value,
  }
})

let loadAbort: AbortController | null = null

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && /abort/i.test(err.message)) return true
  return false
}

async function refreshPrefetchSuggestionCount() {
  if (!effectiveEditable.value || !liveHtml.value || !vePage.value) {
    prefetchSuggestionCount.value = null
    return
  }
  prefetchSuggestionCount.value = await countArticleSuggestions(
    liveHtml.value,
    vePage.value,
    editCount.value,
  )
}

async function fetchArticle(title: string, host: string, lang: string, signal: AbortSignal) {
  if (!title) return

  liveHtml.value = null
  view.value = null
  prefetchSuggestionCount.value = null
  veShellRef.value?.exitEditForNavigation()

  const [body, articleView] = await Promise.all([
    fetchArticleBody(title, host, { signal }),
    props.app ? fetchArticleView(title, { signal, lang }) : Promise.resolve(null),
  ])
  if (signal.aborted) return

  liveHtml.value = body.html
  view.value = articleView
  if (articleView) resolvedTitle.value = articleView.title
  if (effectiveEditable.value) void refreshPrefetchSuggestionCount()
  emit('titleResolved', title)
}

async function resolveAndFetch() {
  const host = props.host ?? defaultHost.value
  const lang = props.lang ?? 'en'
  if (
    props.article &&
    props.article === resolvedTitle.value &&
    resolvedHost.value === host &&
    resolvedLang.value === lang &&
    liveHtml.value !== null
  ) {
    return
  }

  loadAbort?.abort()
  loadAbort = new AbortController()
  const { signal } = loadAbort

  loading.value = true
  error.value = null

  try {
    if (props.article) {
      resolvedTitle.value = props.article
      resolvedHost.value = props.host ?? defaultHost.value
      resolvedLang.value = props.lang ?? 'en'
      await fetchArticle(props.article, resolvedHost.value, resolvedLang.value, signal)
      return
    }

    liveHtml.value = null
    view.value = null
    resolvedTitle.value = null

    const selected = await selectRandomArticle({
      source: props.source ?? DEFAULT_RANDOM_SOURCE,
      langs: props.langs,
      vitalLevel: props.vitalLevel,
    })
    if (signal.aborted) return
    resolvedHost.value = wikiHostFromLang(selected.lang)
    resolvedLang.value = selected.lang
    resolvedTitle.value = selected.title
    await fetchArticle(selected.title, resolvedHost.value, selected.lang, signal)
  } catch (err) {
    if (signal.aborted || isAbortError(err)) return
    error.value = err instanceof Error ? err.message : String(err)
    liveHtml.value = null
    view.value = null
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

watch(
  () =>
    [
      props.host ?? defaultHost.value,
      props.article,
      props.app,
      props.source,
      (props.langs ?? []).join('|'),
      props.vitalLevel,
    ] as const,
  () => {
    void resolveAndFetch()
  },
  { immediate: true },
)

watch(liveHtml, async (html) => {
  if (!html || effectiveEditable.value) return
  await nextTick()
  const root = rendererRef.value?.$el as HTMLElement | undefined
  if (root) emit('parserReady', root)
})

watch([editCount, editCountReady], () => {
  if (editCountReady.value && effectiveEditable.value) void refreshPrefetchSuggestionCount()
})

function onEditClick() {
  veShellRef.value?.onEditClick()
}

function onReadClick() {
  veShellRef.value?.onReadClick()
}
</script>

<template>
  <VisualEditorPageLayout
    v-if="effectiveEditable"
    :sidebar-open="veSidebarOpen"
    :editing="editing"
    :skin="effectiveSkin"
  >
    <ArticleWrapper
      :lang="props.lang"
      :dir="props.dir"
      :title="resolvedTitle ?? undefined"
      :header="props.header"
      :skin="props.skin"
      :theme="props.theme"
      :languages-count="props.languagesCount"
      :app="props.app"
      :description="view?.description"
      :lead-image-url="view?.thumbnailUrl ?? undefined"
      :active-view="editing ? 'edit' : 'read'"
      @edit-click="onEditClick()"
      @read-click="onReadClick()"
    >
      <VisualEditorArticleShell
        ref="veShellRef"
        v-model:editing="editing"
        v-model:sidebar-open="veSidebarOpen"
        v-model:suggestion-count="suggestionCount"
        :loading="loading"
        :error="error"
        :live-html="liveHtml"
        :page="vePage"
        :skin="effectiveSkin"
        :start-in-edit-mode="startInEditMode"
        :prefetch-suggestion-count="prefetchSuggestionCount"
        :lang="resolvedLang"
        :dir="props.dir"
        :theme="props.theme"
      />
    </ArticleWrapper>
  </VisualEditorPageLayout>
  <ArticleWrapper
    v-else
    :lang="props.lang"
    :dir="props.dir"
    :title="resolvedTitle ?? undefined"
    :header="props.header"
    :skin="props.skin"
    :theme="props.theme"
    :languages-count="props.languagesCount"
    :app="props.app"
    :description="view?.description"
    :lead-image-url="view?.thumbnailUrl ?? undefined"
  >
    <CdxProgressBar v-if="loading" inline aria-label="Loading article" />

    <CdxMessage v-if="error" type="error" :allow-user-dismiss="false">
      Couldn't load this article: {{ error }}
    </CdxMessage>

    <ArticleRenderer
      v-if="liveHtml !== null || $slots.default"
      ref="rendererRef"
      :lang="props.lang"
      :dir="props.dir"
      :skin="props.skin"
      :theme="props.theme"
      :app="props.app"
    >
      <template v-if="$slots.default"><slot /></template>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else v-html="liveHtml" />
    </ArticleRenderer>
  </ArticleWrapper>
</template>
