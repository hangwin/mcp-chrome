<template>
  <div class="flex flex-col gap-2">
    <!-- Project name input -->
    <div class="flex items-center gap-2">
      <span class="whitespace-nowrap w-12">Name</span>
      <input
        :value="name"
        class="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        placeholder="Project name"
        @input="handleNameInput"
      />
    </div>

    <!-- Root path selection -->
    <div class="flex items-center gap-2">
      <span class="whitespace-nowrap w-12">Root</span>
      <input
        :value="rootPath"
        readonly
        class="flex-1 border border-slate-200 rounded px-2 py-1 text-xs bg-slate-50 text-slate-600 focus:outline-none cursor-default"
        :placeholder="isLoadingDefault ? 'Loading...' : 'Select a directory'"
      />
      <button
        class="btn-secondary !px-2 !py-1 text-[11px] whitespace-nowrap"
        type="button"
        :disabled="isPicking"
        title="Use default directory (~/.chrome-mcp-agent/workspaces/...)"
        @click="$emit('use-default')"
      >
        Default
      </button>
      <button
        class="btn-secondary !px-2 !py-1 text-[11px] whitespace-nowrap"
        type="button"
        :disabled="isPicking"
        title="Open system directory picker"
        @click="$emit('pick-directory')"
      >
        {{ isPicking ? '...' : 'Browse' }}
      </button>
      <button
        class="btn-primary !px-2 !py-1 text-[11px]"
        type="button"
        :disabled="isCreating || !canCreate"
        @click="$emit('create')"
      >
        {{ isCreating ? 'Creating...' : 'Create' }}
      </button>
    </div>

    <!-- Error message -->
    <div v-if="error" class="text-[11px] text-red-600">
      {{ error }}
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  name: string;
  rootPath: string;
  isCreating: boolean;
  isPicking: boolean;
  isLoadingDefault: boolean;
  canCreate: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  'update:name': [value: string];
  'update:root-path': [value: string];
  'use-default': [];
  'pick-directory': [];
  create: [];
}>();

function handleNameInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit('update:name', value);
}
</script>
