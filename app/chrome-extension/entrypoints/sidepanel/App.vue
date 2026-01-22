<template>
  <div class="h-full w-full bg-slate-50 relative agent-theme" :data-agent-theme="currentTheme">
    <!-- Sidepanel Navigator - only show on workflows/element-markers pages -->
    <SidepanelNavigator
      v-if="activeTab !== 'agent-chat'"
      :activeTab="activeTab"
      @change="handleTabChange"
    />

    <!-- Workflows Tab -->
    <div v-show="activeTab === 'workflows'" class="h-full">
      <WorkflowsView
        :flows="filtered"
        :runs="runs"
        :triggers="triggers"
        :only-bound="onlyBound"
        :open-run-id="openRunId"
        @refresh="handleWorkflowRefresh"
        @create="createFlow"
        @run="run"
        @edit="edit"
        @delete="remove"
        @export="exportFlow"
        @update:only-bound="onlyBound = $event"
        @toggle-run="toggleRun"
        @create-trigger="createTrigger"
        @edit-trigger="editTrigger"
        @remove-trigger="removeTrigger"
      />
    </div>

    <!-- Agent Chat Tab -->
    <div v-show="activeTab === 'agent-chat'" class="h-full">
      <AgentChat />
    </div>

    <!-- Element Markers Tab -->
    <div v-show="activeTab === 'element-markers'" class="element-markers-content">
      <div class="px-4 py-4">
        <!-- Toolbar: Search + Add Button -->
        <div class="em-toolbar">
          <div class="em-search-wrapper">
            <svg class="em-search-icon" viewBox="0 0 20 20" width="16" height="16">
              <path
                fill="currentColor"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              />
            </svg>
            <input
              v-model="markerSearch"
              class="em-search-input"
              :placeholder="getMessage('emSearchPlaceholder')"
              type="text"
            />
            <button
              v-if="markerSearch"
              class="em-search-clear"
              type="button"
              @click="markerSearch = ''"
            >
              <svg viewBox="0 0 20 20" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>
          <button
            class="em-add-btn"
            @click="openMarkerEditor()"
            :title="getMessage('emAddMarkerTitle')"
          >
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path
                fill="currentColor"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              />
            </svg>
          </button>
        </div>

        <!-- Modal: Add/Edit Marker -->
        <div v-if="markerEditorOpen" class="em-modal-overlay" @click.self="closeMarkerEditor">
          <div class="em-modal">
            <div class="em-modal-header">
              <h3 class="em-modal-title">{{
                editingMarkerId ? getMessage('emEditMarker') : getMessage('emAddMarker')
              }}</h3>
              <button class="em-modal-close" @click="closeMarkerEditor">
                <svg viewBox="0 0 20 20" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  />
                </svg>
              </button>
            </div>
            <form @submit.prevent="saveMarker" class="em-form">
              <div class="em-form-row">
                <div class="em-field">
                  <label class="em-field-label">{{ getMessage('emNameLabel') }}</label>
                  <input
                    v-model="markerForm.name"
                    class="em-input"
                    :placeholder="getMessage('emNamePlaceholder')"
                    required
                  />
                </div>
              </div>

              <div class="em-form-row em-form-row-multi">
                <div class="em-field">
                  <label class="em-field-label">{{ getMessage('emSelectorTypeLabel') }}</label>
                  <div class="em-select-wrapper">
                    <select v-model="markerForm.selectorType" class="em-select">
                      <option value="css">CSS Selector</option>
                      <option value="xpath">XPath</option>
                    </select>
                  </div>
                </div>
                <div class="em-field">
                  <label class="em-field-label">{{ getMessage('emMatchTypeLabel') }}</label>
                  <div class="em-select-wrapper">
                    <select v-model="markerForm.matchType" class="em-select">
                      <option value="prefix">{{ getMessage('emMatchTypePrefix') }}</option>
                      <option value="exact">{{ getMessage('emMatchTypeExact') }}</option>
                      <option value="host">{{ getMessage('emMatchTypeHost') }}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="em-form-row">
                <div class="em-field">
                  <label class="em-field-label">{{ getMessage('emSelectorLabel') }}</label>
                  <textarea
                    v-model="markerForm.selector"
                    class="em-textarea"
                    :placeholder="getMessage('emSelectorPlaceholder')"
                    rows="3"
                    required
                  ></textarea>
                </div>
              </div>

              <div class="em-modal-actions">
                <button type="button" class="em-btn em-btn-ghost" @click="closeMarkerEditor">
                  {{ getMessage('cancelButton') }}
                </button>
                <button type="submit" class="em-btn em-btn-primary">
                  {{ editingMarkerId ? getMessage('updateButton') : getMessage('saveButton') }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Markers List -->
        <div v-if="filteredMarkers.length > 0" class="em-list">
          <!-- Statistics (compact) -->
          <div class="em-stats-bar">
            <span class="em-stats-text">
              <template v-if="markerSearch">
                {{
                  getMessage('emFilteredStats', [
                    String(filteredMarkers.length),
                    String(markers.length),
                    String(groupedMarkers.length),
                  ])
                }}
              </template>
              <template v-else>
                {{
                  getMessage('emTotalStats', [
                    String(markers.length),
                    String(groupedMarkers.length),
                  ])
                }}
              </template>
            </span>
          </div>

          <!-- Grouped Markers by Domain -->
          <div
            v-for="domainGroup in groupedMarkers"
            :key="domainGroup.domain"
            class="em-domain-group"
          >
            <!-- Domain Header -->
            <div class="em-domain-header" @click="toggleDomain(domainGroup.domain)">
              <div class="em-domain-info">
                <svg
                  class="em-domain-icon"
                  :class="{ 'em-domain-icon-expanded': expandedDomains.has(domainGroup.domain) }"
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                >
                  <path fill="currentColor" d="M6 8l4 4 4-4" />
                </svg>
                <h3 class="em-domain-name">{{ domainGroup.domain }}</h3>
                <span class="em-domain-count">{{
                  getMessage('emMarkerCount', [String(domainGroup.count)])
                }}</span>
              </div>
            </div>

            <!-- URLs and Markers -->
            <div v-if="expandedDomains.has(domainGroup.domain)" class="em-domain-content">
              <div class="em-content-wrapper">
                <div v-for="urlGroup in domainGroup.urls" :key="urlGroup.url" class="em-url-group">
                  <div class="em-url-header">
                    <svg class="em-url-icon" viewBox="0 0 16 16" width="12" height="12">
                      <path
                        fill="currentColor"
                        d="M4 4a1 1 0 011-1h6a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm2 1v1h4V5H6zm0 3v1h4V8H6z"
                      />
                    </svg>
                    <span class="em-url-path">{{ urlGroup.url }}</span>
                  </div>

                  <div class="em-markers-list">
                    <div v-for="marker in urlGroup.markers" :key="marker.id" class="em-marker-item">
                      <div class="em-marker-row-top">
                        <span class="em-marker-name">{{ marker.name }}</span>
                        <div class="em-marker-actions">
                          <button
                            class="em-action-btn em-action-verify"
                            @click="validateMarker(marker)"
                            :title="getMessage('emVerifyTitle')"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                          <button
                            class="em-action-btn em-action-edit"
                            @click="editMarker(marker)"
                            :title="getMessage('emEditTitle')"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            class="em-action-btn em-action-delete"
                            @click="deleteMarker(marker)"
                            :title="getMessage('emDeleteTitle')"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="em-marker-row-bottom">
                        <code class="em-marker-selector" :title="marker.selector">{{
                          marker.selector
                        }}</code>
                        <div class="em-marker-tags">
                          <span class="em-tag">{{ marker.selectorType || 'css' }}</span>
                          <span class="em-tag">{{ marker.matchType }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No search results -->
        <div v-else-if="markers.length > 0 && filteredMarkers.length === 0" class="em-empty">
          <p>{{ getMessage('emNoMatchingMarkers') }}</p>
          <button class="em-btn em-btn-ghost em-empty-btn" @click="markerSearch = ''">
            {{ getMessage('emClearSearch') }}
          </button>
        </div>

        <!-- Empty state -->
        <div v-else class="em-empty">
          <p>{{ getMessage('emNoMarkers') }}</p>
          <button class="em-btn em-btn-primary em-empty-btn" @click="openMarkerEditor()">
            {{ getMessage('emAddMarker') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, onUnmounted, watch } from 'vue';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { ElementMarker, UpsertMarkerRequest } from '@/common/element-marker-types';
import AgentChat from './components/AgentChat.vue';
import SidepanelNavigator from './components/SidepanelNavigator.vue';
import { WorkflowsView } from './components/workflows';
import { useAgentTheme } from './composables/useAgentTheme';
import { useWorkflowsV3, type FlowLite } from './composables/useWorkflowsV3';
import { getMessage } from '@/utils/i18n';

// i18n helper

// Agent theme for consistent styling
const { theme: currentTheme, initTheme } = useAgentTheme();

// Tab state - default to AgentChat
const activeTab = ref<'workflows' | 'element-markers' | 'agent-chat'>('agent-chat');

// Handle tab change and update URL for deep linking
function handleTabChange(tab: 'workflows' | 'element-markers' | 'agent-chat') {
  activeTab.value = tab;
  // Update URL params for deep link
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url.toString());
  // Note: loadMarkers is already called by the watch on activeTab, no need to call here
}

// Workflows state - using V3 data layer
const workflowsV3 = useWorkflowsV3({ autoConnect: true });
const { flows, runs, triggers } = workflowsV3;
const onlyBound = ref(false);
const search = ref('');
const currentUrl = ref('');
const openRunId = ref<string | null>(null);

// Element markers state
const currentPageUrl = ref('');
const markers = ref<ElementMarker[]>([]);
const editingMarkerId = ref<string | null>(null);
const markerForm = ref<UpsertMarkerRequest>({
  url: '',
  name: '',
  selector: '',
  selectorType: 'css',
  matchType: 'prefix',
});
const expandedDomains = ref<Set<string>>(new Set());
const markerSearch = ref('');
const markerEditorOpen = ref(false);

// Filter markers based on search term
const filteredMarkers = computed(() => {
  const query = markerSearch.value.trim().toLowerCase();
  if (!query) return markers.value;
  return markers.value.filter((m) => {
    const name = (m.name || '').toLowerCase();
    const selector = (m.selector || '').toLowerCase();
    const url = (m.url || '').toLowerCase();
    return name.includes(query) || selector.includes(query) || url.includes(query);
  });
});

// Group markers by domain and URL
const groupedMarkers = computed(() => {
  const groups = new Map<string, Map<string, ElementMarker[]>>();

  for (const marker of filteredMarkers.value) {
    // Use pre-normalized fields from storage instead of reparsing URLs
    const domain = marker.host || getMessage('emLocalFile');
    const fullUrl = marker.url || getMessage('emUnknownUrl');

    if (!groups.has(domain)) {
      groups.set(domain, new Map());
    }

    const domainGroup = groups.get(domain)!;
    if (!domainGroup.has(fullUrl)) {
      domainGroup.set(fullUrl, []);
    }

    domainGroup.get(fullUrl)!.push(marker);
  }

  // Convert to array and sort
  return Array.from(groups.entries())
    .map(([domain, urlMap]) => ({
      domain,
      count: Array.from(urlMap.values()).reduce((sum, arr) => sum + arr.length, 0),
      urls: Array.from(urlMap.entries())
        .map(([url, markers]) => ({ url, markers }))
        .sort((a, b) => a.url.localeCompare(b.url)),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
});

const totalMarkersCount = computed(() => filteredMarkers.value.length);

const filtered = computed(() => {
  const list = onlyBound.value ? flows.value.filter(isBoundToCurrent) : flows.value;
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((f) => {
    const name = String(f.name || '').toLowerCase();
    const domain = String(f?.meta?.domain || '').toLowerCase();
    const tags = ((f?.meta?.tags || []) as any[]).join(',').toLowerCase();
    return name.includes(q) || domain.includes(q) || tags.includes(q);
  });
});

function isBoundToCurrent(f: FlowLite) {
  try {
    const bindings = f?.meta?.bindings || [];
    if (!bindings.length) return false;
    if (!currentUrl.value) return true;
    const u = new URL(currentUrl.value);
    return bindings.some((b: any) => {
      // Support both V3 'kind' and V2 'type' field names
      const bindingType = b.kind || b.type;
      if (bindingType === 'domain') return u.hostname.includes(b.value);
      if (bindingType === 'path') return u.pathname.startsWith(b.value);
      if (bindingType === 'url') return (u.href || '').startsWith(b.value);
      return false;
    });
  } catch {
    return false;
  }
}

// V3 Workflows methods - delegating to composable
async function handleWorkflowRefresh() {
  await workflowsV3.refresh();
}

async function exportFlow(id: string) {
  try {
    const flowData = await workflowsV3.exportFlow(id);
    if (flowData) {
      const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.warn('Export failed:', e);
  }
}

function createTrigger() {
  // V3 Trigger management not yet implemented
  alert(getMessage('v3TriggerNotImplemented'));
}

function editTrigger(_id: string) {
  // V3 Trigger management not yet implemented
  alert(getMessage('v3TriggerNotImplemented'));
}

async function removeTrigger(id: string) {
  await workflowsV3.deleteTrigger(id);
}

function toggleRun(id: string) {
  openRunId.value = openRunId.value === id ? null : id;
}

async function run(id: string) {
  try {
    const result = await workflowsV3.runFlow(id);
    if (!result) console.warn('回放失败');
  } catch {}
}

function edit(id: string) {
  // V3 Builder not yet implemented - show message
  alert(getMessage('v3BuilderNotImplemented'));
  // TODO: openBuilder({ flowId: id });
}

function createFlow() {
  // V3 Builder not yet implemented - show message
  alert(getMessage('v3BuilderNotImplemented'));
  // TODO: openBuilder({ newFlow: true });
}

async function remove(id: string) {
  try {
    const ok = confirm(getMessage('confirmDeleteWorkflow'));
    if (!ok) return;
    await workflowsV3.deleteFlow(id);
  } catch {}
}

function openBuilder(opts: { flowId?: string; newFlow?: boolean }) {
  // Open dedicated builder window for better UX
  const url = new URL(chrome.runtime.getURL('builder.html'));
  if (opts.flowId) url.searchParams.set('flowId', opts.flowId);
  if (opts.newFlow) url.searchParams.set('new', '1');
  chrome.windows.create({ url: url.toString(), type: 'popup', width: 1280, height: 800 });
}

// Element markers functions
function openMarkerEditor(marker?: ElementMarker) {
  if (marker) {
    editingMarkerId.value = marker.id;
    markerForm.value = {
      url: marker.url,
      name: marker.name,
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      listMode: marker.listMode,
      matchType: marker.matchType || 'prefix',
      action: marker.action,
    };
  } else {
    resetForm();
  }
  markerEditorOpen.value = true;
}

function closeMarkerEditor() {
  markerEditorOpen.value = false;
  resetForm();
}

function resetForm() {
  markerForm.value = {
    url: currentPageUrl.value,
    name: '',
    selector: '',
    selectorType: 'css',
    matchType: 'prefix',
  };
  editingMarkerId.value = null;
}

async function loadMarkers() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    currentPageUrl.value = String(tab?.url || '');

    // Only update form URL when not editing - prevents polluting edited marker's URL
    if (!editingMarkerId.value) {
      markerForm.value.url = currentPageUrl.value;
    }

    // Load all markers from all pages
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL,
    });

    if (res?.success) {
      markers.value = res.markers || [];
    }
  } catch (e) {
    console.error('Failed to load markers:', e);
  }
}

async function saveMarker() {
  try {
    if (!markerForm.value.selector) return;

    const isEditing = !!editingMarkerId.value;

    // Only set URL for new markers, not when editing existing ones
    if (!isEditing) {
      markerForm.value.url = currentPageUrl.value;
    }

    let res: any;

    if (isEditing) {
      // Use UPDATE for editing to preserve createdAt
      const existingMarker = markers.value.find((m) => m.id === editingMarkerId.value);
      if (existingMarker) {
        const updatedMarker: ElementMarker = {
          ...existingMarker,
          ...markerForm.value,
          id: editingMarkerId.value!,
        };
        res = await chrome.runtime.sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_UPDATE,
          marker: updatedMarker,
        });
      } else {
        // Fallback to SAVE if existing marker not found in local state
        console.warn('Editing marker not found in local state, falling back to SAVE');
        res = await chrome.runtime.sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE,
          marker: { ...markerForm.value, id: editingMarkerId.value },
        });
      }
    } else {
      // Use SAVE for new markers
      res = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE,
        marker: { ...markerForm.value },
      });
    }

    if (res?.success) {
      closeMarkerEditor();
      await loadMarkers();
    }
  } catch (e) {
    console.error('Failed to save marker:', e);
  }
}

function editMarker(marker: ElementMarker) {
  openMarkerEditor(marker);
}

function cancelEdit() {
  closeMarkerEditor();
}

async function deleteMarker(marker: ElementMarker) {
  try {
    const confirmed = confirm(getMessage('confirmDeleteMarker', [marker.name]));
    if (!confirmed) return;

    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE,
      id: marker.id,
    });

    if (res?.success) {
      await loadMarkers();
    }
  } catch (e) {
    console.error('Failed to delete marker:', e);
  }
}

async function validateMarker(marker: ElementMarker) {
  try {
    const res: any = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE,
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      action: 'hover',
      listMode: !!marker.listMode,
    } as any);

    // Trigger highlight in the page
    if (res?.tool?.ok !== false) {
      await highlightInTab(marker);
    }
  } catch (e) {
    console.error('Failed to validate marker:', e);
  }
}

/**
 * Check if element-marker.js is already injected in the tab
 * Uses a short timeout to avoid hanging on unresponsive tabs
 */
async function isMarkerInjected(tabId: number): Promise<boolean> {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'element_marker_ping' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
    ]);
    return response?.status === 'pong';
  } catch {
    return false;
  }
}

async function highlightInTab(marker: ElementMarker) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    // Check if already injected via ping to avoid duplicate injection
    const alreadyInjected = await isMarkerInjected(tabId);

    if (!alreadyInjected) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ['inject-scripts/element-marker.js'],
          world: 'ISOLATED',
        });
      } catch {
        // Script injection may fail on some pages
      }
    }

    // Send highlight message to content script
    await chrome.tabs.sendMessage(tabId, {
      action: 'element_marker_highlight',
      selector: marker.selector,
      selectorType: marker.selectorType || 'css',
      listMode: !!marker.listMode,
    });
  } catch (e) {
    // Ignore errors (tab might not support content scripts)
    console.error('Failed to highlight in tab:', e);
  }
}

function toggleDomain(domain: string) {
  if (expandedDomains.value.has(domain)) {
    expandedDomains.value.delete(domain);
  } else {
    expandedDomains.value.add(domain);
  }
  // Trigger reactivity
  expandedDomains.value = new Set(expandedDomains.value);
}

// Watch tab changes to load data
watch(activeTab, async (newTab, oldTab) => {
  // Only load if tab actually changed (avoid double-loading on mount)
  if (newTab === 'element-markers' && oldTab !== undefined) {
    await loadMarkers();
  }
});

// Auto-expand domains when search matches
watch(markerSearch, (query) => {
  if (!query.trim()) return;
  // Expand all domains that have matching markers
  const domainsToExpand = new Set<string>();
  for (const group of groupedMarkers.value) {
    domainsToExpand.add(group.domain);
  }
  expandedDomains.value = domainsToExpand;
});

onMounted(async () => {
  // Initialize theme
  await initTheme();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl.value = String(tab?.url || '');
  } catch {}

  // Check URL params for initial tab
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'element-markers') {
    activeTab.value = 'element-markers';
    await loadMarkers();
  } else if (tabParam === 'agent-chat') {
    activeTab.value = 'agent-chat';
  } else if (tabParam === 'workflows') {
    activeTab.value = 'workflows';
  }

  // V3 workflows data is auto-refreshed by useWorkflowsV3 composable
  // No need to manually call refresh here

  // V2 push-based refresh is no longer needed - V3 uses event subscription
  // Keeping commented for reference:
  // const onMessage = (message: { type?: string }) => {
  //   if (message?.type === BACKGROUND_MESSAGE_TYPES.RR_FLOWS_CHANGED) refresh();
  // };
  // chrome.runtime.onMessage.addListener(onMessage);
});

onUnmounted(() => {
  // V3 workflows cleanup is handled by useWorkflowsV3 composable
  // No additional cleanup needed
});
</script>

<style scoped>
/* reuse popup styles; only tune list item spacing for sidepanel width */
.rr-item {
  margin-bottom: 8px;
}
.rr-actions button {
  margin-left: 6px;
}

/* Element Markers Styles - Using agent-theme tokens */
.element-markers-content {
  padding-bottom: 24px;
  color: var(--ac-text, #262626);
}

.em-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.em-form-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.em-form-row-multi {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.em-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.em-field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--ac-text-subtle, #737373);
}

.em-input {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  background: var(--ac-surface-muted, #f5f5f5);
  border: none;
  border-radius: var(--ac-radius-inner, 10px);
  font-size: 14px;
  color: var(--ac-text, #262626);
  font-family: inherit;
  outline: none;
  transition: background var(--ac-motion-fast, 150ms) ease;
}

.em-input:focus {
  background: var(--ac-hover-bg, #e5e5e5);
}

.em-textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px 16px;
  background: var(--ac-surface-muted, #f5f5f5);
  border: none;
  border-radius: var(--ac-radius-inner, 10px);
  font-size: 14px;
  color: var(--ac-text, #262626);
  font-family: var(--ac-font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
  outline: none;
  transition: background var(--ac-motion-fast, 150ms) ease;
  resize: vertical;
}

.em-textarea:focus {
  background: var(--ac-hover-bg, #e5e5e5);
}

.em-select-wrapper {
  position: relative;
}

.em-select {
  width: 100%;
  height: 44px;
  padding: 0 40px 0 16px;
  background: var(--ac-surface-muted, #f5f5f5);
  border: none;
  border-radius: var(--ac-radius-inner, 10px);
  font-size: 14px;
  color: var(--ac-text, #262626);
  font-family: inherit;
  outline: none;
  cursor: pointer;
  appearance: none;
}

.em-select-wrapper::after {
  content: '';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--ac-text-subtle, #737373);
  pointer-events: none;
}

.em-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.em-btn {
  flex: 1;
  height: 44px;
  border: none;
  border-radius: var(--ac-radius-button, 10px);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
}

.em-btn-primary {
  background: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, #ffffff);
}

.em-btn-primary:hover {
  background: var(--ac-accent-hover, #c4664a);
  transform: translateY(-1px);
  box-shadow: var(--ac-shadow-float, 0 4px 12px rgba(0, 0, 0, 0.15));
}

.em-btn-ghost {
  background: var(--ac-surface-muted, #f5f5f5);
  color: var(--ac-text, #404040);
}

.em-btn-ghost:hover {
  background: var(--ac-hover-bg, #e5e5e5);
}

.em-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.em-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--ac-text-subtle, #a3a3a3);
  font-size: 14px;
}

/* Toolbar */
.em-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.em-search-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.em-search-icon {
  position: absolute;
  left: 12px;
  color: var(--ac-text-muted, #737373);
  pointer-events: none;
}

.em-search-input {
  width: 100%;
  height: 40px;
  padding: 0 36px;
  background: var(--ac-surface-muted, #f5f5f5);
  border: none;
  border-radius: var(--ac-radius-inner, 10px);
  font-size: 14px;
  color: var(--ac-text, #262626);
  outline: none;
  transition: background var(--ac-motion-fast, 150ms) ease;
}

.em-search-input:focus {
  background: var(--ac-hover-bg, #e5e5e5);
}

.em-search-input::placeholder {
  color: var(--ac-text-muted, #a3a3a3);
}

.em-search-clear {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--ac-text-muted, #737373);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
}

.em-search-clear:hover {
  background: var(--ac-hover-bg, #e5e5e5);
  color: var(--ac-text, #262626);
}

.em-add-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-accent, #d97757);
  border: none;
  border-radius: var(--ac-radius-button, 10px);
  color: var(--ac-accent-contrast, #ffffff);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
  flex-shrink: 0;
}

.em-add-btn:hover {
  background: var(--ac-accent-hover, #c4664a);
  transform: translateY(-1px);
  box-shadow: var(--ac-shadow-float, 0 4px 12px rgba(0, 0, 0, 0.15));
}

/* Modal */
.em-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 150ms ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.em-modal {
  width: calc(100% - 32px);
  max-width: 480px;
  max-height: calc(100vh - 64px);
  background: var(--ac-surface, #ffffff);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-float, 0 8px 32px rgba(0, 0, 0, 0.2));
  overflow: hidden;
  animation: slideUp 200ms ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.em-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ac-border, #e5e5e5);
}

.em-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ac-text, #262626);
  margin: 0;
}

.em-modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #737373);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
}

.em-modal-close:hover {
  background: var(--ac-hover-bg, #f5f5f5);
  color: var(--ac-text, #262626);
}

.em-modal .em-form {
  padding: 20px;
}

.em-modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

.em-modal-actions .em-btn {
  flex: none;
  min-width: 80px;
}

/* Statistics Bar (compact) */
.em-stats-bar {
  padding: 10px 16px;
  background: var(--ac-surface-muted, #f5f5f5);
  border-radius: var(--ac-radius-inner, 8px);
}

.em-stats-text {
  font-size: 13px;
  color: var(--ac-text-muted, #737373);
}

.em-stats-text strong {
  color: var(--ac-text, #262626);
  font-weight: 600;
}

.em-domain-header {
  background: var(--ac-surface, #ffffff);
  border: var(--ac-border-width, 1px) solid var(--ac-border, #e7e5e4);
  border-radius: var(--ac-radius-card, 12px);
  padding: 6px 12px;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
  user-select: none;
}

.em-domain-header:hover {
  background: var(--ac-hover-bg, #f5f5f4);
  box-shadow: var(--ac-shadow-float, 0 4px 12px rgba(0, 0, 0, 0.1));
}

.em-domain-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.em-domain-icon {
  flex-shrink: 0;
  color: var(--ac-text-muted, #525252);
  transition: transform var(--ac-motion-fast, 150ms) ease;
}

.em-domain-icon-expanded {
  transform: rotate(0deg);
}

.em-domain-icon:not(.em-domain-icon-expanded) {
  transform: rotate(-90deg);
}

.em-domain-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--ac-text, #262626);
  margin: 0;
  flex: 1;
}

.em-domain-count {
  font-size: 13px;
  color: var(--ac-text-muted, #737373);
  background: var(--ac-surface-muted, rgba(255, 255, 255, 0.6));
  padding: 4px 12px;
  border-radius: var(--ac-radius-button, 12px);
  font-weight: 500;
}

/* Domain Content */
.em-domain-content {
  animation: slideDown 200ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Content wrapper with left border for visual hierarchy */
.em-content-wrapper {
  margin-left: 8px;
  margin-top: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--ac-border, #e5e5e5);
}

/* URL Group */
.em-url-group {
  margin-bottom: 12px;
}

.em-url-group:last-child {
  margin-bottom: 0;
}

.em-url-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}

.em-url-icon {
  color: var(--ac-text-muted, #a3a3a3);
  flex-shrink: 0;
}

.em-url-path {
  font-size: 12px;
  color: var(--ac-text-muted, #737373);
  font-family: var(--ac-font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
  word-break: break-all;
  line-height: 1.4;
}

/* Markers List */
.em-markers-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Marker Item - Two row layout */
.em-marker-item {
  padding: 8px 10px;
  border-radius: var(--ac-radius-inner, 6px);
  background: var(--ac-hover-bg, rgba(0, 0, 0, 0.03));
  margin-bottom: 4px;
}

.em-marker-item:last-child {
  margin-bottom: 0;
}

.em-marker-item:hover {
  background: var(--ac-hover-bg, rgba(0, 0, 0, 0.05));
}

/* Top row: name + actions */
.em-marker-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.em-marker-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ac-text, #262626);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.em-marker-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.em-action-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--ac-radius-button, 6px);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 150ms) ease;
}

.em-action-btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.em-action-btn.em-action-verify {
  background: var(--ac-accent-subtle, rgba(217, 119, 87, 0.1));
  color: var(--ac-accent, #d97757);
}

.em-action-btn.em-action-verify:hover {
  background: var(--ac-accent-subtle, rgba(217, 119, 87, 0.18));
}

.em-action-btn.em-action-edit {
  background: var(--ac-surface-muted, #f5f5f5);
  color: var(--ac-text-muted, #737373);
}

.em-action-btn.em-action-edit:hover {
  background: var(--ac-hover-bg, #e5e5e5);
  color: var(--ac-text, #262626);
}

.em-action-btn.em-action-delete {
  background: var(--ac-danger-subtle, rgba(239, 68, 68, 0.08));
  color: var(--ac-danger, #ef4444);
}

.em-action-btn.em-action-delete:hover {
  background: var(--ac-danger-subtle, rgba(239, 68, 68, 0.15));
}

/* Bottom row: selector + tags */
.em-marker-row-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.em-marker-selector {
  font-size: 11px;
  font-family: var(--ac-font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
  color: var(--ac-text-muted, #737373);
  background: var(--ac-surface-muted, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.em-marker-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.em-tag {
  font-size: 9px;
  padding: 2px 5px;
  background: transparent;
  color: var(--ac-text-muted, #a3a3a3);
  border: 1px solid var(--ac-border, #e5e5e5);
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Empty state button */
.em-empty-btn {
  margin-top: 16px;
  width: auto;
  padding: 0 24px;
}
</style>
