<template>
  <div class="section">
    <h2 class="section-title">{{ m('elementMarkerManagementTitle') }}</h2>
    <div class="config-card">
      <div class="status-section" style="gap: 8px">
        <div class="status-header">
          <p class="status-label">{{ m('currentPageLabel') }}</p>
          <span class="status-text" style="opacity: 0.85">{{ currentUrl }}</span>
        </div>
        <div class="status-header">
          <p class="status-label">{{ m('markedElementsLabel') }}</p>
          <span class="status-text">{{ markers.length }}</span>
        </div>
      </div>

      <form class="mcp-config-section" @submit.prevent="onAdd">
        <div class="mcp-config-header">
          <p class="mcp-config-label">{{ m('addMarkerLabel') }}</p>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px">
          <input v-model="form.name" :placeholder="m('emNamePlaceholder')" class="port-input" />
          <select v-model="form.selectorType" class="port-input" style="max-width: 120px">
            <option value="css">CSS</option>
            <option value="xpath">XPath</option>
          </select>
          <select v-model="form.matchType" class="port-input" style="max-width: 120px">
            <option value="prefix">{{ m('emMatchTypePrefix') }}</option>
            <option value="exact">{{ m('emMatchTypeExact') }}</option>
            <option value="host">{{ m('emMatchTypeHost') }}</option>
          </select>
        </div>
        <input
          v-model="form.selector"
          :placeholder="m('cssSelectorPlaceholder')"
          class="port-input"
        />
        <div style="display: flex; gap: 8px; margin-top: 8px">
          <button class="semantic-engine-button" :disabled="!form.selector" type="submit">
            {{ m('saveButton') }}
          </button>
          <button class="danger-button" type="button" @click="resetForm">{{
            m('clearButton')
          }}</button>
        </div>
      </form>

      <div v-if="markers.length" class="model-list" style="margin-top: 8px">
        <div
          v-for="marker in markers"
          :key="marker.id"
          class="model-card"
          style="display: flex; align-items: center; justify-content: space-between; gap: 8px"
        >
          <div style="display: flex; flex-direction: column; gap: 4px">
            <strong class="model-name">{{ marker.name }}</strong>
            <code style="font-size: 12px; opacity: 0.85">{{ marker.selector }}</code>
            <div style="display: flex; gap: 6px; margin-top: 2px">
              <span class="model-tag dimension">{{ marker.selectorType || 'css' }}</span>
              <span class="model-tag dimension">{{ marker.matchType }}</span>
            </div>
          </div>
          <div style="display: flex; gap: 6px">
            <button class="semantic-engine-button" @click="validate(marker)">{{
              m('verifyButton')
            }}</button>
            <button class="secondary-button" @click="prefill(marker)">{{ m('editButton') }}</button>
            <button class="danger-button" @click="remove(marker)">{{ m('deleteButton') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { getMessage } from '@/utils/i18n';

const m = (key: string, substitutions?: string[]) => getMessage(key, substitutions);

const currentUrl = ref('');
const markers = ref<ElementMarker[]>([]);

const form = ref<UpsertMarkerRequest>({
  url: '',
  name: '',
  selector: '',
  matchType: 'prefix',
});

function resetForm() {
  form.value = { url: currentUrl.value, name: '', selector: '', matchType: 'prefix' };
}

async function load() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = tabs[0];
    currentUrl.value = String(t?.url || '');
    form.value.url = currentUrl.value;
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_FOR_URL,
      url: currentUrl.value,
    });
    if (res?.success) markers.value = res.markers || [];
  } catch (e) {
    /* ignore */
  }
}

function prefill(m: ElementMarker) {
  form.value = {
    url: m.url,
    name: m.name,
    selector: m.selector,
    selectorType: m.selectorType,
    listMode: m.listMode,
    matchType: m.matchType,
    action: m.action,
    id: m.id,
  };
}

async function onAdd() {
  try {
    if (!form.value.selector) return;
    form.value.url = currentUrl.value;
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE,
      marker: form.value,
    });
    if (res?.success) {
      resetForm();
      await load();
    }
  } catch (e) {
    /* ignore */
  }
}

async function remove(m: ElementMarker) {
  try {
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE,
      id: m.id,
    });
    if (res?.success) await load();
  } catch (e) {
    /* ignore */
  }
}

async function validate(m: ElementMarker) {
  try {
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
      selector: m.selector,
      selectorType: m.selectorType || 'css',
      action: 'hover',
      listMode: !!m.listMode,
    } as any);

    // Trigger highlight in the page only if tool validation succeeded
    if (res?.tool?.ok !== false) {
      await highlightInTab(m);
    }
  } catch (e) {
    /* ignore */
  }
}

async function highlightInTab(m: ElementMarker) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    // Ensure element-marker.js is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['inject-scripts/element-marker.js'],
        world: 'ISOLATED',
      });
    } catch {
      // Already injected, ignore
    }

    // Send highlight message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'element_marker_highlight',
      selector: m.selector,
      selectorType: m.selectorType || 'css',
      listMode: !!m.listMode,
    });
  } catch (e) {
    // Ignore errors (tab might not support content scripts)
  }
}

onMounted(load);
</script>
