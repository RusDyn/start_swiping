// Universal Dating App Swiper - Content Script
import {
  PLATFORMS,
  isPlatformSupported,
  initializePlatform,
  updateUniversalConfig,
  getUniversalStats,
  getUniversalStatus
} from './platform.js';

import {
  initializeUserId as initializeTinderUserId,
  startSwiping as startTinderSwiping,
  stopSwiping as stopTinderSwiping
} from './tinder.js';

import {
  startBumbleSwiping,
  stopBumbleSwiping
} from './bumble.js';

console.log('🤖 Universal Dating App Swiper Content Script loaded');

// Platform-specific action handlers
async function handleStartAction(platform, config) {
  switch (platform) {
    case PLATFORMS.TINDER:
      return await startTinderSwiping(config);
    case PLATFORMS.BUMBLE:
      return await startBumbleSwiping(config);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function handleStopAction(platform) {
  switch (platform) {
    case PLATFORMS.TINDER:
      stopTinderSwiping();
      break;
    case PLATFORMS.BUMBLE:
      stopBumbleSwiping();
      break;
    default:
      console.error(`Unsupported platform: ${platform}`);
  }
}

// Initialize the swiper when the page is ready
function initializeSwiper() {
  if (!isPlatformSupported()) {
    console.log('⚠️ Platform not supported');
    return;
  }

  const platform = initializePlatform();
  
  // Platform-specific initialization
  if (platform === PLATFORMS.TINDER) {
    initializeTinderUserId();
  }
  
  // Set up message listener for popup communication
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      switch (request.action) {
        case 'start':
          handleStartAction(platform, request.config).then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            console.error('Error starting swiper:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true; // Indicates asynchronous response
          
        case 'stop':
          handleStopAction(platform);
          sendResponse({ success: true });
          break;
          
        case 'getStats':
          sendResponse(getUniversalStats());
          break;
          
        case 'getStatus':
          sendResponse(getUniversalStatus());
          break;
          
        case 'updateConfig':
          updateUniversalConfig(request.config);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error in message listener:', error);
      sendResponse({ success: false, error: error.message });
    }
  });
  
  console.log(`✅ ${platform.charAt(0).toUpperCase() + platform.slice(1)} Swiper initialized successfully`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSwiper);
} else {
  initializeSwiper();
}