<script setup lang="ts">
/**
 * VisualEditor toolbar, Vector 2022 (sticky, classic) and Minerva (fixed,
 * improved), after the original Suggestion Mode prototype. In review mode it
 * becomes the "Before publishing" toolbar (`EditCheckPreSaveToolbarTools.js`):
 * Back · title · disabled Publish.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon, CdxPopover, CdxProgressIndicator, CdxToast, CdxToggleButton } from '@wikimedia/codex'

import { suggestionSettings } from './settings'
import {
  cdxIconAdd,
  cdxIconBold,
  cdxIconCheck,
  cdxIconClose,
  cdxIconCode,
  cdxIconCollapse,
  cdxIconEdit,
  cdxIconEllipsis,
  cdxIconExpand,
  cdxIconEye,
  cdxIconHelp,
  cdxIconItalic,
  cdxIconLightbulb,
  cdxIconLightbulbOutline,
  cdxIconLink,
  cdxIconListBullet,
  cdxIconMenu,
  cdxIconPrevious,
  cdxIconQuotes,
  cdxIconRedo,
  cdxIconSpecialCharacter,
  cdxIconStrikethrough,
  cdxIconTextStyle,
  cdxIconUnderline,
  cdxIconUndo,
  cdxIconWikitext,
} from '@wikimedia/codex-icons'

import { STR } from './engine/strings'

const props = withDefaults(
  defineProps<{
    skin: 'desktop' | 'mobile'
    suggestionsOn: boolean
    /** Suggestions available (badge). */
    count: number
    /** When false, hide the suggestion-mode lightbulb (master setting off). */
    showSuggestionsToggle?: boolean
  canUndo: boolean
  canRedo: boolean
  canPublish: boolean
  review: boolean
    /** Editor still loading: progress bar (Vector) / "Loading editor…" (Minerva). */
    loading?: boolean
    /**
     * Suggestions discoverability loading messages, Minerva only:
     * 1 "Loading editor…", 2 "Looking for suggestions…",
     * 3 "N suggestions found", 4 fading out. 0 / unset: the default loading state.
     */
    loadingPhase?: number
    /** Suggestions found, for phase 3. */
    loadingFound?: number
  }>(),
  { showSuggestionsToggle: true, loadingPhase: 0, loadingFound: 0 },
)

const emit = defineEmits<{
  'update:suggestionsOn': [value: boolean]
  undo: []
  redo: []
  close: []
  publish: []
  back: []
  textStyle: [command: string]
  /** Minerva: show the "0 suggestions" empty state as a Minerva toast (rendered by the editor). */
  emptyToast: []
}>()

/** No suggestions: the toggle looks off (no badge, no rays) whether on or off. */
const noSuggestions = computed(() => props.count === 0)
/** "Selectable button with 0 in badge": with 0 suggestions the toggle still turns on / off. */
const selectableEmpty = computed(() => noSuggestions.value && suggestionSettings.emptyState === 'selectable')
/** What the toggle shows as pressed. */
const toggleShownOn = computed(() => props.suggestionsOn && (!noSuggestions.value || selectableEmpty.value))
/** On with 0 suggestions (selectable mode): subtle icon and a "0" badge. */
const zeroOn = computed(() => selectableEmpty.value && props.suggestionsOn)

/**
 * All suggestions reviewed: the lightbulb swaps from filled to empty. `draining`
 * briefly keeps the toggle in place before "Nothing" hides it.
 */
const draining = ref(false)
const drainFilled = ref(false)
let drainTimers: ReturnType<typeof setTimeout>[] = []
watch(noSuggestions, (empty, wasEmpty) => {
  if (props.loading || !empty || wasEmpty !== false) return
  drainTimers.forEach(clearTimeout)
  draining.value = true
  drainFilled.value = true
  // Straight swap from filled to empty (no bounce).
  drainFilled.value = false
  drainTimers = [setTimeout(() => (draining.value = false), 300)]
})
/** Filled bulb: there are suggestions, or the bounce hasn't reached the swap yet. */
const bulbFilled = computed(() => !noSuggestions.value || drainFilled.value)

/** "Empty state in ToggleButton" → Nothing: no toggle with 0 suggestions (it leaves after the drain). */
const toggleVisible = computed(
  () =>
    props.showSuggestionsToggle &&
    !(suggestionSettings.emptyState === 'nothing' && noSuggestions.value && !draining.value),
)

/** "0 suggestions" popover, shown when turning suggestions on with none to show. */
const emptyPopoverOpen = ref(false)
const toggleRef = ref<InstanceType<typeof CdxToggleButton> | null>(null)

/** Empty state as a toast instead ("Empty state when 0 suggestions" in Mock settings). */
const emptyToastKey = ref(0)
const emptyToastOpen = ref(false)

let emptyPopoverTimer: ReturnType<typeof setTimeout> | null = null
watch(emptyPopoverOpen, (open) => {
  if (emptyPopoverTimer) clearTimeout(emptyPopoverTimer)
  // Hides itself after 4 seconds.
  if (open) emptyPopoverTimer = setTimeout(() => (emptyPopoverOpen.value = false), 4000)
})

function onToggle() {
  // No suggestions: nothing to turn on or off, the click only shows the empty state
  // (except "Selectable button with 0 in badge", which toggles as usual, silently).
  if (noSuggestions.value && !selectableEmpty.value) {
    if (suggestionSettings.emptyState === 'toast') {
      if (props.skin === 'mobile') {
        emit('emptyToast')
        return
      }
      emptyToastKey.value++
      emptyToastOpen.value = true
      return
    }
    emptyPopoverOpen.value = !emptyPopoverOpen.value
    return
  }
  emptyPopoverOpen.value = false
  emit('update:suggestionsOn', !props.suggestionsOn)
}

/** editcheck-toolbar-suggestions-count: {{PLURAL:$1|$1|100=99+}} */
const badgeLabel = computed(() => (props.count >= 100 ? '99+' : String(props.count)))
const showBadge = computed(() => props.count > 0 || zeroOn.value)

/**
 * Desktop loading bar (`ve.init.mw.ProgressBarWidget`): fills 30% → 70% → 100%
 * as the editor loads (production times are 3 s / 2 s / 1 s; shortened here).
 */
const progress = ref(0)
const progressDuration = ref(0)
let progressTimers: ReturnType<typeof setTimeout>[] = []
function startProgress() {
  progressTimers.forEach(clearTimeout)
  progress.value = 0
  progressDuration.value = 0
  progressTimers = [
    setTimeout(() => {
      progressDuration.value = 600
      progress.value = 30
    }, 20),
    setTimeout(() => {
      progressDuration.value = 400
      progress.value = 70
    }, 600),
    setTimeout(() => {
      progressDuration.value = 200
      progress.value = 100
    }, 900),
  ]
}
watch(
  () => props.loading,
  (loading) => {
    if (loading) startProgress()
  },
  { immediate: true },
)

const loadingMessage = computed(() => {
  // Only "Loading editor…" and "Looking for suggestions…" (no found count).
  if (props.loadingPhase === 1) return 'Loading editor…'
  return 'Looking for suggestions…'
})

const scrolled = ref(false)
function onScroll() {
  scrolled.value = window.scrollY > 0
}

// Minerva menus
const openMenu = ref<null | 'text' | 'add' | 'more'>(null)
const textExpanded = ref(false)
function toggleMenu(menu: 'text' | 'add' | 'more') {
  openMenu.value = openMenu.value === menu ? null : menu
  if (menu === 'text') textExpanded.value = false
}
function onDocumentClick(e: MouseEvent) {
  if (!(e.target as Element)?.closest?.('.ve-toolbar__menu, .ve-toolbar__menu-trigger')) openMenu.value = null
}

/**
 * Minerva toolbar width: each middle item needs 44px. Undo, Text styles, More,
 * the suggestions toggle (and Redo when shown) always fit. Link and Cite are
 * top-level when both fit; otherwise they live in "+". The other insert tools
 * aren't in production yet, so "+" only appears when it holds Link/Cite.
 */
const scrollAreaRef = ref<HTMLElement | null>(null)
const scrollAreaWidth = ref(0)
let scrollAreaObserver: ResizeObserver | null = null
watch(scrollAreaRef, (el, _old, onCleanup) => {
  scrollAreaObserver?.disconnect()
  if (!el) return
  scrollAreaObserver = new ResizeObserver(() => (scrollAreaWidth.value = el.clientWidth))
  scrollAreaObserver.observe(el)
  scrollAreaWidth.value = el.clientWidth
  onCleanup(() => scrollAreaObserver?.disconnect())
})
const slots = computed(() =>
  Math.floor((scrollAreaWidth.value || Math.max(0, window.innerWidth - 88)) / 44),
)
const coreSlots = computed(() => 3 + (props.canRedo ? 1 : 0) + 1)
const showLink = computed(() => slots.value >= coreSlots.value + 2)
const showCite = showLink
const showAdd = computed(() => !showLink.value)
const overflowing = computed(() => slots.value < coreSlots.value + (showLink.value ? 2 : 1))

const TEXT_STYLES = [
  { value: 'bold', label: 'Bold', icon: cdxIconBold },
  { value: 'italic', label: 'Italic', icon: cdxIconItalic },
  { value: 'strikeThrough', label: 'Strikethrough', icon: cdxIconStrikethrough },
  { value: 'underline', label: 'Underline', icon: cdxIconUnderline },
]
const addItems = computed(() => [
  ...(!showLink.value ? [{ value: 'link', label: 'Link', icon: cdxIconLink }] : []),
  ...(!showCite.value ? [{ value: 'cite', label: 'Cite', icon: cdxIconQuotes }] : []),
])

function applyTextStyle(command: string) {
  emit('textStyle', command)
  openMenu.value = null
}

/** Keep the caret in the article while pressing toolbar buttons. */
function keepSelection(e: MouseEvent) {
  if ((e.target as Element).closest('button')) e.preventDefault()
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, true)
  document.addEventListener('click', onDocumentClick)
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, true)
  document.removeEventListener('click', onDocumentClick)
  progressTimers.forEach(clearTimeout)
})
</script>

<template>
  <!-- Loading: discoverability messages ("Loading editor…" → "Looking for suggestions…" → "N found") -->
  <div
    v-if="loading && loadingPhase > 0 && skin === 'mobile'"
    class="ve-toolbar ve-toolbar--loading ve-toolbar--phased ve-toolbar--slide-in"
    data-skin="mobile"
  >
    <button
      class="ve-toolbar__btn ve-toolbar__btn--fixed ve-toolbar__btn--close"
      aria-label="Close"
      @click="emit('close')"
    >
      <CdxIcon :icon="cdxIconClose" />
    </button>
    <div
      class="ve-toolbar__loading-label"
      :class="{ 've-toolbar__loading-label--fading': loadingPhase >= 4 }"
      aria-live="polite"
    >
      <span class="ve-toolbar__loading-icon">
        <CdxProgressIndicator class="ve-toolbar__spinner" aria-hidden="true" />
      </span>
      <span class="ve-toolbar__loading-text">
        <Transition name="ve-loading-msg">
          <span :key="Math.min(loadingPhase, 2)" class="ve-toolbar__loading-message">{{ loadingMessage }}</span>
        </Transition>
      </span>
    </div>
  </div>
  <div v-else-if="loading && skin === 'desktop'" class="ve-toolbar ve-toolbar--loading" data-skin="desktop">
    <div class="ve-progress" role="progressbar" aria-label="Loading editor" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
      <div class="ve-progress__bar" :style="{ width: `${progress}%`, transitionDuration: `${progressDuration}ms` }" />
    </div>
  </div>
  <div v-else-if="loading" class="ve-toolbar ve-toolbar--loading ve-toolbar--slide-in" data-skin="mobile">
    <button class="ve-toolbar__btn ve-toolbar__btn--fixed ve-toolbar__btn--close" aria-label="Close" @click="emit('close')">
      <CdxIcon :icon="cdxIconClose" />
    </button>
    <div class="ve-toolbar__loading-label">
      <CdxProgressIndicator class="ve-toolbar__spinner" aria-hidden="true" />
      <span>Loading editor…</span>
    </div>
  </div>

  <!-- Before publishing (pre-save review) -->
  <div
    v-else-if="review"
    class="ve-toolbar ve-toolbar--review"
    :data-skin="skin"
    :class="{ 've-toolbar--scrolled': scrolled }"
  >
    <button class="ve-toolbar__btn ve-toolbar__btn--icon" :aria-label="STR.goBack" :title="STR.goBack" @click="emit('back')">
      <CdxIcon :icon="cdxIconPrevious" />
    </button>
    <div class="ve-toolbar__review-title">{{ STR.beforePublishing }}</div>
    <button class="ve-toolbar__primary ve-toolbar__primary--disabled" disabled>
      <template v-if="skin === 'desktop'">{{ STR.publishChangesEllipsis }}</template>
      <template v-else>{{ STR.publishEllipsis }}</template>
    </button>
  </div>

  <!-- Vector 2022 -->
  <div
    v-else-if="skin === 'desktop'"
    class="ve-toolbar"
    data-skin="desktop"
    :class="{ 've-toolbar--scrolled': scrolled }"
    @mousedown="keepSelection"
  >
    <div class="ve-toolbar__group">
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
        <CdxIcon :icon="cdxIconUndo" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Redo" :disabled="!canRedo" @click="emit('redo')">
        <CdxIcon :icon="cdxIconRedo" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--dropdown ve-toolbar__btn--format">
        <span>Paragraph</span>
        <CdxIcon :icon="cdxIconExpand" size="small" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--dropdown" aria-label="Text style">
        <CdxIcon :icon="cdxIconTextStyle" />
        <CdxIcon :icon="cdxIconExpand" size="small" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Link">
        <CdxIcon :icon="cdxIconLink" />
      </button>
      <button class="ve-toolbar__btn">
        <CdxIcon :icon="cdxIconQuotes" />
        <span>Cite</span>
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--dropdown" aria-label="Lists">
        <CdxIcon :icon="cdxIconListBullet" />
        <CdxIcon :icon="cdxIconExpand" size="small" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--dropdown">
        <span>Insert</span>
        <CdxIcon :icon="cdxIconExpand" size="small" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Special character">
        <CdxIcon :icon="cdxIconSpecialCharacter" />
      </button>
    </div>
    <div class="ve-toolbar__group ve-toolbar__group--trailing">
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Help">
        <CdxIcon :icon="cdxIconHelp" />
      </button>
      <Transition name="ve-toggle-out">
      <CdxToggleButton
        v-if="toggleVisible"
        :model-value="toggleShownOn"
        quiet
        class="ve-toolbar__suggestions"
        :class="{
          've-toolbar__suggestions--on': toggleShownOn,
          've-toolbar__suggestions--zero': zeroOn,
          've-toolbar__suggestions--selectable-empty': selectableEmpty,
        }"
        ref="toggleRef"
        @update:model-value="onToggle"
        :aria-label="STR.toggleSuggestions"
        :title="STR.toggleSuggestions"
      >
        <span class="ve-bulb">
          <span v-if="toggleShownOn && !noSuggestions" class="ve-bulb__rays" aria-hidden="true">
            <span v-for="n in 5" :key="n" class="ve-bulb__ray" :class="`ve-bulb__ray--${n}`" />
          </span>
          <CdxIcon :icon="bulbFilled ? cdxIconLightbulb : cdxIconLightbulbOutline" />
          <span v-if="showBadge" class="ve-bulb__badge">{{ badgeLabel }}</span>
        </span>
      </CdxToggleButton>
      </Transition>
      <button class="ve-toolbar__btn ve-toolbar__btn--icon" aria-label="Page options">
        <CdxIcon :icon="cdxIconMenu" />
      </button>
      <button class="ve-toolbar__btn ve-toolbar__btn--dropdown" aria-label="Switch editor">
        <CdxIcon :icon="cdxIconEdit" />
        <CdxIcon :icon="cdxIconExpand" size="small" />
      </button>
      <button
        class="ve-toolbar__primary"
        :class="{ 've-toolbar__primary--disabled': !canPublish }"
        :disabled="!canPublish"
        @click="emit('publish')"
      >
        {{ STR.publishChangesEllipsis }}
      </button>
    </div>
  </div>

  <!-- Minerva -->
  <div
    v-else
    class="ve-toolbar"
    data-skin="mobile"
    :class="{ 've-toolbar--scrolled': scrolled }"
    @mousedown="keepSelection"
  >
    <button class="ve-toolbar__btn ve-toolbar__btn--fixed ve-toolbar__btn--close" aria-label="Close" @click="emit('close')">
      <CdxIcon :icon="cdxIconClose" />
    </button>
    <div ref="scrollAreaRef" class="ve-toolbar__scroll" :class="{ 've-toolbar__scroll--overflowing': overflowing }">
      <button class="ve-toolbar__btn ve-toolbar__btn--fill" aria-label="Undo" :disabled="!canUndo" @click="emit('undo')">
        <CdxIcon :icon="cdxIconUndo" />
      </button>
      <button v-if="canRedo" class="ve-toolbar__btn ve-toolbar__btn--fill" aria-label="Redo" @click="emit('redo')">
        <CdxIcon :icon="cdxIconRedo" />
      </button>
      <div class="ve-toolbar__menu-wrap ve-toolbar__btn--fill">
        <button
          class="ve-toolbar__btn ve-toolbar__menu-trigger"
          :class="{ 've-toolbar__menu-trigger--active': openMenu === 'text' }"
          aria-label="Text styles"
          @click.stop="toggleMenu('text')"
        >
          <CdxIcon :icon="cdxIconTextStyle" />
        </button>
        <div v-if="openMenu === 'text'" class="ve-toolbar__menu ve-toolbar__menu--text" role="menu">
          <button
            v-for="item in TEXT_STYLES"
            :key="item.value"
            class="ve-toolbar__menu-item"
            role="menuitem"
            @click="applyTextStyle(item.value)"
          >
            <CdxIcon :icon="item.icon" />
            <span>{{ item.label }}</span>
          </button>
          <template v-if="textExpanded">
            <div class="ve-toolbar__menu-divider" role="separator" />
            <button class="ve-toolbar__menu-item" role="menuitem" @click="openMenu = null">
              <CdxIcon :icon="cdxIconCode" />
              <span>Computer code</span>
            </button>
          </template>
          <div class="ve-toolbar__menu-divider" role="separator" />
          <button class="ve-toolbar__menu-item" role="menuitem" @click.stop="textExpanded = !textExpanded">
            <CdxIcon :icon="textExpanded ? cdxIconCollapse : cdxIconExpand" />
            <span>{{ textExpanded ? 'Fewer' : 'More' }}</span>
          </button>
        </div>
      </div>
      <button v-if="showLink" class="ve-toolbar__btn ve-toolbar__btn--fill" aria-label="Link">
        <CdxIcon :icon="cdxIconLink" />
      </button>
      <button v-if="showCite" class="ve-toolbar__btn ve-toolbar__btn--fill" aria-label="Cite">
        <CdxIcon :icon="cdxIconQuotes" />
      </button>
      <div v-if="showAdd" class="ve-toolbar__menu-wrap ve-toolbar__btn--fill">
        <button
          class="ve-toolbar__btn ve-toolbar__menu-trigger"
          :class="{ 've-toolbar__menu-trigger--active': openMenu === 'add' }"
          aria-label="Add"
          @click.stop="toggleMenu('add')"
        >
          <CdxIcon :icon="cdxIconAdd" />
        </button>
        <div v-if="openMenu === 'add'" class="ve-toolbar__menu" role="menu">
          <template v-for="(item, i) in addItems" :key="i">
            <button class="ve-toolbar__menu-item" role="menuitem" @click="openMenu = null">
              <CdxIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>
      <Transition name="ve-toggle-out">
      <CdxToggleButton
        v-if="toggleVisible"
        :model-value="toggleShownOn"
        quiet
        class="ve-toolbar__suggestions ve-toolbar__btn--fill"
        :class="{
          've-toolbar__suggestions--on': toggleShownOn,
          've-toolbar__suggestions--zero': zeroOn,
          've-toolbar__suggestions--selectable-empty': selectableEmpty,
          've-toolbar__suggestions--empty': noSuggestions && !selectableEmpty,
        }"
        ref="toggleRef"
        @update:model-value="onToggle"
        :aria-label="STR.toggleSuggestions"
      >
        <span class="ve-bulb">
          <span v-if="toggleShownOn && !noSuggestions" class="ve-bulb__rays" aria-hidden="true">
            <span v-for="n in 5" :key="n" class="ve-bulb__ray" :class="`ve-bulb__ray--${n}`" />
          </span>
          <CdxIcon :icon="bulbFilled ? cdxIconLightbulb : cdxIconLightbulbOutline" />
          <span v-if="showBadge" class="ve-bulb__badge">{{ badgeLabel }}</span>
        </span>
      </CdxToggleButton>
      </Transition>
      <div class="ve-toolbar__menu-wrap ve-toolbar__btn--fill">
        <button
          class="ve-toolbar__btn ve-toolbar__menu-trigger"
          :class="{ 've-toolbar__menu-trigger--active': openMenu === 'more' }"
          aria-label="More options"
          @click.stop="toggleMenu('more')"
        >
          <CdxIcon class="ve-toolbar__ellipsis" :icon="cdxIconEllipsis" />
        </button>
        <div v-if="openMenu === 'more'" class="ve-toolbar__menu" role="menu">
          <button class="ve-toolbar__menu-item ve-toolbar__menu-item--active" role="menuitem" @click="openMenu = null">
            <CdxIcon :icon="cdxIconEye" />
            <span>Visual editing</span>
          </button>
          <button class="ve-toolbar__menu-item" role="menuitem" @click="openMenu = null">
            <CdxIcon :icon="cdxIconWikitext" />
            <span>Source editing</span>
          </button>
        </div>
      </div>
    </div>
    <button
      class="ve-toolbar__primary ve-toolbar__btn--fixed"
      :class="{ 've-toolbar__primary--disabled': !canPublish }"
      :disabled="!canPublish"
      :aria-label="STR.publish"
      @click="emit('publish')"
    >
      <CdxIcon :icon="cdxIconCheck" />
    </button>
  </div>
  <CdxPopover
    v-model:open="emptyPopoverOpen"
    class="ve-toolbar__empty-popover"
    :anchor="toggleRef"
    placement="bottom"
    :use-bottom-sheet="false"
  >
    There are no suggestions to improve this article for now.
  </CdxPopover>
  <CdxToast
    v-if="emptyToastOpen"
    :key="emptyToastKey"
    type="notice"
    :auto-dismiss="4000"
    prevent-user-dismiss
    @auto-dismissed="emptyToastOpen = false"
  >
    There are no suggestions to improve this article for now.
  </CdxToast>
</template>

<style scoped>
.ve-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  min-height: 42px;
  border-bottom: 1px solid var(--border-color-subtle, #c8ccd1);
  background-color: var(--background-color-base, #fff);
  position: sticky;
  top: 0;
  z-index: 10;
  font-family: var(--font-family-base);
}

/* Below-only: not --box-shadow-medium (side glow); spread matches Vector 2022 VE. */
.ve-toolbar--scrolled {
  box-shadow: 0 2px 1px -1px var(--box-shadow-color-alpha-base);
}

.ve-toolbar[data-skin='desktop']:has(.ve-toolbar__group--trailing) {
  /* Trailing group uses auto margin so a wrapped second row hugs the right edge. */
  justify-content: flex-start;
}

.ve-toolbar__group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.ve-toolbar__group--trailing {
  margin-inline-start: auto;
}

.ve-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  padding: 5px 13px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--border-radius-base, 2px);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-small, 14px);
  line-height: 20px;
  color: var(--color-base, #202122);
}

.ve-toolbar__btn:hover:not(:disabled) {
  background-color: var(--background-color-interactive-subtle, #f8f9fa);
}

.ve-toolbar__btn:disabled {
  color: var(--color-disabled, #a2a9b1);
  cursor: not-allowed;
}

.ve-toolbar__btn:disabled .cdx-icon {
  color: var(--color-disabled, #a2a9b1);
}

.ve-toolbar__btn--icon {
  width: 40px;
  padding: 5px;
}

.ve-toolbar__btn--dropdown {
  padding-inline: 7px 9px;
  gap: 2px;
}

/* Format dropdown: fixed width, caret on the right (as in production). */
.ve-toolbar__btn--format {
  min-width: 110px;
  justify-content: space-between;
}

.ve-toolbar__primary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  padding: 5px 13px;
  background: var(--background-color-progressive, #36c);
  border: 1px solid var(--border-color-progressive--focus, #6485d1);
  border-radius: var(--border-radius-base, 2px);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-small, 14px);
  font-weight: var(--font-weight-bold, 700);
  line-height: 20px;
  color: var(--color-inverted, #fff);
}

.ve-toolbar__primary:hover:not(:disabled) {
  background: var(--background-color-progressive--hover, #447ff5);
}

.ve-toolbar__primary--disabled {
  background: var(--background-color-disabled, #eaecf0);
  border-color: var(--border-color-subtle, #c8ccd1);
  color: var(--color-disabled, #a2a9b1);
  cursor: not-allowed;
}

.ve-toolbar__primary .cdx-icon {
  color: inherit;
}

/* Loading */
.ve-toolbar--loading[data-skin='desktop'] {
  justify-content: center;
  flex-wrap: nowrap;
}

/* ProgressBarWidget: centred, 50% of the toolbar, 0.875em tall, blue outline. */
.ve-progress {
  width: 50%;
  height: 0.875em;
  box-sizing: border-box;
  border: 1px solid var(--border-color-progressive, #36c);
  border-radius: 0.875em;
  background: var(--background-color-base, #fff);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.ve-progress__bar {
  height: 100%;
  width: 0;
  background: var(--background-color-progressive, #36c);
  transition-property: width;
  transition-timing-function: ease-in;
}

/* MobileFrontend fake toolbar slides down. */
.ve-toolbar--slide-in {
  animation: ve-toolbar-slide-in 250ms ease;
}

@keyframes ve-toolbar-slide-in {
  from {
    transform: translate(-50%, -100%);
  }
  to {
    transform: translate(-50%, 0);
  }
}

.ve-toolbar--loading[data-skin='mobile'] {
  justify-content: flex-start;
}

.ve-toolbar__loading-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-inline: 16px;
  font-size: var(--font-size-medium, 16px);
  color: var(--color-base, #202122);
}

.ve-toolbar__spinner {
  width: 20px;
  height: 20px;
  min-width: 20px;
}

/* Discoverability loading messages (Minerva) */
.ve-toolbar--phased {
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.ve-toolbar--phased .ve-toolbar__loading-label {
  flex: 1;
  min-width: 0;
  transition: opacity 300ms ease;
}

.ve-toolbar__loading-label--fading {
  opacity: 0;
}

.ve-toolbar__loading-icon {
  position: relative;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.ve-toolbar__loading-icon > * {
  position: absolute;
  inset: 0;
}

.ve-toolbar__loading-bulb {
  color: var(--color-progressive, #36c);
}

.ve-toolbar__loading-bulb--empty {
  color: var(--color-placeholder, #72777d);
}

.ve-toolbar__loading-text {
  position: relative;
  flex: 1;
  height: 1.4em;
  overflow: hidden;
}

.ve-toolbar__loading-message {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  white-space: nowrap;
}

.ve-toolbar__loading-count {
  color: var(--color-progressive, #36c);
  font-weight: var(--font-weight-bold, 700);
}

.ve-loading-msg-enter-active {
  animation: ve-loading-msg-in 300ms ease-out both;
}

.ve-loading-msg-leave-active {
  animation: ve-loading-msg-out 250ms ease-in both;
}

@keyframes ve-loading-msg-in {
  from {
    opacity: 0;
    transform: translateY(calc(-50% + 12px));
  }
  to {
    opacity: 1;
    transform: translateY(-50%);
  }
}

@keyframes ve-loading-msg-out {
  from {
    opacity: 1;
    transform: translateY(-50%);
  }
  to {
    opacity: 0;
    transform: translateY(calc(-50% - 12px));
  }
}

.ve-loading-icon-enter-active {
  animation: ve-loading-icon-in 400ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
}

.ve-loading-icon-leave-active {
  animation: ve-loading-icon-out 250ms ease-in both;
}

@keyframes ve-loading-icon-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes ve-loading-icon-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ve-loading-msg-enter-active,
  .ve-loading-msg-leave-active,
  .ve-loading-icon-enter-active,
  .ve-loading-icon-leave-active {
    animation: none;
  }

  .ve-toolbar--phased .ve-toolbar__loading-label {
    transition: none;
  }
}

/* Review (Before publishing) */
.ve-toolbar--review {
  flex-wrap: nowrap;
}

.ve-toolbar__review-title {
  flex: 1;
  text-align: center;
  font-size: var(--font-size-small, 14px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-base, #202122);
}

.ve-toolbar--review[data-skin='mobile'] {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  min-height: 48px;
}

.ve-toolbar--review[data-skin='mobile'] .ve-toolbar__btn,
.ve-toolbar--review[data-skin='mobile'] .ve-toolbar__primary {
  height: 48px;
}

.ve-toolbar--review[data-skin='mobile'] .ve-toolbar__review-title {
  font-size: var(--font-size-medium, 16px);
}

/* Suggestions toggle + badge */
.ve-toolbar__suggestions {
  width: 40px;
  height: 42px;
  min-width: 40px;
  padding: 5px;
  /* Badge sits on the bulb corner (outside the 20px icon box); Codex sets overflow:hidden. */
  overflow: visible;
}

.ve-toolbar__suggestions--on .cdx-icon {
  color: var(--color-progressive, #36c);
  animation: ve-icon-glow 0.4s ease-out;
}

@keyframes ve-icon-glow {
  0% {
    filter: brightness(1);
    transform: scale(1);
  }
  40% {
    filter: brightness(1.2);
    transform: scale(1.08);
  }
  100% {
    filter: brightness(1.1);
    transform: scale(1);
  }
}

.ve-bulb {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.ve-bulb__rays {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ve-bulb__ray {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 3px;
  background-color: var(--color-progressive, #36c);
  border-radius: 0.5px;
  opacity: 0;
  animation: ve-ray-in 0.3s ease-out forwards;
}

.ve-bulb__ray--1 {
  transform: translate(-50%, -50%) rotate(-60deg) translateY(-13px);
}
.ve-bulb__ray--2 {
  transform: translate(-50%, -50%) rotate(-30deg) translateY(-12.5px);
  animation-delay: 0.05s;
}
.ve-bulb__ray--3 {
  transform: translate(-50%, -50%) rotate(0deg) translateY(-12px);
  animation-delay: 0.1s;
}
.ve-bulb__ray--4 {
  transform: translate(-50%, -50%) rotate(30deg) translateY(-12.5px);
  animation-delay: 0.15s;
}
.ve-bulb__ray--5 {
  transform: translate(-50%, -50%) rotate(60deg) translateY(-13px);
  animation-delay: 0.2s;
}

@keyframes ve-ray-in {
  0% {
    opacity: 0;
    height: 2px;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    height: 3px;
  }
}

.ve-bulb__badge {
  position: absolute;
  bottom: 0;
  right: 0;
  transform: translate(50%, 50%);
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-base, 2px);
  border: 1px solid var(--border-color-inverted, #fff);
  background: var(--background-color-progressive, #36c);
  color: var(--color-inverted, #fff);
  font-size: 12px;
  font-weight: var(--font-weight-bold, 700);
  line-height: 14px;
  pointer-events: none;
  z-index: 2;
}

.ve-toolbar__suggestions--on .ve-bulb__badge {
  background: var(--background-color-progressive-subtle, #e8eeff);
  color: var(--color-progressive, #36c);
  border-color: var(--border-color-progressive, #36c);
}

/* "Empty state in ToggleButton" → Nothing: the toggle shrinks away once empty. */
.ve-toggle-out-leave-active {
  overflow: hidden;
  animation: ve-toggle-out 320ms ease-in forwards;
}

@keyframes ve-toggle-out {
  from {
    opacity: 1;
    max-width: 48px;
    transform: scale(1);
  }
  to {
    opacity: 0;
    max-width: 0;
    min-width: 0;
    padding-left: 0;
    padding-right: 0;
    transform: scale(0.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ve-toggle-out-leave-active {
    animation-duration: 1ms;
  }
}

/* "Selectable button with 0 in badge" with 0 suggestions: progressive-subtle when on. */
.ve-toolbar .cdx-toggle-button.ve-toolbar__suggestions--zero:enabled,
.ve-toolbar .cdx-toggle-button.ve-toolbar__suggestions--zero:enabled:hover,
.ve-toolbar .cdx-toggle-button.ve-toolbar__suggestions--zero:enabled:active {
  background-color: var(--background-color-progressive-subtle, #e8eeff);
}

/* On with 0 suggestions ("Selectable button with 0 in badge"): subtle icon and "0" badge. */
.ve-toolbar__suggestions--zero .cdx-icon {
  color: var(--color-subtle, #54595d);
  animation: none;
}

.ve-toolbar__suggestions.ve-toolbar__suggestions--zero .ve-bulb__badge {
  background: var(--background-color-progressive-subtle, #e8eeff);
  color: var(--color-subtle, #54595d);
  border-color: var(--border-color-disabled, #c8ccd1);
}

/* Minerva */
.ve-toolbar[data-skin='mobile']:not(.ve-toolbar--review) {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  width: 100%;
  max-width: 994px;
  flex-wrap: nowrap;
  min-height: 48px;
}

.ve-toolbar[data-skin='mobile'] .ve-toolbar__btn--fixed {
  flex: 0 0 44px;
  width: 44px;
  height: 48px;
  padding: 0;
  border-radius: 0;
}

.ve-toolbar__btn--close {
  border-right: 1px solid var(--border-color-muted, #dadde3);
}

.ve-toolbar__scroll {
  flex: 1 1 auto;
  min-width: 0;
  height: 48px;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  scrollbar-width: none;
}

.ve-toolbar__scroll::-webkit-scrollbar {
  display: none;
}

/* Not even the core fits: fixed 44px items, horizontal scroll, fade on the right. */
.ve-toolbar__scroll--overflowing .ve-toolbar__btn--fill {
  flex: 0 0 44px !important;
}

.ve-toolbar__scroll--overflowing::after {
  content: '';
  position: sticky;
  right: 0;
  flex: 0 0 16px;
  margin-left: -16px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 85%);
  pointer-events: none;
}

.ve-toolbar[data-skin='mobile'] .ve-toolbar__btn--fill {
  flex: 1 1 0;
  min-width: 44px;
  height: 48px;
  padding: 0;
}

.ve-toolbar[data-skin='mobile'] .ve-toolbar__suggestions {
  height: 48px;
  width: auto;
}

/* Minerva, 0 suggestions: the tap only opens the popover, no grey pressed / hover background. */
.ve-toolbar[data-skin='mobile'] .cdx-toggle-button.ve-toolbar__suggestions--empty:enabled:hover,
.ve-toolbar[data-skin='mobile'] .cdx-toggle-button.ve-toolbar__suggestions--empty:enabled:active,
.ve-toolbar[data-skin='mobile'] .cdx-toggle-button.ve-toolbar__suggestions--empty:enabled:focus {
  background-color: transparent;
  border-color: transparent;
  box-shadow: none;
}

.ve-toolbar[data-skin='mobile'] .ve-bulb__badge {
  font-size: 14px;
  line-height: 14px;
}

.ve-toolbar__menu-wrap {
  position: relative;
  display: flex;
}

.ve-toolbar__menu-trigger {
  width: 100%;
  height: 48px;
  padding: 0;
}

.ve-toolbar__menu-trigger--active {
  background: var(--background-color-interactive-subtle, #eaecf0);
  border-color: var(--border-color-base, #a2a9b1);
}

.ve-toolbar__ellipsis {
  transform: rotate(90deg);
}

.ve-toolbar__menu {
  position: fixed;
  top: 48px;
  right: 0;
  width: min(256px, 100vw);
  background: var(--background-color-base, #fff);
  border: 1px solid var(--border-color-base, #a2a9b1);
  border-radius: var(--border-radius-base, 2px);
  box-shadow: var(--box-shadow-medium, 0 4px 8px 0 rgba(0, 0, 0, 0.12));
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ve-toolbar__menu--text {
  width: min(224px, calc(100vw - 16px));
  gap: 0;
}

.ve-toolbar__menu-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: var(--border-radius-base, 2px);
  background: transparent;
  color: var(--color-base, #202122);
  font: inherit;
  font-size: var(--font-size-medium, 16px);
  text-align: left;
  cursor: pointer;
}

.ve-toolbar__menu-item:hover {
  background: var(--background-color-interactive-subtle, #f8f9fa);
}

.ve-toolbar__menu-item .cdx-icon {
  color: var(--color-subtle, #54595d);
}

.ve-toolbar__menu-item--active,
.ve-toolbar__menu-item--active .cdx-icon {
  background: var(--background-color-progressive-subtle, #e8eeff);
  color: var(--color-progressive, #36c);
}

.ve-toolbar__menu-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--border-color-subtle, #c8ccd1);
}
</style>

<style>
/* "0 suggestions" popover (teleported to body): narrow, like the design. */
.cdx-popover.ve-toolbar__empty-popover {
  width: var(--size-1600, 256px);
}

/* Arrow joins the box seamlessly: extend it past its diagonal, over the box border. */
.cdx-popover.ve-toolbar__empty-popover .cdx-popover__arrow {
  border-right-color: transparent;
  border-bottom-color: transparent;
  clip-path: polygon(0 0, 100% 0, 100% 3px, 3px 100%, 0 100%);
}
</style>
