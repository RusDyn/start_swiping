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
            sendResponse(this.stats);
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
      console.log('📝 Extracting name...');
      data.name = this.extractName();
      console.log(`✅ Name: "${data.name}"`);
      
      // 2. Extract age
      console.log('🎂 Extracting age...');
      data.age = this.extractAge();
      console.log(`✅ Age: ${data.age}`);
      
      // 3. Extract verification status
      console.log('✅ Checking verification status...');
      data.verified = this.extractVerificationStatus();
      console.log(`✅ Verified: ${data.verified}`);
      
      // 4. Extract photos
      console.log('📸 Extracting photos...');
      data.photos = this.extractAllPhotos();
      console.log(`✅ Photos: ${data.photos.length} found`);
      
      // 5. Extract bio
      console.log('📄 Extracting bio...');
      data.bio = this.extractBio();
      console.log(`✅ Bio: ${data.bio.length} characters`);
      
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
      'svg[title="Verified!"]',
      'svg[aria-label*="Verified"]',
      '[title*="Verified"]'
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
    
    console.log('❌ Not verified');
    return false;
  }

  extractAllPhotos() {
    console.log('🔍 Starting photo extraction...');
    const photos = [];
    const processedUrls = new Set();
    
    // Method 1: Profile slider photos
    console.log('📸 Method 1: Profile slider photos');
    const sliderPhotos = document.querySelectorAll('.profileCard__slider__img[style*="background-image"]');
    console.log(`Found ${sliderPhotos.length} slider photos`);
    
    sliderPhotos.forEach((el, i) => {
      const url = this.extractUrlFromBackground(el);
      if (url && this.isValidProfilePhoto(url) && !processedUrls.has(url)) {
        processedUrls.add(url);
        photos.push(url);
        console.log(`📸 Slider photo ${i + 1}: ${url.substring(0, 80)}...`);
      }
    });
    
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
    if (photos.length < 3) {
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
    
    console.log(`📸 Total photos extracted: ${photos.length}`);
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
    
    // Look for info containers
    const containers = document.querySelectorAll('div[class*="P(24px)"][class*="W(100%)"]');
    console.log(`Found ${containers.length} potential bio containers`);
    
    for (const container of containers) {
      const text = container.textContent.trim();
      if (text.length > 20 && 
          !text.includes('Looking for') && 
          !text.includes('Passions') &&
          !text.includes('miles away')) {
        console.log(`✅ Found bio: "${text.substring(0, 100)}..."`);
        return text;
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
      console.error('Unknown action:', decision.action);
      await this.swipeLeft('Unknown action');
      this.stats.passes++;
    }
    
    this.stats.total++;
  }

  async swipeRight(reason) {
    console.log(`❤️ LIKE: ${reason}`);
    
    const likeBtn = document.querySelector('[data-testid="gamepadLikeButton"]') ||
                   document.querySelector('[aria-label="Like"]');
    
    if (likeBtn) {
      likeBtn.click();
    } else {
      // Fallback: keyboard event
      this.triggerKeyEvent('ArrowRight');
    }
    
    // Обрабатываем модальные окна матчей
    setTimeout(() => this.handleModalDialogs(), 1000);
  }

  async swipeLeft(reason) {
    console.log(`👎 PASS: ${reason}`);
    
    const passBtn = document.querySelector('[data-testid="gamepadPassButton"]') ||
                   document.querySelector('[aria-label="Pass"]');
    
    if (passBtn) {
      passBtn.click();
    } else {
      // Fallback: keyboard event
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