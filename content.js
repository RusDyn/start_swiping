// Universal Dating App Swiper - Content Script
// Dependencies loaded from platform.js, tinder.js, bumble.js

console.log('🤖 Universal Dating App Swiper Content Script loaded');

// Platform-specific action handlers
async function handleStartAction(platform, config) {
  switch (platform) {
    case window.PLATFORMS.TINDER:
      return await window.startTinderSwiping(config);
    case window.PLATFORMS.BUMBLE:
      return await window.startBumbleSwiping(config);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function handleStopAction(platform) {
  switch (platform) {
    case window.PLATFORMS.TINDER:
      window.stopTinderSwiping();
      break;
    case window.PLATFORMS.BUMBLE:
      window.stopBumbleSwiping();
      break;
    default:
      console.error(`Unsupported platform: ${platform}`);
  }
}

// Initialize the swiper when the page is ready
function initializeSwiper() {
  if (!window.isPlatformSupported()) {
    console.log('⚠️ Platform not supported');
    return;
  }

  const platform = window.initializePlatform();
  
  // Platform-specific initialization
  // No platform-specific initialization needed
  
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
          sendResponse(window.getUniversalStats());
          break;
          
        case 'getStatus':
          sendResponse(window.getUniversalStatus());
          break;
          
        case 'updateConfig':
          window.updateUniversalConfig(request.config);
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