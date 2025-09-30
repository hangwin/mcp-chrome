import { initNativeHostListener } from './native-host';
import {
  initSemanticSimilarityListener,
  initializeSemanticEngineIfCached,
} from './semantic-similarity';
import { initStorageManagerListener } from './storage-manager';
import {
  initRateLimiter,
  cleanupRateLimiter,
  getAllRateLimitStatuses,
  resetRateLimit,
  resetAllRateLimits,
} from './rate-limiter';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();
  initRateLimiter();
  console.log('Background: Rate limiter initialized');

  // Add rate limiter monitoring message handlers
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === BACKGROUND_MESSAGE_TYPES.GET_RATE_LIMIT_STATUS) {
      const statuses = getAllRateLimitStatuses();
      sendResponse({ success: true, statuses });
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.RESET_RATE_LIMIT) {
      if (message.toolName) {
        resetRateLimit(message.toolName);
        sendResponse({ success: true, message: `Rate limit reset for ${message.toolName}` });
      } else {
        sendResponse({ success: false, error: 'Tool name required' });
      }
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.RESET_ALL_RATE_LIMITS) {
      resetAllRateLimits();
      sendResponse({ success: true, message: 'All rate limits reset' });
      return true;
    }
  });

  // Cleanup on extension unload
  browser.runtime.onSuspend?.addListener(() => {
    console.log('Background: Cleaning up rate limiter');
    cleanupRateLimiter();
  });

  // Conditionally initialize semantic similarity engine if model cache exists
  initializeSemanticEngineIfCached()
    .then((initialized) => {
      if (initialized) {
        console.log('Background: Semantic similarity engine initialized from cache');
      } else {
        console.log(
          'Background: Semantic similarity engine initialization skipped (no cache found)',
        );
      }
    })
    .catch((error) => {
      console.warn('Background: Failed to conditionally initialize semantic engine:', error);
    });

  // Initial cleanup on startup
  cleanupModelCache().catch((error) => {
    console.warn('Background: Initial cache cleanup failed:', error);
  });
});
