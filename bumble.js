// Bumble-specific functionality - Functional approach
// Dependencies loaded from platform.js

// Bumble-specific selectors
const BUMBLE_SELECTORS = {
  // Profile information
  name: '.encounters-story-profile__name',
  age: '.encounters-story-profile__age',
  occupation: '.encounters-story-profile__occupation',
  verification: '.encounters-story-profile__verification-badge',
  location: '.location-widget__town',
  distance: '.location-widget__distance',
  
  // Photos
  allImages: '.media-box__picture-image',
  currentStory: '.encounters-album__story',
  
  // About section
  aboutSection: '.encounters-story-section--about',
  aboutText: '.encounters-story-about__text',
  questionSections: '.encounters-story-section--question',
  questionTexts: '.encounters-story-section--question .encounters-story-about__text',
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
  if (window.universalState.isRunning) {
    console.log('Already running');
    return;
  }

  window.universalState.config = { ...window.universalState.config, ...userConfig };
  window.setRunningState(true);
  window.resetSwipeCount();
  
  console.log('🚀 Starting Bumble swiper');
  await executeBumbleSwipeLoop();
}

// Stop swiping
function stopBumbleSwiping() {
  window.setRunningState(false);
  console.log('⏹️ Bumble swiper stopped');
}

// Main swipe loop for Bumble
async function executeBumbleSwipeLoop() {
  console.log('====== STARTING BUMBLE SWIPE LOOP ======');
  
  while (window.universalState.isRunning && window.universalState.swipeCount < window.universalState.config.maxSwipes) {
    try {
      console.log(`\n🔄 BUMBLE SWIPE #${window.universalState.swipeCount + 1} STARTING...`);
      
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
        occupation: basicData.occupation,
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
            skipThreshold: window.universalState.config.skipAfterImages
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
      await window.delayExecution(delay);
      
      window.incrementSwipeCount();
      console.log(`✅ Bumble swipe #${window.universalState.swipeCount} completed!\n`);

    } catch (error) {
      console.error('\n❌ CRITICAL ERROR in Bumble swipe loop:', error);
      console.error('Stack trace:', error.stack);
      window.updateStats('error');
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
    occupation: '',
    verified: false,
    location: '',
    distance: '',
    firstPhoto: null
  };
  
  try {
    // Extract name
    const nameEl = document.querySelector(BUMBLE_SELECTORS.name);
    if (nameEl) {
      data.name = window.cleanText(nameEl.textContent);
    }
    
    // Extract age (format: ", 20")
    const ageEl = document.querySelector(BUMBLE_SELECTORS.age);
    if (ageEl) {
      const ageMatch = ageEl.textContent.match(/,\s*(\d+)/);
      if (ageMatch) {
        data.age = parseInt(ageMatch[1]);
      }
    }
    
    // Extract occupation
    const occupationEl = document.querySelector(BUMBLE_SELECTORS.occupation);
    if (occupationEl) {
      data.occupation = window.cleanText(occupationEl.textContent);
    }
    
    // Check verification
    const verificationEl = document.querySelector(BUMBLE_SELECTORS.verification);
    data.verified = !!verificationEl;
    
    // Extract location
    const locationEl = document.querySelector(BUMBLE_SELECTORS.location);
    if (locationEl) {
      data.location = window.cleanText(locationEl.textContent);
    }
    
    // Extract distance
    const distanceEl = document.querySelector(BUMBLE_SELECTORS.distance);
    if (distanceEl) {
      data.distance = window.cleanText(distanceEl.textContent);
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
    
    // Extract main about text
    const aboutTextElements = document.querySelectorAll(BUMBLE_SELECTORS.aboutText);
    const allAboutTexts = [];
    aboutTextElements.forEach(textEl => {
      const text = window.cleanText(textEl.textContent);
      if (text && text.length > 0) {
        allAboutTexts.push(text);
      }
    });
    
    // Extract question/answer texts
    const questionElements = document.querySelectorAll(BUMBLE_SELECTORS.questionSections);
    const questionTexts = [];
    questionElements.forEach(section => {
      const questionTitle = section.querySelector('.encounters-story-section__heading-title');
      const questionAnswer = section.querySelector(BUMBLE_SELECTORS.aboutText);
      
      if (questionTitle && questionAnswer) {
        const title = window.cleanText(questionTitle.textContent);
        const answer = window.cleanText(questionAnswer.textContent);
        if (title && answer) {
          questionTexts.push(`${title}: ${answer}`);
        }
      }
    });
    
    // Combine all text content
    const allTexts = [...allAboutTexts, ...questionTexts];
    fullData.about = allTexts.join('\n\n');
    
    console.log(`📝 Extracted ${allAboutTexts.length} about texts and ${questionTexts.length} question texts:`);
    console.log('About texts:', allAboutTexts);
    console.log('Question texts:', questionTexts);
    console.log('Combined about text:', fullData.about);
    console.log(`🏷️ Extracted ${fullData.badges.length} lifestyle badges:`, fullData.badges);
    
    // Extract badges with improved category detection
    const badgeContainers = document.querySelectorAll('.encounters-story-about__badge');
    badgeContainers.forEach(container => {
      const pill = container.querySelector('.pill');
      if (pill) {
        const img = pill.querySelector('.pill__image');
        const title = pill.querySelector('.pill__title');
        
        if (img && title) {
          const imgSrc = img.getAttribute('src') || '';
          const titleText = window.cleanText(title.textContent);
          
          // Extract category from image filename
          let category = null;
          if (imgSrc.includes('height')) category = 'Height';
          else if (imgSrc.includes('exercise')) category = 'Exercise';
          else if (imgSrc.includes('education')) category = 'Education';
          else if (imgSrc.includes('drinking')) category = 'Drinking';
          else if (imgSrc.includes('smoking')) category = 'Smoking';
          else if (imgSrc.includes('gender')) category = 'Gender';
          else if (imgSrc.includes('intentions')) category = 'Looking for';
          else if (imgSrc.includes('familyPlans')) category = 'Family plans';
          else if (imgSrc.includes('starSign')) category = 'Star sign';
          else if (imgSrc.includes('Politics')) category = 'Politics';
          else if (imgSrc.includes('religion')) category = 'Religion';
          
          // Format as "Category: Value" or just "Value" if category unknown
          const badgeText = category ? `${category}: ${titleText}` : titleText;
          if (badgeText && badgeText.length > 0) {
            fullData.badges.push(badgeText);
          }
        }
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
  if (!window.isValidUrl(url)) return false;
  
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
      userId: window.universalState.config.userId,
      platform: 'bumble',
      profile: {
        name: profileData.name,
        age: profileData.age,
        occupation: profileData.occupation,
        verified: profileData.verified,
        location: profileData.location,
        distance: profileData.distance,
        about: profileData.about,
        badges: profileData.badges,
        photoCount: profileData.photos.length,
        timestamp: profileData.timestamp,
        url: profileData.url
      },
      swipeCount: window.universalState.swipeCount,
      stats: window.universalState.stats
    };
    
    console.log('🌐 Requesting Bumble text-based decision from API...');
    
    const endpoint = window.universalState.config.textApiEndpoint || window.universalState.config.apiEndpoint;
    const decision = await window.makeApiRequest(endpoint, requestPayload, 180000);
    
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
      userId: window.universalState.config.userId,
      platform: 'bumble',
      imageUrls: imageData.imageUrls,
      imageIndex: imageData.imageIndex,
      totalImages: imageData.totalImages,
      profileName: imageData.name,
      skipThreshold: imageData.skipThreshold,
      swipeCount: window.universalState.swipeCount,
      stats: window.universalState.stats
    };
    
    console.log(`🌐 Requesting Bumble image-based decision from API for ${imageData.imageUrls?.length || 1} images...`);
    
    const endpoint = window.universalState.config.imageApiEndpoint || window.universalState.config.apiEndpoint;
    const decision = await window.makeApiRequest(endpoint, requestPayload);
    
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
    window.updateStats('like');
  } else if (action === 'pass' || action === 'left' || action === 'skip') {
    await bumbleSwipeLeft(decision.reason);
    window.updateStats('pass');
  } else {
    console.error(`❌ Unknown Bumble action: "${decision.action}" - Stopping swiper`);
    window.updateStats('error');
    stopBumbleSwiping();
    return;
  }
}

// Swipe right (like) on Bumble
async function bumbleSwipeRight(reason) {
  console.log(`❤️ BUMBLE LIKE: ${reason}`);
  
  // Try multiple selectors for robustness - including exact working selectors
  const likeSelectors = [
    BUMBLE_SELECTORS.likeButton, // Primary selector
    '[aria-label="Like"]', // Aria label backup
    '.encounters-action--like', // Class backup
    'div.encounters-action.encounters-action--like', // More specific class
    '[class*="encounters-action"][aria-label="Like"]' // Combined backup
  ];
  
  let likeBtn = null;
  
  for (const selector of likeSelectors) {
    likeBtn = document.querySelector(selector);
    if (likeBtn && likeBtn.offsetParent !== null) { // Check visibility
      console.log(`✅ Like button found with selector: ${selector}`);
      break;
    }
  }
  
  if (likeBtn) {
    try {
      console.log('🎯 Found like button, attempting click...');
      
      // Method 1: Focus + Enter key (best for accessibility elements)
      likeBtn.focus();
      await window.delayExecution(100);
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      const enterResult = likeBtn.dispatchEvent(enterEvent);
      console.log(`✅ Enter key dispatched on like button (result: ${enterResult})`);
      
      // Also trigger Space as fallback
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space', 
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true
      });
      
      setTimeout(() => {
        const spaceResult = likeBtn.dispatchEvent(spaceEvent);
        console.log(`✅ Space key dispatched on like button (result: ${spaceResult})`);
      }, 100);
      
      // Wait for animation and profile change
      await window.delayExecution(2000);
      
    } catch (error) {
      console.error('Error with keyboard events on like button:', error);
      console.log('⚠️ Falling back to arrow key method');
      window.triggerKeyEvent('ArrowRight');
    }
  } else {
    console.log('⚠️ Bumble like button not found with any selector, using keyboard fallback');
    window.triggerKeyEvent('ArrowRight');
  }
  
  // Handle potential match modals with longer delay
  setTimeout(() => handleBumbleModals(), 2000);
}

// Swipe left (pass) on Bumble
async function bumbleSwipeLeft(reason) {
  console.log(`👎 BUMBLE PASS: ${reason}`);
  
  // Try multiple selectors for robustness - including exact working selectors
  const passSelectors = [
    BUMBLE_SELECTORS.passButton, // Primary selector
    '[aria-label="Pass"]', // Aria label backup
    '.encounters-action--dislike', // Class backup
    'div.encounters-action.encounters-action--dislike', // More specific class
    '[class*="encounters-action"][aria-label="Pass"]' // Combined backup
  ];
  
  let passBtn = null;
  
  for (const selector of passSelectors) {
    passBtn = document.querySelector(selector);
    if (passBtn && passBtn.offsetParent !== null) { // Check visibility
      console.log(`✅ Pass button found with selector: ${selector}`);
      break;
    }
  }
  
  if (passBtn) {
    try {
      console.log('🎯 Found pass button, attempting click...');
      
      // Method 1: Focus + Enter key (best for accessibility elements)
      passBtn.focus();
      await window.delayExecution(100);
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      const enterResult = passBtn.dispatchEvent(enterEvent);
      console.log(`✅ Enter key dispatched on pass button (result: ${enterResult})`);
      
      // Also trigger Space as fallback
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true
      });
      
      setTimeout(() => {
        const spaceResult = passBtn.dispatchEvent(spaceEvent);
        console.log(`✅ Space key dispatched on pass button (result: ${spaceResult})`);
      }, 100);
      
      // Wait for animation and profile change
      await window.delayExecution(2000);
      
    } catch (error) {
      console.error('Error with keyboard events on pass button:', error);
      console.log('⚠️ Falling back to arrow key method');
      window.triggerKeyEvent('ArrowLeft');
    }
  } else {
    console.log('⚠️ Bumble pass button not found with any selector, using keyboard fallback');
    window.triggerKeyEvent('ArrowLeft');
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
        window.triggerKeyEvent('Escape');
      }
    }
  });
}

// Make Bumble functions available globally
window.startBumbleSwiping = startBumbleSwiping;
window.stopBumbleSwiping = stopBumbleSwiping;
window.extractBumbleBasicData = extractBumbleBasicData;
window.extractBumbleFullData = extractBumbleFullData;
window.extractBumblePhotos = extractBumblePhotos;
window.BUMBLE_SELECTORS = BUMBLE_SELECTORS;