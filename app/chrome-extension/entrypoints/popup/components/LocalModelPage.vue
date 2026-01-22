<template>
  <div class="local-model-page">
    <!-- Back button -->
    <div class="page-header">
      <button class="back-button" @click="$emit('back')" :title="getMessage('backToHomeTitle')">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>{{ getMessage('backButton') }}</span>
      </button>
      <h2 class="page-title">{{ getMessage('localModelTitle') }}</h2>
    </div>

    <div class="page-content">
      <!-- 语义引擎 -->
      <div class="section">
        <h3 class="section-title">{{ getMessage('semanticEngineLabel') }}</h3>
        <div class="semantic-engine-card">
          <div class="semantic-engine-status">
            <div class="status-info">
              <span :class="['status-dot', getSemanticEngineStatusClass()]"></span>
              <span class="status-text">{{ getSemanticEngineStatusText() }}</span>
            </div>
            <div v-if="semanticEngineLastUpdated" class="status-timestamp">
              {{ getMessage('lastUpdatedLabel') }}
              {{ new Date(semanticEngineLastUpdated).toLocaleTimeString() }}
            </div>
          </div>

          <ProgressIndicator
            v-if="isSemanticEngineInitializing"
            :visible="isSemanticEngineInitializing"
            :text="semanticEngineInitProgress"
            :showSpinner="true"
          />

          <button
            class="primary-action-button"
            :disabled="isSemanticEngineInitializing"
            @click="$emit('initializeSemanticEngine')"
          >
            <BoltIcon />
            <span>{{ getSemanticEngineButtonText() }}</span>
          </button>
        </div>
      </div>

      <!-- Embedding模型选择 -->
      <div class="section">
        <h3 class="section-title">{{ getMessage('embeddingModelLabel') }}</h3>

        <ProgressIndicator
          v-if="isModelSwitching || isModelDownloading"
          :visible="isModelSwitching || isModelDownloading"
          :text="progressText"
          :showSpinner="true"
        />

        <div v-if="modelInitializationStatus === 'error'" class="error-card">
          <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-details">
              <p class="error-title">{{ getMessage('semanticEngineInitFailedStatus') }}</p>
              <p class="error-message">{{
                modelErrorMessage || getMessage('semanticEngineInitFailedStatus')
              }}</p>
              <p class="error-suggestion">{{ errorTypeText }}</p>
            </div>
          </div>
          <button
            class="retry-button"
            @click="$emit('retryModelInitialization')"
            :disabled="isModelSwitching || isModelDownloading"
          >
            <span>🔄</span>
            <span>{{ getMessage('retryButton') }}</span>
          </button>
        </div>

        <div class="model-list">
          <div
            v-for="model in availableModels"
            :key="model.preset"
            :class="[
              'model-card',
              {
                selected: currentModel === model.preset,
                disabled: isModelSwitching || isModelDownloading,
              },
            ]"
            @click="!isModelSwitching && !isModelDownloading && $emit('switchModel', model.preset)"
          >
            <div class="model-header">
              <div class="model-info">
                <p class="model-name" :class="{ 'selected-text': currentModel === model.preset }">
                  {{ model.preset }}
                </p>
                <p class="model-description">{{ getModelDescription(model) }}</p>
              </div>
              <div v-if="currentModel === model.preset" class="check-icon">
                <CheckIcon class="text-white" />
              </div>
            </div>
            <div class="model-tags">
              <span class="model-tag performance">{{ getPerformanceText(model.performance) }}</span>
              <span class="model-tag size">{{ model.size }}</span>
              <span class="model-tag dimension">{{ model.dimension }}D</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 索引数据管理 -->
      <div class="section">
        <h3 class="section-title">{{ getMessage('indexDataManagementLabel') }}</h3>
        <div class="stats-grid">
          <div class="stats-card">
            <div class="stats-header">
              <p class="stats-label">{{ getMessage('indexedPagesLabel') }}</p>
              <span class="stats-icon violet">
                <DocumentIcon />
              </span>
            </div>
            <p class="stats-value">{{ storageStats?.indexedPages || 0 }}</p>
          </div>

          <div class="stats-card">
            <div class="stats-header">
              <p class="stats-label">{{ getMessage('indexSizeLabel') }}</p>
              <span class="stats-icon teal">
                <DatabaseIcon />
              </span>
            </div>
            <p class="stats-value">{{ formatIndexSize() }}</p>
          </div>

          <div class="stats-card">
            <div class="stats-header">
              <p class="stats-label">{{ getMessage('activeTabsLabel') }}</p>
              <span class="stats-icon blue">
                <TabIcon />
              </span>
            </div>
            <p class="stats-value">{{ storageStats?.totalTabs || 0 }}</p>
          </div>

          <div class="stats-card">
            <div class="stats-header">
              <p class="stats-label">{{ getMessage('vectorDocumentsLabel') }}</p>
              <span class="stats-icon green">
                <VectorIcon />
              </span>
            </div>
            <p class="stats-value">{{ storageStats?.totalDocuments || 0 }}</p>
          </div>
        </div>

        <ProgressIndicator
          v-if="isClearingData && clearDataProgress"
          :visible="isClearingData"
          :text="clearDataProgress"
          :showSpinner="true"
        />

        <button
          class="danger-action-button"
          :disabled="isClearingData"
          @click="$emit('showClearConfirmation')"
        >
          <TrashIcon />
          <span>{{
            isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton')
          }}</span>
        </button>
      </div>

      <!-- 模型缓存管理 -->
      <ModelCacheManagement
        :cache-stats="cacheStats"
        :is-managing-cache="isManagingCache"
        @cleanup-cache="$emit('cleanupCache')"
        @clear-all-cache="$emit('clearAllCache')"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { getMessage } from '@/utils/i18n';
import ProgressIndicator from './ProgressIndicator.vue';
import ModelCacheManagement from './ModelCacheManagement.vue';
import {
  DocumentIcon,
  DatabaseIcon,
  BoltIcon,
  TrashIcon,
  CheckIcon,
  TabIcon,
  VectorIcon,
} from './icons';

interface Props {
  // 语义引擎
  semanticEngineStatus: 'idle' | 'initializing' | 'ready' | 'error';
  isSemanticEngineInitializing: boolean;
  semanticEngineInitProgress: string;
  semanticEngineLastUpdated: number | null;
  // 模型
  availableModels: Array<{
    preset: string;
    performance: string;
    size: string;
    dimension: number;
  }>;
  currentModel: string | null;
  isModelSwitching: boolean;
  isModelDownloading: boolean;
  modelDownloadProgress: number;
  modelInitializationStatus: string;
  modelErrorMessage: string;
  modelErrorType: string;
  // 存储统计
  storageStats: {
    indexedPages: number;
    totalDocuments: number;
    totalTabs: number;
    indexSize: number;
    isInitialized: boolean;
  } | null;
  isClearingData: boolean;
  clearDataProgress: string;
  // 缓存
  cacheStats: any;
  isManagingCache: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  (e: 'back'): void;
  (e: 'initializeSemanticEngine'): void;
  (e: 'switchModel', preset: string): void;
  (e: 'retryModelInitialization'): void;
  (e: 'showClearConfirmation'): void;
  (e: 'cleanupCache'): void;
  (e: 'clearAllCache'): void;
}>();

// 计算属性
const getSemanticEngineStatusClass = () => {
  switch (props.semanticEngineStatus) {
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

const getSemanticEngineStatusText = () => {
  switch (props.semanticEngineStatus) {
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

const getSemanticEngineButtonText = () => {
  switch (props.semanticEngineStatus) {
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

const progressText = computed(() => {
  if (props.isModelDownloading) {
    return getMessage('downloadingModelStatus', [props.modelDownloadProgress.toString()]);
  } else if (props.isModelSwitching) {
    return getMessage('switchingModelStatus');
  }
  return '';
});

const errorTypeText = computed(() => {
  switch (props.modelErrorType) {
    case 'network':
      return getMessage('networkErrorMessage');
    case 'file':
      return getMessage('modelCorruptedErrorMessage');
    case 'unknown':
    default:
      return getMessage('unknownErrorMessage');
  }
});

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

const formatIndexSize = () => {
  if (!props.storageStats?.indexSize) return '0 MB';
  const sizeInMB = Math.round(props.storageStats.indexSize / (1024 * 1024));
  return `${sizeInMB} MB`;
};
</script>

<style scoped>
.local-model-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ac-border, #e7e5e4);
  background: var(--ac-surface, #ffffff);
}

.back-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--ac-surface-muted, #f2f0eb);
  border: none;
  border-radius: var(--ac-radius-button, 8px);
  color: var(--ac-text-muted, #6e6e6e);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.back-button:hover {
  background: var(--ac-hover-bg, #f5f5f4);
  color: var(--ac-text, #1a1a1a);
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ac-text, #1a1a1a);
  margin: 0;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ac-text, #374151);
  margin-bottom: 12px;
}

.semantic-engine-card {
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.semantic-engine-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.status-dot.bg-yellow-500 {
  background-color: #eab308;
}
.status-dot.bg-red-500 {
  background-color: #ef4444;
}
.status-dot.bg-gray-500 {
  background-color: #6b7280;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--ac-text, #1a1a1a);
}

.status-timestamp {
  font-size: 12px;
  color: var(--ac-text-subtle, #9ca3af);
}

.primary-action-button {
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
}

.primary-action-button:hover:not(:disabled) {
  background: var(--ac-accent-hover, #c4664a);
}

.primary-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger-action-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--ac-surface, white);
  border: 1px solid var(--ac-border, #d1d5db);
  color: var(--ac-text, #374151);
  font-weight: 600;
  padding: 12px 16px;
  border-radius: var(--ac-radius-button, 8px);
  cursor: pointer;
  transition: all var(--ac-motion-fast, 120ms) ease;
  margin-top: 12px;
}

.danger-action-button:hover:not(:disabled) {
  border-color: #ef4444;
  color: #dc2626;
}

.danger-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 模型列表 */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  padding: 16px;
  cursor: pointer;
  border: 1px solid var(--ac-border, #e5e7eb);
  transition: all var(--ac-motion-fast, 120ms) ease;
}

.model-card:hover {
  border-color: var(--ac-accent, #d97757);
}

.model-card.selected {
  border: 2px solid var(--ac-accent, #d97757);
  background: var(--ac-accent-subtle, rgba(217, 119, 87, 0.08));
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
  color: var(--ac-text, #1e293b);
  margin: 0 0 4px 0;
}

.model-name.selected-text {
  color: var(--ac-accent, #d97757);
}

.model-description {
  font-size: 14px;
  color: var(--ac-text-muted, #64748b);
  margin: 0;
}

.check-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: var(--ac-accent, #d97757);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
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
  background: var(--ac-accent-subtle, #ddd6fe);
  color: var(--ac-accent, #5b21b6);
}

.model-tag.dimension {
  background: var(--ac-surface-muted, #e5e7eb);
  color: var(--ac-text-muted, #4b5563);
}

/* 统计网格 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stats-card {
  background: var(--ac-surface, white);
  border-radius: var(--ac-radius-card, 12px);
  box-shadow: var(--ac-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));
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
  color: var(--ac-text-muted, #64748b);
  margin: 0;
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
  font-size: 24px;
  font-weight: 700;
  color: var(--ac-text, #0f172a);
  margin: 0;
}

/* 错误卡片 */
.error-card {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--ac-radius-card, 12px);
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
  transition: all var(--ac-motion-fast, 120ms) ease;
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
</style>
