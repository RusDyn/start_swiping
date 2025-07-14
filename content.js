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
    while (this.isRunning && this.swipeCount < this.config.maxSwipes) {
      try {
        // 1. Извлекаем данные профиля
        const profileData = this.extractProfileData();
        
        if (!profileData) {
          console.log('⏳ No profile data, waiting... (checking DOM structure)');
          
          // Расширенная диагностика
          console.log('🔍 DOM Analysis:');
          console.log('- URL:', window.location.href);
          console.log('- Page title:', document.title);
          
          // Ищем все элементы с фотографиями
          const allPhotos = document.querySelectorAll('[style*="background-image"]');
          console.log(`- Found ${allPhotos.length} elements with background images`);
          
          if (allPhotos.length > 0) {
            console.log('- First photo element:', allPhotos[0]);
            console.log('- First photo style:', allPhotos[0].style.backgroundImage);
          }
          
          // Ищем текстовые элементы
          const h1Elements = document.querySelectorAll('h1');
          console.log(`- Found ${h1Elements.length} h1 elements`);
          if (h1Elements.length > 0) {
            console.log('- H1 texts:', Array.from(h1Elements).map(h => h.textContent.trim()));
          }
          
          // Проверяем общие селекторы
          const potentialCards = document.querySelectorAll('[class*="card"], [data-testid*="card"], [class*="Card"]');
          console.log(`- Found ${potentialCards.length} potential card elements`);
          
          await this.delay(5000); // Увеличиваем задержку для лучшей диагностики
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
      // Обновленные селекторы для новой структуры Tinder
      const cardSelectors = [
        '[data-testid="gamepad-card"]',
        '.Pos\\(r\\).Expand.H\\(--recs-card-height\\)',
        '.Tcha\\(n\\).Bxsh\\(\\$bxsh-card\\)',
        '.recsCardboard__cards .Expand',
        'div[class*="StretchedBox"]'
      ];
      
      let card = null;
      let usedSelector = '';
      
      for (const selector of cardSelectors) {
        try {
          card = document.querySelector(selector);
          if (card) {
            usedSelector = selector;
            console.log(`✅ Found profile card using: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!card) {
        console.log('❌ No profile card found');
        return null;
      }

      // Попытка кликнуть "Show full profile" для получения больше данных
      this.clickShowFullProfile(card); // Убираем await - делаем неблокирующим

      // Ищем имя по itemprop="name"
      let name = 'Unknown';
      let nameEl = card.querySelector('[itemprop="name"]');
      
      if (nameEl) {
        name = nameEl.textContent.trim();
        console.log(`✅ Found name: "${name}" using itemprop="name"`);
      } else {
        // Fallback селекторы для имени
        const nameSelectors = [
          '.Typs\\(display-1-strong\\)',
          'span[class*="display-1"]',
          'h1',
          '[class*="display"]'
        ];
        
        for (const selector of nameSelectors) {
          try {
            nameEl = card.querySelector(selector);
            if (nameEl && nameEl.textContent.trim()) {
              name = this.cleanName(nameEl.textContent.trim());
              console.log(`✅ Found name: "${name}" using fallback ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Ищем возраст по itemprop="age"
      let age = null;
      const ageEl = card.querySelector('[itemprop="age"]');
      if (ageEl) {
        age = parseInt(ageEl.textContent.trim());
        console.log(`✅ Found age: ${age} using itemprop="age"`);
      } else {
        // Fallback - ищем в тексте
        age = this.extractAge(card.textContent);
        if (age) {
          console.log(`✅ Found age: ${age} using text extraction`);
        }
      }

      // Ищем био
      let bio = '';
      const bioSelectors = [
        '[data-testid="card-bio"]',
        '[itemprop="description"]',
        '.BreakWord',
        'div[class*="BreakWord"]',
        'div[class*="Whs(pw)"]',
        'p:not([class*="name"]):not([class*="age"])'
      ];
      
      for (const selector of bioSelectors) {
        try {
          const bioEl = card.querySelector(selector);
          if (bioEl && bioEl.textContent.trim().length > 10) {
            const text = bioEl.textContent.trim();
            // Проверяем что это не имя и не возраст
            if (!text.includes(name) && !text.match(/^\d+$/)) {
              bio = text;
              console.log(`✅ Found bio: "${bio.substring(0, 50)}..." using ${selector}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Извлекаем фотографии с новыми селекторами
      const photos = this.extractPhotoUrls(card);
      
      const profileData = {
        name: name,
        bio: bio,
        photos: photos,
        photoCount: photos.length,
        age: age,
        timestamp: Date.now(),
        url: window.location.href,
        cardSelector: usedSelector
      };

      console.log('📊 Profile extracted:', {
        name: profileData.name,
        photoCount: profileData.photoCount,
        bioLength: profileData.bio.length,
        age: profileData.age,
        selector: usedSelector
      });

      // Считаем профиль валидным если есть имя И фото
      if (profileData.name !== 'Unknown' && profileData.photoCount > 0) {
        return profileData;
      }

      console.log('⚠️ Profile data quality insufficient');
      return null;

    } catch (error) {
      console.error('Error extracting profile:', error);
      return null;
    }
  }

  extractPhotoUrls(card) {
    const photos = [];
    
    // Ищем по точным селекторам для фото профилей
    const photoSelectors = [
      '[aria-label*="Profile Photo"][role="img"]',
      '.Bdrs\\(8px\\).Bgz\\(cv\\).Bgp\\(c\\).StretchedBox',
      'div[class*="StretchedBox"][role="img"]',
      '[role="img"][style*="background-image"]'
    ];
    
    // Начинаем с поиска в карточке
    let photoElements = [];
    for (const selector of photoSelectors) {
      const elements = card.querySelectorAll(selector);
      if (elements.length > 0) {
        photoElements = Array.from(elements);
        console.log(`🔍 Found ${elements.length} photos using selector: ${selector}`);
        break;
      }
    }
    
    // Если не нашли в карточке, ищем по всему документу
    if (photoElements.length === 0) {
      console.log('🔍 No photos in card, searching entire document...');
      for (const selector of photoSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          photoElements = Array.from(elements);
          console.log(`🔍 Found ${elements.length} photos globally using: ${selector}`);
          break;
        }
      }
    }
    
    // Fallback: все элементы с background-image
    if (photoElements.length === 0) {
      photoElements = Array.from(document.querySelectorAll('[style*="background-image"]'));
      console.log(`🔍 Fallback: Found ${photoElements.length} elements with background-image`);
    }
    
    photoElements.forEach((el, index) => {
      let url = null;
      
      if (el.style.backgroundImage) {
        const match = el.style.backgroundImage.match(/url\(&quot;([^&]*)&quot;\)|url\("([^"]*)"\)|url\(([^)]*)\)/);
        if (match) {
          url = match[1] || match[2] || match[3];
          // Декодируем HTML entities
          url = url.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        }
      }
      
      // Фильтруем только настоящие фото профилей
      if (url && this.isValidProfilePhoto(url) && !photos.includes(url)) {
        photos.push(url);
        console.log(`📸 Photo ${photos.length}: ${url.substring(0, 80)}...`);
        
        // Ограничиваем количество фото
        if (photos.length >= 10) {
          console.log('📸 Reached photo limit (10), stopping search');
          return;
        }
      }
    });

    console.log(`📸 Final result: Found ${photos.length} valid profile photos`);
    return photos;
  }

  async clickShowFullProfile(card) {
    try {
      // Ищем правильную кнопку "Open Profile" или информационную кнопку
      const showProfileSelectors = [
        'button:has([class*="Hidden"]:contains("Open Profile"))',
        'button span.Hidden:contains("Open Profile")',
        '[aria-label*="Open Profile"]',
        '[aria-label*="Show Profile"]',
        'button[class*="focus-button-style"]:has(span:contains("Open Profile"))',
        // Кнопка с иконкой информации (i)
        'button:has(svg path[d*="M12 0c6.627"])',
        // Любая кнопка с текстом "Open Profile"
        'button:has(span:contains("Open Profile"))'
      ];
      
      let showButton = null;
      
      // Специальный поиск кнопки с "Open Profile" в span.Hidden
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const hiddenSpan = btn.querySelector('span.Hidden');
        if (hiddenSpan && hiddenSpan.textContent.trim() === 'Open Profile') {
          showButton = btn;
          console.log('🔍 Found "Open Profile" button by hidden span text');
          break;
        }
      }
      
      // Fallback поиск
      if (!showButton) {
        for (const selector of showProfileSelectors) {
          try {
            showButton = document.querySelector(selector);
            if (showButton) {
              console.log(`🔍 Found show profile button using: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      if (showButton) {
        console.log('👆 Clicking "Open Profile" button for more data...');
        showButton.click();
        // Даем больше времени на загрузку дополнительных данных
        await this.delay(2000);
        console.log('✅ Clicked profile button, waiting for data to load...');
      } else {
        console.log('ℹ️ No "Open Profile" button found, using available data');
      }
    } catch (error) {
      console.log('⚠️ Error clicking show profile:', error.message);
    }
  }

  isValidProfilePhoto(url) {
    // Проверяем что это настоящее фото профиля, а не иконка
    if (!url || !url.startsWith('http')) return false;
    
    // Исключаем иконки и статические ресурсы
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
    
    // Включаем только фото из Tinder CDN
    return url.includes('images-ssl.gotinder.com') || url.includes('gotinder.com/u/');
  }

  cleanName(rawName) {
    if (!rawName) return 'Unknown';
    
    // Удаляем распространенные лишние части
    let cleaned = rawName
      .replace(/\d+Open Profile/gi, '') // "23Open Profile"
      .replace(/Open Profile/gi, '')     // "Open Profile"
      .replace(/\d+$/, '')               // Числа в конце
      .replace(/\s+/g, ' ')              // Множественные пробелы
      .trim();
    
    // Берем только первую часть (имя) до первого числа или специального символа
    const match = cleaned.match(/^([a-zA-Zà-ÿÀ-ÿ\u0100-\u017F\s]+)/);
    if (match) {
      cleaned = match[1].trim();
    }
    
    // Если имя слишком длинное, берем только первое слово
    if (cleaned.length > 20) {
      cleaned = cleaned.split(' ')[0];
    }
    
    return cleaned || 'Unknown';
  }

  extractAge(text) {
    if (!text) return null;
    
    // Ищем числа от 18 до 65 (вероятный возраст)
    const matches = text.match(/\b(\d{2})\b/g);
    if (matches) {
      for (const match of matches) {
        const age = parseInt(match);
        if (age >= 18 && age <= 65) {
          return age;
        }
      }
    }
    
    return null;
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