<template>
  <div class="h-full flex flex-col" :style="containerStyle">
    <!-- Fixed Header: Search + Actions -->
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
            placeholder="Search workflows..."
            class="w-full pl-9 pr-3 py-2 text-sm"
            :style="inputStyle"
          />
        </div>

        <!-- Refresh Button -->
        <button
          class="flex-shrink-0 p-2"
          :style="refreshButtonStyle"
          @click="$emit('refresh')"
          title="Refresh"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        <!-- New Workflow Button -->
        <button
          class="flex-shrink-0 px-3 py-2 text-sm font-medium"
          :style="newButtonStyle"
          @click="$emit('create')"
        >
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New
          </span>
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="flex items-center justify-between mt-3">
        <label
          class="flex items-center gap-2 text-sm cursor-pointer"
          :style="{ color: 'var(--ac-text-muted)' }"
        >
          <input
            type="checkbox"
            :checked="onlyBound"
            @change="$emit('update:onlyBound', ($event.target as HTMLInputElement).checked)"
            class="workflow-checkbox"
          />
          <span>Current page only</span>
        </label>
        <span class="text-xs" :style="{ color: 'var(--ac-text-subtle)' }">
          {{ filteredFlows.length }} workflow{{ filteredFlows.length !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto ac-scroll">
      <!-- Empty State -->
      <div
        v-if="filteredFlows.length === 0"
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
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
        </div>
        <div class="text-sm font-medium mb-1" :style="{ color: 'var(--ac-text)' }">
          {{ searchQuery ? 'No matching workflows' : 'No workflows yet' }}
        </div>
        <div class="text-xs text-center mb-4" :style="{ color: 'var(--ac-text-muted)' }">
          {{
            searchQuery ? 'Try a different search term' : 'Record your first automation workflow'
          }}
        </div>
        <button
          v-if="!searchQuery"
          class="px-4 py-2 text-sm font-medium"
          :style="newButtonStyle"
          @click="$emit('create')"
        >
          Create Workflow
        </button>
      </div>

      <!-- Workflow List -->
      <div v-else class="px-4 py-3 space-y-3">
        <WorkflowListItem
          v-for="flow in filteredFlows"
          :key="flow.id"
          :flow="flow"
          @run="$emit('run', $event)"
          @edit="$emit('edit', $event)"
          @delete="$emit('delete', $event)"
          @export="$emit('export', $event)"
        />
      </div>

      <!-- Advanced Settings (Collapsible) -->
      <div class="px-4 pb-4">
        <div class="advanced-divider" :style="dividerStyle">
          <span
            :style="{
              backgroundColor: 'var(--ac-surface)',
              padding: '0 12px',
              color: 'var(--ac-text-subtle)',
            }"
          >
            Advanced
          </span>
        </div>

        <!-- Run History Section -->
        <div class="advanced-section" :style="sectionStyle">
          <button
            class="advanced-section-header"
            :style="sectionHeaderStyle"
            @click="toggleSection('runs')"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-90': expandedSections.has('runs') }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Run History</span>
            </div>
            <span class="text-xs" :style="{ color: 'var(--ac-text-subtle)' }">{{
              runs.length
            }}</span>
          </button>

          <Transition name="section-expand">
            <div v-if="expandedSections.has('runs')" class="advanced-section-content">
              <div
                v-if="runs.length === 0"
                class="text-sm py-3"
                :style="{ color: 'var(--ac-text-muted)' }"
              >
                No run history yet
              </div>
              <div v-else class="space-y-2 py-2">
                <div
                  v-for="run in runs.slice(0, 5)"
                  :key="run.id"
                  class="run-item"
                  :style="runItemStyle"
                  @click="$emit('toggleRun', run.id)"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2 h-2 rounded-full"
                        :class="{ 'animate-pulse': run.isInProgress }"
                        :style="{ backgroundColor: getRunStatusColor(run) }"
                      ></span>
                      <span class="text-sm" :style="{ color: 'var(--ac-text)' }">{{
                        getFlowName(run.flowId)
                      }}</span>
                      <span
                        v-if="run.status"
                        class="text-xs px-1.5 py-0.5 rounded"
                        :style="{
                          backgroundColor: run.isInProgress
                            ? 'var(--ac-primary-light, #dbeafe)'
                            : run.success
                              ? 'var(--ac-success-light, #dcfce7)'
                              : 'var(--ac-danger-light, #fee2e2)',
                          color: getRunStatusColor(run),
                        }"
                      >
                        {{ getRunStatusText(run) }}
                      </span>
                    </div>
                    <span class="text-xs" :style="{ color: 'var(--ac-text-subtle)' }">
                      {{ formatTime(run.startedAt) }}
                    </span>
                  </div>
                  <!-- Run details (if expanded) -->
                  <div
                    v-if="openRunId === run.id"
                    class="mt-2 pt-2 border-t"
                    :style="{ borderColor: 'var(--ac-border)' }"
                  >
                    <!-- V3: Show status info when no entries -->
                    <div
                      v-if="run.entries.length === 0 && run.status"
                      class="text-xs py-1"
                      :style="{ color: 'var(--ac-text-muted)' }"
                    >
                      <div class="flex items-center gap-2">
                        <span
                          >{{ getMessage('workflowStatusLabel') }} {{ getRunStatusText(run) }}</span
                        >
                        <span v-if="run.finishedAt"
                          >• {{ getMessage('workflowDurationLabel') }}
                          {{
                            Math.round(
                              (new Date(run.finishedAt).getTime() -
                                new Date(run.startedAt).getTime()) /
                                1000,
                            )
                          }}s</span
                        >
                      </div>
                    </div>
                    <!-- V2: Show entries -->
                    <div
                      v-for="(entry, idx) in run.entries"
                      :key="idx"
                      class="text-xs py-1"
                      :style="{
                        color:
                          entry.status === 'failed' ? 'var(--ac-danger)' : 'var(--ac-text-muted)',
                      }"
                    >
                      #{{ idx + 1 }} {{ entry.status }} - step={{ entry.stepId }}
                      <span v-if="entry.tookMs" class="ml-2">{{ entry.tookMs }}ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Triggers Section -->
        <div class="advanced-section" :style="sectionStyle">
          <button
            class="advanced-section-header"
            :style="sectionHeaderStyle"
            @click="toggleSection('triggers')"
          >
            <div class="flex items-center gap-2">
              <svg
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-90': expandedSections.has('triggers') }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Triggers</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs" :style="{ color: 'var(--ac-text-subtle)' }">{{
                triggers.length
              }}</span>
              <button
                class="trigger-add-btn"
                :style="triggerAddStyle"
                @click.stop="$emit('createTrigger')"
                title="Add trigger"
              >
                <svg
                  class="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </button>

          <Transition name="section-expand">
            <div v-if="expandedSections.has('triggers')" class="advanced-section-content">
              <div
                v-if="triggers.length === 0"
                class="text-sm py-3"
                :style="{ color: 'var(--ac-text-muted)' }"
              >
                No triggers configured
              </div>
              <div v-else class="space-y-2 py-2">
                <div
                  v-for="trigger in triggers"
                  :key="trigger.id"
                  class="trigger-item"
                  :style="triggerItemStyle"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2 h-2 rounded-full"
                        :style="{
                          backgroundColor:
                            trigger.enabled !== false
                              ? 'var(--ac-success)'
                              : 'var(--ac-text-subtle)',
                        }"
                      ></span>
                      <span class="text-sm font-medium" :style="{ color: 'var(--ac-text)' }">{{
                        trigger.type
                      }}</span>
                      <span class="text-xs" :style="{ color: 'var(--ac-text-muted)' }">
                        {{ getFlowName(trigger.flowId) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        class="trigger-action"
                        :style="triggerActionStyle"
                        @click="$emit('editTrigger', trigger.id)"
                        title="Edit"
                      >
                        <svg
                          class="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        class="trigger-action trigger-action-danger"
                        :style="triggerActionDangerStyle"
                        @click="$emit('removeTrigger', trigger.id)"
                        title="Delete"
                      >
                        <svg
                          class="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import WorkflowListItem from './WorkflowListItem.vue';
import { getMessage } from '@/utils/i18n';

interface FlowLite {
  id: string;
  name: string;
  description?: string;
  meta?: {
    domain?: string;
    tags?: string[];
    bindings?: any[];
  };
}

interface RunLite {
  id: string;
  flowId: string;
  startedAt: string;
  finishedAt?: string;
  success?: boolean;
  /** Whether the run is still in progress (queued/running/paused) */
  isInProgress?: boolean;
  /** V3 run status */
  status?: 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled';
  entries: any[];
}

interface Trigger {
  id: string;
  type: string;
  flowId: string;
  enabled?: boolean;
  [key: string]: any;
}

const props = defineProps<{
  flows: FlowLite[];
  runs: RunLite[];
  triggers: Trigger[];
  onlyBound: boolean;
  openRunId: string | null;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'create'): void;
  (e: 'run', id: string): void;
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'export', id: string): void;
  (e: 'update:onlyBound', value: boolean): void;
  (e: 'toggleRun', id: string): void;
  (e: 'createTrigger'): void;
  (e: 'editTrigger', id: string): void;
  (e: 'removeTrigger', id: string): void;
}>();

// Local state
const searchQuery = ref('');
const expandedSections = ref<Set<string>>(new Set());

// Filtered flows based on search
const filteredFlows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.flows;

  return props.flows.filter((flow) => {
    const name = (flow.name || '').toLowerCase();
    const desc = (flow.description || '').toLowerCase();
    const domain = (flow.meta?.domain || '').toLowerCase();
    const tags = (flow.meta?.tags || []).join(' ').toLowerCase();

    return (
      name.includes(query) || desc.includes(query) || domain.includes(query) || tags.includes(query)
    );
  });
});

// Helper functions
function getFlowName(flowId: string): string {
  const flow = props.flows.find((f) => f.id === flowId);
  return flow?.name || flowId;
}

/**
 * Get the status color for a run
 * - In progress (queued/running/paused): blue/primary
 * - Succeeded: green/success
 * - Failed/canceled: red/danger
 */
function getRunStatusColor(run: RunLite): string {
  // V3 style: check isInProgress first
  if (run.isInProgress) {
    return 'var(--ac-primary, #3b82f6)';
  }
  // V3 style: check status
  if (run.status) {
    if (run.status === 'succeeded') return 'var(--ac-success, #22c55e)';
    if (run.status === 'failed' || run.status === 'canceled') return 'var(--ac-danger, #ef4444)';
    // queued/running/paused - should be caught by isInProgress but just in case
    return 'var(--ac-primary, #3b82f6)';
  }
  // V2 fallback: use success boolean
  return run.success ? 'var(--ac-success, #22c55e)' : 'var(--ac-danger, #ef4444)';
}

/**
 * Get the status text for a run
 */
function getRunStatusText(run: RunLite): string {
  if (run.status) {
    const statusMap: Record<string, string> = {
      queued: getMessage('workflowStatusQueued'),
      running: getMessage('workflowStatusRunning'),
      paused: getMessage('workflowStatusPaused'),
      succeeded: getMessage('workflowStatusSucceeded'),
      failed: getMessage('workflowStatusFailed'),
      canceled: getMessage('workflowStatusCanceled'),
    };
    return statusMap[run.status] || run.status;
  }
  // V2 fallback
  return run.success ? getMessage('workflowStatusSucceeded') : getMessage('workflowStatusFailed');
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function toggleSection(section: string) {
  if (expandedSections.value.has(section)) {
    expandedSections.value.delete(section);
  } else {
    expandedSections.value.add(section);
  }
  expandedSections.value = new Set(expandedSections.value);
}

// Computed styles
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

const refreshButtonStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface-muted)',
  color: 'var(--ac-text-muted)',
  borderRadius: 'var(--ac-radius-button)',
  border: 'none',
}));

const newButtonStyle = computed(() => ({
  backgroundColor: 'var(--ac-accent)',
  color: 'var(--ac-accent-contrast)',
  borderRadius: 'var(--ac-radius-button)',
}));

const dividerStyle = computed(() => ({
  borderColor: 'var(--ac-border)',
}));

const sectionStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface)',
  border: 'var(--ac-border-width) solid var(--ac-border)',
  borderRadius: 'var(--ac-radius-inner)',
}));

const sectionHeaderStyle = computed(() => ({
  color: 'var(--ac-text)',
}));

const runItemStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface-muted)',
  borderRadius: 'var(--ac-radius-button)',
}));

const triggerItemStyle = computed(() => ({
  backgroundColor: 'var(--ac-surface-muted)',
  borderRadius: 'var(--ac-radius-button)',
}));

const triggerAddStyle = computed(() => ({
  backgroundColor: 'var(--ac-accent-subtle)',
  color: 'var(--ac-accent)',
  borderRadius: '50%',
}));

const triggerActionStyle = computed(() => ({
  color: 'var(--ac-text-muted)',
}));

const triggerActionDangerStyle = computed(() => ({
  color: 'var(--ac-danger)',
}));
</script>

<style scoped>
.workflow-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  appearance: none;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.workflow-checkbox:checked {
  background-color: var(--ac-accent, #d97757);
  border-color: var(--ac-accent, #d97757);
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
}

.advanced-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0 16px;
  font-size: 12px;
  font-weight: 500;
}

.advanced-divider::before,
.advanced-divider::after {
  content: '';
  flex: 1;
  border-bottom: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
}

.advanced-section {
  margin-bottom: 8px;
  overflow: hidden;
}

.advanced-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color var(--ac-motion-fast, 120ms) ease;
}

.advanced-section-header:hover {
  background-color: var(--ac-hover-bg, #f5f5f4);
}

.advanced-section-content {
  padding: 0 12px 12px;
}

.run-item,
.trigger-item {
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color var(--ac-motion-fast, 120ms) ease;
}

.run-item:hover,
.trigger-item:hover {
  background-color: var(--ac-hover-bg, #f5f5f4) !important;
}

.trigger-add-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.trigger-add-btn:hover {
  transform: scale(1.1);
}

.trigger-action {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.trigger-action:hover {
  background-color: var(--ac-hover-bg, #f5f5f4);
}

.trigger-action-danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

/* Section expand transition */
.section-expand-enter-active,
.section-expand-leave-active {
  transition: all var(--ac-motion-normal, 180ms) ease;
  overflow: hidden;
}

.section-expand-enter-from,
.section-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.section-expand-enter-to,
.section-expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
