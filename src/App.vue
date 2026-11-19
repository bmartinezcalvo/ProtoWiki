<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'

import SettingsPopover from '@/components/settings/SettingsPopover.vue'
import UserSettingsPanel from '@/components/settings/UserSettingsPanel.vue'

/**
 * Keyboard shortcut for Mock settings, for screens with no header button (e.g. the
 * Minerva editor): Control + M ("M" for Mock). Not Cmd + M — macOS keeps that one to
 * minimise the window, so the page never receives it.
 */
let toggleSettings: (() => void) | null = null

function onKeydown(event: KeyboardEvent) {
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.code !== 'KeyM') return
  event.preventDefault()
  toggleSettings?.()
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <RouterView />
  <div class="app-settings-shortcut">
    <SettingsPopover>
      <template #default="{ toggle }">
        <span :ref="() => (toggleSettings = toggle)" />
      </template>
      <template #panel>
        <UserSettingsPanel />
      </template>
    </SettingsPopover>
  </div>
</template>

<style scoped>
/* Invisible anchor at the top-right corner, where the header's settings button sits. */
.app-settings-shortcut {
  position: fixed;
  top: 8px;
  right: 8px;
  width: 0;
  height: 0;
  overflow: visible;
}
</style>
