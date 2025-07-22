// Platform detection and common utilities

// Platform types
const PLATFORMS = {
  TINDER: 'tinder',
  BUMBLE: 'bumble',
  UNKNOWN: 'unknown'
};

// Detect current platform based on hostname
function detectPlatform() {
  const hostname = window.location.hostname.toLowerCase();
  
  if (hostname.includes('tinder.com')) {
    return PLATFORMS.TINDER;
  } else if (hostname.includes('bumble.com')) {
    return PLATFORMS.BUMBLE;
  }
  
  return PLATFORMS.UNKNOWN;
}

// Platform-specific configurations
const PLATFORM_CONFIGS = {
  [PLATFORMS.TINDER]: {
    name: 'Tinder',
    supportedFeatures: ['textAnalysis', 'imageAnalysis', 'profileExtraction', 'autoSwipe'],
    keyboardShortcuts: {
      like: 'ArrowRight',
      pass: 'ArrowLeft',
      superLike: 'ArrowUp'
    }
  },
  [PLATFORMS.BUMBLE]: {
    name: 'Bumble',
    supportedFeatures: ['textAnalysis', 'imageAnalysis', 'profileExtraction', 'autoSwipe'],
    keyboardShortcuts: {
      like: 'ArrowRight',
      pass: 'ArrowLeft',
      superLike: 'Space' // SuperSwipe
    }
  }
};

// Get configuration for current platform
function getPlatformConfig() {
  const platform = detectPlatform();
  return PLATFORM_CONFIGS[platform] || null;
}

// Check if platform is supported
function isPlatformSupported() {
  const platform = detectPlatform();
  return platform !== PLATFORMS.UNKNOWN;
}

// Common utility functions shared across platforms
function delayExecution(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateUserId() {
  let userId = localStorage.getItem('universalSwiper_userId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('universalSwiper_userId', userId);
  }
  return userId;
}

function triggerKeyEvent(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: key,
    bubbles: true,
    cancelable: true
  }));
}

function cleanText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

function isValidUrl(url) {
  try {
    new URL(url);
    return url.startsWith('http') || url.startsWith('https');
  } catch {
    return false;
  }
}

// Common state management
const universalState = {
  platform: null,
  isRunning: false,
  swipeCount: 0,
  config: {
    apiEndpoint: 'https://your-api.com/decide',
    textApiEndpoint: 'https://your-api.com/text-decide',
    imageApiEndpoint: 'https://your-api.com/image-decide',
    maxSwipes: 200,
    skipAfterImages: 6,
    userId: null
  },
  stats: {
    total: 0,
    likes: 0,
    passes: 0,
    errors: 0
  }
};

// Initialize platform state
function initializePlatform() {
  universalState.platform = detectPlatform();
  universalState.config.userId = generateUserId();
  
  console.log(`🚀 Platform detected: ${universalState.platform}`);
  console.log(`👤 User ID: ${universalState.config.userId}`);
  
  return universalState.platform;
}

// Update configuration
function updateUniversalConfig(newConfig = {}) {
  universalState.config = { ...universalState.config, ...newConfig };
}

// Get current state
function getUniversalStats() {
  return {
    ...universalState.stats,
    isRunning: universalState.isRunning,
    platform: universalState.platform
  };
}

function getUniversalStatus() {
  return {
    isRunning: universalState.isRunning,
    swipeCount: universalState.swipeCount,
    platform: universalState.platform
  };
}

// Set running state
function setRunningState(isRunning) {
  universalState.isRunning = isRunning;
}

// Update swipe count
function incrementSwipeCount() {
  universalState.swipeCount++;
}

function resetSwipeCount() {
  universalState.swipeCount = 0;
}

// Update stats
function updateStats(action) {
  universalState.stats.total++;
  
  switch (action.toLowerCase()) {
    case 'like':
    case 'right':
      universalState.stats.likes++;
      break;
    case 'pass':
    case 'left':
    case 'skip':
      universalState.stats.passes++;
      break;
    default:
      universalState.stats.errors++;
  }
}

// Common API request function
async function makeApiRequest(endpoint, payload, timeout = 45000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'UniversalSwiper/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('❌ API request failed:', error);
    throw error;
  }
}

// Export everything
export {
  PLATFORMS,
  detectPlatform,
  getPlatformConfig,
  isPlatformSupported,
  initializePlatform,
  updateUniversalConfig,
  getUniversalStats,
  getUniversalStatus,
  setRunningState,
  incrementSwipeCount,
  resetSwipeCount,
  updateStats,
  makeApiRequest,
  delayExecution,
  generateUserId,
  triggerKeyEvent,
  cleanText,
  isValidUrl,
  universalState
};