// Popup Script - Interface Controller
class PopupController {
  constructor() {
    this.isRunning = false;
    this.currentTab = null;
    
    this.elements = {
      status: document.getElementById('status'),
      textApiEndpoint: document.getElementById('textApiEndpoint'),
      imageApiEndpoint: document.getElementById('imageApiEndpoint'),
      textUrlStatus: document.getElementById('textUrlStatus'),
      imageUrlStatus: document.getElementById('imageUrlStatus'),
      maxSwipes: document.getElementById('maxSwipes'),
      skipAfterImages: document.getElementById('skipAfterImages'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      statsTotal: document.getElementById('statsTotal'),
      statsLikes: document.getElementById('statsLikes'),
      statsPasses: document.getElementById('statsPasses'),
      statsErrors: document.getElementById('statsErrors'),
      likeRate: document.getElementById('likeRate')
    };
    
    this.init();
  }

  async init() {
    // Получаем текущую вкладку
    this.currentTab = await this.getCurrentTab();
    
    // Загружаем сохраненные настройки
    await this.loadSettings();
    
    // Проверяем текущее состояние swiper
    await this.checkSwiperStatus();
    
    // Привязываем события
    this.bindEvents();
    
    // Обновляем статистику каждые 2 секунды
    setInterval(() => this.updateStats(), 2000);
    
    console.log('Popup controller initialized');
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'textApiEndpoint',
      'imageApiEndpoint',
      'maxSwipes',
      'skipAfterImages'
    ]);
    
    if (settings.textApiEndpoint) {
      this.elements.textApiEndpoint.value = settings.textApiEndpoint;
    } else {
      // Устанавливаем значение по умолчанию
      this.elements.textApiEndpoint.value = 'http://localhost:3000/text-decide';
    }
    
    if (settings.imageApiEndpoint) {
      this.elements.imageApiEndpoint.value = settings.imageApiEndpoint;
    } else {
      // Устанавливаем значение по умолчанию
      this.elements.imageApiEndpoint.value = 'http://localhost:3000/image-decide';
    }
    
    if (settings.maxSwipes) {
      this.elements.maxSwipes.value = settings.maxSwipes;
    }
    
    if (settings.skipAfterImages) {
      this.elements.skipAfterImages.value = settings.skipAfterImages;
    }
  }

  async saveSettings() {
    const settings = {
      textApiEndpoint: this.elements.textApiEndpoint.value,
      imageApiEndpoint: this.elements.imageApiEndpoint.value,
      maxSwipes: parseInt(this.elements.maxSwipes.value),
      skipAfterImages: parseInt(this.elements.skipAfterImages.value)
    };
    
    await chrome.storage.local.set(settings);
    console.log('Settings saved:', settings);
    
    // Show save confirmation
    this.showUrlStatus('textUrlStatus', 'Saved!', true);
    this.showUrlStatus('imageUrlStatus', 'Saved!', true);
  }
  
  showUrlStatus(elementId, message, success) {
    const statusEl = this.elements[elementId];
    statusEl.textContent = message;
    statusEl.className = success ? 'url-status url-saved' : 'url-status url-error';
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }

  bindEvents() {
    this.elements.startBtn.onclick = () => this.startSwiping();
    this.elements.stopBtn.onclick = () => this.stopSwiping();
    
    // Автосохранение настроек при изменении
    this.elements.textApiEndpoint.onchange = () => this.saveSettings();
    this.elements.imageApiEndpoint.onchange = () => this.saveSettings();
    this.elements.maxSwipes.onchange = () => this.saveSettings();
    this.elements.skipAfterImages.onchange = () => this.saveSettings();
  }

  async startSwiping() {
    if (!this.currentTab.url.includes('tinder.com')) {
      alert('Please open Tinder.com first');
      return;
    }

    if (!this.elements.textApiEndpoint.value || !this.elements.imageApiEndpoint.value) {
      alert('Please enter both Text and Image API endpoints');
      console.error('API endpoints not configured');
      return;
    }

    // Сохраняем настройки
    await this.saveSettings();

    const config = {
      textApiEndpoint: this.elements.textApiEndpoint.value,
      imageApiEndpoint: this.elements.imageApiEndpoint.value,
      maxSwipes: parseInt(this.elements.maxSwipes.value),
      skipAfterImages: parseInt(this.elements.skipAfterImages.value)
    };

    try {
      // Проверяем что content script загружен
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'updateConfig',
        config: config
      });
      
      if (!response || !response.success) {
        throw new Error('Content script not ready. Please refresh the page.');
      }
      
      // Отправляем команду старта
      const startResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'start',
        config: config
      });
      
      if (startResponse && startResponse.success) {
        this.isRunning = true;
        this.updateUI();
        console.log('Swiper started with config:', config);
      } else {
        throw new Error(startResponse?.error || 'Failed to start swiper');
      }
      
    } catch (error) {
      console.error('Failed to start swiper:', error);
      
      if (error.message.includes('Receiving end does not exist')) {
        alert('Content script not loaded. Please refresh the Tinder page and try again.');
      } else if (error.message.includes('not ready')) {
        alert('Please refresh the Tinder page and wait for it to fully load.');
      } else {
        alert(`Failed to start: ${error.message}`);
      }
    }
  }

  async stopSwiping() {
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'stop'
      });
      
      this.isRunning = false;
      this.updateUI();
      
      console.log('Swiper stopped');
      
    } catch (error) {
      console.error('Failed to stop swiper:', error);
      // Даже если есть ошибка, считаем что остановили
      this.isRunning = false;
      this.updateUI();
    }
  }

  async updateStatus() {
    if (!this.currentTab.url.includes('tinder.com')) {
      this.elements.status.textContent = 'Status: Not on Tinder';
      this.elements.status.className = 'status stopped';
      return;
    }

    this.elements.status.textContent = this.isRunning ? 'Status: Running' : 'Status: Ready';
    this.elements.status.className = `status ${this.isRunning ? 'running' : 'stopped'}`;
  }

  async checkSwiperStatus() {
    if (!this.currentTab.url.includes('tinder.com')) {
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStatus'
      });

      if (response && response.isRunning !== undefined) {
        this.isRunning = response.isRunning;
        this.updateUI();
        console.log('Swiper status synced:', this.isRunning ? 'running' : 'stopped');
      }
    } catch (error) {
      // Content script not ready
      console.log('Could not check swiper status - content script may not be ready');
    }
  }

  async updateStats() {
    if (!this.currentTab.url.includes('tinder.com')) {
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStats'
      });

      if (response) {
        // Update running status from response
        if (response.isRunning !== undefined && response.isRunning !== this.isRunning) {
          console.log('Swiper status changed:', response.isRunning ? 'started' : 'stopped');
          this.isRunning = response.isRunning;
          this.updateUI();
        }

        this.elements.statsTotal.textContent = response.total || 0;
        this.elements.statsLikes.textContent = response.likes || 0;
        this.elements.statsPasses.textContent = response.passes || 0;
        this.elements.statsErrors.textContent = response.errors || 0;
        
        const total = response.total || 0;
        const likes = response.likes || 0;
        const likeRate = total > 0 ? Math.round((likes / total) * 100) : 0;
        this.elements.likeRate.textContent = `${likeRate}%`;
      }

    } catch (error) {
      // Content script may not be ready or tab closed - не логируем для избежания спама
      if (this.isRunning) {
        console.log('Could not get stats - content script may not be ready');
        // Останавливаем если content script недоступен
        this.isRunning = false;
        this.updateUI();
      }
    }
  }

  updateUI() {
    if (this.isRunning) {
      this.elements.startBtn.style.display = 'none';
      this.elements.stopBtn.style.display = 'block';
    } else {
      this.elements.startBtn.style.display = 'block';
      this.elements.stopBtn.style.display = 'none';
    }
    
    this.updateStatus();
  }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});