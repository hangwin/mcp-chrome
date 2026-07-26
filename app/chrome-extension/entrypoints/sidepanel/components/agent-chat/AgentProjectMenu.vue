<template>
  <div
    v-if="open"
    class="fixed top-12 left-4 right-4 z-50 py-2 max-w-[calc(100%-2rem)]"
    :style="{
      backgroundColor: 'var(--ac-surface, #ffffff)',
      border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
      borderRadius: 'var(--ac-radius-inner, 8px)',
      boxShadow: 'var(--ac-shadow-float, 0 4px 20px -2px rgba(0,0,0,0.1))',
    }"
  >
    <!-- Projects Section -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      Projects
    </div>

    <!-- Project List -->
    <div class="max-h-[200px] overflow-y-auto ac-scroll">
      <button
        v-for="p in projects"
        :key="p.id"
        class="w-full px-3 py-2 text-left text-sm flex items-center justify-between ac-menu-item"
        :style="{
          color:
            selectedProjectId === p.id ? 'var(--ac-accent, #c87941)' : 'var(--ac-text, #1a1a1a)',
        }"
        @click="$emit('project:select', p.id)"
      >
        <div class="flex-1 min-w-0">
          <div class="truncate">{{ p.name }}</div>
          <div
            class="text-[10px] truncate"
            :style="{
              fontFamily: 'var(--ac-font-mono, monospace)',
              color: 'var(--ac-text-subtle, #a8a29e)',
            }"
          >
            {{ p.rootPath }}
          </div>
        </div>
        <svg
          v-if="selectedProjectId === p.id"
          class="w-4 h-4 flex-shrink-0 ml-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
    </div>

    <!-- New Project -->
    <button
      class="w-full px-3 py-2 text-left text-sm ac-menu-item"
      :style="{ color: 'var(--ac-link, #3b82f6)' }"
      :disabled="isPicking"
      @click="$emit('project:new')"
    >
      {{ isPicking ? 'Selecting...' : '+ New Project' }}
    </button>

    <!-- Divider -->
    <div
      class="my-2"
      :style="{ borderTop: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)' }"
    />

    <!-- CLI & Model Settings -->
    <div
      class="px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }"
    >
      Settings
    </div>

    <!-- CLI Selection -->
    <div class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> CLI </span>
      <select
        :value="selectedCli"
        class="flex-1 px-2 py-1 text-xs rounded"
        :style="{
          backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
          border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
          color: 'var(--ac-text, #1a1a1a)',
          borderRadius: 'var(--ac-radius-button, 8px)',
        }"
        @change="handleCliChange"
      >
        <option value="">Auto</option>
        <option v-for="e in engines" :key="e.name" :value="e.name">
          {{ e.name }}
        </option>
      </select>
    </div>

    <!-- Model Selection -->
    <div class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> Model </span>
      <select
        :value="normalizedModel"
        class="flex-1 px-2 py-1 text-xs rounded"
        :style="{
          backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
          border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
          color: 'var(--ac-text, #1a1a1a)',
          borderRadius: 'var(--ac-radius-button, 8px)',
        }"
        :disabled="isModelDisabled"
        @change="handleModelChange"
      >
        <option value="">Default</option>
        <option v-for="m in availableModels" :key="m.id" :value="m.id">
          {{ m.name }}
        </option>
      </select>
    </div>

    <!-- Reasoning Effort (Codex only) -->
    <div v-if="showReasoningEffortOption" class="px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }">
          Effort
        </span>
        <select
          :value="normalizedReasoningEffort"
          class="flex-1 px-2 py-1 text-xs rounded"
          :style="{
            backgroundColor: 'var(--ac-surface-muted, #f2f0eb)',
            border: 'var(--ac-border-width, 1px) solid var(--ac-border, #e5e5e5)',
            color: 'var(--ac-text, #1a1a1a)',
            borderRadius: 'var(--ac-radius-button, 8px)',
          }"
          @change="handleReasoningEffortChange"
        >
          <option v-for="effort in availableReasoningEfforts" :key="effort" :value="effort">
            {{ effort }}
          </option>
        </select>
      </div>
      <p class="text-[10px] mt-1 ml-14" :style="{ color: 'var(--ac-text-subtle, #a8a29e)' }">
        Applies to new sessions. Edit existing session in Session Settings.
      </p>
    </div>

    <!-- CCR Option (Claude Code Router) - only shown when Claude CLI is selected -->
    <div v-if="showCcrOption" class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> CCR </span>
      <label
        class="flex items-center gap-2 cursor-pointer"
        title="Use Claude Code Router for API routing"
      >
        <input
          type="checkbox"
          :checked="useCcr"
          class="w-4 h-4 rounded"
          :style="{
            accentColor: 'var(--ac-accent, #c87941)',
          }"
          @change="handleCcrChange"
        />
        <span class="text-xs" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
          Use Claude Code Router
        </span>
      </label>
    </div>

    <!-- Chrome MCP Option - only shown when Claude or Codex CLI is selected -->
    <div v-if="showChromeMcpOption" class="px-3 py-2 flex items-center gap-2">
      <span class="text-xs w-12" :style="{ color: 'var(--ac-text-muted, #6e6e6e)' }"> MCP </span>
      <label
        class="flex items-center gap-2 cursor-pointer"
        title="Enable local Chrome MCP server integration"
      >
        <input
          type="checkbox"
          :checked="enableChromeMcp"
          class="w-4 h-4 rounded"
          :style="{
            accentColor: 'var(--ac-accent, #c87941)',
          }"
          @change="handleChromeMcpChange"
        />
        <span class="text-xs" :style="{ color: 'var(--ac-text, #1a1a1a)' }">
          Enable Chrome MCP
        </span>
      </label>
    </div>

    <!-- Save Button -->
    <div class="px-3 py-2">
      <button
        class="w-full px-3 py-1.5 text-xs rounded transition-colors hover:opacity-90 cursor-pointer"
        :style="{
          backgroundColor: 'var(--ac-accent, #c87941)',
          color: 'var(--ac-accent-contrast, #ffffff)',
          borderRadius: 'var(--ac-radius-button, 8px)',
        }"
        :disabled="isSaving"
        @click="handleSave"
      >
        {{ isSaving ? 'Saving...' : 'Save Settings' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-3 py-1 text-[10px]" :style="{ color: 'var(--ac-danger, #dc2626)' }">
      {{ error }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { AgentProject, AgentEngineInfo, CodexReasoningEffort } from 'agent-chrome-mcp-shared';
import {
  getModelsForCli,
  getDefaultModelForCli,
  getCodexReasoningEfforts,
  type ModelDefinition,
} from '@/common/agent-models';

const props = defineProps<{
  open: boolean;
  projects: AgentProject[];
  selectedProjectId: string;
  selectedCli: string;
  model: string;
  reasoningEffort: CodexReasoningEffort;
  useCcr: boolean;
  enableChromeMcp: boolean;
  engines: AgentEngineInfo[];
  isPicking: boolean;
  isSaving: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'project:select': [projectId: string];
  'project:new': [];
  'cli:update': [cli: string];
  'model:update': [model: string];
  'reasoning-effort:update': [effort: CodexReasoningEffort];
  'ccr:update': [useCcr: boolean];
  'chrome-mcp:update': [enableChromeMcp: boolean];
  save: [];
}>();

// Get available models based on selected CLI
const availableModels = computed<ModelDefinition[]>(() => {
  return getModelsForCli(props.selectedCli);
});

// Normalize model value: ensure it exists in available models or fallback to empty
const normalizedModel = computed(() => {
  const trimmedModel = props.model.trim();
  if (!trimmedModel) return '';
  // No CLI selected = model disabled, show empty (server will use default)
  if (!props.selectedCli) return '';
  const models = availableModels.value;
  // If CLI selected but no models defined, fallback to empty
  if (models.length === 0) return '';
  // Check if current model is valid for selected CLI
  const isValid = models.some((m) => m.id === trimmedModel);
  return isValid ? trimmedModel : '';
});

// Check if Model select should be disabled
const isModelDisabled = computed(() => {
  return !props.selectedCli || availableModels.value.length === 0;
});

// Show reasoning effort option only when Codex CLI is selected
const showReasoningEffortOption = computed(() => {
  return props.selectedCli === 'codex';
});

// Get available reasoning efforts based on selected model
const availableReasoningEfforts = computed<readonly CodexReasoningEffort[]>(() => {
  if (!showReasoningEffortOption.value) return [];
  const effectiveModel = normalizedModel.value || getDefaultModelForCli('codex');
  return getCodexReasoningEfforts(effectiveModel);
});

// Normalize reasoning effort value - fallback to highest supported
const normalizedReasoningEffort = computed(() => {
  const supported = availableReasoningEfforts.value;
  if (supported.length === 0) return props.reasoningEffort;
  if (supported.includes(props.reasoningEffort)) return props.reasoningEffort;
  // Fallback to highest supported effort (last in the sorted array)
  return supported[supported.length - 1];
});

// Show CCR option only when Claude CLI is selected
const showCcrOption = computed(() => {
  return props.selectedCli === 'claude';
});

// Show Chrome MCP option when Claude, Codex, or Auto (empty) CLI is selected
// Auto typically defaults to Claude, and users should be able to manage this project-level setting
const showChromeMcpOption = computed(() => {
  return !props.selectedCli || props.selectedCli === 'claude' || props.selectedCli === 'codex';
});

// Handle CLI change - auto-select default model for the CLI
function handleCliChange(event: Event): void {
  const cli = (event.target as HTMLSelectElement).value;
  emit('cli:update', cli);

  // Auto-select default model when CLI changes
  if (cli) {
    const defaultModel = getDefaultModelForCli(cli);
    // Validate default model exists in available models
    const models = getModelsForCli(cli);
    const isValidDefault = models.some((m) => m.id === defaultModel);
    emit('model:update', isValidDefault ? defaultModel : (models[0]?.id ?? ''));
  } else {
    emit('model:update', '');
  }

  // Reset CCR when switching away from Claude
  if (cli !== 'claude') {
    emit('ccr:update', false);
  }
}

function handleCcrChange(event: Event): void {
  emit('ccr:update', (event.target as HTMLInputElement).checked);
}

function handleChromeMcpChange(event: Event): void {
  emit('chrome-mcp:update', (event.target as HTMLInputElement).checked);
}

function handleModelChange(event: Event): void {
  const newModel = (event.target as HTMLSelectElement).value;
  emit('model:update', newModel);

  // When model changes for Codex, validate reasoning effort
  if (props.selectedCli === 'codex') {
    const supported = getCodexReasoningEfforts(newModel || getDefaultModelForCli('codex'));
    if (!supported.includes(props.reasoningEffort)) {
      // Auto-downgrade to highest supported effort
      emit('reasoning-effort:update', supported[supported.length - 1]);
    }
  }
}

function handleReasoningEffortChange(event: Event): void {
  emit(
    'reasoning-effort:update',
    (event.target as HTMLSelectElement).value as CodexReasoningEffort,
  );
}

function handleSave(): void {
  emit('save');
}
</script>
