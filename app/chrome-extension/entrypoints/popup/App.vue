<template>
  <div class="popup-container agent-theme" :data-agent-theme="agentTheme">
    <!-- 首页 -->
    <div v-show="currentView === 'home'" class="home-view">
      <div class="header">
        <div class="header-content">
          <h1 class="header-title">Chrome MCP</h1>
        </div>
      </div>
      <div class="content">
        <!-- 服务配置卡片 -->
        <div class="section">
          <h2 class="section-title">{{ getMessage('nativeServerConfigLabel') }}</h2>
          <div class="config-card">
            <div class="mcp-config-section">
              <div class="mcp-config-header">
                <p class="mcp-config-label">{{ getMessage('mcpServerConfigLabel') }}</p>
                <button class="copy-config-button" @click="copyMcpConfig">
                  {{ copyButtonText }}
                </button>
              </div>
              <p class="mcp-config-help">{{ getMessage('mcpConfigHelpText') }}</p>
              <div
                class="mcp-config-mode"
                role="tablist"
                :aria-label="getMessage('mcpConfigModeLabel')"
              >
                <button
                  type="button"
                  :class="['mcp-config-mode-button', { active: mcpConfigMode === 'npx' }]"
                  role="tab"
                  :aria-selected="mcpConfigMode === 'npx'"
                  @click="setMcpConfigMode('npx')"
                >
                  {{ getMessage('mcpConfigModeNpx') }}
                </button>
                <button
                  type="button"
                  :class="['mcp-config-mode-button', { active: mcpConfigMode === 'http' }]"
                  role="tab"
                  :aria-selected="mcpConfigMode === 'http'"
                  @click="setMcpConfigMode('http')"
                >
                  {{ getMessage('mcpConfigModeHttp') }}
                </button>
              </div>
              <div class="mcp-config-content">
                <pre class="mcp-config-json">{{ mcpConfigJson }}</pre>
              </div>
            </div>

            <div class="status-section">
              <div class="status-header">
                <p class="status-label">{{ getMessage('runningStatusLabel') }}</p>
                <button
                  class="refresh-status-button"
                  @click="refreshServerStatus"
                  :title="getMessage('refreshStatusButton')"
                >
                  <RefreshIcon className="icon-small" />
                </button>
              </div>
              <div class="status-info">
                <span :class="['status-dot', getStatusClass()]"></span>
                <span class="status-text">{{ getStatusText() }}</span>
              </div>
              <div v-if="serverStatus.lastUpdated" class="status-timestamp">
                {{ getMessage('lastUpdatedLabel') }}
                {{ new Date(serverStatus.lastUpdated).toLocaleTimeString() }}
              </div>
              <div class="server-readiness">
                <div class="server-readiness-header">
                  <span>{{ getMessage('serverReadinessLabel') }}</span>
                  <div class="server-readiness-actions">
                    <button
                      type="button"
                      class="server-readiness-guide-button"
                      @click="openWelcomePage"
                    >
                      {{ getMessage('serverReadinessGuideButton') }}
                    </button>
                    <span :class="['server-readiness-badge', { ready: isServerReady }]">
                      {{
                        isServerReady
                          ? getMessage('serverReadinessReady')
                          : getMessage('serverReadinessNotReady')
                      }}
                    </span>
                  </div>
                </div>
                <ol class="server-readiness-list">
                  <li>
                    {{ getMessage('serverReadinessStepPrereq') }}
                  </li>
                  <li>
                    {{ getMessage('serverReadinessStepConfig') }}
                  </li>
                  <li>
                    {{ getMessage('serverReadinessStepRestart') }}
                  </li>
                  <li :class="{ done: nativeConnectionStatus === 'connected' }">
                    {{ getMessage('serverReadinessStepConnect') }}
                  </li>
                  <li :class="{ done: serverStatus.isRunning }">
                    {{ getMessage('serverReadinessStepRunning') }}
                  </li>
                  <li :class="{ done: serverStatus.isRunning }">
                    {{ getMessage('serverReadinessStepPing', [serverPingUrl]) }}
                  </li>
                  <li>
                    {{ getMessage('serverReadinessStepRepair') }}
                  </li>
                </ol>
              </div>
            </div>

            <button
              class="advanced-toggle-button"
              @click="showAdvancedConfig = !showAdvancedConfig"
            >
              <span>{{ getMessage('advancedSettingsLabel') }}</span>
              <span aria-hidden="true">{{ showAdvancedConfig ? '−' : '+' }}</span>
            </button>

            <div v-if="showAdvancedConfig" class="port-section">
              <label for="port" class="port-label">{{ getMessage('connectionPortLabel') }}</label>
              <input
                type="text"
                id="port"
                :value="nativeServerPort"
                @input="updatePort"
                class="port-input"
              />
            </div>

            <button class="connect-button" :disabled="isConnecting" @click="testNativeConnection">
              <BoltIcon />
              <span>{{
                isConnecting
                  ? getMessage('connectingStatus')
                  : nativeConnectionStatus === 'connected'
                    ? getMessage('disconnectButton')
                    : getMessage('connectButton')
              }}</span>
            </button>
          </div>
        </div>

        <!-- 快捷工具卡片 -->
        <div class="section">
          <h2 class="section-title">快捷工具</h2>
          <div class="rr-icon-buttons">
            <button
              class="rr-icon-btn rr-icon-btn-record rr-icon-btn-coming-soon has-tooltip"
              @click="startRecording"
              data-tooltip="录制功能开发中"
            >
              <RecordIcon :recording="false" />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-stop rr-icon-btn-coming-soon has-tooltip"
              @click="stopRecording"
              data-tooltip="录制功能开发中"
            >
              <StopIcon />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-edit has-tooltip"
              @click="toggleWebEditor"
              data-tooltip="开启页面编辑模式"
            >
              <EditIcon />
            </button>
            <button
              class="rr-icon-btn rr-icon-btn-marker has-tooltip"
              @click="toggleElementMarker"
              data-tooltip="开启元素标注"
            >
              <MarkerIcon />
            </button>
          </div>
        </div>

        <!-- 管理入口卡片 -->
        <div class="section">
          <h2 class="section-title">管理入口</h2>
          <div class="entry-card">
            <button class="entry-item" @click="openAgentSidepanel">
              <div class="entry-icon agent">
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
              <div class="entry-content">
                <span class="entry-title">智能助手</span>
                <span class="entry-desc">AI Agent 对话与任务</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item entry-item-coming-soon" @click="openWorkflowSidepanel">
              <div class="entry-icon workflow">
                <WorkflowIcon />
              </div>
              <div class="entry-content">
                <span class="entry-title">
                  工作流管理
                  <span class="coming-soon-badge">Coming Soon</span>
                </span>
                <span class="entry-desc">录制与回放自动化流程</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="openElementMarkerSidepanel">
              <div class="entry-icon marker">
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
              <div class="entry-content">
                <span class="entry-title">元素标注管理</span>
                <span class="entry-desc">管理页面元素标注</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button class="entry-item" @click="currentView = 'local-model'">
              <div class="entry-icon model">
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
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div class="entry-content">
                <span class="entry-title">本地模型</span>
                <span class="entry-desc">语义引擎与模型管理</span>
              </div>
              <svg
                class="entry-arrow"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-links">
          <button class="footer-link" @click="openWelcomePage" title="View installation guide">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Guide
          </button>
          <button class="footer-link" @click="openTroubleshooting" title="Troubleshooting">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Docs
          </button>
        </div>
        <p class="footer-text">chrome mcp server for ai</p>
      </div>
    </div>

    <!-- 本地模型二级页面 -->
    <LocalModelPage
      v-show="currentView === 'local-model'"
      :semantic-engine-status="semanticEngineStatus"
      :is-semantic-engine-initializing="isSemanticEngineInitializing"
      :semantic-engine-init-progress="semanticEngineInitProgress"
      :semantic-engine-last-updated="semanticEngineLastUpdated"
      :available-models="availableModels"
      :current-model="currentModel"
      :is-model-switching="isModelSwitching"
      :is-model-downloading="isModelDownloading"
      :model-download-progress="modelDownloadProgress"
      :model-initialization-status="modelInitializationStatus"
      :model-error-message="modelErrorMessage"
      :model-error-type="modelErrorType"
      :storage-stats="storageStats"
      :is-clearing-data="isClearingData"
      :clear-data-progress="clearDataProgress"
      :cache-stats="cacheStats"
      :is-managing-cache="isManagingCache"
      @back="currentView = 'home'"
      @initialize-semantic-engine="initializeSemanticEngine"
      @switch-model="switchModel"
      @retry-model-initialization="retryModelInitialization"
      @show-clear-confirmation="showClearConfirmation = true"
      @cleanup-cache="cleanupCache"
      @clear-all-cache="clearAllCache"
    />

    <ConfirmDialog
      :visible="showClearConfirmation"
      :title="getMessage('confirmClearDataTitle')"
      :message="getMessage('clearDataWarningMessage')"
      :items="[
        getMessage('clearDataList1'),
        getMessage('clearDataList2'),
        getMessage('clearDataList3'),
      ]"
      :warning="getMessage('clearDataIrreversibleWarning')"
      icon="⚠️"
      :confirm-text="getMessage('confirmClearButton')"
      :cancel-text="getMessage('cancelButton')"
      :confirming-text="getMessage('clearingStatus')"
      :is-confirming="isClearingData"
      @confirm="confirmClearAllData"
      @cancel="hideClearDataConfirmation"
    />

    <!-- 侧边栏承担工作流管理；编辑器在独立窗口中打开 -->

    <!-- Coming Soon Toast -->
    <Transition name="toast">
      <div v-if="comingSoonToast.show" class="coming-soon-toast">
        <svg
          class="toast-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ comingSoonToast.feature }} 功能开发中，敬请期待</span>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { NativeMessageType } from 'agent-chrome-mcp-shared';
import {
  PREDEFINED_MODELS,
  type ModelPreset,
  getModelInfo,
  getCacheStats,
  clearModelCache,
  cleanupModelCache,
} from '@/utils/semantic-similarity-engine';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { LINKS, NATIVE_HOST } from '@/common/constants';
import { getMessage } from '@/utils/i18n';
import { useAgentTheme, type AgentThemeId } from '../sidepanel/composables/useAgentTheme';

import ConfirmDialog from './components/ConfirmDialog.vue';
import ProgressIndicator from './components/ProgressIndicator.vue';
import ModelCacheManagement from './components/ModelCacheManagement.vue';
import LocalModelPage from './components/LocalModelPage.vue';
import {
  DocumentIcon,
  DatabaseIcon,
  BoltIcon,
  TrashIcon,
  CheckIcon,
  TabIcon,
  VectorIcon,
  RecordIcon,
  StopIcon,
  WorkflowIcon,
  RefreshIcon,
  EditIcon,
  MarkerIcon,
} from './components/icons';

// AgentChat theme - 从preload中获取，保持与sidepanel一致
const { theme: agentTheme, initTheme } = useAgentTheme();

// 当前视图状态：首页 or 本地模型页
const currentView = ref<'home' | 'local-model'>('home');

// Coming Soon Toast
const comingSoonToast = ref<{ show: boolean; feature: string }>({ show: false, feature: '' });

function showComingSoonToast(feature: string) {
  comingSoonToast.value = { show: true, feature };
  setTimeout(() => {
    comingSoonToast.value = { show: false, feature: '' };
  }, 2000);
}

// Record & Replay state
const rrRecording = ref(false);
const rrFlows = ref<
  Array<{ id: string; name: string; description?: string; meta?: any; variables?: any[] }>
>([]);
const rrOnlyBound = ref(false);
const rrSearch = ref('');
const currentTabUrl = ref<string>('');
const filteredRrFlows = computed(() => {
  const base = rrOnlyBound.value ? rrFlows.value.filter(isFlowBoundToCurrent) : rrFlows.value;
  const q = rrSearch.value.trim().toLowerCase();
  if (!q) return base;
  return base.filter((f: any) => {
    const name = String(f.name || '').toLowerCase();
    const domain = String(f?.meta?.domain || '').toLowerCase();
    const tags = ((f?.meta?.tags || []) as any[]).join(',').toLowerCase();
    return name.includes(q) || domain.includes(q) || tags.includes(q);
  });
});

// Flow editor在独立窗口中打开；在popup不再展示繁杂列表

const loadFlows = async () => {
  try {
    const res = await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.RR_LIST_FLOWS });
    if (res && res.success) rrFlows.value = res.flows || [];
  } catch (e) {
    /* ignore */
  }
};

function isFlowBoundToCurrent(flow: any) {
  try {
    const bindings = flow?.meta?.bindings || [];
    if (!bindings.length) return false;
    if (!currentTabUrl.value) return true;
    const url = new URL(currentTabUrl.value);
    return bindings.some((b: any) => {
      if (b.type === 'domain') return url.hostname.includes(b.value);
      if (b.type === 'path') return url.pathname.startsWith(b.value);
      if (b.type === 'url') return (url.href || '').startsWith(b.value);
      return false;
    });
  } catch {
    return false;
  }
}

// 运行记录与覆盖项在侧边栏页面查看
const startRecording = async () => {
  // TODO: 录制回放功能开发中，暂时拦截
  showComingSoonToast('录制回放');
  return;
  // if (rrRecording.value) return;
  // try {
  //   const res = await chrome.runtime.sendMessage({
  //     type: BACKGROUND_MESSAGE_TYPES.RR_START_RECORDING,
  //     meta: { name: '新录制' },
  //   });
  //   rrRecording.value = !!(res && res.success);
  // } catch (e) {
  //   console.error('开始录制失败:', e);
  //   rrRecording.value = false;
  // }
};

const stopRecording = async () => {
  // TODO: 录制回放功能开发中，暂时拦截
  showComingSoonToast('录制回放');
  return;
  // if (!rrRecording.value) return;
  // try {
  //   const res = await chrome.runtime.sendMessage({
  //     type: BACKGROUND_MESSAGE_TYPES.RR_STOP_RECORDING,
  //   });
  //   rrRecording.value = false;
  //   if (res && res.success) await loadFlows();
  // } catch (e) {
  //   console.error('停止录制失败:', e);
  //   rrRecording.value = false;
  // }
};

const runFlow = async (flowId: string) => {
  try {
    // load flow to get runOptions
    let flow: any = null;
    try {
      const getRes = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.RR_GET_FLOW,
        flowId,
      });
      if (getRes && getRes.success) flow = getRes.flow;
    } catch {}
    const runOptions = (flow && flow.meta && flow.meta.runOptions) || {};
    // No per-run overrides in popup; sidepanel/editor manage advanced options
    const ov: any = {};
    const res = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.RR_RUN_FLOW,
      flowId,
      options: { ...runOptions, ...ov, returnLogs: true },
    });
    if (!(res && res.success)) {
      console.warn('回放失败');
      return;
    }
    // If failed, open builder and focus the failed node
    try {
      const result = res.result;
      if (result && result.success === false) {
        const logs = result.logs || [];
        const failed = logs.find((l: any) => l.status === 'failed');
        if (failed && failed.stepId) {
          // 打开独立编辑窗口并定位失败节点
          if (flow) openBuilderWindow(flow.id, String(failed.stepId));
        }
      } else if (result && result.success === true) {
        // If run succeeded but selector fallback was used, suggest updating priorities
        const logs = result.logs || [];
        const fb = logs.find((l: any) => l.fallbackUsed && l.fallbackTo);
        if (fb && flow) openBuilderWindow(flow.id, String(fb.stepId || ''));
      }
    } catch {}
  } catch (e) {
    console.error('回放失败:', e);
  }
};

// 旧的“克隆/发布/定时/覆盖项”在侧边栏或编辑器中处理

const nativeConnectionStatus = ref<'unknown' | 'connected' | 'disconnected'>('unknown');
const isConnecting = ref(false);
const nativeServerPort = ref<number>(NATIVE_HOST.DEFAULT_PORT);
const showAdvancedConfig = ref(false);

const serverStatus = ref<{
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}>({
  isRunning: false,
  lastUpdated: Date.now(),
});

const copyButtonText = ref(getMessage('copyConfigButton'));
const mcpConfigMode = ref<'npx' | 'http'>('npx');

const isServerReady = computed(
  () => nativeConnectionStatus.value === 'connected' && serverStatus.value.isRunning,
);

const serverPingUrl = computed(() => {
  const port = serverStatus.value.port || nativeServerPort.value || NATIVE_HOST.DEFAULT_PORT;
  return `http://127.0.0.1:${port}/ping`;
});

const setMcpConfigMode = (mode: 'npx' | 'http') => {
  mcpConfigMode.value = mode;
  copyButtonText.value = getMessage('copyConfigButton');
};

const mcpConfigJson = computed(() => {
  if (mcpConfigMode.value === 'http') {
    const config = {
      mcpServers: {
        'chrome-mcp': {
          type: 'streamableHttp',
          url: `http://127.0.0.1:${nativeServerPort.value}/mcp`,
        },
      },
    };
    return JSON.stringify(config, null, 2);
  }

  const config = {
    mcpServers: {
      'chrome-mcp': {
        command: 'npx',
        args: ['-y', '--registry=https://registry.npmjs.org', 'agent-chrome-mcp@latest', 'stdio'],
      },
    },
  };
  return JSON.stringify(config, null, 2);
});

const currentModel = ref<ModelPreset | null>(null);
const isModelSwitching = ref(false);
const modelSwitchProgress = ref('');

const modelDownloadProgress = ref<number>(0);
const isModelDownloading = ref(false);
const modelInitializationStatus = ref<'idle' | 'downloading' | 'initializing' | 'ready' | 'error'>(
  'idle',
);
const modelErrorMessage = ref<string>('');
const modelErrorType = ref<'network' | 'file' | 'unknown' | ''>('');

const selectedVersion = ref<'quantized'>('quantized');

const storageStats = ref<{
  indexedPages: number;
  totalDocuments: number;
  totalTabs: number;
  indexSize: number;
  isInitialized: boolean;
} | null>(null);
const isRefreshingStats = ref(false);
const isClearingData = ref(false);
const showClearConfirmation = ref(false);
const clearDataProgress = ref('');

const semanticEngineStatus = ref<'idle' | 'initializing' | 'ready' | 'error'>('idle');
const isSemanticEngineInitializing = ref(false);
const semanticEngineInitProgress = ref('');
const semanticEngineLastUpdated = ref<number | null>(null);

// Cache management
const isManagingCache = ref(false);
const cacheStats = ref<{
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: Array<{
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
  }>;
} | null>(null);

const availableModels = computed(() => {
  return Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
    preset: key as ModelPreset,
    ...value,
  }));
});

const getStatusClass = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return 'bg-emerald-500';
    } else {
      return 'bg-yellow-500';
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return 'bg-red-500';
  } else {
    return 'bg-gray-500';
  }
};

// Open sidepanel and close popup
async function openSidepanelAndClose(tab: string) {
  try {
    const current = await chrome.windows.getCurrent();
    if ((chrome.sidePanel as any)?.setOptions) {
      await (chrome.sidePanel as any).setOptions({
        path: `sidepanel.html?tab=${tab}`,
        enabled: true,
      });
    }
    if (chrome.sidePanel && (chrome.sidePanel as any).open) {
      await (chrome.sidePanel as any).open({ windowId: current.id! });
    }
    // Close popup after opening sidepanel
    window.close();
  } catch (e) {
    console.warn(`Failed to open sidepanel (${tab}):`, e);
  }
}

// Open sidepanel from popup for workflow management
function openWorkflowSidepanel() {
  // TODO: 工作流功能开发中，暂时拦截
  showComingSoonToast('工作流管理');
  // openSidepanelAndClose('workflows');
}

// Open sidepanel for element marker management
function openElementMarkerSidepanel() {
  openSidepanelAndClose('element-markers');
}

// Open sidepanel for agent chat
function openAgentSidepanel() {
  openSidepanelAndClose('agent-chat');
}

async function toggleWebEditor() {
  try {
    await chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TOGGLE });
  } catch (error) {
    console.warn('切换网页编辑模式失败:', error);
  }
}

async function toggleElementMarker() {
  try {
    // 获取当前活动tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('无法获取当前tab');
      return;
    }

    // 向background发送消息，启动元素标注
    await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START,
      tabId: tab.id,
    });
  } catch (error) {
    console.warn('开启元素标注失败:', error);
  }
}

async function openWelcomePage() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  } catch {
    // ignore
  }
}

async function openTroubleshooting() {
  try {
    await chrome.tabs.create({ url: LINKS.TROUBLESHOOTING });
  } catch {
    // ignore
  }
}

function openBuilderWindow(flowId?: string, focusNodeId?: string) {
  const url = new URL(chrome.runtime.getURL('builder.html'));
  if (flowId) url.searchParams.set('flowId', flowId);
  if (focusNodeId) url.searchParams.set('focus', focusNodeId);
  chrome.windows.create({ url: url.toString(), type: 'popup', width: 1280, height: 800 });
}

const getStatusText = () => {
  if (nativeConnectionStatus.value === 'connected') {
    if (serverStatus.value.isRunning) {
      return getMessage('serviceRunningStatus', [
        (serverStatus.value.port || 'Unknown').toString(),
      ]);
    } else {
      return getMessage('connectedServiceNotStartedStatus');
    }
  } else if (nativeConnectionStatus.value === 'disconnected') {
    return getMessage('serviceNotConnectedStatus');
  } else {
    return getMessage('detectingStatus');
  }
};

const formatIndexSize = () => {
  if (!storageStats.value?.indexSize) return '0 MB';
  const sizeInMB = Math.round(storageStats.value.indexSize / (1024 * 1024));
  return `${sizeInMB} MB`;
};

const getModelDescription = (model: any) => {
  switch (model.preset) {
    case 'multilingual-e5-small':
      return getMessage('lightweightModelDescription');
    case 'multilingual-e5-base':
      return getMessage('betterThanSmallDescription');
    default:
      return getMessage('multilingualModelDescription');
  }
};

const getPerformanceText = (performance: string) => {
  switch (performance) {
    case 'fast':
      return getMessage('fastPerformance');
    case 'balanced':
      return getMessage('balancedPerformance');
    case 'accurate':
      return getMessage('accuratePerformance');
    default:
      return performance;
  }
};

const getSemanticEngineStatusText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('semanticEngineReadyStatus');
    case 'initializing':
      return getMessage('semanticEngineInitializingStatus');
    case 'error':
      return getMessage('semanticEngineInitFailedStatus');
    case 'idle':
    default:
      return getMessage('semanticEngineNotInitStatus');
  }
};

const getSemanticEngineStatusClass = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return 'bg-emerald-500';
    case 'initializing':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'idle':
    default:
      return 'bg-gray-500';
  }
};

const getActiveTabsCount = () => {
  return storageStats.value?.totalTabs || 0;
};

const getProgressText = () => {
  if (isModelDownloading.value) {
    return getMessage('downloadingModelStatus', [modelDownloadProgress.value.toString()]);
  } else if (isModelSwitching.value) {
    return modelSwitchProgress.value || getMessage('switchingModelStatus');
  }
  return '';
};

const getErrorTypeText = () => {
  switch (modelErrorType.value) {
    case 'network':
      return getMessage('networkErrorMessage');
    case 'file':
      return getMessage('modelCorruptedErrorMessage');
    case 'unknown':
    default:
      return getMessage('unknownErrorMessage');
  }
};

const getSemanticEngineButtonText = () => {
  switch (semanticEngineStatus.value) {
    case 'ready':
      return getMessage('reinitializeButton');
    case 'initializing':
      return getMessage('initializingStatus');
    case 'error':
      return getMessage('reinitializeButton');
    case 'idle':
    default:
      return getMessage('initSemanticEngineButton');
  }
};

const loadCacheStats = async () => {
  try {
    cacheStats.value = await getCacheStats();
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    cacheStats.value = null;
  }
};

const cleanupCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await cleanupModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const clearAllCache = async () => {
  if (isManagingCache.value) return;

  isManagingCache.value = true;
  try {
    await clearModelCache();
    // Refresh cache stats
    await loadCacheStats();
  } catch (error) {
    console.error('Failed to clear cache:', error);
  } finally {
    isManagingCache.value = false;
  }
};

const saveSemanticEngineState = async () => {
  try {
    const semanticEngineState = {
      status: semanticEngineStatus.value,
      lastUpdated: semanticEngineLastUpdated.value,
    };
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ semanticEngineState });
  } catch (error) {
    console.error('保存语义引擎状态失败:', error);
  }
};

const initializeSemanticEngine = async () => {
  if (isSemanticEngineInitializing.value) return;

  const isReinitialization = semanticEngineStatus.value === 'ready';
  console.log(
    `🚀 User triggered semantic engine ${isReinitialization ? 'reinitialization' : 'initialization'}`,
  );

  isSemanticEngineInitializing.value = true;
  semanticEngineStatus.value = 'initializing';
  semanticEngineInitProgress.value = isReinitialization
    ? getMessage('semanticEngineInitializingStatus')
    : getMessage('semanticEngineInitializingStatus');
  semanticEngineLastUpdated.value = Date.now();

  await saveSemanticEngineState();

  try {
    // eslint-disable-next-line no-undef
    chrome.runtime
      .sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.INITIALIZE_SEMANTIC_ENGINE,
      })
      .catch((error) => {
        console.error('❌ Error sending semantic engine initialization request:', error);
      });

    startSemanticEngineStatusPolling();

    semanticEngineInitProgress.value = isReinitialization
      ? getMessage('processingStatus')
      : getMessage('processingStatus');
  } catch (error: any) {
    console.error('❌ Failed to send initialization request:', error);
    semanticEngineStatus.value = 'error';
    semanticEngineInitProgress.value = `Failed to send initialization request: ${error?.message || 'Unknown error'}`;

    await saveSemanticEngineState();

    setTimeout(() => {
      semanticEngineInitProgress.value = '';
    }, 5000);

    isSemanticEngineInitializing.value = false;
    semanticEngineLastUpdated.value = Date.now();
    await saveSemanticEngineState();
  }
};

const checkSemanticEngineStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_MODEL_STATUS,
    });

    if (response && response.success && response.status) {
      const status = response.status;

      if (status.initializationStatus === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineReadyStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 2000);
      } else if (
        status.initializationStatus === 'downloading' ||
        status.initializationStatus === 'initializing'
      ) {
        semanticEngineStatus.value = 'initializing';
        isSemanticEngineInitializing.value = true;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitializingStatus');
        semanticEngineLastUpdated.value = Date.now();
        await saveSemanticEngineState();
      } else if (status.initializationStatus === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = Date.now();
        isSemanticEngineInitializing.value = false;
        semanticEngineInitProgress.value = getMessage('semanticEngineInitFailedStatus');
        await saveSemanticEngineState();
        stopSemanticEngineStatusPolling();
        setTimeout(() => {
          semanticEngineInitProgress.value = '';
        }, 5000);
      } else {
        semanticEngineStatus.value = 'idle';
        isSemanticEngineInitializing.value = false;
        await saveSemanticEngineState();
      }
    } else {
      semanticEngineStatus.value = 'idle';
      isSemanticEngineInitializing.value = false;
      await saveSemanticEngineState();
    }
  } catch (error) {
    console.error('Popup: Failed to check semantic engine status:', error);
    semanticEngineStatus.value = 'idle';
    isSemanticEngineInitializing.value = false;
    await saveSemanticEngineState();
  }
};

const retryModelInitialization = async () => {
  if (!currentModel.value) return;

  console.log('🔄 Retrying model initialization...');

  modelErrorMessage.value = '';
  modelErrorType.value = '';
  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;
  await switchModel(currentModel.value);
};

const updatePort = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const newPort = Number(target.value);
  nativeServerPort.value = newPort;

  await savePortPreference(newPort);
};

const checkNativeConnection = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({ type: 'ping_native' });
    nativeConnectionStatus.value = response?.connected ? 'connected' : 'disconnected';
  } catch (error) {
    console.error('检测 Native 连接状态失败:', error);
    nativeConnectionStatus.value = 'disconnected';
  }
};

const checkServerStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('检测服务器状态失败:', error);
  }
};

const ensureNativeConnection = async () => {
  if (isConnecting.value) return;
  isConnecting.value = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: NativeMessageType.ENSURE_NATIVE,
      port: nativeServerPort.value,
    });
    if (response?.connected) {
      nativeConnectionStatus.value = 'connected';
      await savePortPreference(nativeServerPort.value);
    } else {
      nativeConnectionStatus.value = 'disconnected';
    }
    await checkServerStatus();
  } catch (error) {
    console.error('自动连接 Native 服务失败:', error);
    nativeConnectionStatus.value = 'disconnected';
  } finally {
    isConnecting.value = false;
  }
};

const refreshServerStatus = async () => {
  try {
    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS,
    });
    if (response?.success && response.serverStatus) {
      serverStatus.value = response.serverStatus;
    }

    if (response?.connected !== undefined) {
      nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
    }
  } catch (error) {
    console.error('刷新服务器状态失败:', error);
  }
};

const copyMcpConfig = async () => {
  try {
    await navigator.clipboard.writeText(mcpConfigJson.value);
    copyButtonText.value = getMessage('configCopiedNotification');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  } catch (error) {
    console.error('复制配置失败:', error);
    copyButtonText.value = getMessage('networkErrorMessage');

    setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  }
};

const testNativeConnection = async () => {
  if (isConnecting.value) return;
  isConnecting.value = true;
  try {
    if (nativeConnectionStatus.value === 'connected') {
      // eslint-disable-next-line no-undef
      await chrome.runtime.sendMessage({ type: 'disconnect_native' });
      nativeConnectionStatus.value = 'disconnected';
    } else {
      console.log(`尝试连接到端口: ${nativeServerPort.value}`);
      // eslint-disable-next-line no-undef
      const response = await chrome.runtime.sendMessage({
        type: 'connectNative',
        port: nativeServerPort.value,
      });
      if (response && response.success) {
        nativeConnectionStatus.value = 'connected';
        console.log('连接成功:', response);
        await savePortPreference(nativeServerPort.value);
      } else {
        nativeConnectionStatus.value = 'disconnected';
        console.error('连接失败:', response);
      }
    }
  } catch (error) {
    console.error('测试连接失败:', error);
    nativeConnectionStatus.value = 'disconnected';
  } finally {
    isConnecting.value = false;
  }
};

const loadModelPreference = async () => {
  try {
    // eslint-disable-next-line no-undef
    const result = await chrome.storage.local.get([
      'selectedModel',
      'selectedVersion',
      'modelState',
      'semanticEngineState',
    ]);

    if (result.selectedModel) {
      const storedModel = result.selectedModel as string;
      console.log('📋 Stored model from storage:', storedModel);

      if (PREDEFINED_MODELS[storedModel as ModelPreset]) {
        currentModel.value = storedModel as ModelPreset;
        console.log(`✅ Loaded valid model: ${currentModel.value}`);
      } else {
        console.warn(
          `⚠️ Stored model "${storedModel}" not found in PREDEFINED_MODELS, using default`,
        );
        currentModel.value = 'multilingual-e5-small';
        await saveModelPreference(currentModel.value);
      }
    } else {
      console.log('⚠️ No model found in storage, using default');
      currentModel.value = 'multilingual-e5-small';
      await saveModelPreference(currentModel.value);
    }

    selectedVersion.value = 'quantized';
    console.log('✅ Using quantized version (fixed)');

    await saveVersionPreference('quantized');

    if (result.modelState) {
      const modelState = result.modelState;

      if (modelState.status === 'ready') {
        modelInitializationStatus.value = 'ready';
        modelDownloadProgress.value = modelState.downloadProgress || 100;
        isModelDownloading.value = false;
      } else {
        modelInitializationStatus.value = 'idle';
        modelDownloadProgress.value = 0;
        isModelDownloading.value = false;

        await saveModelState();
      }
    } else {
      modelInitializationStatus.value = 'idle';
      modelDownloadProgress.value = 0;
      isModelDownloading.value = false;
    }

    if (result.semanticEngineState) {
      const semanticState = result.semanticEngineState;
      if (semanticState.status === 'ready') {
        semanticEngineStatus.value = 'ready';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else if (semanticState.status === 'error') {
        semanticEngineStatus.value = 'error';
        semanticEngineLastUpdated.value = semanticState.lastUpdated || Date.now();
      } else {
        semanticEngineStatus.value = 'idle';
      }
    } else {
      semanticEngineStatus.value = 'idle';
    }
  } catch (error) {
    console.error('❌ 加载模型偏好失败:', error);
  }
};

const saveModelPreference = async (model: ModelPreset) => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ selectedModel: model });
  } catch (error) {
    console.error('保存模型偏好失败:', error);
  }
};

const saveVersionPreference = async (version: 'full' | 'quantized' | 'compressed') => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ selectedVersion: version });
  } catch (error) {
    console.error('保存版本偏好失败:', error);
  }
};

const savePortPreference = async (port: number) => {
  try {
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ nativeServerPort: port });
    console.log(`端口偏好已保存: ${port}`);
  } catch (error) {
    console.error('保存端口偏好失败:', error);
  }
};

const loadPortPreference = async () => {
  try {
    // eslint-disable-next-line no-undef
    const result = await chrome.storage.local.get(['nativeServerPort']);
    if (result.nativeServerPort === NATIVE_HOST.LEGACY_DEFAULT_PORT) {
      nativeServerPort.value = NATIVE_HOST.DEFAULT_PORT;
      await savePortPreference(NATIVE_HOST.DEFAULT_PORT);
      console.log(
        `端口偏好已从旧默认值 ${NATIVE_HOST.LEGACY_DEFAULT_PORT} 迁移到 ${NATIVE_HOST.DEFAULT_PORT}`,
      );
    } else if (result.nativeServerPort) {
      nativeServerPort.value = result.nativeServerPort;
      console.log(`端口偏好已加载: ${result.nativeServerPort}`);
    }
  } catch (error) {
    console.error('加载端口偏好失败:', error);
  }
};

const saveModelState = async () => {
  try {
    const modelState = {
      status: modelInitializationStatus.value,
      downloadProgress: modelDownloadProgress.value,
      isDownloading: isModelDownloading.value,
      lastUpdated: Date.now(),
    };
    // eslint-disable-next-line no-undef
    await chrome.storage.local.set({ modelState });
  } catch (error) {
    console.error('保存模型状态失败:', error);
  }
};

let statusMonitoringInterval: ReturnType<typeof setInterval> | null = null;
let semanticEngineStatusPollingInterval: ReturnType<typeof setInterval> | null = null;

const startModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
  }

  statusMonitoringInterval = setInterval(async () => {
    try {
      // eslint-disable-next-line no-undef
      const response = await chrome.runtime.sendMessage({
        type: 'get_model_status',
      });

      if (response && response.success) {
        const status = response.status;
        modelInitializationStatus.value = status.initializationStatus || 'idle';
        modelDownloadProgress.value = status.downloadProgress || 0;
        isModelDownloading.value = status.isDownloading || false;

        if (status.initializationStatus === 'error') {
          modelErrorMessage.value = status.errorMessage || getMessage('modelFailedStatus');
          modelErrorType.value = status.errorType || 'unknown';
        } else {
          modelErrorMessage.value = '';
          modelErrorType.value = '';
        }

        await saveModelState();

        if (status.initializationStatus === 'ready' || status.initializationStatus === 'error') {
          stopModelStatusMonitoring();
        }
      }
    } catch (error) {
      console.error('获取模型状态失败:', error);
    }
  }, 1000);
};

const stopModelStatusMonitoring = () => {
  if (statusMonitoringInterval) {
    clearInterval(statusMonitoringInterval);
    statusMonitoringInterval = null;
  }
};

const startSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
  }

  semanticEngineStatusPollingInterval = setInterval(async () => {
    try {
      await checkSemanticEngineStatus();
    } catch (error) {
      console.error('Semantic engine status polling failed:', error);
    }
  }, 2000);
};

const stopSemanticEngineStatusPolling = () => {
  if (semanticEngineStatusPollingInterval) {
    clearInterval(semanticEngineStatusPollingInterval);
    semanticEngineStatusPollingInterval = null;
  }
};

const refreshStorageStats = async () => {
  if (isRefreshingStats.value) return;

  isRefreshingStats.value = true;
  try {
    console.log('🔄 Refreshing storage statistics...');

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'get_storage_stats',
    });

    if (response && response.success) {
      storageStats.value = {
        indexedPages: response.stats.indexedPages || 0,
        totalDocuments: response.stats.totalDocuments || 0,
        totalTabs: response.stats.totalTabs || 0,
        indexSize: response.stats.indexSize || 0,
        isInitialized: response.stats.isInitialized || false,
      };
      console.log('✅ Storage stats refreshed:', storageStats.value);
    } else {
      console.error('❌ Failed to get storage stats:', response?.error);
      storageStats.value = {
        indexedPages: 0,
        totalDocuments: 0,
        totalTabs: 0,
        indexSize: 0,
        isInitialized: false,
      };
    }
  } catch (error) {
    console.error('❌ Error refreshing storage stats:', error);
    storageStats.value = {
      indexedPages: 0,
      totalDocuments: 0,
      totalTabs: 0,
      indexSize: 0,
      isInitialized: false,
    };
  } finally {
    isRefreshingStats.value = false;
  }
};

const hideClearDataConfirmation = () => {
  showClearConfirmation.value = false;
};

const confirmClearAllData = async () => {
  if (isClearingData.value) return;

  isClearingData.value = true;
  clearDataProgress.value = getMessage('clearingStatus');

  try {
    console.log('🗑️ Starting to clear all data...');

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'clear_all_data',
    });

    if (response && response.success) {
      clearDataProgress.value = getMessage('dataClearedNotification');
      console.log('✅ All data cleared successfully');

      await refreshStorageStats();

      setTimeout(() => {
        clearDataProgress.value = '';
        hideClearDataConfirmation();
      }, 2000);
    } else {
      throw new Error(response?.error || 'Failed to clear data');
    }
  } catch (error: any) {
    console.error('❌ Failed to clear all data:', error);
    clearDataProgress.value = `Failed to clear data: ${error?.message || 'Unknown error'}`;

    setTimeout(() => {
      clearDataProgress.value = '';
    }, 5000);
  } finally {
    isClearingData.value = false;
  }
};

const switchModel = async (newModel: ModelPreset) => {
  console.log(`🔄 switchModel called with newModel: ${newModel}`);

  if (isModelSwitching.value) {
    console.log('⏸️ Model switch already in progress, skipping');
    return;
  }

  const isSameModel = newModel === currentModel.value;
  const currentModelInfo = currentModel.value
    ? getModelInfo(currentModel.value)
    : getModelInfo('multilingual-e5-small');
  const newModelInfo = getModelInfo(newModel);
  const isDifferentDimension = currentModelInfo.dimension !== newModelInfo.dimension;

  console.log(`📊 Switch analysis:`);
  console.log(`   - Same model: ${isSameModel} (${currentModel.value} -> ${newModel})`);
  console.log(
    `   - Current dimension: ${currentModelInfo.dimension}, New dimension: ${newModelInfo.dimension}`,
  );
  console.log(`   - Different dimension: ${isDifferentDimension}`);

  if (isSameModel && !isDifferentDimension) {
    console.log('✅ Same model and dimension - no need to switch');
    return;
  }

  const switchReasons = [];
  if (!isSameModel) switchReasons.push('different model');
  if (isDifferentDimension) switchReasons.push('different dimension');

  console.log(`🚀 Switching model due to: ${switchReasons.join(', ')}`);
  console.log(
    `📋 Model: ${currentModel.value} (${currentModelInfo.dimension}D) -> ${newModel} (${newModelInfo.dimension}D)`,
  );

  isModelSwitching.value = true;
  modelSwitchProgress.value = getMessage('switchingModelStatus');

  modelInitializationStatus.value = 'downloading';
  modelDownloadProgress.value = 0;
  isModelDownloading.value = true;

  try {
    await saveModelPreference(newModel);
    await saveVersionPreference('quantized');
    await saveModelState();

    modelSwitchProgress.value = getMessage('semanticEngineInitializingStatus');

    startModelStatusMonitoring();

    // eslint-disable-next-line no-undef
    const response = await chrome.runtime.sendMessage({
      type: 'switch_semantic_model',
      modelPreset: newModel,
      modelVersion: 'quantized',
      modelDimension: newModelInfo.dimension,
      previousDimension: currentModelInfo.dimension,
    });

    if (response && response.success) {
      currentModel.value = newModel;
      modelSwitchProgress.value = getMessage('successNotification');
      console.log(
        '模型切换成功:',
        newModel,
        'version: quantized',
        'dimension:',
        newModelInfo.dimension,
      );

      modelInitializationStatus.value = 'ready';
      isModelDownloading.value = false;
      await saveModelState();

      setTimeout(() => {
        modelSwitchProgress.value = '';
      }, 2000);
    } else {
      throw new Error(response?.error || 'Model switch failed');
    }
  } catch (error: any) {
    console.error('模型切换失败:', error);
    modelSwitchProgress.value = `Model switch failed: ${error?.message || 'Unknown error'}`;

    modelInitializationStatus.value = 'error';
    isModelDownloading.value = false;

    const errorMessage = error?.message || '未知错误';
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')
    ) {
      modelErrorType.value = 'network';
      modelErrorMessage.value = getMessage('networkErrorMessage');
    } else if (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('format')
    ) {
      modelErrorType.value = 'file';
      modelErrorMessage.value = getMessage('modelCorruptedErrorMessage');
    } else {
      modelErrorType.value = 'unknown';
      modelErrorMessage.value = errorMessage;
    }

    await saveModelState();

    setTimeout(() => {
      modelSwitchProgress.value = '';
    }, 8000);
  } finally {
    isModelSwitching.value = false;
  }
};

const setupServerStatusListener = () => {
  // eslint-disable-next-line no-undef
  const onMessage = (message: { type?: string; payload?: unknown }) => {
    // Server status changes
    if (message.type === BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED && message.payload) {
      serverStatus.value = message.payload as any;
      console.log('Server status updated:', message.payload);
    }
    // Flows changed - refresh list (IndexedDB-based notification)
    if (message.type === BACKGROUND_MESSAGE_TYPES.RR_FLOWS_CHANGED) {
      loadFlows();
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  // Store reference for cleanup
  (window as any).__rr_popup_onMessage = onMessage;
};

onMounted(async () => {
  // 初始化主题
  await initTheme();
  await loadPortPreference();
  await loadModelPreference();
  await ensureNativeConnection();
  await checkNativeConnection();
  await checkServerStatus();
  await refreshStorageStats();
  await loadCacheStats();
  await loadFlows();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl.value = tab?.url || '';
  } catch {}

  await checkSemanticEngineStatus();
  setupServerStatusListener();
  // Auto-refresh workflows list when storage rr_flows changes
  try {
    const onChanged = (changes: any, area: string) => {
      try {
        if (area !== 'local') return;
        if (Object.prototype.hasOwnProperty.call(changes || {}, 'rr_flows')) loadFlows();
      } catch {}
    };
    chrome.storage.onChanged.addListener(onChanged);
    (window as any).__rr_popup_onChanged = onChanged;
  } catch {}
});

onUnmounted(() => {
  stopModelStatusMonitoring();
  stopSemanticEngineStatusPolling();
  // Clean up runtime message listener
  try {
    const msgFn = (window as any).__rr_popup_onMessage;
    if (msgFn && chrome?.runtime?.onMessage?.removeListener) {
      chrome.runtime.onMessage.removeListener(msgFn);
    }
  } catch {}
  // Clean up storage change listener (legacy fallback)
  try {
    const fn = (window as any).__rr_popup_onChanged;
    if (fn && chrome?.storage?.onChanged?.removeListener) {
      chrome.storage.onChanged.removeListener(fn);
    }
  } catch {}
});
</script>

<style scoped>
.popup-container {
  background: #f1f5f9;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  flex-shrink: 0;
  padding-left: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.settings-button {
  padding: 8px;
  border-radius: 50%;
  color: #64748b;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-button:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.content {
  flex-grow: 1;
  padding: 8px 24px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.content::-webkit-scrollbar {
  display: none;
}
.status-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 8px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  height: 8px;
  width: 8px;
  border-radius: 50%;
}

.status-dot.bg-emerald-500 {
  background-color: #10b981;
}

.status-dot.bg-red-500 {
  background-color: #ef4444;
}

.status-dot.bg-yellow-500 {
  background-color: #eab308;
}

.status-dot.bg-gray-500 {
  background-color: #6b7280;
}

.status-text {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.model-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.model-name {
  font-weight: 600;
  color: #7c3aed;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stats-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 16px;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stats-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.stats-icon {
  padding: 8px;
  border-radius: 8px;
}

.stats-icon.violet {
  background: #ede9fe;
  color: #7c3aed;
}

.stats-icon.teal {
  background: #ccfbf1;
  color: #0d9488;
}

.stats-icon.blue {
  background: #dbeafe;
  color: #2563eb;
}

.stats-icon.green {
  background: #dcfce7;
  color: #16a34a;
}

.stats-value {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.section {
  margin-bottom: 24px;
}

.secondary-button {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.secondary-button:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.secondary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button:hover {
  background: #2563eb;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}
.current-model-card {
  background: linear-gradient(135deg, #faf5ff, #f3e8ff);
  border: 1px solid #e9d5ff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.current-model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.current-model-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin: 0;
}

.current-model-badge {
  background: #8b5cf6;
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

.current-model-name {
  font-size: 16px;
  font-weight: 700;
  color: #7c3aed;
  margin: 0;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.model-card:hover {
  border-color: #8b5cf6;
}

.model-card.selected {
  border: 2px solid #8b5cf6;
  background: #faf5ff;
}

.model-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.model-info {
  flex: 1;
}

.model-name {
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.model-name.selected-text {
  color: #7c3aed;
}

.model-description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.check-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: #8b5cf6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}
.model-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.model-tag.performance {
  background: #d1fae5;
  color: #065f46;
}

.model-tag.size {
  background: #ddd6fe;
  color: #5b21b6;
}

.model-tag.dimension {
  background: #e5e7eb;
  color: #4b5563;
}

.config-card {
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.semantic-engine-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.semantic-engine-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.semantic-engine-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #8b5cf6;
  color: white;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.semantic-engine-button:hover:not(:disabled) {
  background: #7c3aed;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.semantic-engine-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.refresh-status-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
}

.refresh-status-button:hover {
  background: #f1f5f9;
  color: #374151;
}

.status-timestamp {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.server-readiness {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 10px;
  padding: 10px;
}

.server-readiness-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.server-readiness-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.server-readiness-guide-button {
  appearance: none;
  border: 0;
  background: #eef2ff;
  color: #3730a3;
  border-radius: 999px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 7px;
  white-space: nowrap;
}

.server-readiness-guide-button:hover {
  background: #e0e7ff;
}

.server-readiness-badge {
  background: #fef3c7;
  color: #92400e;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 4px 7px;
  white-space: nowrap;
}

.server-readiness-badge.ready {
  background: #dcfce7;
  color: #166534;
}

.server-readiness-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
}

.server-readiness-list li.done {
  color: #15803d;
}

.mcp-config-section {
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 14px;
}

.mcp-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.mcp-config-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin: 0;
}

.mcp-config-help {
  font-size: 12px;
  line-height: 1.45;
  color: #64748b;
  margin: 0 0 8px;
}

.mcp-config-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 3px;
  margin-bottom: 8px;
}

.mcp-config-mode-button {
  appearance: none;
  border: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  min-height: 28px;
  padding: 6px 8px;
  border-radius: 6px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.mcp-config-mode-button:hover {
  color: #334155;
}

.mcp-config-mode-button.active {
  background: #fff;
  color: #2563eb;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.copy-config-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
}

.copy-config-button:hover {
  background: #f1f5f9;
  color: #374151;
}

.mcp-config-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
}

.mcp-config-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #374151;
  margin: 0;
  white-space: pre;
  overflow-x: auto;
}

.port-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.port-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.port-input {
  display: block;
  width: 100%;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  padding: 12px;
  font-size: 14px;
  background: #f8fafc;
}

.port-input:focus {
  outline: none;
  border-color: var(--ac-accent, #d97757);
  box-shadow: 0 0 0 3px var(--ac-accent-subtle, rgba(217, 119, 87, 0.12));
}

.advanced-toggle-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 0;
  background: #f8fafc;
  color: #475569;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.advanced-toggle-button:hover {
  background: #f1f5f9;
}

.connect-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--ac-accent, #d97757);
  color: var(--ac-accent-contrast, white);
  font-weight: 600;
  padding: 12px 16px;
  border-radius: var(--ac-radius-button, 8px);
  border: none;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
}

.connect-button:hover:not(:disabled) {
  background: var(--ac-accent-hover, #c4664a);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
}

.connect-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.error-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.error-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-details {
  flex: 1;
}

.error-title {
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
  margin: 0 0 4px 0;
}

.error-message {
  font-size: 14px;
  color: #991b1b;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.error-suggestion {
  font-size: 13px;
  color: #7f1d1d;
  margin: 0;
  line-height: 1.4;
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #dc2626;
  color: white;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  flex-shrink: 0;
}

.retry-button:hover:not(:disabled) {
  background: #b91c1c;
}

.retry-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.danger-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 16px;
}

.danger-button:hover:not(:disabled) {
  border-color: #ef4444;
  color: #dc2626;
}

.danger-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Icon sizes - use :deep to apply to child components */
:deep(.icon-small) {
  width: 16px;
  height: 16px;
}

:deep(.icon-default) {
  width: 20px;
  height: 20px;
}

:deep(.icon-medium) {
  width: 24px;
  height: 24px;
}
.footer {
  padding: 16px;
  margin-top: auto;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  margin-bottom: 8px;
}

.footer-link {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.footer-link:hover {
  color: #8b5cf6;
  background: #e2e8f0;
}

.footer-link svg {
  width: 14px;
  height: 14px;
}

.footer-text {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

@media (max-width: 320px) {
  .popup-container {
    width: 100%;
    height: 100vh;
    border-radius: 0;
  }

  .footer-links {
    gap: 8px;
  }

  .rr-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rr-controls {
    display: flex;
    gap: 8px;
  }
  .rr-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rr-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border: 1px solid #eee;
    border-radius: 6px;
  }
  .rr-runoverrides {
    margin-top: 6px;
    border: 1px dashed #e5e7eb;
    border-radius: 8px;
    padding: 8px;
    background: #f9fafb;
  }
  .rr-meta {
    display: flex;
    flex-direction: column;
  }
  .rr-name {
    font-weight: 600;
  }
  .rr-desc {
    font-size: 12px;
    color: #666;
  }
  .empty {
    color: #888;
    font-size: 13px;
  }

  .header {
    padding: 24px 20px 12px;
  }

  .content {
    padding: 8px 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .config-card {
    padding: 16px;
    gap: 12px;
  }

  .current-model-card {
    padding: 12px;
    margin-bottom: 12px;
  }

  .stats-card {
    padding: 12px;
  }

  .stats-value {
    font-size: 24px;
  }
}

/* 快捷工具icon按钮样式 */
.rr-icon-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
  padding: 16px;
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
}

.rr-icon-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-surface-muted, #f2f0eb);
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.rr-icon-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.05));
}

.rr-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.rr-icon-btn svg {
  width: 24px;
  height: 24px;
}

/* 录制按钮 - 红色 */
.rr-icon-btn-record {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.rr-icon-btn-record:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

/* 录制中状态 - 脉冲动画 */
.rr-icon-btn-recording {
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

/* 停止按钮 - 深红色 */
.rr-icon-btn-stop {
  background: rgba(185, 28, 28, 0.1);
  color: #b91c1c;
}

.rr-icon-btn-stop:hover:not(:disabled) {
  background: rgba(185, 28, 28, 0.2);
  color: #991b1b;
}

/* 编辑按钮 - 蓝色 */
.rr-icon-btn-edit {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.rr-icon-btn-edit:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.2);
  color: #1d4ed8;
}

/* 标注按钮 - 绿色 */
.rr-icon-btn-marker {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.rr-icon-btn-marker:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.2);
  color: #059669;
}

/* Coming Soon 按钮样式 */
.rr-icon-btn-coming-soon {
  opacity: 0.5;
  cursor: default !important;
}

.rr-icon-btn-coming-soon:hover {
  transform: none !important;
  box-shadow: none !important;
  opacity: 0.6;
}

/* CSS Tooltip - instant display */
.has-tooltip {
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--ac-text-inverse, #ffffff);
  background-color: var(--ac-text, #1a1a1a);
  border-radius: var(--ac-radius-button, 8px);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 80ms ease,
    visibility 80ms ease;
  pointer-events: none;
  z-index: 100;
}

.has-tooltip::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--ac-text, #1a1a1a);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 80ms ease,
    visibility 80ms ease;
  pointer-events: none;
  z-index: 100;
}

.has-tooltip:hover::after,
.has-tooltip:hover::before {
  opacity: 1;
  visibility: visible;
}

/* 首页视图 */
.home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 管理入口卡片样式 */
.entry-card {
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.entry-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ac-border, #e7e5e4);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  text-align: left;
}

.entry-item:last-child {
  border-bottom: none;
}

.entry-item:hover {
  background: var(--ac-hover-bg, #f5f5f4);
}

.entry-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ac-radius-button, 8px);
  flex-shrink: 0;
}

.entry-icon.agent {
  background: rgba(217, 119, 87, 0.12);
  color: var(--ac-accent, #d97757);
}

.entry-icon.workflow {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.entry-icon.marker {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.entry-icon.model {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.entry-content {
  flex: 1;
  min-width: 0;
}

.entry-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--ac-text, #1a1a1a);
  line-height: 1.3;
}

.entry-desc {
  display: block;
  font-size: 12px;
  color: var(--ac-text-subtle, #a8a29e);
  line-height: 1.3;
  margin-top: 2px;
}

.entry-arrow {
  color: var(--ac-text-subtle, #a8a29e);
  flex-shrink: 0;
}

/* Coming Soon Badge */
.coming-soon-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ac-accent, #d97757);
  background: rgba(217, 119, 87, 0.12);
  border-radius: 4px;
  vertical-align: middle;
}

.entry-item-coming-soon {
  opacity: 0.7;
}

.entry-item-coming-soon:hover {
  opacity: 0.85;
}

/* Coming Soon Toast */
.coming-soon-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--ac-text, #1a1a1a);
  color: var(--ac-text-inverse, #ffffff);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-float, 0 4px 20px -2px rgba(0, 0, 0, 0.15));
  z-index: 1000;
  white-space: nowrap;
}

.toast-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--ac-accent, #d97757);
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
