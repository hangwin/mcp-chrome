<template>
  <div ref="rootRef" class="py-1 space-y-2">
    <!-- Text content -->
    <div
      v-if="hasText"
      class="text-sm leading-relaxed markdown-content"
      :style="{
        color: 'var(--ac-text)',
        fontFamily: 'var(--ac-font-body)',
      }"
    >
      <MarkdownRender
        :content="item.text"
        :max-live-nodes="0"
        :render-batch-size="16"
        :render-batch-delay="8"
        :smooth-streaming="true"
      />
    </div>

    <!-- Image-only message fallback text -->
    <span
      v-else-if="item.attachments.length > 0"
      class="text-xs italic"
      :style="{ color: 'var(--ac-text-subtle)' }"
    >
      Sent {{ item.attachments.length }} image{{ item.attachments.length === 1 ? '' : 's' }}
    </span>

    <!-- Attachment thumbnails -->
    <div v-if="item.attachments.length > 0" class="flex flex-wrap gap-2 mt-2">
      <button
        v-for="attachment in item.attachments"
        :key="`${attachment.messageId}:${attachment.index}`"
        type="button"
        class="relative group w-16 h-16 rounded-lg overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
        :style="{
          backgroundColor: 'var(--ac-surface-muted)',
          border: 'var(--ac-border-width) solid var(--ac-border)',
        }"
        :title="attachment.originalName"
        @click="openViewer(attachment)"
      >
        <img
          v-if="getAttachmentUrl(attachment)"
          :src="getAttachmentUrl(attachment)!"
          :alt="attachment.originalName"
          class="w-full h-full object-cover"
          loading="lazy"
        />
        <!-- Fallback placeholder when server not ready -->
        <div
          v-else
          class="w-full h-full flex items-center justify-center"
          :style="{ color: 'var(--ac-text-subtle)' }"
          title="Server not ready"
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

        <!-- Filename overlay on hover -->
        <div
          class="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 text-[8px] truncate opacity-0 group-hover:opacity-100 transition-opacity"
          :style="{
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
          }"
        >
          {{ attachment.originalName }}
        </div>
      </button>
    </div>

    <!-- Image Viewer Modal (teleported to avoid stacking context issues) -->
    <Teleport :to="overlayTarget" :disabled="!overlayTarget">
      <div
        v-if="viewerAttachment"
        class="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="closeViewer" />

        <!-- Image container -->
        <div
          class="relative max-w-[92vw] max-h-[92vh] overflow-hidden"
          :style="{
            backgroundColor: 'var(--ac-surface, #ffffff)',
            border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
            borderRadius: 'var(--ac-radius-card, 12px)',
            boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.2))',
          }"
        >
          <!-- Close button -->
          <button
            type="button"
            class="absolute top-2 right-2 p-1 rounded-full transition-colors hover:bg-black/20 cursor-pointer"
            :style="{ color: 'white' }"
            aria-label="Close image preview"
            @click="closeViewer"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Full-size image -->
          <img
            v-if="viewerUrl"
            :src="viewerUrl"
            :alt="viewerAttachment.originalName"
            class="block max-w-[92vw] max-h-[92vh] object-contain"
          />
          <div v-else class="p-6 text-sm" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
            Agent server not ready (missing server port).
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import MarkdownRender from 'markstream-vue';
import 'markstream-vue/index.css';
import { AGENT_SERVER_PORT_KEY, type TimelineItem } from '../../../composables';

const props = defineProps<{
  item: Extract<TimelineItem, { kind: 'user_prompt' }>;
}>();

type UserPromptItem = Extract<TimelineItem, { kind: 'user_prompt' }>;
type UserPromptAttachment = UserPromptItem['attachments'][number];

// Inject server port from parent
const serverPort = inject(AGENT_SERVER_PORT_KEY, ref<number | null>(null));

// Compute base URL for attachment requests
const baseUrl = computed(() => {
  const port = serverPort.value;
  if (!Number.isInteger(port) || port === null || port <= 0) return null;
  return `http://127.0.0.1:${port}`;
});

/**
 * Build full URL for an attachment.
 * Ensures urlPath starts with / for proper concatenation.
 */
function getAttachmentUrl(attachment: UserPromptAttachment): string | null {
  const base = baseUrl.value;
  if (!base) return null;
  const path = attachment.urlPath.startsWith('/') ? attachment.urlPath : `/${attachment.urlPath}`;
  return `${base}${path}`;
}

// Check if message has text content
const hasText = computed(() => (props.item.text || '').trim().length > 0);

// Teleport target for modal overlay
const rootRef = ref<HTMLElement | null>(null);
const overlayTarget = ref<Element | null>(null);

// Image viewer state
const viewerAttachment = ref<UserPromptAttachment | null>(null);
const viewerUrl = computed(() => {
  if (!viewerAttachment.value) return null;
  return getAttachmentUrl(viewerAttachment.value);
});

function openViewer(attachment: UserPromptAttachment): void {
  viewerAttachment.value = attachment;
}

function closeViewer(): void {
  viewerAttachment.value = null;
}

// Handle Escape key to close viewer
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && viewerAttachment.value) {
    closeViewer();
  }
}

// Register/unregister keyboard listener only when viewer is open
watch(
  () => viewerAttachment.value,
  (current, _prev, onCleanup) => {
    if (!current) return;
    document.addEventListener('keydown', handleKeydown);
    onCleanup(() => document.removeEventListener('keydown', handleKeydown));
  },
);

onMounted(() => {
  // Find teleport target (agent-theme container or body)
  overlayTarget.value =
    rootRef.value?.closest('.agent-theme') ?? rootRef.value?.ownerDocument?.body ?? null;
});
</script>

<style scoped>
.markdown-content :deep(pre) {
  background-color: var(--ac-code-bg);
  border: var(--ac-border-width) solid var(--ac-code-border);
  border-radius: var(--ac-radius-inner);
  padding: 12px;
  overflow-x: auto;
}

.markdown-content :deep(code) {
  font-family: var(--ac-font-mono);
  font-size: 0.875em;
  color: var(--ac-code-text);
}

.markdown-content :deep(p) {
  margin: 0.5em 0;
}

.markdown-content :deep(p:first-child) {
  margin-top: 0;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 0.75em 0 0.5em;
  font-weight: 600;
}

.markdown-content :deep(blockquote) {
  border-left: var(--ac-border-width-strong) solid var(--ac-border);
  padding-left: 1em;
  margin: 0.5em 0;
  color: var(--ac-text-muted);
}

.markdown-content :deep(a) {
  color: var(--ac-link);
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: var(--ac-link-hover);
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: var(--ac-border-width) solid var(--ac-border);
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: var(--ac-surface-muted);
}

.markdown-content :deep(hr) {
  border: none;
  border-top: var(--ac-border-width) solid var(--ac-border);
  margin: 1em 0;
}

.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--ac-radius-inner);
}
</style>
