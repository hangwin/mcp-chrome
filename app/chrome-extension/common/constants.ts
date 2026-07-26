/**
 * Chrome Extension Constants
 * Centralized configuration values and magic constants
 */

// Native Host Configuration
export const NATIVE_HOST = {
  NAME: 'com.chromemcp.nativehost',
  LEGACY_DEFAULT_PORT: 12306,
  DEFAULT_PORT: 12307,
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
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: 'Tool executed successfully',
  CONNECTION_ESTABLISHED: 'Connection established',
  SERVER_STARTED: 'Server started successfully',
  SERVER_STOPPED: 'Server stopped successfully',
} as const;

// External Links
export const LINKS = {
  TROUBLESHOOTING: 'https://github.com/hangwin/mcp-chrome/blob/master/docs/TROUBLESHOOTING.md',
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
  // Substring match against full URL (not just hostname) to support patterns like 'facebook.com/tr'
  EXCLUDED_DOMAINS: [
    // Google
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'doubleclick.net',
    'googlesyndication.com',
    'googleads.g.doubleclick.net',
    'stats.g.doubleclick.net',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    // Amazon
    'amazon-adsystem.com',
    // Microsoft
    'bat.bing.com',
    'clarity.ms',
    // Facebook
    'connect.facebook.net',
    'facebook.com/tr',
    // Twitter
    'analytics.twitter.com',
    'ads-twitter.com',
    // Other ad networks
    'ads.yahoo.com',
    'adroll.com',
    'adnxs.com',
    'criteo.com',
    'quantserve.com',
    'scorecardresearch.com',
    // Analytics & session recording
    'segment.io',
    'amplitude.com',
    'mixpanel.com',
    'optimizely.com',
    'static.hotjar.com',
    'script.hotjar.com',
    'crazyegg.com',
    'clicktale.net',
    'mouseflow.com',
    'fullstory.com',
    // LinkedIn (tracking pixels)
    'linkedin.com/px',
  ],
  // Static resource extensions (used when includeStatic=false)
  STATIC_RESOURCE_EXTENSIONS: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.webp',
    '.ico',
    '.bmp',
    '.cur',
    '.css',
    '.scss',
    '.less',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.map',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.mp3',
    '.mp4',
    '.avi',
    '.mov',
    '.wmv',
    '.flv',
    '.webm',
    '.ogg',
    '.wav',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.iso',
    '.dmg',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
  ],
  // MIME types treated as static/binary (filtered when includeStatic=false)
  STATIC_MIME_TYPES_TO_FILTER: [
    'image/',
    'font/',
    'audio/',
    'video/',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/x-javascript',
    'application/pdf',
    'application/zip',
    'application/octet-stream',
  ],
  // API-like MIME types (never filtered by MIME)
  API_MIME_TYPES: [
    'application/json',
    'application/xml',
    'text/xml',
    'text/plain',
    'text/event-stream',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/grpc',
    'application/protobuf',
    'application/x-protobuf',
    'application/x-json',
    'application/ld+json',
    'application/problem+json',
    'application/problem+xml',
    'application/soap+xml',
    'application/vnd.api+json',
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
  NATIVE_SERVER_PORT: 'nativeServerPort',
  NATIVE_AUTO_CONNECT_ENABLED: 'nativeAutoConnectEnabled',
  SEMANTIC_MODEL: 'selectedModel',
  USER_PREFERENCES: 'userPreferences',
  VECTOR_INDEX: 'vectorIndex',
  USERSCRIPTS: 'userscripts',
  USERSCRIPTS_DISABLED: 'userscripts_disabled',
  // Record & Replay storage keys
  RR_FLOWS: 'rr_flows',
  RR_RUNS: 'rr_runs',
  RR_PUBLISHED: 'rr_published_flows',
  RR_SCHEDULES: 'rr_schedules',
  RR_TRIGGERS: 'rr_triggers',
  // Persistent recording state (guards resume across navigations/service worker restarts)
  RR_RECORDING_STATE: 'rr_recording_state',
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
