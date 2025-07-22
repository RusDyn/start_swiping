// Bumble-specific functionality - Functional approach

import {
  universalState,
  setRunningState,
  incrementSwipeCount,
  resetSwipeCount,
  updateStats,
  makeApiRequest,
  delayExecution,
  triggerKeyEvent,
  cleanText,
  isValidUrl
} from './platform.js';

// Bumble-specific selectors
const BUMBLE_SELECTORS = {
  // Profile information
  name: '.encounters-story-profile__name',
  age: '.encounters-story-profile__age',
  verification: '.encounters-story-profile__verification-badge',
  location: '.location-widget__town',
  distance: '.location-widget__distance',
  
  // Photos
  allImages: '.media-box__picture-image',
  currentStory: '.encounters-album__story',
  
  // About section
  aboutSection: '.encounters-story-section--about',
  badges: '.encounters-story-about__badge .pill__title',
  
  // Action buttons
  passButton: '[data-qa-role="encounters-action-dislike"]',
  likeButton: '[data-qa-role="encounters-action-like"]',
  superSwipeButton: '[data-qa-role="encounters-action-superswipe"]',
  
  // Navigation
  nextButton: '.encounters-album__nav-item--next',
  prevButton: '.encounters-album__nav-item--prev',
  progressBar: '.line-progress__bar',
  
  // Report/block
  reportButton: '.encounters-controls__report'
};

// Start swiping on Bumble
async function startBumbleSwiping(userConfig = {}) {
  if (universalState.isRunning) {
    console.log('Already running');
    return;
  }

  universalState.config = { ...universalState.config, ...userConfig };
  setRunningState(true);
  resetSwipeCount();
  
  console.log('🚀 Starting Bumble swiper');
  await executeBumbleSwipeLoop();
}

// Stop swiping
function stopBumbleSwiping() {
  setRunningState(false);
  console.log('⏹️ Bumble swiper stopped');
}

// Main swipe loop for Bumble
async function executeBumbleSwipeLoop() {
  console.log('====== STARTING BUMBLE SWIPE LOOP ======');
  
  while (universalState.isRunning && universalState.swipeCount < universalState.config.maxSwipes) {
    try {
      console.log(`\n🔄 BUMBLE SWIPE #${universalState.swipeCount + 1} STARTING...`);
      
      // STEP 1: Extract basic profile data
      const basicData = await extractBumbleBasicData();
      
      if (!basicData) {
        console.error('❌ No basic profile data extracted. Stopping.');
        stopBumbleSwiping();
        break;
      }
      
      console.log('\n📋 BASIC DATA EXTRACTED:', {
        name: basicData.name,
        age: basicData.age,
        firstPhotoFound: basicData.firstPhoto ? 'Yes' : 'No',
        verified: basicData.verified,
        location: basicData.location
      });
      
      // STEP 2: Decision-making process (similar to Tinder)
      let finalDecision = null;
      let shouldContinue = true;
      
      // Step 2.1: Quick first image check (if available)
      if (basicData.firstPhoto) {
        console.log('🖼️ Analyzing first image for quick decision...');
        const firstImageDecision = await requestBumbleImageDecision({
          imageUrls: [basicData.firstPhoto],
          imageIndex: 0,
          totalImages: 1,
          name: basicData.name,
          skipThreshold: 1
        });
        
        if (!firstImageDecision) {
          console.error('❌ First image API request failed. Stopping.');
          stopBumbleSwiping();
          break;
        }
        
        if (firstImageDecision.action === 'skip' || firstImageDecision.action === 'pass' || firstImageDecision.action === 'left') {
          console.log('⏭️ Quick PASS based on first image');
          finalDecision = firstImageDecision;
          shouldContinue = false;
        }
      }
      
      // Step 2.2: If first image passed, analyze text and all images
      if (shouldContinue) {
        const fullData = await extractBumbleFullData(basicData);
        
        console.log('📝 Analyzing text content...');
        const textDecision = await requestBumbleTextDecision(fullData);
        
        if (!textDecision) {
          console.error('❌ Text API request failed. Stopping.');
          stopBumbleSwiping();
          break;
        }
        
        if (textDecision.action === 'skip' || textDecision.action === 'pass' || textDecision.action === 'left') {
          console.log('⏭️ PASS based on text analysis');
          finalDecision = textDecision;
          shouldContinue = false;
        }
        
        // Step 2.3: If text passed, analyze all images
        if (shouldContinue && fullData.photos.length > 0) {
          console.log(`🖼️ Text passed - analyzing all ${fullData.photos.length} images...`);
          
          const allImagesDecision = await requestBumbleImageDecision({
            imageUrls: fullData.photos,
            totalImages: fullData.photos.length,
            name: fullData.name,
            skipThreshold: universalState.config.skipAfterImages
          });
          
          if (!allImagesDecision) {
            console.error('❌ All images API request failed. Stopping.');
            stopBumbleSwiping();
            break;
          }
          
          if (allImagesDecision.action === 'skip' || allImagesDecision.action === 'pass' || allImagesDecision.action === 'left') {
            console.log('🚫 PASS based on full image analysis');
            finalDecision = allImagesDecision;
          } else {
            console.log('💕 All checks passed - LIKE decision');
            finalDecision = textDecision;
          }
        } else if (shouldContinue) {
          console.log('💕 Text passed, no images - LIKE decision');
          finalDecision = textDecision;
        }
      }
      
      // STEP 3: Execute swipe decision
      if (finalDecision) {
        await executeBumbleSwipe(finalDecision);
      } else {
        console.error('❌ No final decision made. Stopping.');
        stopBumbleSwiping();
        break;
      }
      
      // Wait before next profile
      const delay = finalDecision?.nextDelay || 4000;
      console.log(`\n⏱️ Waiting ${delay}ms before next profile...`);
      await delayExecution(delay);
      
      incrementSwipeCount();
      console.log(`✅ Bumble swipe #${universalState.swipeCount} completed!\n`);

    } catch (error) {
      console.error('\n❌ CRITICAL ERROR in Bumble swipe loop:', error);
      console.error('Stack trace:', error.stack);
      updateStats('error');
      console.log('🛑 Stopping due to error.');
      stopBumbleSwiping();
      break;
    }
  }
  
  console.log('====== BUMBLE SWIPE LOOP ENDED ======');
  stopBumbleSwiping();
}

// Extract basic profile data from current Bumble profile
async function extractBumbleBasicData() {
  const data = {
    name: 'Unknown',
    age: null,
    verified: false,
    location: '',
    distance: '',
    firstPhoto: null
  };
  
  try {
    // Extract name
    const nameEl = document.querySelector(BUMBLE_SELECTORS.name);
    if (nameEl) {
      data.name = cleanText(nameEl.textContent);
    }
    
    // Extract age (format: ", 20")
    const ageEl = document.querySelector(BUMBLE_SELECTORS.age);
    if (ageEl) {
      const ageMatch = ageEl.textContent.match(/,\s*(\d+)/);
      if (ageMatch) {
        data.age = parseInt(ageMatch[1]);
      }
    }
    
    // Check verification
    const verificationEl = document.querySelector(BUMBLE_SELECTORS.verification);
    data.verified = !!verificationEl;
    
    // Extract location
    const locationEl = document.querySelector(BUMBLE_SELECTORS.location);
    if (locationEl) {
      data.location = cleanText(locationEl.textContent);
    }
    
    // Extract distance
    const distanceEl = document.querySelector(BUMBLE_SELECTORS.distance);
    if (distanceEl) {
      data.distance = cleanText(distanceEl.textContent);
    }
    
    // Extract first photo
    const firstPhotoEl = document.querySelector(BUMBLE_SELECTORS.allImages);
    if (firstPhotoEl && firstPhotoEl.src) {
      const photoUrl = extractBumblePhotoUrl(firstPhotoEl.src);
      if (photoUrl && isBumblePhotoValid(photoUrl)) {
        data.firstPhoto = photoUrl;
      }
    }
    
    if (data.name === 'Unknown') {
      console.error('❌ Basic Bumble profile data quality insufficient');
      return null;
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error during Bumble basic profile extraction:', error);
    return null;
  }
}

// Extract full profile data
async function extractBumbleFullData(basicData) {
  const fullData = {
    ...basicData,
    photos: [],
    badges: [],
    about: '',
    timestamp: Date.now(),
    url: window.location.href,
    platform: 'bumble'
  };
  
  try {
    // Extract all photos
    fullData.photos = await extractBumblePhotos();
    
    // Extract badges (lifestyle info)
    const badgeElements = document.querySelectorAll(BUMBLE_SELECTORS.badges);
    badgeElements.forEach(badge => {
      const badgeText = cleanText(badge.textContent);
      if (badgeText && badgeText.length > 0) {
        fullData.badges.push(badgeText);
      }
    });
    
    return fullData;
    
  } catch (error) {
    console.error('❌ Error during Bumble full profile extraction:', error);
    return fullData;
  }
}

// Extract all photos from current Bumble profile
async function extractBumblePhotos() {
  const photos = [];
  const processedUrls = new Set();
  
  try {
    // Get all image elements
    const imageElements = document.querySelectorAll(BUMBLE_SELECTORS.allImages);
    
    imageElements.forEach(img => {
      if (img.src) {
        const photoUrl = extractBumblePhotoUrl(img.src);
        if (photoUrl && isBumblePhotoValid(photoUrl) && !processedUrls.has(photoUrl)) {
          processedUrls.add(photoUrl);
          photos.push(photoUrl);
        }
      }
    });
    
    console.log(`📸 Extracted ${photos.length} photos from Bumble profile`);
    return photos;
    
  } catch (error) {
    console.error('❌ Error extracting Bumble photos:', error);
    return [];
  }
}

// Extract clean photo URL from Bumble's CDN URL
function extractBumblePhotoUrl(rawUrl) {
  if (!rawUrl) return null;
  
  try {
    // Bumble uses URLs like: //us1.ecdn2.bumbcdn.com/p512/hidden?euri=...
    // Make sure it's a complete URL
    let cleanUrl = rawUrl;
    if (cleanUrl.startsWith('//')) {
      cleanUrl = 'https:' + cleanUrl;
    }
    
    return cleanUrl;
    
  } catch (error) {
    console.error('❌ Error extracting Bumble photo URL:', error);
    return null;
  }
}

// Validate if URL is a valid Bumble photo
function isBumblePhotoValid(url) {
  if (!isValidUrl(url)) return false;
  
  // Check if it's from Bumble CDN
  const bumbleCdnPatterns = [
    'bumbcdn.com',
    'ecdn2.bumbcdn.com'
  ];
  
  return bumbleCdnPatterns.some(pattern => url.includes(pattern));
}

// API request functions for Bumble
async function requestBumbleTextDecision(profileData) {
  try {
    const requestPayload = {
      userId: universalState.config.userId,
      platform: 'bumble',
      profile: {
        name: profileData.name,
        age: profileData.age,
        verified: profileData.verified,
        location: profileData.location,
        distance: profileData.distance,
        badges: profileData.badges,
        photoCount: profileData.photos.length,
        timestamp: profileData.timestamp,
        url: profileData.url
      },
      swipeCount: universalState.swipeCount,
      stats: universalState.stats
    };
    
    console.log('🌐 Requesting Bumble text-based decision from API...');
    
    const endpoint = universalState.config.textApiEndpoint || universalState.config.apiEndpoint;
    const decision = await makeApiRequest(endpoint, requestPayload, 180000);
    
    console.log('📝 Bumble text decision received:', {
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence
    });

    return decision;

  } catch (error) {
    console.error('❌ Bumble text API request failed:', error);
    stopBumbleSwiping();
    
    return {
      action: 'stop',
      reason: 'Bumble text API unavailable - stopping swiper',
      confidence: 1.0,
      nextDelay: 0
    };
  }
}

async function requestBumbleImageDecision(imageData) {
  try {
    const requestPayload = {
      userId: universalState.config.userId,
      platform: 'bumble',
      imageUrls: imageData.imageUrls,
      imageIndex: imageData.imageIndex,
      totalImages: imageData.totalImages,
      profileName: imageData.name,
      skipThreshold: imageData.skipThreshold,
      swipeCount: universalState.swipeCount,
      stats: universalState.stats
    };
    
    console.log(`🌐 Requesting Bumble image-based decision from API for ${imageData.imageUrls?.length || 1} images...`);
    
    const endpoint = universalState.config.imageApiEndpoint || universalState.config.apiEndpoint;
    const decision = await makeApiRequest(endpoint, requestPayload);
    
    console.log('📝 Bumble image decision received:', {
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence
    });

    return decision;

  } catch (error) {
    console.error('❌ Bumble image API request failed:', error);
    stopBumbleSwiping();
    
    return null;
  }
}

// Execute swipe decision on Bumble
async function executeBumbleSwipe(decision) {
  const action = decision.action?.toLowerCase();
  
  if (action === 'stop') {
    console.log('🛑 Stopping Bumble swiper as requested by decision');
    stopBumbleSwiping();
    return;
  }
  
  if (action === 'like' || action === 'right') {
    await bumbleSwipeRight(decision.reason);
    updateStats('like');
  } else if (action === 'pass' || action === 'left' || action === 'skip') {
    await bumbleSwipeLeft(decision.reason);
    updateStats('pass');
  } else {
    console.error(`❌ Unknown Bumble action: "${decision.action}" - Stopping swiper`);
    updateStats('error');
    stopBumbleSwiping();
    return;
  }
}

// Swipe right (like) on Bumble
async function bumbleSwipeRight(reason) {
  console.log(`❤️ BUMBLE LIKE: ${reason}`);
  
  const likeBtn = document.querySelector(BUMBLE_SELECTORS.likeButton);
  
  if (likeBtn) {
    likeBtn.click();
    console.log('✅ Bumble like button clicked');
  } else {
    console.log('⚠️ Bumble like button not found, using keyboard fallback');
    triggerKeyEvent('ArrowRight');
  }
  
  // Handle potential match modals
  setTimeout(() => handleBumbleModals(), 1000);
}

// Swipe left (pass) on Bumble
async function bumbleSwipeLeft(reason) {
  console.log(`👎 BUMBLE PASS: ${reason}`);
  
  const passBtn = document.querySelector(BUMBLE_SELECTORS.passButton);
  
  if (passBtn) {
    passBtn.click();
    console.log('✅ Bumble pass button clicked');
  } else {
    console.log('⚠️ Bumble pass button not found, using keyboard fallback');
    triggerKeyEvent('ArrowLeft');
  }
}

// Handle Bumble match modals and notifications
function handleBumbleModals() {
  const modalSelectors = [
    '[data-qa="match-modal"]',
    '[role="dialog"]',
    '.modal',
    '[class*="modal"]',
    '[class*="overlay"]'
  ];

  modalSelectors.forEach(selector => {
    const modal = document.querySelector(selector);
    if (modal) {
      const closeBtn = modal.querySelector('[aria-label="Close"]') ||
                      modal.querySelector('[data-qa="close"]') ||
                      modal.querySelector('.close') ||
                      modal.querySelector('[class*="close"]');
      
      if (closeBtn) {
        closeBtn.click();
        console.log('🗙 Closed Bumble modal dialog');
      } else {
        triggerKeyEvent('Escape');
      }
    }
  });
}

// Export Bumble functions
export {
  startBumbleSwiping,
  stopBumbleSwiping,
  extractBumbleBasicData,
  extractBumbleFullData,
  extractBumblePhotos,
  BUMBLE_SELECTORS
};