import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'

import type { Skin } from '@/theme'

export interface VisualEditorPage {
  title: string
  lang: string
  host: string
}

export interface UseVisualEditorArticleOptions {
  /** Article HTML for read/edit surfaces (includes published overlay). */
  html: ComputedRef<string>
  page: ComputedRef<VisualEditorPage | null>
  skin: ComputedRef<Skin>
  /** When true, enter edit mode once `page` and `html` are ready. */
  startInEditMode: Ref<boolean>
  /** Fires when the loaded article identity changes (new fetch). */
  onArticleIdentityChange?: () => void
}

export function useVisualEditorArticle(options: UseVisualEditorArticleOptions) {
  const { html, page, skin, startInEditMode, onArticleIdentityChange } = options

  const editing = ref(false)
  const editKey = ref(0)
  const editorRef = ref<{ requestExit: () => void } | null>(null)
  const editSection = ref<string | null>(null)
  const readerRef = ref<{ $el: HTMLElement } | null>(null)
  const sidebarOpen = ref(false)
  const detectedCount = ref<number | null>(null)
  const publishedToast = ref(0)
  const publishedHtml = ref<string | null>(null)

  const isMobile = computed(() => skin.value === 'mobile')

  const displayHtml = computed(() => publishedHtml.value ?? html.value)

  function resetForNewArticle() {
    editing.value = false
    sidebarOpen.value = false
    publishedHtml.value = null
    detectedCount.value = null
    onArticleIdentityChange?.()
  }

  function startEditing(section: string | null = null) {
    if (!page.value || editing.value) return
    editSection.value = section
    editKey.value++
    editing.value = true
    if (isMobile.value) window.scrollTo({ top: 0 })
  }

  function stopEditing() {
    editing.value = false
    sidebarOpen.value = false
  }

  function requestStopEditing() {
    if (editorRef.value) editorRef.value.requestExit()
    else stopEditing()
  }

  function onEditClick() {
    if (editing.value) requestStopEditing()
    else startEditing(null)
  }

  function onReadClick() {
    if (editing.value) requestStopEditing()
  }

  function onPublished(newHtml: string) {
    publishedHtml.value = newHtml
    stopEditing()
    publishedToast.value++
    window.scrollTo({ top: 0 })
  }

  function decorateSections() {
    const root = readerRef.value?.$el
    if (!root || isMobile.value) return
    root
      .querySelectorAll<HTMLElement>('section[data-mw-section-id] > :is(h2, h3, h4, h5, h6)')
      .forEach((heading) => {
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
      (trigger as HTMLElement).dataset.section ??
      trigger.closest('section[data-mw-section-id]')?.getAttribute('data-mw-section-id')
    if (!section) return
    e.preventDefault()
    e.stopPropagation()
    startEditing(Number(section) > 0 ? section : null)
  }

  let listeningOn: HTMLElement | null = null
  watch(
    () => [readerRef.value?.$el, displayHtml.value, skin.value, editing.value] as const,
    async () => {
      await nextTick()
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

  let autoStartedForTitle: string | null = null
  watch(
    () => [page.value?.title, displayHtml.value, startInEditMode.value] as const,
    ([title, bodyHtml, shouldStart]) => {
      if (!title || !bodyHtml || !shouldStart) return
      if (autoStartedForTitle === title) return
      autoStartedForTitle = title
      startEditing(null)
    },
  )

  watch(
    () => page.value?.title,
    (title, prev) => {
      if (title === prev) return
      autoStartedForTitle = null
      resetForNewArticle()
    },
  )

  function updateToastOffset() {
    const header = document.querySelector('.vector-chrome-header')
    const bottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
    document.documentElement.style.setProperty('--ve-toast-top', `${bottom + 16}px`)
  }

  watch(
    skin,
    (value) => {
      document.documentElement.classList.toggle('ve-template-vector', value === 'desktop')
      nextTick(updateToastOffset)
    },
    { immediate: true },
  )
  updateToastOffset()
  window.addEventListener('scroll', updateToastOffset, { passive: true })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', updateToastOffset)
    document.documentElement.classList.remove('ve-template-vector')
    document.documentElement.style.removeProperty('--ve-toast-top')
  })

  return {
    editing,
    editKey,
    editorRef,
    editSection,
    readerRef,
    sidebarOpen,
    detectedCount,
    publishedToast,
    publishedHtml,
    displayHtml,
    isMobile,
    startEditing,
    stopEditing,
    requestStopEditing,
    onEditClick,
    onReadClick,
    onPublished,
    resetForNewArticle,
    exitEditForNavigation: stopEditing,
  }
}
