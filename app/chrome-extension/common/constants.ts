/**
 * Chrome Extension Constants
 * Centralized configuration values and magic constants
 */

// Native Host Configuration
export const NATIVE_HOST = {
  NAME: 'com.chromemcp.nativehost',
  DEFAULT_PORT: 12306,
} as const;

// Chrome Extension Icons
export const ICONS = {
  NOTIFICATION: 'icon/48.png',
} as const;

// Timeouts and Delays (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_WAIT: 1000,
  NETWORK_CAPTURE_MAX: 30000,
  NETWORK_CAPTURE_IDLE: 3000,
  SCREENSHOT_DELAY: 100,
  KEYBOARD_DELAY: 50,
  CLICK_DELAY: 100,
} as const;

// Limits and Thresholds
export const LIMITS = {
  MAX_NETWORK_REQUESTS: 100,
  MAX_SEARCH_RESULTS: 50,
  MAX_BOOKMARK_RESULTS: 100,
  MAX_HISTORY_RESULTS: 100,
  SIMILARITY_THRESHOLD: 0.1,
  VECTOR_DIMENSIONS: 384,
  // Rate Limiting Configuration
  RATE_LIMIT: {
    // High-risk tools (can open tabs, make network requests, steal data)
    HIGH_RISK: {
      BUCKET_SIZE: 10,
      REFILL_RATE: 2, // tokens per second
      REFILL_INTERVAL: 1000, // ms
    },
    // Medium-risk tools (can interact with page but limited damage)
    MEDIUM_RISK: {
      BUCKET_SIZE: 20,
      REFILL_RATE: 5,
      REFILL_INTERVAL: 1000,
    },
    // Low-risk tools (read-only operations)
    LOW_RISK: {
      BUCKET_SIZE: 50,
      REFILL_RATE: 10,
      REFILL_INTERVAL: 1000,
    },
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NATIVE_CONNECTION_FAILED: 'Failed to connect to native host',
  NATIVE_DISCONNECTED: 'Native connection disconnected',
  SERVER_STATUS_LOAD_FAILED: 'Failed to load server status',
  SERVER_STATUS_SAVE_FAILED: 'Failed to save server status',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
  INVALID_PARAMETERS: 'Invalid parameters provided',
  PERMISSION_DENIED: 'Permission denied',
  TAB_NOT_FOUND: 'Tab not found',
  ELEMENT_NOT_FOUND: 'Element not found',
  NETWORK_ERROR: 'Network error occurred',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: 'Tool executed successfully',
  CONNECTION_ESTABLISHED: 'Connection established',
  SERVER_STARTED: 'Server started successfully',
  SERVER_STOPPED: 'Server stopped successfully',
} as const;

// File Extensions and MIME Types
export const FILE_TYPES = {
  STATIC_EXTENSIONS: [
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
  ],
  FILTERED_MIME_TYPES: ['text/html', 'text/css', 'text/javascript', 'application/javascript'],
  IMAGE_FORMATS: ['png', 'jpeg', 'webp'] as const,
} as const;

// Network Filtering
export const NETWORK_FILTERS = {
  EXCLUDED_DOMAINS: [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com',
    'doubleclick.net',
    'googlesyndication.com',
  ],
  STATIC_RESOURCE_TYPES: ['stylesheet', 'image', 'font', 'media', 'other'],
} as const;

// Semantic Similarity Configuration
export const SEMANTIC_CONFIG = {
  DEFAULT_MODEL: 'sentence-transformers/all-MiniLM-L6-v2',
  CHUNK_SIZE: 512,
  CHUNK_OVERLAP: 50,
  BATCH_SIZE: 32,
  CACHE_SIZE: 1000,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  SERVER_STATUS: 'serverStatus',
  SEMANTIC_MODEL: 'selectedModel',
  USER_PREFERENCES: 'userPreferences',
  VECTOR_INDEX: 'vectorIndex',
} as const;

// Notification Configuration
export const NOTIFICATIONS = {
  PRIORITY: 2,
  TYPE: 'basic' as const,
} as const;

export enum ExecutionWorld {
  ISOLATED = 'ISOLATED',
  MAIN = 'MAIN',
}
