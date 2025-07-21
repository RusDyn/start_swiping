// Tinder-specific functionality - Functional approach

import {
  universalState,
  setRunningState,
  incrementSwipeCount,
  resetSwipeCount,
  updateStats,
  delayExecution,
  triggerKeyEvent
} from './platform.js';

// Initialize user ID for Tinder (legacy compatibility)
function initializeUserId() {
  let userId = localStorage.getItem('tinderSwiper_userId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('tinderSwiper_userId', userId);
    // Also set it in universal state
    universalState.config.userId = userId;
  }
  return userId;
}

// Main swiper functions
async function startSwiping(userConfig = {}) {
  if (universalState.isRunning) {
    console.log('Already running');
    return;
  }

  universalState.config = { ...universalState.config, ...userConfig };
  setRunningState(true);
  resetSwipeCount();
  
  console.log('🚀 Starting Tinder swiper');
  await executeSwipeLoop();
}

function stopSwiping() {
  setRunningState(false);
  console.log('⏹️ Tinder swiper stopped');
}

async function executeSwipeLoop() {
  console.log('====== STARTING TINDER SWIPE LOOP ======');
  
  while (universalState.isRunning && universalState.swipeCount < universalState.config.maxSwipes) {
    try {
      console.log(`\n🔄 SWIPE #${universalState.swipeCount + 1} STARTING...`);
      
      // STEP 1: Click "Open Profile" button and wait
      const openSuccess = await clickOpenProfileAndWait();
      
      if (!openSuccess) {
        console.error('❌ Failed to open profile. Stopping.');
        stopSwiping();
        break;
      }
      
      // STEP 2: Extract basic data and first image only
      const basicData = await extractBasicProfileData();
      
      if (!basicData) {
        console.error('❌ No basic profile data extracted. Stopping.');
        stopSwiping();
        break;
      }
      
      console.log('\n📋 BASIC DATA EXTRACTED:', {
        name: basicData.name,
        age: basicData.age,
        firstPhotoFound: basicData.firstPhoto ? 'Yes' : 'No',
        verified: basicData.verified
      });
      
      // STEP 3: Human-like decision process
      let finalDecision = null;
      let shouldContinue = true;
      
      // Step 3.1: Quick first image check (if available)
      if (basicData.firstPhoto) {
        console.log('🖼️ Analyzing first image for quick decision...');
        const firstImageDecision = await requestImageDecision({
          imageUrls: [basicData.firstPhoto],
          imageIndex: 0,
          totalImages: 1,
          name: basicData.name,
          skipThreshold: 1
        });
        
        if (!firstImageDecision) {
          console.error('❌ First image API request failed. Stopping.');
          stopSwiping();
          break;
        }
        
        if (firstImageDecision.action === 'skip' || firstImageDecision.action === 'pass' || firstImageDecision.action === 'left') {
          console.log('⏭️ Quick PASS based on first image');
          finalDecision = firstImageDecision;
          shouldContinue = false;
        }
      }
      
      // Step 3.2: If first image passed or no image, analyze text while fetching remaining images
      if (shouldContinue) {
        const allImagesPromise = extractAllPhotos();
        
        const fullProfileData = await extractFullProfileData(basicData);
        
        console.log('📝 Analyzing text content...');
        const textDecision = await requestTextDecision(fullProfileData);
        
        if (!textDecision) {
          console.error('❌ Text API request failed. Stopping.');
          stopSwiping();
          break;
        }
        
        if (textDecision.action === 'skip' || textDecision.action === 'pass' || textDecision.action === 'left') {
          console.log('⏭️ PASS based on text analysis');
          finalDecision = textDecision;
          shouldContinue = false;
        }
        
        // Step 3.3: If text passed, analyze all images at once
        if (shouldContinue) {
          const allPhotos = await allImagesPromise;
          console.log(`🖼️ Text passed - analyzing all ${allPhotos.length} images at once...`);
          
          if (allPhotos.length > 0) {
            const allImagesDecision = await requestImageDecision({
              imageUrls: allPhotos,
              totalImages: allPhotos.length,
              name: fullProfileData.name,
              skipThreshold: universalState.config.skipAfterImages
            });
            
            if (!allImagesDecision) {
              console.error('❌ All images API request failed. Stopping.');
              stopSwiping();
              break;
            }
            
            if (allImagesDecision.action === 'skip' || allImagesDecision.action === 'pass' || allImagesDecision.action === 'left') {
              console.log('🚫 PASS based on full image analysis');
              finalDecision = allImagesDecision;
            } else {
              console.log('💕 All checks passed - LIKE decision');
              finalDecision = textDecision;
            }
          } else {
            console.log('💕 Text passed, no images - LIKE decision');
            finalDecision = textDecision;
          }
        }
      }
      
      // STEP 4: Execute final swipe decision
      if (finalDecision) {
        await executeSwipe(finalDecision);
      } else {
        console.error('❌ No final decision made. Stopping.');
        stopSwiping();
        break;
      }
      
      // Wait before next profile
      const delay = finalDecision?.nextDelay || 4000;
      console.log(`\n⏱️ Waiting ${delay}ms before next profile...`);
      await delayExecution(delay);
      
      incrementSwipeCount();
      console.log(`✅ Swipe #${universalState.swipeCount} completed!\n`);

    } catch (error) {
      console.error('\n❌ CRITICAL ERROR in swipe loop:', error);
      console.error('Stack trace:', error.stack);
      updateStats('error');
      console.log('🛑 Stopping due to error.');
      stopSwiping();
      break;
    }
  }
  
  console.log('====== SWIPE LOOP ENDED ======');
  stopSwiping();
}

// Profile interaction functions
async function clickOpenProfileAndWait() {
  const buttons = document.querySelectorAll('button');
  let showButton = null;
  
  for (const btn of buttons) {
    const hiddenSpan = btn.querySelector('span.Hidden');
    if (hiddenSpan && hiddenSpan.textContent.trim() === 'Open Profile') {
      showButton = btn;
      break;
    }
  }
  
  if (!showButton) {
    console.log('⚠️ No "Open Profile" button found - profile might already be open');
    return true;
  }
  
  try {
    console.log('👆 Clicking "Open Profile" button...');
    showButton.click();
    
    console.log('⏱️ Waiting 3 seconds for profile to load...');
    await delayExecution(3000);
    
    return true;
  } catch (error) {
    console.error('❌ Error clicking "Open Profile" button:', error);
    return false;
  }
}

// Profile data extraction functions
async function extractBasicProfileData() {
  const data = {
    name: 'Unknown',
    age: null,
    verified: false,
    firstPhoto: null
  };
  
  try {
    data.name = extractName();
    data.age = extractAge();
    data.verified = extractVerificationStatus();
    
    const firstPhotos = await extractFirstPhotoOnly();
    if (firstPhotos.length > 0) {
      data.firstPhoto = firstPhotos[0];
    }
    
    if (data.name === 'Unknown') {
      console.error('❌ Basic profile data quality insufficient');
      return null;
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error during basic profile extraction:', error);
    return null;
  }
}

async function extractFullProfileData(basicData) {
  const fullData = {
    ...basicData,
    bio: '',
    photos: [],
    profileInfo: {},
    timestamp: Date.now(),
    url: window.location.href
  };
  
  try {
    fullData.bio = extractBio();
    fullData.profileInfo = extractAllProfileInfo();
    
    return fullData;
    
  } catch (error) {
    console.error('❌ Error during full profile extraction:', error);
    return fullData;
  }
}

function extractName() {
  const nameSelectors = [
    'h1[class*="Typs(display-2-strong)"] span:first-child',
    'h1 span.Pend\\(8px\\)',
    'h1 span:first-child',
    'h1'
  ];
  
  for (const selector of nameSelectors) {
    try {
      const nameEl = document.querySelector(selector);
      if (nameEl && nameEl.textContent.trim()) {
        const name = cleanName(nameEl.textContent.trim());
        return name;
      }
    } catch (e) {
      console.log(`❌ Name selector failed: ${selector}`);
    }
  }
  
  console.log('❌ No name found');
  return 'Unknown';
}

function extractAge() {
  const ageSelectors = [
    'h1[class*="Typs(display-2-strong)"] span[class*="Typs(display-2-regular)"]',
    'h1 span.Whs\\(nw\\)',
    'h1 span:last-child'
  ];
  
  for (const selector of ageSelectors) {
    try {
      const ageEl = document.querySelector(selector);
      if (ageEl && ageEl.textContent.trim() && /^\d{1,2}$/.test(ageEl.textContent.trim())) {
        const age = parseInt(ageEl.textContent.trim());
        return age;
      }
    } catch (e) {
      console.log(`❌ Age selector failed: ${selector}`);
    }
  }
  
  console.log('❌ No age found');
  return null;
}

function extractVerificationStatus() {
  const verificationSelectors = [
    'title[textContent="Verified!"]',
    'svg title[textContent="Verified!"]',
    'svg[title="Verified!"]',
    'svg[aria-label*="Verified"]',
    '[title*="Verified"]',
    '[aria-label*="Verified"]'
  ];
  
  for (const selector of verificationSelectors) {
    try {
      const verifiedEl = document.querySelector(selector);
      if (verifiedEl) {
        return true;
      }
    } catch (e) {
      console.log(`❌ Verification selector failed: ${selector}`);
    }
  }
  
  const titleElements = document.querySelectorAll('title');
  for (const title of titleElements) {
    if (title.textContent.trim() === 'Verified!') {
      return true;
    }
  }
  
  const svgElements = document.querySelectorAll('svg');
  for (const svg of svgElements) {
    const titleEl = svg.querySelector('title');
    if (titleEl && titleEl.textContent.trim() === 'Verified!') {
      return true;
    }
  }
  
  const badgeElements = document.querySelectorAll('[class*="verified"], [class*="badge"], [data-testid*="verified"]');
  for (const badge of badgeElements) {
    if (badge.textContent.includes('Verified') || badge.getAttribute('aria-label')?.includes('Verified')) {
      return true;
    }
  }
  
  console.log('❌ Not verified');
  return false;
}

async function extractFirstPhotoOnly() {
  const photos = [];
  
  try {
    const firstSlide = document.querySelector('.keen-slider__slide');
    if (firstSlide) {
      const imgDiv = firstSlide.querySelector('.profileCard__slider__img[style*="background-image"]');
      if (imgDiv) {
        const url = extractUrlFromBackground(imgDiv);
        if (url && isValidProfilePhoto(url)) {
          photos.push(url);
        }
      }
    }
    
    if (photos.length === 0) {
      const firstAriaPhoto = document.querySelector('[aria-label*="Profile Photo"][style*="background-image"]');
      if (firstAriaPhoto) {
        const url = extractUrlFromBackground(firstAriaPhoto);
        if (url && isValidProfilePhoto(url)) {
          photos.push(url);
        }
      }
    }
    
    const keenSlides = document.querySelectorAll('.keen-slider__slide');
    if (keenSlides.length > 0) {
      const firstSlide = keenSlides[0];
      const ariaLabel = firstSlide.getAttribute('aria-label');
      if (ariaLabel) {
        const match = ariaLabel.match(/\d+ of (\d+)/);
        if (match) {
          tinderState.totalPhotos = parseInt(match[1]);
        }
      }
    }
    
    return photos;
    
  } catch (error) {
    console.error('❌ Error extracting first photo:', error);
    return [];
  }
}

async function extractAllPhotos() {
  const photos = [];
  const processedUrls = new Set();
  
  const keenSlides = document.querySelectorAll('.keen-slider__slide');
  
  let totalPhotos = 0;
  if (keenSlides.length > 0) {
    const firstSlide = keenSlides[0];
    const ariaLabel = firstSlide.getAttribute('aria-label');
    if (ariaLabel) {
      const match = ariaLabel.match(/\d+ of (\d+)/);
      if (match) {
        totalPhotos = parseInt(match[1]);
      }
    }
  }
  
  if (totalPhotos > 1) {
    const carouselPhotos = await loadAllPhotosFromCarousel(totalPhotos);
    
    carouselPhotos.forEach(url => {
      if (!processedUrls.has(url)) {
        processedUrls.add(url);
        photos.push(url);
      }
    });
    
  } else {
    keenSlides.forEach((slide) => {
      const imgDiv = slide.querySelector('.profileCard__slider__img[style*="background-image"]');
      if (imgDiv) {
        const url = extractUrlFromBackground(imgDiv);
        if (url && isValidProfilePhoto(url) && !processedUrls.has(url)) {
          processedUrls.add(url);
          photos.push(url);
        }
      }
    });
  }
  
  const ariaPhotos = document.querySelectorAll('[aria-label*="Profile Photo"][style*="background-image"]');
  
  ariaPhotos.forEach((el) => {
    const url = extractUrlFromBackground(el);
    if (url && isValidProfilePhoto(url) && !processedUrls.has(url)) {
      processedUrls.add(url);
      photos.push(url);
    }
  });
  
  if (photos.length < Math.min(totalPhotos, 3)) {
    const allBgImages = document.querySelectorAll('[style*="background-image"]');
    
    allBgImages.forEach((el) => {
      const url = extractUrlFromBackground(el);
      if (url && isValidProfilePhoto(url) && !processedUrls.has(url)) {
        processedUrls.add(url);
        photos.push(url);
      }
    });
  }
  
  if (totalPhotos > 0 && photos.length < totalPhotos) {
    console.log(`⚠️ WARNING: Only found ${photos.length} photos but expected ${totalPhotos}. Photos might be lazy-loaded.`);
  }
  
  return photos;
}

function extractBio() {
  const containers = document.querySelectorAll('div[class*="P(24px)"][class*="W(100%)"]');
  
  for (const container of containers) {
    const header = container.querySelector('h2[class*="Typs(body-2-strong)"]');
    if (header && header.textContent.trim() === 'About me') {
      
      const bioDiv = container.querySelector('div[class*="C($c-ds-text-primary)"][class*="Typs(body-1-regular)"]');
      if (bioDiv) {
        let bioText = bioDiv.textContent.trim();
        return bioText;
      }
    }
  }
  
  for (const container of containers) {
    const text = container.textContent.trim();
    if (text.length > 20 && 
        !text.includes('Looking for') && 
        !text.includes('Essentials') &&
        !text.includes('Basics') &&
        !text.includes('Lifestyle') &&
        !text.includes('Interests') &&
        !text.includes('kilometers away') &&
        !text.includes('miles away')) {
      let cleanText = text.replace(/^About me\s*/i, '').trim();
      return cleanText;
    }
  }
  
  console.log('❌ No bio found');
  return '';
}

function extractAllProfileInfo() {
  const profileInfo = {};
  
  const containers = document.querySelectorAll('div[class*="P(24px)"][class*="W(100%)"]');
  
  containers.forEach((container) => {
    const header = container.querySelector('h2[class*="Typs(body-2-strong)"]');
    if (header) {
      let sectionName = header.textContent.trim();
      sectionName = cleanSectionName(sectionName);
      
      switch (sectionName) {
        case 'Looking for':
          profileInfo.lookingFor = extractLookingFor(container);
          break;
        case 'About me':
          break;
        case 'Essentials':
          profileInfo.essentials = extractListInfo(container);
          break;
        case 'Basics':
          profileInfo.basics = extractListInfo(container);
          break;
        case 'Lifestyle':
          profileInfo.lifestyle = extractListInfo(container);
          break;
        case 'Interests':
          profileInfo.interests = extractInterests(container);
          break;
        case 'Going Out':
          profileInfo.goingOut = extractListInfo(container);
          break;
        case 'My anthem':
          profileInfo.anthem = extractSpotifyInfo(container);
          break;
        case 'My top artists':
          profileInfo.topArtists = extractSpotifyInfo(container);
          break;
        default:
          if (sectionName.includes('Preferences') || sectionName.includes('Matched')) {
            profileInfo.preferences = extractListInfo(container);
          } else {
            profileInfo[sectionNameToKey(sectionName)] = extractGenericSection(container);
          }
      }
    }
  });
  
  return profileInfo;
}

// Photo extraction utility functions
async function loadAllPhotosFromCarousel(totalPhotos) {
  const photos = [];
  const processedUrls = new Set();
  
  const photoContainer = document.querySelector('.keen-slider');
  if (!photoContainer) {
    console.log('❌ No keen-slider container found');
    return [];
  }
  
  for (let i = 0; i < totalPhotos; i++) {
    if (i === 0) {
      // First photo should already be visible
    } else {
      await navigateToNextPhoto(photoContainer, i);
    }
    
    await delayExecution(800);
    
    const activePhoto = extractCurrentActivePhoto();
    if (activePhoto && isValidProfilePhoto(activePhoto) && !processedUrls.has(activePhoto)) {
      processedUrls.add(activePhoto);
      photos.push(activePhoto);
    } else {
      console.log(`⚠️ Failed to capture photo ${i + 1} - no valid URL found`);
    }
  }
  
  return photos;
}

async function navigateToNextPhoto(photoContainer, photoIndex) {
  const indicators = document.querySelectorAll('[role="tab"]');
  if (indicators[photoIndex]) {
    indicators[photoIndex].click();
    return;
  }
  
  console.log('⌨️ Using keyboard navigation (ArrowRight)');
  photoContainer.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true
  }));
}

function extractCurrentActivePhoto() {
  const activeSlides = document.querySelectorAll('.keen-slider__slide[aria-hidden="false"]');
  for (const slide of activeSlides) {
    const imgDiv = slide.querySelector('.profileCard__slider__img[style*="background-image"]');
    if (imgDiv) {
      const url = extractUrlFromBackground(imgDiv);
      if (url) {
        return url;
      }
    }
  }
  
  const visiblePhotos = document.querySelectorAll('.profileCard__slider__img[style*="background-image"]');
  for (const photo of visiblePhotos) {
    const url = extractUrlFromBackground(photo);
    if (url) {
      return url;
    }
  }
  
  const ariaPhotos = document.querySelectorAll('[aria-label*="Profile Photo"][style*="background-image"]');
  for (const photo of ariaPhotos) {
    const url = extractUrlFromBackground(photo);
    if (url) {
      return url;
    }
  }
  
  console.log('❌ No active photo found');
  return null;
}

// API request functions
async function requestTextDecision(profileData) {
  try {
    const requestPayload = {
      userId: universalState.config.userId,
      profile: {
        name: profileData.name,
        age: profileData.age,
        bio: profileData.bio,
        verified: profileData.verified,
        photoCount: profileData.photos.length,
        profileInfo: profileData.profileInfo,
        timestamp: profileData.timestamp,
        url: profileData.url
      },
      swipeCount: universalState.swipeCount,
      stats: universalState.stats
    };
    
    console.log('🌐 Requesting text-based decision from API...');
    
    const endpoint = universalState.config.textApiEndpoint || universalState.config.apiEndpoint;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TinderSwiper/1.0'
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Text API responded with ${response.status}`);
    }

    const decision = await response.json();
    
    console.log('📝 Text decision received:', {
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence
    });

    return decision;

  } catch (error) {
    console.error('❌ Text API request failed:', error);
    console.log('🛑 Stopping swiper due to API unavailability');
    
    stopSwiping();
    
    return {
      action: 'stop',
      reason: 'Text API unavailable - stopping swiper',
      confidence: 1.0,
      nextDelay: 0
    };
  }
}

async function requestImageDecision(imageData) {
  try {
    const requestPayload = {
      userId: universalState.config.userId,
      imageUrls: imageData.imageUrls || [imageData.imageUrl],
      imageIndex: imageData.imageIndex,
      totalImages: imageData.totalImages,
      profileName: imageData.name,
      skipThreshold: imageData.skipThreshold,
      swipeCount: universalState.swipeCount,
      stats: universalState.stats
    };
    
    console.log(`🌐 Requesting image-based decision from API for ${imageData.imageUrls?.length || 1} images...`);
    
    const endpoint = universalState.config.imageApiEndpoint || universalState.config.apiEndpoint;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TinderSwiper/1.0'
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Image API responded with ${response.status}`);
    }

    const decision = await response.json();
    
    console.log('📝 Image decision received:', {
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence
    });

    return decision;

  } catch (error) {
    console.error('❌ Image API request failed:', error);
    console.log('🛑 Stopping swiper due to image API unavailability');
    
    stopSwiping();
    
    return null;
  }
}

// Swipe execution functions
async function executeSwipe(decision) {
  const action = decision.action?.toLowerCase();
  
  if (action === 'stop') {
    console.log('🛑 Stopping swiper as requested by decision');
    stopSwiping();
    return;
  }
  
  if (action === 'like' || action === 'right') {
    await swipeRight(decision.reason);
    updateStats('like');
  } else if (action === 'pass' || action === 'left' || action === 'skip') {
    await swipeLeft(decision.reason);
    updateStats('pass');
  } else {
    console.error(`❌ Unknown action: "${decision.action}" - Stopping swiper`);
    updateStats('error');
    stopSwiping();
    return;
  }
  
  // Stats are updated in updateStats function
}

async function swipeRight(reason) {
  console.log(`❤️ LIKE: ${reason}`);
  
  const likeSelectors = [
    'button[class*="Bgc($c-ds-background-gamepad-sparks-like-default)"]',
    'button .gamepad-icon-wrapper svg[fill*="gamepad-sparks-like"]',
    '[data-testid="gamepadLikeButton"]',
    '[aria-label="Like"]'
  ];
  
  let likeBtn = null;
  
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const hiddenSpan = btn.querySelector('span.Hidden');
    if (hiddenSpan && hiddenSpan.textContent.trim() === 'Like') {
      likeBtn = btn;
      break;
    }
  }
  
  if (!likeBtn) {
    for (const selector of likeSelectors) {
      likeBtn = document.querySelector(selector);
      if (likeBtn) {
        break;
      }
    }
  }
  
  if (likeBtn) {
    likeBtn.click();
    console.log('✅ Like button clicked');
  } else {
    console.log('⚠️ Like button not found, using keyboard fallback');
    triggerKeyEvent('ArrowRight');
  }
  
  setTimeout(() => handleModalDialogs(), 1000);
}

async function swipeLeft(reason) {
  console.log(`👎 PASS: ${reason}`);
  
  const passSelectors = [
    'button[class*="Bgc($c-ds-background-gamepad-sparks-nope-default)"]',
    'button .gamepad-icon-wrapper svg[fill*="gamepad-sparks-nope"]',
    '[data-testid="gamepadPassButton"]',
    '[aria-label="Pass"]',
    '[aria-label="Nope"]'
  ];
  
  let passBtn = null;
  
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const hiddenSpan = btn.querySelector('span.Hidden');
    if (hiddenSpan && hiddenSpan.textContent.trim() === 'Nope') {
      passBtn = btn;
      break;
    }
  }
  
  if (!passBtn) {
    for (const selector of passSelectors) {
      passBtn = document.querySelector(selector);
      if (passBtn) {
        break;
      }
    }
  }
  
  if (passBtn) {
    passBtn.click();
    console.log('✅ Pass button clicked');
  } else {
    console.log('⚠️ Pass button not found, using keyboard fallback');
    triggerKeyEvent('ArrowLeft');
  }
}

// Utility functions
function extractUrlFromBackground(element) {
  if (!element || !element.style.backgroundImage) return null;
  
  const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
  if (match) {
    return match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  }
  return null;
}

function isValidProfilePhoto(url) {
  if (!url || !url.startsWith('http')) return false;
  
  const excludePatterns = [
    '/icons/',
    '/static-assets/',
    '/descriptors/',
    'static/build/',
    '.svg',
    'icon',
    'descriptor'
  ];
  
  for (const pattern of excludePatterns) {
    if (url.includes(pattern)) {
      return false;
    }
  }
  
  return url.includes('images-ssl.gotinder.com') || url.includes('gotinder.com/u/');
}

function cleanName(rawName) {
  if (!rawName) return 'Unknown';
  
  let cleaned = rawName
    .replace(/\d+Open Profile/gi, '')
    .replace(/Open Profile/gi, '')
    .replace(/\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const match = cleaned.match(/^([a-zA-Zà-ÿÀ-ÿ\u0100-\u017F\s]+)/);
  if (match) {
    cleaned = match[1].trim();
  }
  
  if (cleaned.length > 20) {
    cleaned = cleaned.split(' ')[0];
  }
  
  return cleaned || 'Unknown';
}

function extractLookingFor(container) {
  const valueSpan = container.querySelector('span[class*="Typs(display-3-strong)"]');
  if (valueSpan) {
    const value = valueSpan.textContent.trim();
    return value;
  }
  return null;
}

function extractListInfo(container) {
  const items = [];
  const listItems = container.querySelectorAll('li');
  
  listItems.forEach(li => {
    const category = li.querySelector('h3');
    const value = li.querySelector('div[class*="Typs(body-1-regular)"][class*="C($c-ds-text-primary)"]');
    
    if (category && value) {
      items.push({
        category: category.textContent.trim(),
        value: value.textContent.trim()
      });
    } else {
      const text = li.textContent.trim();
      if (text && text.length > 1) {
        items.push(text);
      }
    }
  });
  
  return items;
}

function extractInterests(container) {
  const interests = [];
  const interestItems = container.querySelectorAll('li span[class*="Typs(body-1"]');
  
  interestItems.forEach(span => {
    const interest = span.textContent.trim();
    if (interest && interest.length > 1) {
      interests.push(interest);
    }
  });
  
  return interests;
}

function cleanSectionName(rawName) {
  let cleaned = rawName
    .replace(/Tinder Gold™.*$/i, '')
    .replace(/Available with.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

function sectionNameToKey(sectionName) {
  return sectionName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(.)/g, (_, char) => char.toUpperCase())
    .replace(/\s/g, '');
}

function extractSpotifyInfo(container) {
  const spotifyItems = [];
  
  const textContent = container.textContent.trim();
  if (textContent && !textContent.includes('My anthem') && !textContent.includes('My top artists')) {
    spotifyItems.push(textContent);
  }
  
  const spotifyElements = container.querySelectorAll('[class*="spotify"], [data-spotify], .track, .artist');
  spotifyElements.forEach(el => {
    const text = el.textContent.trim();
    if (text && !spotifyItems.includes(text)) {
      spotifyItems.push(text);
    }
  });
  
  return spotifyItems;
}

function extractGenericSection(container) {
  const info = {};
  
  const textContent = container.textContent.trim();
  if (textContent.length > 10) {
    info.text = textContent;
  }
  
  const listItems = container.querySelectorAll('li');
  if (listItems.length > 0) {
    info.items = extractListInfo(container);
  }
  
  const images = container.querySelectorAll('img[src]');
  if (images.length > 0) {
    info.images = Array.from(images).map(img => img.src);
  }
  
  return Object.keys(info).length > 0 ? info : null;
}

function triggerKeyEvent(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: key,
    bubbles: true,
    cancelable: true
  }));
}

function handleModalDialogs() {
  const modalSelectors = [
    '[data-testid="matchModal"]',
    '[role="dialog"]',
    '.modal',
    '[class*="Modal"]'
  ];

  modalSelectors.forEach(selector => {
    const modal = document.querySelector(selector);
    if (modal) {
      const closeBtn = modal.querySelector('[aria-label="Close"]') ||
                      modal.querySelector('[data-testid="modal-close"]') ||
                      modal.querySelector('.close') ||
                      modal.querySelector('[class*="close"]');
      
      if (closeBtn) {
        closeBtn.click();
        console.log('🗙 Closed modal dialog');
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
    }
  });
}

function delayExecution(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export functions using ES6 modules
export {
  initializeUserId,
  updateConfig,
  getConfig,
  getStats,
  getStatus,
  startSwiping,
  stopSwiping
};