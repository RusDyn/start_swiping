// Tinder Smart Swiper - Content Script (Minimal)
class SimpleTinderSwiper {
  constructor() {
    this.isRunning = false;
    this.swipeCount = 0;
    this.config = {
      apiEndpoint: 'https://your-api.com/decide', // Ваш API endpoint
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
      switch (request.action) {
        case 'start':
          this.start(request.config);
          sendResponse({ success: true });
          break;
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
    while (this.isRunning && this.swipeCount < this.config.maxSwipes) {
      try {
        // 1. Извлекаем данные профиля
        const profileData = this.extractProfileData();
        
        if (!profileData) {
          console.log('No profile data, waiting...');
          await this.delay(3000);
          continue;
        }

        // 2. Отправляем запрос на API для принятия решения
        const decision = await this.requestDecision(profileData);
        
        // 3. Выполняем свайп на основе решения
        await this.executeSwipe(decision);
        
        // 4. Ждем указанную задержку от API
        await this.delay(decision.nextDelay || 4000);
        
        this.swipeCount++;

      } catch (error) {
        console.error('Error in swipe loop:', error);
        this.stats.errors++;
        await this.delay(5000); // Увеличенная пауза при ошибке
      }
    }
    
    this.stop();
  }

  extractProfileData() {
    try {
      const card = document.querySelector('[data-testid="gamepad-card"]');
      if (!card) return null;

      // Извлекаем основную информацию
      const nameElement = card.querySelector('h1');
      const bioElement = card.querySelector('[data-testid="card-bio"]');
      
      // Извлекаем фотографии
      const photos = this.extractPhotoUrls(card);
      
      // Извлекаем возраст (если доступен)
      const ageElement = card.querySelector('[class*="age"]') || 
                        nameElement?.nextElementSibling;
      
      const profileData = {
        name: nameElement?.textContent?.trim() || '',
        bio: bioElement?.textContent?.trim() || '',
        photos: photos,
        photoCount: photos.length,
        age: this.extractAge(ageElement?.textContent || nameElement?.textContent),
        timestamp: Date.now(),
        url: window.location.href
      };

      console.log('📊 Profile extracted:', {
        name: profileData.name,
        photoCount: profileData.photoCount,
        bioLength: profileData.bio.length
      });

      return profileData;

    } catch (error) {
      console.error('Error extracting profile:', error);
      return null;
    }
  }

  extractPhotoUrls(card) {
    const photos = [];
    
    // Ищем элементы с background-image
    const bgElements = card.querySelectorAll('div[style*="background-image"]');
    bgElements.forEach(el => {
      const match = el.style.backgroundImage.match(/url\("?([^"]*)"?\)/);
      if (match && match[1]) {
        photos.push(match[1]);
      }
    });

    // Ищем img элементы
    const imgElements = card.querySelectorAll('img');
    imgElements.forEach(img => {
      if (img.src && img.src.startsWith('http')) {
        photos.push(img.src);
      }
    });

    // Удаляем дубликаты
    return [...new Set(photos)];
  }

  extractAge(text) {
    if (!text) return null;
    const ageMatch = text.match(/\b(\d{2})\b/);
    return ageMatch ? parseInt(ageMatch[1]) : null;
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
      console.error('API request failed:', error);
      
      // Fallback: простое случайное решение
      return {
        action: Math.random() > 0.7 ? 'like' : 'pass',
        reason: 'API unavailable - random decision',
        confidence: 0.1,
        nextDelay: 4000
      };
    }
  }

  async executeSwipe(decision) {
    const action = decision.action?.toLowerCase();
    
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