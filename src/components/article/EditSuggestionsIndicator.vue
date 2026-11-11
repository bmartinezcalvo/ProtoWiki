<script setup lang="ts">
/**
 * Wraps an Edit icon (pencil) with the suggestions lightbulb badge in its
 * bottom-end corner, and an optional pulse ring for first-time editors.
 */
defineProps<{
  show: boolean
  pulse?: boolean
}>()
</script>

<template>
  <span class="edit-suggestions-indicator">
    <slot />
    <template v-if="show">
      <span v-if="pulse" class="edit-suggestions-indicator__pulse" />
      <svg
        class="edit-suggestions-indicator__badge"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <path d="M7.84615 12H4.15385V10.8H7.84615V12Z" />
        <path
          d="M6 0C7.19241 0 8.20276 0.333393 8.92007 0.986133C9.64163 1.64275 10 2.56229 10 3.6C10 4.93159 9.29275 5.83918 8.74459 6.43652C8.34865 6.86802 8.15385 7.41601 8.15385 8.0332V9.6H3.84615V8.0332C3.84615 7.41601 3.65136 6.86802 3.25541 6.43652C2.70725 5.83918 2 4.93159 2 3.6C2 2.62372 2.36504 1.71301 3.07272 1.04707C3.78125 0.380328 4.78878 0 6 0Z"
        />
      </svg>
    </template>
  </span>
</template>

<!-- Global: Minerva section headings build the same markup outside Vue. -->
<style>
.edit-suggestions-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.edit-suggestions-indicator__badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  z-index: 1;
  fill: #4b77d6;
  pointer-events: none;
}

.edit-suggestions-indicator__pulse {
  position: absolute;
  right: 2px;
  bottom: 2px;
  z-index: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: rgba(51, 102, 204, 0.2);
  box-shadow: 0 0 0 0 rgba(51, 102, 204, 0.4);
  animation: edit-suggestions-indicator-pulse 1.5s ease-out infinite;
  pointer-events: none;
}

@keyframes edit-suggestions-indicator-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(51, 102, 204, 0.4);
  }
  70% {
    box-shadow: 0 0 0 14px rgba(51, 102, 204, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(51, 102, 204, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .edit-suggestions-indicator__pulse {
    animation: none;
  }
}
</style>
