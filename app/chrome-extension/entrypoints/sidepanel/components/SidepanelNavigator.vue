<template>
  <div
    ref="wrapperRef"
    class="navigator-wrapper"
    :style="wrapperStyle"
    :class="{ 'navigator-dragging': isDragging }"
  >
    <!-- Trigger button (also serves as drag handle) -->
    <button
      ref="triggerRef"
      class="navigator-trigger"
      :class="{ 'navigator-trigger-active': isOpen }"
      @click="handleTriggerClick"
      @dblclick="resetToDefault"
      :title="getMessage('navigatorTriggerTooltip')"
    >
      <svg
        class="navigator-icon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <!-- Floating menu -->
    <Transition name="navigator-menu">
      <div v-if="isOpen" class="navigator-overlay" @click="closeMenu">
        <div class="navigator-menu" :style="menuStyle" @click.stop>
          <div class="navigator-header">
            <span class="navigator-title">{{ getMessage('switchPageTitle') }}</span>
            <button class="navigator-close" @click="closeMenu">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="navigator-items">
            <button
              class="navigator-item"
              :class="{ 'navigator-item-active': activeTab === 'agent-chat' }"
              @click="selectTab('agent-chat')"
            >
              <div class="navigator-item-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div class="navigator-item-content">
                <span class="navigator-item-title">{{ getMessage('smartAssistantTitle') }}</span>
                <span class="navigator-item-desc">{{ getMessage('smartAssistantDesc') }}</span>
              </div>
              <div v-if="activeTab === 'agent-chat'" class="navigator-item-check">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
            <button
              class="navigator-item"
              :class="{ 'navigator-item-active': activeTab === 'workflows' }"
              @click="selectTab('workflows')"
            >
              <div class="navigator-item-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
              </div>
              <div class="navigator-item-content">
                <span class="navigator-item-title">{{
                  getMessage('workflowManagementTitle')
                }}</span>
                <span class="navigator-item-desc">{{ getMessage('workflowManagementDesc') }}</span>
              </div>
              <div v-if="activeTab === 'workflows'" class="navigator-item-check">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
            <button
              class="navigator-item"
              :class="{ 'navigator-item-active': activeTab === 'element-markers' }"
              @click="selectTab('element-markers')"
            >
              <div class="navigator-item-icon">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <div class="navigator-item-content">
                <span class="navigator-item-title">{{
                  getMessage('elementMarkerManagementTitle')
                }}</span>
                <span class="navigator-item-desc">{{
                  getMessage('elementMarkerManagementDesc')
                }}</span>
              </div>
              <div v-if="activeTab === 'element-markers'" class="navigator-item-check">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useFloatingDrag } from '../composables/useFloatingDrag';
import { getMessage } from '@/utils/i18n';

type TabType = 'workflows' | 'element-markers' | 'agent-chat';

const BUTTON_SIZE = 36;
const CLAMP_MARGIN = 12;

const props = defineProps<{
  activeTab: TabType;
}>();

const emit = defineEmits<{
  (e: 'change', tab: TabType): void;
}>();

const isOpen = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);

// Initialize floating drag
const { positionStyle, isDragging, resetToDefault } = useFloatingDrag(triggerRef, wrapperRef, {
  clampMargin: CLAMP_MARGIN,
  clickThresholdMs: 150,
  moveThresholdPx: 5,
  getDefaultPosition: () => ({
    left: window.innerWidth - BUTTON_SIZE - CLAMP_MARGIN,
    top: window.innerHeight - BUTTON_SIZE - CLAMP_MARGIN,
  }),
});

// Wrapper style with dynamic position
const wrapperStyle = computed(() => ({
  left: positionStyle.value.left,
  top: positionStyle.value.top,
}));

// Menu position: prefer appearing above and to the left of the trigger
const menuStyle = computed(() => {
  // Menu appears in fixed position near the trigger
  return {};
});

function handleTriggerClick() {
  // Only toggle menu if not currently dragging
  if (!isDragging.value) {
    isOpen.value = !isOpen.value;
  }
}

function closeMenu() {
  isOpen.value = false;
}

function selectTab(tab: TabType) {
  emit('change', tab);
  closeMenu();
}
</script>

<style scoped>
.navigator-wrapper {
  position: fixed;
  z-index: 1000;
  touch-action: none;
}

.navigator-dragging {
  cursor: grabbing;
}

.navigator-trigger {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-surface, #ffffff);
  border: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  cursor: grab;
  transition: all var(--ac-motion-fast, 120ms) ease;
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  touch-action: none;
  user-select: none;
}

.navigator-trigger:hover {
  background: var(--ac-hover-bg, #f5f5f4);
  color: var(--ac-text, #1a1a1a);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
}

.navigator-trigger:active,
.navigator-dragging .navigator-trigger {
  cursor: grabbing;
}

.navigator-trigger-active {
  background: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, #ffffff);
  border-color: var(--ac-accent, #d97757);
}

.navigator-trigger-active:hover {
  background: var(--ac-accent-hover, #c4664a);
  color: var(--ac-accent-contrast, #ffffff);
}

.navigator-icon {
  flex-shrink: 0;
  pointer-events: none;
}

.navigator-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 12px;
}

.navigator-menu {
  width: 280px;
  max-height: calc(100vh - 80px);
  background: var(--ac-surface, #ffffff);
  border: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
  overflow: hidden;
}

.navigator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
}

.navigator-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ac-text, #1a1a1a);
}

.navigator-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.navigator-close:hover {
  background: var(--ac-hover-bg, #f5f5f4);
  color: var(--ac-text, #1a1a1a);
}

.navigator-items {
  padding: 8px;
}

.navigator-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: var(--ac-radius-inner, 8px);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  text-align: left;
}

.navigator-item:hover {
  background: var(--ac-hover-bg, #f5f5f4);
}

.navigator-item-active {
  background: var(--ac-accent-subtle, rgba(217, 119, 87, 0.12));
}

.navigator-item-active:hover {
  background: var(--ac-accent-subtle, rgba(217, 119, 87, 0.12));
}

.navigator-item-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-surface-muted, #f2f0eb);
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  flex-shrink: 0;
}

.navigator-item-active .navigator-item-icon {
  background: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, #ffffff);
}

.navigator-item-content {
  flex: 1;
  min-width: 0;
}

.navigator-item-title {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--ac-text, #1a1a1a);
  line-height: 1.3;
}

.navigator-item-desc {
  display: block;
  font-size: 12px;
  color: var(--ac-text-subtle, #a8a29e);
  line-height: 1.3;
  margin-top: 2px;
}

.navigator-item-check {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ac-accent, #d97757);
  flex-shrink: 0;
}

/* Transition animations */
.navigator-menu-enter-active,
.navigator-menu-leave-active {
  transition: opacity var(--ac-motion-fast, 120ms) ease;
}

.navigator-menu-enter-active .navigator-menu,
.navigator-menu-leave-active .navigator-menu {
  transition:
    transform var(--ac-motion-fast, 120ms) ease,
    opacity var(--ac-motion-fast, 120ms) ease;
}

.navigator-menu-enter-from,
.navigator-menu-leave-to {
  opacity: 0;
}

.navigator-menu-enter-from .navigator-menu,
.navigator-menu-leave-to .navigator-menu {
  opacity: 0;
  transform: translateY(8px);
}
</style>
