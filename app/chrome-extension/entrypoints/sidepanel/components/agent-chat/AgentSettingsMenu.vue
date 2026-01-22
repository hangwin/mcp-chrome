<template>
  <div
    v-if="open"
    class="fixed top-12 right-4 z-50 min-w-[180px] py-2"
    :style="{
      backgroundColor: 'var(--ac-surface, #ffffff)',
      border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      borderRadius: 'var(--ac-radius-inner, 8px)',
      boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
    }"
  >
    <!-- Theme Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ m('themeLabel') }}
    </div>

    <button
      v-for="t in themes"
      :key="t.id"
      class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
      :style="{
        color: theme === t.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
      }"
      @click="$emit('theme:set', t.id)"
    >
      <span>{{ t.label }}</span>
      <svg
        v-if="theme === t.id"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Input Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ m('inputSectionLabel') }}
    </div>

    <button
      class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('fakeCaret:toggle', !fakeCaretEnabled)"
    >
      <span>{{ m('cometCaretLabel') }}</span>
      <svg
        v-if="fakeCaretEnabled"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Storage Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      {{ m('storageSectionLabel') }}
    </div>

    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('attachments:open')"
    >
      {{ m('clearAttachmentCacheLabel') }}
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{
        borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      }"
    />

    <!-- Reconnect -->
    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-text, #1a1a1a)' }"
      @click="$emit('reconnect')"
    >
      {{ m('reconnectServerLabel') }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { type AgentThemeId, THEME_LABELS } from '../../composables';
import { getMessage } from '@/utils/i18n';

// i18n helper
const m = (key: string, substitutions?: string[]) => getMessage(key, substitutions);

defineProps<{
  open: boolean;
  theme: AgentThemeId;
  /** Fake caret (comet effect) enabled state */
  fakeCaretEnabled?: boolean;
}>();

defineEmits<{
  'theme:set': [theme: AgentThemeId];
  reconnect: [];
  'attachments:open': [];
  'fakeCaret:toggle': [enabled: boolean];
}>();

const themes: { id: AgentThemeId; label: string }[] = [
  { id: 'warm-editorial', label: THEME_LABELS['warm-editorial'] },
  { id: 'blueprint-architect', label: THEME_LABELS['blueprint-architect'] },
  { id: 'zen-journal', label: THEME_LABELS['zen-journal'] },
  { id: 'neo-pop', label: THEME_LABELS['neo-pop'] },
  { id: 'dark-console', label: THEME_LABELS['dark-console'] },
  { id: 'swiss-grid', label: THEME_LABELS['swiss-grid'] },
];
</script>
