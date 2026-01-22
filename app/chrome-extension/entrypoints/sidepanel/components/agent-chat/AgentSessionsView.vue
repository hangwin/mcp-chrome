<template>
  <div class="h-full flex flex-col" :style="containerStyle">
    <!-- Header: Search + New Button -->
    <div class="flex-shrink-0 px-4 py-3 border-b" :style="headerStyle">
      <div class="flex items-center gap-2">
        <!-- Search Input -->
        <div class="flex-1 relative">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            :style="{ color: 'var(--ac-text-subtle)' }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="m('searchSessionsPlaceholder')"
            class="w-full pl-9 pr-3 py-2 text-sm"
            :style="inputStyle"
          />
        </div>

        <!-- New Session Button -->
        <button
          class="flex-shrink-0 px-3 py-2 text-sm font-medium cursor-pointer"
          :style="newButtonStyle"
          :disabled="isCreating"
          @click="handleNewSession"
        >
          <span v-if="isCreating">{{ m('creatingLabel') }}</span>
          <span v-else class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {{ m('newLabel') }}
          </span>
        </button>
      </div>
    </div>

    <!-- Sessions List -->
    <div class="flex-1 overflow-y-auto ac-scroll">
      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center py-12"
        :style="{ color: 'var(--ac-text-muted)' }"
      >
        <span class="text-sm">{{ m('loadingSessionsStatus') }}</span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredSessions.length === 0"
        class="flex flex-col items-center justify-center py-12 px-4"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          :style="{ backgroundColor: 'var(--ac-surface-muted)' }"
        >
          <svg
            class="w-8 h-8"
            :style="{ color: 'var(--ac-text-subtle)' }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <div class="text-sm font-medium mb-1" :style="{ color: 'var(--ac-text)' }">
          {{ searchQuery ? m('noMatchingSessions') : m('noSessionsYet') }}
        </div>
        <div class="text-xs text-center mb-4" :style="{ color: 'var(--ac-text-muted)' }">
          {{ searchQuery ? m('tryDifferentSearch') : m('startConversationHint') }}
        </div>
        <button
          v-if="!searchQuery"
          class="px-4 py-2 text-sm font-medium cursor-pointer"
          :style="newButtonStyle"
          @click="handleNewSession"
        >
          {{ m('startNewSessionButton') }}
        </button>
      </div>

      <!-- Session Items -->
      <div v-else>
        <AgentSessionListItem
          v-for="session in filteredSessions"
          :key="session.id"
          :session="session"
          :project-path="getProjectPath(session)"
          :selected="selectedSessionId === session.id"
          :is-running="isSessionRunning(session.id)"
          @click="handleSessionClick"
          @rename="handleSessionRename"
          @delete="handleSessionDelete"
          @open-project="handleSessionOpenProject"
        />
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="error"
      class="flex-shrink-0 px-4 py-2 text-xs"
      :style="{ color: 'var(--ac-danger)', backgroundColor: 'var(--ac-surface-muted)' }"
    >
      {{ error }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { AgentSession, AgentProject } from 'chrome-mcp-shared';
import { getMessage } from '@/utils/i18n';
import AgentSessionListItem from './AgentSessionListItem.vue';

// i18n helper
const m = (key: string, substitutions?: string[]) => getMessage(key, substitutions);

// =============================================================================
// Props & Emits
// =============================================================================

const props = defineProps<{
  sessions: AgentSession[];
  selectedSessionId: string;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  /**
   * Map of sessionId -> running status.
   * Used to display running badge on sessions with active executions.
   */
  runningSessionIds?: Set<string>;
  /**
   * Map of projectId -> AgentProject for looking up project paths.
   * Used to display project path for each session.
   */
  projectsMap?: Map<string, AgentProject>;
}>();

const emit = defineEmits<{
  'session:select': [sessionId: string];
  'session:new': [];
  'session:delete': [sessionId: string];
  'session:rename': [sessionId: string, name: string];
  'session:open-project': [sessionId: string];
}>();

// =============================================================================
// Local State
// =============================================================================

const searchQuery = ref('');

// =============================================================================
// Computed
// =============================================================================

/**
 * Filter sessions by search query.
 * Searches in: name, preview, model, engineName
 */
const filteredSessions = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) {
    // Sort by updatedAt descending (most recent first)
    return [...props.sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  return props.sessions
    .filter((session) => {
      const searchFields = [
        session.name || '',
        session.preview || '',
        session.model || '',
        session.engineName || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchFields.includes(query);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
});

// =============================================================================
// Computed: Styles
// =============================================================================

const containerStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface)',
}));

const headerStyle = computed(() => ({
  borderColor: 'var(--ac-border)',
  backgroundColor: 'var(--ac-surface)',
}));

const inputStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface-muted)',
  border: 'var(--ac-border-width) solid var(--ac-border)',
  borderRadius: 'var(--ac-radius-button)',
  color: 'var(--ac-text)',
  outline: 'none',
}));

const newButtonStyle = computed(() => ({
  backgroundColor: 'var(--ac-accent)',
  color: 'var(--ac-accent-contrast)',
  borderRadius: 'var(--ac-radius-button)',
}));

// =============================================================================
// Methods
// =============================================================================

function isSessionRunning(sessionId: string): boolean {
  return props.runningSessionIds?.has(sessionId) ?? false;
}

/**
 * Get the project root path for a session.
 */
function getProjectPath(session: AgentSession): string | undefined {
  return props.projectsMap?.get(session.projectId)?.rootPath;
}

function handleSessionClick(sessionId: string): void {
  emit('session:select', sessionId);
}

function handleNewSession(): void {
  emit('session:new');
}

function handleSessionRename(sessionId: string, name: string): void {
  emit('session:rename', sessionId, name);
}

function handleSessionDelete(sessionId: string): void {
  emit('session:delete', sessionId);
}

function handleSessionOpenProject(sessionId: string): void {
  emit('session:open-project', sessionId);
}
</script>
