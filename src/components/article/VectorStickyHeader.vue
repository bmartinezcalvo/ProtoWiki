<script setup lang="ts">
/**
 * Vector 2022 sticky header (read mode): slides in once the page has scrolled
 * past the article header, with the page title and quick page actions. The
 * Edit pencil carries the suggestions indicator.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import {
  cdxIconDownTriangle,
  cdxIconEdit,
  cdxIconHistory,
  cdxIconLanguage,
  cdxIconSearch,
  cdxIconStar,
  cdxIconUserAvatar,
} from '@wikimedia/codex-icons'

import EditSuggestionsIndicator from './EditSuggestionsIndicator.vue'

const SCROLL_THRESHOLD = 150

defineProps<{
  title: string
  languagesLabel: string
  showIndicator: boolean
  pulse: boolean
}>()

defineEmits<{
  editClick: []
  historyClick: []
  watchClick: []
}>()

const visible = ref(false)

function onScroll() {
  visible.value = window.scrollY > SCROLL_THRESHOLD
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Teleport to="body">
    <header v-if="visible" class="vector-sticky-header" aria-label="Sticky header">
      <CdxButton weight="quiet" :icon-only="true" aria-label="Search">
        <CdxIcon :icon="cdxIconSearch" />
      </CdxButton>
      <span class="vector-sticky-header__title">{{ title }}</span>
      <div class="vector-sticky-header__actions">
        <CdxButton
          weight="quiet"
          :icon-only="true"
          aria-label="View history"
          @click="$emit('historyClick')"
        >
          <CdxIcon :icon="cdxIconHistory" />
        </CdxButton>
        <CdxButton weight="quiet" :icon-only="true" aria-label="Watch" @click="$emit('watchClick')">
          <CdxIcon :icon="cdxIconStar" />
        </CdxButton>
        <CdxButton weight="quiet" :icon-only="true" aria-label="Edit" @click="$emit('editClick')">
          <EditSuggestionsIndicator :show="showIndicator" :pulse="pulse">
            <CdxIcon :icon="cdxIconEdit" />
          </EditSuggestionsIndicator>
        </CdxButton>
        <CdxButton weight="quiet" class="vector-sticky-header__languages">
          <CdxIcon :icon="cdxIconLanguage" size="small" />
          {{ languagesLabel }}
          <CdxIcon :icon="cdxIconDownTriangle" size="x-small" />
        </CdxButton>
        <CdxButton weight="quiet" aria-label="User menu">
          <CdxIcon :icon="cdxIconUserAvatar" />
          <CdxIcon :icon="cdxIconDownTriangle" size="x-small" />
        </CdxButton>
      </div>
    </header>
  </Teleport>
</template>

<style scoped>
.vector-sticky-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  box-sizing: border-box;
  height: 48px;
  padding: 0 44px;
  border-bottom: 1px solid var(--border-color-subtle, #c8ccd1);
  background-color: var(--background-color-base, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-family: var(--font-family-base);
}

.vector-sticky-header__title {
  min-width: 0;
  max-width: 40%;
  margin-inline: var(--spacing-100, 16px) auto;
  overflow: hidden;
  font-family: var(--font-family-serif);
  font-size: 1.125rem;
  color: var(--color-base);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.vector-sticky-header__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-25, 4px);
}

.vector-sticky-header__languages {
  font-size: var(--font-size-small, 14px);
  font-weight: var(--font-weight-normal);
}
</style>
