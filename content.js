// Tinder Smart Swiper - Content Script (Minimal)
class SimpleTinderSwiper {
  constructor() {
    this.isRunning = false;
    this.swipeCount = 0;
    this.config = {
      apiEndpoint: 'https://your-api.com/decide', // Will be updated via popup
      maxSwipes: 200,
      userId: this.generateUserId()
    };
    
    this.stats = {
      total: 0,
      likes: 0,
      passes: 0,
      errors: 0
    };
    
    console.log('🤖 Simple Tinder Swiper loaded');
    this.listenForCommands();
  }

  generateUserId() {
    // Генерируем уникальный ID пользователя для статистики
    let userId = localStorage.getItem('tinderSwiper_userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('tinderSwiper_userId', userId);
    }
    return userId;
  }

  listenForCommands() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        switch (request.action) {
          case 'start':
            this.start(request.config).then(() => {
              sendResponse({ success: true });
            }).catch(error => {
              console.error('Error starting swiper:', error);
              sendResponse({ success: false, error: error.message });
            });
            return true; // Указывает что ответ будет асинхронным
            
          case 'stop':
            this.stop();
            sendResponse({ success: true });
            break;
            
          case 'getStats':
            sendResponse({
              ...this.stats,
              isRunning: this.isRunning
            });
            break;
            
          case 'getStatus':
            sendResponse({
              isRunning: this.isRunning,
              swipeCount: this.swipeCount
            });
            break;
            
          case 'updateConfig':
            this.config = { ...this.config, ...request.config };
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
  }

  async start(userConfig = {}) {
    if (this.isRunning) {
      console.log('Already running');
      return;
    }

    this.config = { ...this.config, ...userConfig };
    this.isRunning = true;
    this.swipeCount = 0;
    
    console.log('🚀 Starting simple swiper');
    await this.swipeLoop();
  }

  stop() {
    this.isRunning = false;
    console.log('⏹️ Swiper stopped');
  }

  async swipeLoop() {
    console.log('====== STARTING SWIPE LOOP ======');
    
    while (this.isRunning && this.swipeCount < this.config.maxSwipes) {
      try {
        console.log(`\n🔄 SWIPE #${this.swipeCount + 1} STARTING...`);
        
        // STEP 1: Click "Open Profile" button and wait
        console.log('📍 STEP 1: Looking for "Open Profile" button...');
        const openSuccess = await this.clickOpenProfileAndWait();
        
        if (!openSuccess) {
          console.error('❌ Failed to open profile. Stopping.');
          this.stop();
          break;
        }
        
        // STEP 2: Extract all profile data
        console.log('\n📍 STEP 2: Extracting profile data...');
        const profileData = await this.extractAllProfileData();
        
        if (!profileData) {
          console.error('❌ No profile data extracted. Stopping.');
          this.stop();
          break;
        }
        
        console.log('\n✅ PROFILE DATA EXTRACTED:', {
          name: profileData.name,
          age: profileData.age,
          photoCount: profileData.photos.length,
          bioLength: profileData.bio.length,
          verified: profileData.verified
        });
        
        // STEP 3: Send to API
        console.log('\n📍 STEP 3: Sending to API...');
        const decision = await this.requestDecision(profileData);
        
        if (!decision) {
          console.error('❌ No decision from API. Stopping.');
          this.stop();
          break;
        }
        
        // STEP 4: Execute swipe
        console.log('\n📍 STEP 4: Executing swipe...');
        await this.executeSwipe(decision);
        
        // Wait before next profile
        const delay = decision.nextDelay || 4000;
        console.log(`\n⏱️ Waiting ${delay}ms before next profile...`);
        await this.delay(delay);
        
        this.swipeCount++;
        console.log(`✅ Swipe #${this.swipeCount} completed!\n`);

      } catch (error) {
        console.error('\n❌ CRITICAL ERROR in swipe loop:', error);
        console.error('Stack trace:', error.stack);
        this.stats.errors++;
        console.log('🛑 Stopping due to error.');
        this.stop();
        break;
      }
    }
    
    console.log('====== SWIPE LOOP ENDED ======');
    this.stop();
  }

  async clickOpenProfileAndWait() {
    console.log('🔍 Looking for "Open Profile" button...');
    
    // Find the "Open Profile" button
    const buttons = document.querySelectorAll('button');
    let showButton = null;
    
    for (const btn of buttons) {
      const hiddenSpan = btn.querySelector('span.Hidden');
      if (hiddenSpan && hiddenSpan.textContent.trim() === 'Open Profile') {
        showButton = btn;
        console.log('✅ Found "Open Profile" button');
        break;
      }
    }
    
    if (!showButton) {
      console.log('⚠️ No "Open Profile" button found - profile might already be open');
      return true; // Continue anyway
    }
    
    try {
      console.log('👆 Clicking "Open Profile" button...');
      showButton.click();
      
      console.log('⏱️ Waiting 3 seconds for profile to load...');
      await this.delay(3000);
      
      console.log('✅ Profile should now be open');
      return true;
    } catch (error) {
      console.error('❌ Error clicking "Open Profile" button:', error);
      return false;
    }
  }

  async extractAllProfileData() {
    console.log('🔍 Starting comprehensive profile extraction...');
    
    const data = {
      name: 'Unknown',
      age: null,
      bio: '',
      photos: [],
      verified: false,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    try {
      // 1. Extract name
      data.name = this.extractName();
      console.log(`✅ Name: "${data.name}"`);
      
      // 2. Extract age
      data.age = this.extractAge();
      console.log(`✅ Age: ${data.age}`);
      
      // 3. Extract verification status
      data.verified = this.extractVerificationStatus();
      console.log(`✅ Verified: ${data.verified}`);
      
      // 4. Extract photos
      data.photos = await this.extractAllPhotos();
      console.log(`✅ Photos: ${data.photos.length} found`);
      
      // 5. Extract bio
      data.bio = this.extractBio();
      console.log(`✅ Bio: ${data.bio.length} characters`);
      
      // 6. Extract all profile info sections
      data.profileInfo = this.extractAllProfileInfo();
      console.log(`✅ Profile sections: ${Object.keys(data.profileInfo).length} found`);
      
      // Validate data quality
      if (data.name === 'Unknown' || data.photos.length === 0) {
        console.error('❌ Profile data quality insufficient');
        console.error('- Name:', data.name);
        console.error('- Photos:', data.photos.length);
        return null;
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Error during profile extraction:', error);
      console.error('Stack trace:', error.stack);
      return null;
    }
  }

  extractName() {
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
          const name = this.cleanName(nameEl.textContent.trim());
          console.log(`✅ Found name using ${selector}: "${name}"`);
          return name;
        }
      } catch (e) {
        console.log(`❌ Name selector failed: ${selector}`);
      }
    }
    
    console.log('❌ No name found');
    return 'Unknown';
  }

  extractAge() {
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
          console.log(`✅ Found age using ${selector}: ${age}`);
          return age;
        }
      } catch (e) {
        console.log(`❌ Age selector failed: ${selector}`);
      }
    }
    
    console.log('❌ No age found');
    return null;
  }

  extractVerificationStatus() {
    
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
          console.log(`✅ Found verification using ${selector}`);
          return true;
        }
      } catch (e) {
        console.log(`❌ Verification selector failed: ${selector}`);
      }
    }
    
    // Method 2: Look for title elements with "Verified!" text content
    const titleElements = document.querySelectorAll('title');
    for (const title of titleElements) {
      if (title.textContent.trim() === 'Verified!') {
        console.log('✅ Found verification via title element text content');
        return true;
      }
    }
    
    // Method 3: Look for SVG elements containing title with "Verified!"
    const svgElements = document.querySelectorAll('svg');
    for (const svg of svgElements) {
      const titleEl = svg.querySelector('title');
      if (titleEl && titleEl.textContent.trim() === 'Verified!') {
        console.log('✅ Found verification via SVG title element');
        return true;
      }
    }
    
    // Method 4: Check for verification badge/icon patterns
    const badgeElements = document.querySelectorAll('[class*="verified"], [class*="badge"], [data-testid*="verified"]');
    for (const badge of badgeElements) {
      if (badge.textContent.includes('Verified') || badge.getAttribute('aria-label')?.includes('Verified')) {
        console.log('✅ Found verification via badge pattern');
        return true;
      }
    }
    
    console.log('❌ Not verified');
    return false;
  }

  async extractAllPhotos() {
    console.log('🔍 Starting photo extraction...');
    const photos = [];
    const processedUrls = new Set();
    
    // Method 1: Check keen-slider slides and get total count from aria-labels
    console.log('📸 Method 1: Keen slider analysis');
    const keenSlides = document.querySelectorAll('.keen-slider__slide');
    console.log(`Found ${keenSlides.length} keen-slider slides`);
    
    // Extract total photo count from aria-labels like "1 of 6"
    let totalPhotos = 0;
    if (keenSlides.length > 0) {
      const firstSlide = keenSlides[0];
      const ariaLabel = firstSlide.getAttribute('aria-label');
      if (ariaLabel) {
        const match = ariaLabel.match(/\d+ of (\d+)/);
        if (match) {
          totalPhotos = parseInt(match[1]);
          console.log(`📊 Total photos detected from aria-label: ${totalPhotos}`);
        }
      }
    }
    
    // If we have multiple photos, navigate through carousel to collect them
    if (totalPhotos > 1) {
      console.log(`🔄 Navigating through ${totalPhotos} photos to collect them...`);
      const carouselPhotos = await this.loadAllPhotosFromCarousel(totalPhotos);
      
      // Add carousel photos to our collection
      carouselPhotos.forEach(url => {
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          photos.push(url);
        }
      });
      
      console.log(`📸 Added ${carouselPhotos.length} photos from carousel navigation`);
    } else {
      // Single photo - extract from current view
      console.log('📸 Single photo detected, extracting from current view...');
      keenSlides.forEach((slide, i) => {
        const imgDiv = slide.querySelector('.profileCard__slider__img[style*="background-image"]');
        if (imgDiv) {
          const url = this.extractUrlFromBackground(imgDiv);
          if (url && this.isValidProfilePhoto(url) && !processedUrls.has(url)) {
            processedUrls.add(url);
            photos.push(url);
            console.log(`📸 Keen slide ${i + 1}: ${url.substring(0, 80)}...`);
          }
        }
      });
    }
    
    // Method 2: All elements with Profile Photo aria-label
    console.log('📸 Method 2: Aria-label Profile Photo elements');
    const ariaPhotos = document.querySelectorAll('[aria-label*="Profile Photo"][style*="background-image"]');
    console.log(`Found ${ariaPhotos.length} aria-label photos`);
    
    ariaPhotos.forEach((el, i) => {
      const url = this.extractUrlFromBackground(el);
      if (url && this.isValidProfilePhoto(url) && !processedUrls.has(url)) {
        processedUrls.add(url);
        photos.push(url);
        console.log(`📸 Aria photo ${i + 1}: ${url.substring(0, 80)}...`);
      }
    });
    
    // Method 3: All background images (fallback)
    if (photos.length < Math.min(totalPhotos, 3)) {
      console.log('📸 Method 3: All background images (fallback)');
      const allBgImages = document.querySelectorAll('[style*="background-image"]');
      console.log(`Found ${allBgImages.length} background images`);
      
      allBgImages.forEach((el, i) => {
        const url = this.extractUrlFromBackground(el);
        if (url && this.isValidProfilePhoto(url) && !processedUrls.has(url)) {
          processedUrls.add(url);
          photos.push(url);
          console.log(`📸 Fallback photo ${i + 1}: ${url.substring(0, 80)}...`);
        }
      });
    }
    
    console.log(`📸 Total photos extracted: ${photos.length} (expected: ${totalPhotos})`);
    if (totalPhotos > 0 && photos.length < totalPhotos) {
      console.log(`⚠️ WARNING: Only found ${photos.length} photos but expected ${totalPhotos}. Photos might be lazy-loaded.`);
    }
    
    return photos;
  }

  extractUrlFromBackground(element) {
    if (!element || !element.style.backgroundImage) return null;
    
    const match = element.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (match) {
      return match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    }
    return null;
  }

  extractBio() {
    console.log('📄 Extracting bio...');
    
    // Look specifically for "About me" section
    const containers = document.querySelectorAll('div[class*="P(24px)"][class*="W(100%)"]');
    console.log(`Found ${containers.length} info containers`);
    
    for (const container of containers) {
      // Check if this container has "About me" header
      const header = container.querySelector('h2[class*="Typs(body-2-strong)"]');
      if (header && header.textContent.trim() === 'About me') {
        console.log('✅ Found "About me" section');
        
        // Extract the bio text content (excluding the header)
        const bioDiv = container.querySelector('div[class*="C($c-ds-text-primary)"][class*="Typs(body-1-regular)"]');
        if (bioDiv) {
          let bioText = bioDiv.textContent.trim();
          console.log(`✅ Found bio text: "${bioText.substring(0, 100)}..."`);
          return bioText;
        }
      }
    }
    
    // Fallback: look for any large text content (old method)
    console.log('📄 Using fallback bio extraction...');
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
        // Remove "About me" prefix if present
        let cleanText = text.replace(/^About me\s*/i, '').trim();
        console.log(`✅ Found fallback bio: "${cleanText.substring(0, 100)}..."`);
        return cleanText;
      }
    }
    
    console.log('❌ No bio found');
    return '';
  }

  // Utility methods
  isValidProfilePhoto(url) {
    if (!url || !url.startsWith('http')) return false;
    
    // Exclude icons and static resources
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
    
    // Include only photos from Tinder CDN
    return url.includes('images-ssl.gotinder.com') || url.includes('gotinder.com/u/');
  }

  cleanName(rawName) {
    if (!rawName) return 'Unknown';
    
    // Remove common extra parts
    let cleaned = rawName
      .replace(/\d+Open Profile/gi, '') // "23Open Profile"
      .replace(/Open Profile/gi, '')     // "Open Profile"
      .replace(/\d+$/, '')               // Numbers at end
      .replace(/\s+/g, ' ')              // Multiple spaces
      .trim();
    
    // Take only first part (name) before first number or special character
    const match = cleaned.match(/^([a-zA-Zà-ÿÀ-ÿ\u0100-\u017F\s]+)/);
    if (match) {
      cleaned = match[1].trim();
    }
    
    // If name too long, take only first word
    if (cleaned.length > 20) {
      cleaned = cleaned.split(' ')[0];
    }
    
    return cleaned || 'Unknown';
  }

  async loadAllPhotosFromCarousel(totalPhotos) {
    console.log('🔄 Starting carousel navigation to collect photos...');
    const photos = [];
    const processedUrls = new Set();
    
    // Find the photo container
    const photoContainer = document.querySelector('.keen-slider');
    if (!photoContainer) {
      console.log('❌ No keen-slider container found');
      return [];
    }
    
    // Navigate through each photo and capture immediately
    for (let i = 0; i < totalPhotos; i++) {
      console.log(`👆 Navigating to photo ${i + 1}/${totalPhotos}...`);
      
      // Navigate to the photo
      if (i === 0) {
        // First photo should already be visible
        console.log('📸 Capturing first photo (already visible)');
      } else {
        // Navigate to next photo
        await this.navigateToNextPhoto(photoContainer, i);
      }
      
      // Wait for image to load
      await this.delay(800);
      
      // Capture the currently active photo immediately
      const activePhoto = this.extractCurrentActivePhoto();
      if (activePhoto && this.isValidProfilePhoto(activePhoto) && !processedUrls.has(activePhoto)) {
        processedUrls.add(activePhoto);
        photos.push(activePhoto);
        console.log(`📸 Captured photo ${i + 1}: ${activePhoto.substring(0, 80)}...`);
      } else {
        console.log(`⚠️ Failed to capture photo ${i + 1}`);
      }
    }
    
    console.log(`✅ Captured ${photos.length}/${totalPhotos} photos via navigation`);
    return photos;
  }
  
  async navigateToNextPhoto(photoContainer, photoIndex) {
    // Method 1: Try clicking on photo navigation dots/indicators
    const indicators = document.querySelectorAll('[role="tab"]');
    if (indicators[photoIndex]) {
      indicators[photoIndex].click();
      return;
    }
    
    // Method 2: Try keyboard navigation
    console.log('⌨️ Using keyboard navigation (ArrowRight)');
    photoContainer.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true
    }));
    return;
  }
  
  extractCurrentActivePhoto() {
    // Method 1: Look for currently visible/active slide
    const activeSlides = document.querySelectorAll('.keen-slider__slide[aria-hidden="false"]');
    for (const slide of activeSlides) {
      const imgDiv = slide.querySelector('.profileCard__slider__img[style*="background-image"]');
      if (imgDiv) {
        const url = this.extractUrlFromBackground(imgDiv);
        if (url) {
          console.log('✅ Found active slide photo');
          return url;
        }
      }
    }
    
    // Method 2: Look for any currently visible photo element
    const visiblePhotos = document.querySelectorAll('.profileCard__slider__img[style*="background-image"]');
    for (const photo of visiblePhotos) {
      const url = this.extractUrlFromBackground(photo);
      if (url) {
        console.log('✅ Found visible photo element');
        return url;
      }
    }
    
    // Method 3: Look for any photo with Profile Photo aria-label
    const ariaPhotos = document.querySelectorAll('[aria-label*="Profile Photo"][style*="background-image"]');
    for (const photo of ariaPhotos) {
      const url = this.extractUrlFromBackground(photo);
      if (url) {
        console.log('✅ Found aria-label photo');
        return url;
      }
    }
    
    console.log('❌ No active photo found');
    return null;
  }

  extractAllProfileInfo() {
    console.log('🔍 Extracting all profile info sections...');
    const profileInfo = {};
    
    // Find all info containers
    const containers = document.querySelectorAll('div[class*="P(24px)"][class*="W(100%)"]');
    console.log(`Found ${containers.length} info containers`);
    
    containers.forEach((container) => {
      // Look for section header
      const header = container.querySelector('h2[class*="Typs(body-2-strong)"]');
      if (header) {
        let sectionName = header.textContent.trim();
        // Clean up section names that have extra text
        sectionName = this.cleanSectionName(sectionName);
        
        switch (sectionName) {
          case 'Looking for':
            profileInfo.lookingFor = this.extractLookingFor(container);
            break;
          case 'About me':
            // Already handled in extractBio()
            break;
          case 'Essentials':
            profileInfo.essentials = this.extractListInfo(container);
            break;
          case 'Basics':
            profileInfo.basics = this.extractListInfo(container);
            break;
          case 'Lifestyle':
            profileInfo.lifestyle = this.extractListInfo(container);
            break;
          case 'Interests':
            profileInfo.interests = this.extractInterests(container);
            break;
          case 'Going Out':
            profileInfo.goingOut = this.extractListInfo(container);
            break;
          case 'My anthem':
            profileInfo.anthem = this.extractSpotifyInfo(container);
            break;
          case 'My top artists':
            profileInfo.topArtists = this.extractSpotifyInfo(container);
            break;
          default:
            if (sectionName.includes('Preferences') || sectionName.includes('Matched')) {
              profileInfo.preferences = this.extractListInfo(container);
            } else {
              // Generic section handler
              profileInfo[this.sectionNameToKey(sectionName)] = this.extractGenericSection(container);
            }
        }
      }
    });
    
    return profileInfo;
  }

  extractLookingFor(container) {
    const valueSpan = container.querySelector('span[class*="Typs(display-3-strong)"]');
    if (valueSpan) {
      const value = valueSpan.textContent.trim();
      console.log(`✅ Looking for: "${value}"`);
      return value;
    }
    return null;
  }

  extractListInfo(container) {
    const items = [];
    const listItems = container.querySelectorAll('li');
    
    listItems.forEach(li => {
      // Check for category and value structure
      const category = li.querySelector('h3');
      const value = li.querySelector('div[class*="Typs(body-1-regular)"][class*="C($c-ds-text-primary)"]');
      
      if (category && value) {
        items.push({
          category: category.textContent.trim(),
          value: value.textContent.trim()
        });
      } else {
        // Simple text item
        const text = li.textContent.trim();
        if (text && text.length > 1) {
          items.push(text);
        }
      }
    });
    
    return items;
  }

  extractInterests(container) {
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

  cleanSectionName(rawName) {
    // Remove Tinder Gold and other promotional text
    let cleaned = rawName
      .replace(/Tinder Gold™.*$/i, '')
      .replace(/Available with.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  }

  sectionNameToKey(sectionName) {
    // Convert section name to camelCase key
    return sectionName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+(.)/g, (_, char) => char.toUpperCase())
      .replace(/\s/g, '');
  }

  extractSpotifyInfo(container) {
    console.log('🎵 Extracting Spotify info...');
    
    // Look for track/artist names and Spotify elements
    const spotifyItems = [];
    
    // Method 1: Look for text content with Spotify-like structure
    const textContent = container.textContent.trim();
    if (textContent && !textContent.includes('My anthem') && !textContent.includes('My top artists')) {
      spotifyItems.push(textContent);
    }
    
    // Method 2: Look for specific Spotify elements
    const spotifyElements = container.querySelectorAll('[class*="spotify"], [data-spotify], .track, .artist');
    spotifyElements.forEach(el => {
      const text = el.textContent.trim();
      if (text && !spotifyItems.includes(text)) {
        spotifyItems.push(text);
      }
    });
    
    return spotifyItems;
  }

  extractGenericSection(container) {
    console.log('📄 Extracting generic section info...');
    
    // Try different extraction methods
    const info = {};
    
    // Get all text content
    const textContent = container.textContent.trim();
    if (textContent.length > 10) {
      info.text = textContent;
    }
    
    // Look for any structured data
    const listItems = container.querySelectorAll('li');
    if (listItems.length > 0) {
      info.items = this.extractListInfo(container);
    }
    
    // Look for any images or media
    const images = container.querySelectorAll('img[src]');
    if (images.length > 0) {
      info.images = Array.from(images).map(img => img.src);
    }
    
    return Object.keys(info).length > 0 ? info : null;
  }

  async requestDecision(profileData) {
    try {
      const requestPayload = {
        userId: this.config.userId,
        profile: profileData,
        swipeCount: this.swipeCount,
        stats: this.stats
      };

      console.log('🌐 Requesting decision from API...');
      
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TinderSwiper/1.0'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }

      const decision = await response.json();
      
      console.log('📝 Decision received:', {
        action: decision.action,
        reason: decision.reason,
        confidence: decision.confidence
      });

      return decision;

    } catch (error) {
      console.error('❌ API request failed:', error);
      console.log('🛑 Stopping swiper due to API unavailability');
      
      // Останавливаем свайпер при недоступности API
      this.stop();
      
      return {
        action: 'stop',
        reason: 'API unavailable - stopping swiper',
        confidence: 1.0,
        nextDelay: 0
      };
    }
  }

  async executeSwipe(decision) {
    const action = decision.action?.toLowerCase();
    
    if (action === 'stop') {
      console.log('🛑 Stopping swiper as requested by decision');
      this.stop();
      return;
    }
    
    if (action === 'like' || action === 'right') {
      await this.swipeRight(decision.reason);
      this.stats.likes++;
    } else if (action === 'pass' || action === 'left') {
      await this.swipeLeft(decision.reason);
      this.stats.passes++;
    } else {
      console.error(`❌ Unknown action: "${decision.action}" - Stopping swiper`);
      this.stats.errors++;
      this.stop();
      return;
    }
    
    this.stats.total++;
  }

  async swipeRight(reason) {
    console.log(`❤️ LIKE: ${reason}`);
    
    // Try multiple selectors for like button
    const likeSelectors = [
      'button span.Hidden:contains("Like")',
      'button[class*="Bgc($c-ds-background-gamepad-sparks-like-default)"]',
      'button .gamepad-icon-wrapper svg[fill*="gamepad-sparks-like"]',
      '[data-testid="gamepadLikeButton"]',
      '[aria-label="Like"]'
    ];
    
    let likeBtn = null;
    
    // Find button by hidden text "Like"
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const hiddenSpan = btn.querySelector('span.Hidden');
      if (hiddenSpan && hiddenSpan.textContent.trim() === 'Like') {
        likeBtn = btn;
        console.log('✅ Found like button by hidden text');
        break;
      }
    }
    
    // Fallback to other selectors if needed
    if (!likeBtn) {
      for (const selector of likeSelectors) {
        likeBtn = document.querySelector(selector);
        if (likeBtn) {
          console.log(`✅ Found like button with selector: ${selector}`);
          break;
        }
      }
    }
    
    if (likeBtn) {
      likeBtn.click();
      console.log('✅ Like button clicked');
    } else {
      console.log('⚠️ Like button not found, using keyboard fallback');
      this.triggerKeyEvent('ArrowRight');
    }
    
    // Обрабатываем модальные окна матчей
    setTimeout(() => this.handleModalDialogs(), 1000);
  }

  async swipeLeft(reason) {
    console.log(`👎 PASS: ${reason}`);
    
    // Try multiple selectors for pass button
    const passSelectors = [
      'button span.Hidden:contains("Nope")',
      'button[class*="Bgc($c-ds-background-gamepad-sparks-nope-default)"]',
      'button .gamepad-icon-wrapper svg[fill*="gamepad-sparks-nope"]',
      '[data-testid="gamepadPassButton"]',
      '[aria-label="Pass"]',
      '[aria-label="Nope"]'
    ];
    
    let passBtn = null;
    
    // Find button by hidden text "Nope"
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const hiddenSpan = btn.querySelector('span.Hidden');
      if (hiddenSpan && hiddenSpan.textContent.trim() === 'Nope') {
        passBtn = btn;
        console.log('✅ Found pass button by hidden text');
        break;
      }
    }
    
    // Fallback to other selectors if needed
    if (!passBtn) {
      for (const selector of passSelectors) {
        passBtn = document.querySelector(selector);
        if (passBtn) {
          console.log(`✅ Found pass button with selector: ${selector}`);
          break;
        }
      }
    }
    
    if (passBtn) {
      passBtn.click();
      console.log('✅ Pass button clicked');
    } else {
      console.log('⚠️ Pass button not found, using keyboard fallback');
      this.triggerKeyEvent('ArrowLeft');
    }
  }

  triggerKeyEvent(key) {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: key,
      bubbles: true,
      cancelable: true
    }));
  }

  handleModalDialogs() {
    // Закрываем модальные окна матчей, уведомлений и т.д.
    const modalSelectors = [
      '[data-testid="matchModal"]',
      '[role="dialog"]',
      '.modal',
      '[class*="Modal"]'
    ];

    modalSelectors.forEach(selector => {
      const modal = document.querySelector(selector);
      if (modal) {
        // Ищем кнопку закрытия
        const closeBtn = modal.querySelector('[aria-label="Close"]') ||
                        modal.querySelector('[data-testid="modal-close"]') ||
                        modal.querySelector('.close') ||
                        modal.querySelector('[class*="close"]');
        
        if (closeBtn) {
          closeBtn.click();
          console.log('🗙 Closed modal dialog');
        } else {
          // Если кнопки нет, кликаем вне модала
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      }
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Инициализация
if (window.location.hostname === 'tinder.com') {
  window.tinderSwiper = new SimpleTinderSwiper();
}