// Popup Script - Interface Controller
class PopupController {
  constructor() {
    this.isRunning = false;
    this.currentTab = null;
    
    this.elements = {
      status: document.getElementById('status'),
      apiEndpoint: document.getElementById('apiEndpoint'),
      maxSwipes: document.getElementById('maxSwipes'),
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
      'apiEndpoint',
      'maxSwipes'
    ]);
    
    if (settings.apiEndpoint) {
      this.elements.apiEndpoint.value = settings.apiEndpoint;
    } else {
      // Устанавливаем значение по умолчанию
      this.elements.apiEndpoint.value = 'http://localhost:3000/decide';
    }
    
    if (settings.maxSwipes) {
      this.elements.maxSwipes.value = settings.maxSwipes;
    }
  }

  async saveSettings() {
    const settings = {
      apiEndpoint: this.elements.apiEndpoint.value,
      maxSwipes: parseInt(this.elements.maxSwipes.value)
    };
    
    await chrome.storage.local.set(settings);
    console.log('Settings saved:', settings);
  }

  bindEvents() {
    this.elements.startBtn.onclick = () => this.startSwiping();
    this.elements.stopBtn.onclick = () => this.stopSwiping();
    
    // Автосохранение настроек при изменении
    this.elements.apiEndpoint.onchange = () => this.saveSettings();
    this.elements.maxSwipes.onchange = () => this.saveSettings();
  }

  async startSwiping() {
    if (!this.currentTab.url.includes('tinder.com')) {
      alert('Please open Tinder.com first');
      return;
    }

    if (!this.elements.apiEndpoint.value) {
      alert('Please enter API endpoint first');
      console.error('No API endpoint configured');
      return;
    }

    // Сохраняем настройки
    await this.saveSettings();

    const config = {
      apiEndpoint: this.elements.apiEndpoint.value,
      maxSwipes: parseInt(this.elements.maxSwipes.value)
    };

    try {
      // Отправляем команду на content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'start',
        config: config
      });
      
      this.isRunning = true;
      this.updateUI();
      
      console.log('Swiper started with config:', config);
      
    } catch (error) {
      console.error('Failed to start swiper:', error);
      alert('Failed to start. Make sure you are on Tinder.com and refresh the page.');
    }
  }

  async stopSwiping() {
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'stop'
      });
      
      this.isRunning = false;
      this.updateUI();
      
      console.log('Swiper stopped');
      
    } catch (error) {
      console.error('Failed to stop swiper:', error);
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

  async updateStats() {
    if (!this.currentTab.url.includes('tinder.com') || !this.isRunning) {
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStats'
      });

      if (response) {
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
      // Content script may not be ready or tab closed
      console.log('Could not get stats - content script not ready or tab closed');
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