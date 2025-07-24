class BillableServiceWorker {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    chrome.runtime.onInstalled.addListener(() => {
      this.onExtensionInstalled();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.onTabUpdated(tabId, changeInfo, tab);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'billableEntryLogged':
          await this.updateDailyStats(request.data);
          sendResponse({ success: true });
          break;

        case 'getStats':
          const stats = await this.getDailyStats();
          sendResponse({ success: true, stats });
          break;

        case 'resetStats':
          await this.resetDailyStats();
          sendResponse({ success: true });
          break;

        case 'checkAuthStatus':
          const authStatus = await this.getAuthStatus();
          sendResponse({ success: true, authStatus });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
      
      // Handle OAuth success messages
      if (request.type === 'CLIO_AUTH_SUCCESS') {
        console.log('🎉 Service Worker: Clio OAuth success received');
        
        if (request.accessToken) {
          try {
            console.log('💾 Service Worker: Storing access token...');
            await chrome.storage.local.set({ 
              clioAccessToken: request.accessToken,
              clioAuthStatus: 'authenticated',
              clioAuthTime: Date.now()
            });
            
            console.log('✅ Service Worker: Access token stored successfully');
            sendResponse({ success: true, message: 'Token stored' });
            
            // Notify all open extension pages about successful auth
            chrome.runtime.sendMessage({ type: 'AUTH_STATUS_UPDATED' });
            
          } catch (error) {
            console.error('❌ Service Worker: Failed to store token:', error);
            sendResponse({ success: false, error: error.message });
          }
        }
      }
      
    } catch (error) {
      console.error('Service worker error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async onExtensionInstalled() {
    await chrome.storage.local.set({
      installDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    });
    // Extension installed - ready to track emails in Gmail
  }

  onTabUpdated(tabId, changeInfo, tab) {
    // Content script auto-injects via manifest.json
    // No manual injection needed
  }

  async updateDailyStats(data) {
    const today = new Date().toDateString();
    const statsKey = `stats_${today}`;
    
    const currentStats = await chrome.storage.local.get([statsKey]);
    const stats = currentStats[statsKey] || { emailsLogged: 0, timeTracked: 0 };
    
    stats.emailsLogged += 1;
    stats.timeTracked += parseFloat(data.timeSpent || 0);
    
    await chrome.storage.local.set({ [statsKey]: stats });
    
    this.updateBadge(stats.emailsLogged);
  }

  async getDailyStats() {
    const today = new Date().toDateString();
    const statsKey = `stats_${today}`;
    
    const statsData = await chrome.storage.local.get([statsKey]);
    return statsData[statsKey] || { emailsLogged: 0, timeTracked: 0 };
  }

  async resetDailyStats() {
    const today = new Date().toDateString();
    const statsKey = `stats_${today}`;
    
    await chrome.storage.local.set({
      [statsKey]: { emailsLogged: 0, timeTracked: 0 }
    });
    
    this.updateBadge(0);
  }

  async getAuthStatus() {
    const authData = await chrome.storage.local.get(['authenticatedPlatform', 'authToken']);
    return {
      isAuthenticated: !!(authData.authenticatedPlatform && authData.authToken),
      platform: authData.authenticatedPlatform
    };
  }

  updateBadge(count) {
    const badgeText = count > 0 ? count.toString() : '';
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
  }

  async cleanupOldStats() {
    const storage = await chrome.storage.local.get(null);
    const currentDate = new Date();
    const sevenDaysAgo = new Date(currentDate.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const keysToRemove = [];
    
    for (const key in storage) {
      if (key.startsWith('stats_')) {
        const dateStr = key.replace('stats_', '');
        const statsDate = new Date(dateStr);
        
        if (statsDate < sevenDaysAgo) {
          keysToRemove.push(key);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  }
}

new BillableServiceWorker();

setInterval(() => {
  new BillableServiceWorker().cleanupOldStats();
}, 24 * 60 * 60 * 1000); 