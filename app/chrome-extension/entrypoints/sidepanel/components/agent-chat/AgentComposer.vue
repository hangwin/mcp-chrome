<template>
  <div class="relative" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
    <!-- Drag overlay -->
    <div
      v-if="isDragOver"
      class="absolute inset-0 z-10 flex items-center justify-center rounded-lg pointer-events-none"
      :style="{
        backgroundColor: 'var(--ac-accent)',
        opacity: 0.1,
        border: '2px dashed var(--ac-accent)',
      }"
    >
      <span class="text-sm font-medium" :style="{ color: 'var(--ac-accent)' }">
        {{ m('dropImagesHere') }}
      </span>
    </div>

    <!-- Image Previews (thumbnails) -->
    <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 mb-2 px-1">
      <div v-for="(attachment, index) in attachments" :key="index" class="relative group">
        <!-- Thumbnail container -->
        <div
          class="w-14 h-14 rounded-lg overflow-hidden"
          :style="{
            backgroundColor: 'var(--ac-surface-muted)',
            border: 'var(--ac-border-width) solid var(--ac-border)',
          }"
        >
          <img
            v-if="attachment.type === 'image' && attachment.previewUrl"
            :src="attachment.previewUrl"
            :alt="attachment.name"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
            :style="{ color: 'var(--ac-text-subtle)' }"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <!-- Remove button (appears on hover) -->
        <button
          class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          :style="{
            backgroundColor: 'var(--ac-error)',
            color: 'white',
          }"
          :title="m('removeImageTitle')"
          @click="$emit('attachment:remove', index)"
        >
          <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <!-- Filename tooltip on hover -->
        <div
          class="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 text-[8px] truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg"
          :style="{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
          }"
        >
          {{ attachment.name }}
        </div>
      </div>
    </div>

    <!-- Attachment error message -->
    <div v-if="attachmentError" class="px-1 mb-1 text-xs" :style="{ color: 'var(--ac-error)' }">
      {{ attachmentError }}
    </div>

    <!-- Floating Input Card -->
    <div
      class="flex flex-col transition-all"
      :style="{
        backgroundColor: 'var(--ac-surface)',
        borderRadius: 'var(--ac-radius-card)',
        border: isDragOver
          ? '2px solid var(--ac-accent)'
          : 'var(--ac-border-width) solid var(--ac-border)',
        boxShadow: 'var(--ac-shadow-float)',
      }"
    >
      <!-- Textarea wrapper with expand button -->
      <div class="relative">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          :class="[
            'w-full bg-transparent border-none focus:ring-0 focus:outline-none resize-none p-3 text-sm',
            showExpandButton ? 'pr-10' : '',
          ]"
          :style="{
            height: `${textareaHeight}px`,
            minHeight: `${MIN_HEIGHT}px`,
            maxHeight: `${MAX_HEIGHT}px`,
            overflowY: isOverflowing ? 'auto' : 'hidden',
            fontFamily: 'var(--ac-font-body)',
            color: 'var(--ac-text)',
          }"
          :placeholder="placeholder"
          rows="1"
          @input="handleInput"
          @keydown.enter.exact.prevent="handleEnter"
          @paste="handlePaste"
        />

        <!-- Fake caret overlay (opt-in comet effect, only mount when enabled) -->
        <FakeCaretOverlay
          v-if="enableFakeCaret"
          :textarea-ref="textareaRef"
          :enabled="true"
          :value="modelValue"
        />

        <!-- Expand button (visible when content exceeds max height) -->
        <Transition name="expand-btn">
          <button
            v-if="showExpandButton"
            type="button"
            class="absolute top-2 right-2 p-1.5 transition-all hover:scale-105 cursor-pointer"
            :style="expandButtonStyle"
            :title="m('expandEditorTitle')"
            @click="openDrawer"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        </Transition>
      </div>

      <div class="flex items-center justify-between px-2 pb-2">
        <!-- Left Tools -->
        <div class="flex items-center gap-1">
          <!-- Attach Button -->
          <button
            v-if="supportsImages"
            class="p-1.5 ac-btn"
            :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
            :data-tooltip="m('attachImageTooltip')"
            @click="$emit('attachment:add')"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          <!-- Model Selector (auto-width) -->
          <div
            v-if="availableModels.length > 0"
            class="relative"
            :data-tooltip="m('switchModelTooltip')"
          >
            <!-- Hidden span to measure text width -->
            <span
              ref="modelWidthRef"
              class="invisible absolute whitespace-nowrap px-1.5 text-[10px]"
              :style="{ fontFamily: 'var(--ac-font-mono)' }"
            >
              {{ selectedModelName }}
            </span>
            <select
              :value="selectedModel"
              class="py-0.5 text-[10px] border-none bg-transparent cursor-pointer appearance-none pr-4 pl-1.5"
              :style="{
                color: 'var(--ac-text-muted)',
                fontFamily: 'var(--ac-font-mono)',
                width: modelSelectWidth,
                borderRadius: 'var(--ac-radius-button)',
              }"
              @change="handleModelChange"
            >
              <option v-for="m in availableModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
            <!-- Dropdown arrow -->
            <svg
              class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              :style="{ color: 'var(--ac-text-subtle)' }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <!-- Reasoning Effort (Codex only) -->
          <select
            v-if="
              isCodexEngine && availableReasoningEfforts && availableReasoningEfforts.length > 0
            "
            :value="reasoningEffort"
            class="px-1.5 py-0.5 text-[10px] border-none bg-transparent cursor-pointer"
            :style="{
              color: 'var(--ac-text-muted)',
              fontFamily: 'var(--ac-font-mono)',
              borderRadius: 'var(--ac-radius-button)',
            }"
            :data-tooltip="m('reasoningEffortTooltip')"
            @change="handleReasoningEffortChange"
          >
            <option v-for="effort in availableReasoningEfforts" :key="effort" :value="effort">
              {{ effort }}
            </option>
          </select>

          <!-- Reset Button -->
          <button
            class="p-1 ac-btn"
            :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
            :data-tooltip="m('resetConversationTitle')"
            @click="handleReset"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <!-- Session Settings Button -->
          <button
            class="p-1 ac-btn"
            :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
            :data-tooltip="m('sessionSettingsTitle')"
            @click="handleOpenSettings"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </button>

          <!-- Status Text -->
          <div class="text-[11px] ml-1 flex items-center gap-1" :style="{ color: statusColor }">
            <span
              v-if="sending || isRequestActive"
              class="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              :style="{ backgroundColor: 'var(--ac-accent)' }"
            />
            {{ statusText }}
          </div>
        </div>

        <!-- Right Actions -->
        <div class="flex gap-2">
          <!-- Primary Action Button: Send (idle) / Stop (loading) -->
          <button
            type="button"
            class="p-1 transition-colors cursor-pointer"
            :style="primaryActionButtonStyle"
            :disabled="primaryActionDisabled"
            :title="isRequestActive ? m('stopRequestLabel') : m('sendMessageLabel')"
            :aria-label="isRequestActive ? m('stopRequestLabel') : m('sendMessageLabel')"
            @click="handlePrimaryAction"
          >
            <!-- Stop icon (square) when request is active -->
            <svg v-if="isRequestActive" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <!-- Send icon (arrow up) when idle -->
            <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Expanded editor drawer -->
    <ComposerDrawer
      :open="isDrawerOpen"
      :model-value="modelValue"
      :placeholder="placeholder"
      :attachments="attachments"
      :attachment-error="attachmentError"
      :request-state="requestState"
      :sending="sending"
      :cancelling="cancelling"
      :can-cancel="canCancel"
      :can-send="canSend"
      :enable-fake-caret="enableFakeCaret"
      @close="closeDrawer"
      @update:model-value="handleDrawerInput"
      @submit="handleSubmit"
      @cancel="$emit('cancel')"
      @attachment:remove="$emit('attachment:remove', $event)"
      @paste="handlePaste"
    >
      <template #left-actions>
        <div class="flex items-center gap-1">
          <!-- Attach Button -->
          <button
            v-if="supportsImages"
            class="p-1.5 ac-btn"
            :style="{ color: 'var(--ac-text-subtle)', borderRadius: 'var(--ac-radius-button)' }"
            :data-tooltip="m('attachImageTooltip')"
            @click="$emit('attachment:add')"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          <!-- Model Selector -->
          <div
            v-if="availableModels.length > 0"
            class="relative"
            :data-tooltip="m('switchModelTooltip')"
          >
            <select
              :value="selectedModel"
              class="py-0.5 text-[10px] border-none bg-transparent cursor-pointer appearance-none pr-4 pl-1.5"
              :style="{
                color: 'var(--ac-text-muted)',
                fontFamily: 'var(--ac-font-mono)',
                borderRadius: 'var(--ac-radius-button)',
              }"
              @change="handleModelChange"
            >
              <option v-for="m in availableModels" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>
            <svg
              class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              :style="{ color: 'var(--ac-text-subtle)' }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <!-- Status Text -->
          <div class="text-[11px] ml-1 flex items-center gap-1" :style="{ color: statusColor }">
            <span
              v-if="sending || isRequestActive"
              class="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              :style="{ backgroundColor: 'var(--ac-accent)' }"
            />
            {{ statusText }}
          </div>
        </div>
      </template>
    </ComposerDrawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, toRef } from 'vue';
import type { CodexReasoningEffort } from 'chrome-mcp-shared';
import type { ModelDefinition } from '@/common/agent-models';
import type { AttachmentWithPreview } from '../../composables/useAttachments';
import type { RequestState } from '../../composables/useAgentChat';
import { useTextareaAutoResize } from '../../composables/useTextareaAutoResize';
import type { ElementReferenceData } from '../../composables/useElementReferences';
import { getMessage } from '@/utils/i18n';
import ComposerDrawer from './ComposerDrawer.vue';
import FakeCaretOverlay from './FakeCaretOverlay.vue';

// i18n helper
const m = (key: string, substitutions?: string[]) => getMessage(key, substitutions);

const props = defineProps<{
  modelValue: string;
  attachments: AttachmentWithPreview[];
  attachmentError?: string | null;
  isDragOver?: boolean;
  /** Message-level streaming state (delta updates) */
  isStreaming: boolean;
  /** Request lifecycle state for UI (stop button, loading indicators) */
  requestState: RequestState;
  sending: boolean;
  cancelling: boolean;
  canCancel: boolean;
  canSend: boolean;
  placeholder?: string;
  // Model selection props
  engineName?: string;
  selectedModel: string;
  availableModels: ModelDefinition[];
  // Codex reasoning effort props
  reasoningEffort?: CodexReasoningEffort;
  availableReasoningEfforts?: readonly CodexReasoningEffort[];
  // Fake caret feature flag
  enableFakeCaret?: boolean;
}>();

/**
 * Whether there is an active request in progress.
 * Derived from requestState for use in UI conditions.
 */
const isRequestActive = computed(() => {
  return (
    props.requestState === 'starting' ||
    props.requestState === 'ready' ||
    props.requestState === 'running'
  );
});

const isCodexEngine = computed(() => props.engineName === 'codex');

// Image upload is supported for Claude and Codex engines
const supportsImages = computed(() => {
  const engine = props.engineName;
  return engine === 'claude' || engine === 'codex';
});

// Model selector auto-width
const modelWidthRef = ref<HTMLSpanElement | null>(null);
const modelSelectWidth = ref('auto');

const selectedModelName = computed(() => {
  const model = props.availableModels.find((m) => m.id === props.selectedModel);
  return model?.name || props.selectedModel || '';
});

// Update width when model changes
watch(
  [selectedModelName, () => props.availableModels],
  async () => {
    await nextTick();
    if (modelWidthRef.value) {
      const width = modelWidthRef.value.offsetWidth;
      // Add extra space for dropdown arrow (16px)
      modelSelectWidth.value = `${width + 16}px`;
    }
  },
  { immediate: true },
);

const statusText = computed(() => {
  if (props.sending) return m('statusSending');
  if (props.cancelling) return m('statusStopping');
  // Use requestState for more accurate status display
  switch (props.requestState) {
    case 'starting':
      return m('statusStarting');
    case 'ready':
      return m('statusPreparing');
    case 'running':
      return m('statusWorking');
    default:
      return m('statusReady');
  }
});

const statusColor = computed(() => {
  if (props.sending || isRequestActive.value) return 'var(--ac-accent)';
  return 'var(--ac-text-subtle)';
});

// =============================================================================
// Primary Action Button (Send / Stop)
// =============================================================================

/**
 * Style for the primary action button.
 * Changes based on whether a request is active.
 */
const primaryActionButtonStyle = computed(() => {
  const baseStyle = {
    borderRadius: 'var(--ac-radius-button)',
    // Always have border to prevent size change when switching modes
    border: 'var(--ac-border-width) solid transparent',
  };

  if (isRequestActive.value) {
    // Stop mode: danger style
    const isDisabled = props.cancelling || !props.canCancel;
    return {
      ...baseStyle,
      backgroundColor: 'var(--ac-diff-del-bg)',
      color: 'var(--ac-danger)',
      border: 'var(--ac-border-width) solid var(--ac-diff-del-border)',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
    };
  }

  // Send mode: accent style when enabled, muted when disabled
  return {
    ...baseStyle,
    backgroundColor: props.canSend ? 'var(--ac-accent)' : 'var(--ac-surface-muted)',
    color: props.canSend ? 'var(--ac-accent-contrast)' : 'var(--ac-text-subtle)',
    cursor: props.canSend ? 'pointer' : 'not-allowed',
  };
});

/**
 * Whether the primary action button should be disabled.
 */
const primaryActionDisabled = computed(() => {
  if (isRequestActive.value) {
    // In stop mode: disabled when already cancelling or cannot cancel
    return props.cancelling || !props.canCancel;
  }
  // In send mode: disabled when cannot send
  return !props.canSend;
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
  cancel: [];
  'attachment:add': [];
  'attachment:remove': [index: number];
  'attachment:drop': [event: DragEvent];
  'attachment:paste': [event: ClipboardEvent];
  'attachment:dragover': [event: DragEvent];
  'attachment:dragleave': [event: DragEvent];
  'model:change': [modelId: string];
  'reasoning-effort:change': [effort: CodexReasoningEffort];
  'session:settings': [];
  'session:reset': [];
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

// =============================================================================
// Textarea Auto-Resize
// =============================================================================

const MIN_HEIGHT = 50;
const MAX_HEIGHT = 200;

const { height: textareaHeight, isOverflowing } = useTextareaAutoResize({
  textareaRef,
  value: toRef(props, 'modelValue'),
  minHeight: MIN_HEIGHT,
  maxHeight: MAX_HEIGHT,
});

// Show expand button when content exceeds max height
const showExpandButton = computed(() => isOverflowing.value);

// Expand button style
const expandButtonStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface-muted)',
  color: 'var(--ac-text)',
  border: 'var(--ac-border-width) solid var(--ac-border)',
  borderRadius: 'var(--ac-radius-button)',
}));

// =============================================================================
// Expanded Editor Drawer
// =============================================================================

const isDrawerOpen = ref(false);

function openDrawer(): void {
  isDrawerOpen.value = true;
}

function closeDrawer(): void {
  isDrawerOpen.value = false;
  // Focus back to main textarea
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

function handleDrawerInput(value: string): void {
  emit('update:modelValue', value);
}

// =============================================================================
// Input Handlers
// =============================================================================

function handleInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value;
  emit('update:modelValue', value);
}

function handleEnter(): void {
  // Don't send when request is active (button shows Stop, not Send)
  if (isRequestActive.value) return;
  if (props.canSend && !props.sending) {
    emit('submit');
  }
}

function handleSubmit(): void {
  emit('submit');
}

/**
 * Handle primary action button click.
 * Sends message when idle, cancels request when active.
 */
function handlePrimaryAction(): void {
  if (isRequestActive.value) {
    emit('cancel');
  } else {
    handleSubmit();
  }
}

function handleModelChange(event: Event): void {
  const modelId = (event.target as HTMLSelectElement).value;
  emit('model:change', modelId);
}

function handleReasoningEffortChange(event: Event): void {
  const effort = (event.target as HTMLSelectElement).value as CodexReasoningEffort;
  emit('reasoning-effort:change', effort);
}

function handleReset(): void {
  if (confirm(m('resetConversationConfirm'))) {
    emit('session:reset');
  }
}

function handleOpenSettings(): void {
  emit('session:settings');
}

// Drag and drop handlers - delegate to parent
// Always preventDefault to avoid browser default behavior (opening files)
function handleDragOver(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (supportsImages.value) {
    emit('attachment:dragover', event);
  }
}

function handleDragLeave(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (supportsImages.value) {
    emit('attachment:dragleave', event);
  }
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  event.stopPropagation();
  if (supportsImages.value) {
    emit('attachment:drop', event);
  }
}

// Paste handler - delegate to parent
function handlePaste(event: ClipboardEvent): void {
  if (supportsImages.value) {
    // Check if clipboard contains images
    const items = event.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          emit('attachment:paste', event);
          return;
        }
      }
    }
  }
  // Let text paste through normally
}

// Expose ref for parent focus control
defineExpose({
  focus: () => textareaRef.value?.focus(),
});
</script>

<style scoped>
/* Expand button transition */
.expand-btn-enter-active,
.expand-btn-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.expand-btn-enter-from,
.expand-btn-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
