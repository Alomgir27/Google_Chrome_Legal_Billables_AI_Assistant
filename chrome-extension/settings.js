class SettingsPage {
  constructor() {
    this.apiBaseUrl = 'https://googlechromelegalbillablesaiassistant-production.up.railway.app/api';
    this.settings = {};
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    await this.checkApiStatus();
  }

  setupEventListeners() {
    // Back button
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.close();
      });
    }

    // Toggle switches
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
      });
    });

    // Action buttons
    document.getElementById('test-api-btn').addEventListener('click', () => this.testApi());
    document.getElementById('test-openai-btn').addEventListener('click', () => this.testOpenAI());
    document.getElementById('connect-platform-btn').addEventListener('click', () => this.connectPlatform());
    document.getElementById('view-data-btn').addEventListener('click', () => this.viewDataLocation());
    document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
    document.getElementById('clear-data-btn').addEventListener('click', () => this.clearData());
    document.getElementById('about-btn').addEventListener('click', () => this.showAbout());
    document.getElementById('save-btn').addEventListener('click', () => this.saveSettings());
    document.getElementById('reset-btn').addEventListener('click', () => this.resetSettings());
    
    // Clio configuration handlers
    document.getElementById('configure-clio-btn').addEventListener('click', () => this.toggleClioConfig());
    document.getElementById('save-clio-config').addEventListener('click', () => this.saveClioConfig());
    document.getElementById('test-clio-connection').addEventListener('click', () => this.testClioConnection());
    
    // Clio access token handlers
    document.getElementById('set-clio-token').addEventListener('click', () => this.setClioAccessToken());
    document.getElementById('clear-clio-token').addEventListener('click', () => this.clearClioAccessToken());
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.local.get(['settings', 'clioConfig', 'clioAccessToken']);
      this.settings = stored.settings || this.getDefaultSettings();
      this.clioConfig = stored.clioConfig || this.getDefaultClioConfig();
      
      // Load stored access token if exists
      if (stored.clioAccessToken) {
        document.getElementById('clio-access-token').value = '••••••••••••••••';
        this.updateTokenStatus('Token stored ✓', 'success');
      } else {
        this.updateTokenStatus('No token set', 'warning');
      }
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = this.getDefaultSettings();
      this.clioConfig = this.getDefaultClioConfig();
      this.updateUI();
    }
  }

  updateUI() {
    this.applySettings();
    this.applyClioConfig();
  }

  getDefaultClioConfig() {
    return {
      clientId: 'EKamqHz9o8L6fNvtJRkpIHqDzwFWqeAsqAYLhN5A',
      clientSecret: 'QhHqCuUyhcgvdYlWt4gaOkpcqUZJKUFpbsCVocvb',
      redirectUri: 'https://googlechromelegalbillablesaiassistant-production.up.railway.app/auth/clio/callback',
      appId: '20912'
    };
  }

  updateTokenStatus(message, type) {
    const statusElement = document.getElementById('token-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `token-status ${type}`;
    }
  }

  // Access Token Management Methods
  async setClioAccessToken() {
    const tokenInput = document.getElementById('clio-access-token');
    const authCode = tokenInput.value.trim();
    
    if (!authCode || authCode === '••••••••••••••••') {
      this.showNotification('Please enter the authorization code from Clio', 'error');
      return;
    }

    const btn = document.getElementById('set-clio-token');
    btn.textContent = 'Getting Token...';
    btn.disabled = true;

    try {
      let accessToken;
      
      // Check if it looks like an authorization code (short, no dashes) or access token (long with dashes)
      if (!authCode.includes('-') || authCode.length < 30) {
        // This looks like an authorization code, exchange it for access token
        console.log('🔄 Exchanging authorization code for access token...');
        
        const exchangeResponse = await fetch(`${this.apiBaseUrl}/clio/exchange-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ authorizationCode: authCode })
        });

        const exchangeResult = await exchangeResponse.json();

        if (exchangeResult.success) {
          accessToken = exchangeResult.accessToken;
          console.log('✅ Authorization code exchanged successfully');
          this.showNotification('Authorization code exchanged successfully!', 'success');
        } else {
          throw new Error(exchangeResult.error || 'Failed to exchange authorization code');
        }
      } else {
        // This looks like a direct access token
        accessToken = authCode;
        console.log('🔑 Using direct access token');
        
        // Validate the direct token
        const response = await fetch(`${this.apiBaseUrl}/clio/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ accessToken: accessToken })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Token validation failed');
        }
      }

      // Store the access token locally
      await chrome.storage.local.set({ clioAccessToken: accessToken });
      
      // Update UI
      tokenInput.value = '••••••••••••••••';
      this.updateTokenStatus('Token validated ✓', 'success');
      this.showNotification('Clio access token set successfully!', 'success');
      
    } catch (error) {
      console.error('Failed to set access token:', error);
      this.showNotification(`Failed to set token: ${error.message}`, 'error');
    } finally {
      btn.textContent = 'Set Access Token';
      btn.disabled = false;
    }
  }

  async clearClioAccessToken() {
    if (!confirm('Are you sure you want to clear the stored Clio access token?')) {
      return;
    }

    try {
      await chrome.storage.local.remove(['clioAccessToken']);
      document.getElementById('clio-access-token').value = '';
      this.updateTokenStatus('No token set', 'warning');
      this.showNotification('Access token cleared', 'success');
    } catch (error) {
      console.error('Failed to clear access token:', error);
      this.showNotification('Failed to clear token', 'error');
    }
  }

  getDefaultSettings() {
    return {
      emailTracking: true,
      autoPauseDuration: 300,
      hourlyRate: 200,
      successNotifications: true,
      dailySummary: false
    };
  }

  applySettings() {
    document.getElementById('email-tracking-toggle').classList.toggle('active', this.settings.emailTracking);
    document.getElementById('auto-pause-duration').value = this.settings.autoPauseDuration;
    document.getElementById('hourly-rate').value = this.settings.hourlyRate;
    document.getElementById('success-notifications-toggle').classList.toggle('active', this.settings.successNotifications);
    document.getElementById('daily-summary-toggle').classList.toggle('active', this.settings.dailySummary);
  }

  async checkApiStatus() {
    try {
      // Simple single API call
      const response = await fetch(`${this.apiBaseUrl}/health`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Update status indicators
        const apiStatus = document.querySelector('.setting-item .setting-description');
        apiStatus.innerHTML = '<span class="status-indicator connected"></span>Connected';
        
        console.log('✅ API status checked:', data);
      } else {
        throw new Error('API unavailable');
      }
      
    } catch (error) {
      console.log('ℹ️ API offline');
      const apiStatus = document.querySelector('.setting-item .setting-description');
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator error"></span>Offline';
      }
    }
  }

  async testApi() {
    const btn = document.getElementById('test-api-btn');
    btn.textContent = 'Testing...';
    btn.disabled = true;

    try {
      await this.checkApiStatus();
      this.showNotification('Connection test complete', 'success');
    } catch (error) {
      this.showNotification('Connection failed', 'error');
    } finally {
      btn.textContent = 'Test Connection';
      btn.disabled = false;
    }
  }

  async testOpenAI() {
    const btn = document.getElementById('test-openai-btn');
    btn.textContent = 'Testing...';
    btn.disabled = true;

    try {
      const response = await fetch(`${this.apiBaseUrl}/openai/test`);
      const data = await response.json();
      
      if (data.success) {
        this.showNotification('OpenAI integration working', 'success');
      } else {
        throw new Error(data.error || 'OpenAI test failed');
      }
    } catch (error) {
      this.showNotification('OpenAI test failed', 'error');
    } finally {
      btn.textContent = 'Test OpenAI';
      btn.disabled = false;
    }
  }

  connectPlatform() {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
  }

  viewDataLocation() {
    this.showNotification('Data stored in: backend/data/billables/', 'success');
  }

  async exportData() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/billables`);
      const data = await response.json();

      if (data.success) {
        const jsonData = JSON.stringify(data.entries, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `billables-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully', 'success');
      }
    } catch (error) {
      this.showNotification('Export failed', 'error');
    }
  }

  clearData() {
    if (confirm('Are you sure you want to delete all billable entries? This action cannot be undone.')) {
      this.showNotification('Clear data functionality would be implemented here', 'success');
    }
  }

  showAbout() {
    alert('Legal Billables AI v1.0.0\n\nAI-powered billable tracking for legal professionals.\n\nFeatures:\n- Automatic email time tracking\n- OpenAI-powered summaries\n- Local storage + platform sync\n- Comprehensive reporting\n\nBuilt with modern web technologies.');
  }

  async saveSettings() {
    this.settings = {
      emailTracking: document.getElementById('email-tracking-toggle').classList.contains('active'),
      autoPauseDuration: parseInt(document.getElementById('auto-pause-duration').value),
      hourlyRate: parseFloat(document.getElementById('hourly-rate').value) || 200,
      successNotifications: document.getElementById('success-notifications-toggle').classList.contains('active'),
      dailySummary: document.getElementById('daily-summary-toggle').classList.contains('active')
    };

    try {
      await chrome.storage.local.set({ settings: this.settings });
      this.showNotification('Settings saved successfully', 'success');
    } catch (error) {
      this.showNotification('Failed to save settings', 'error');
    }
  }

  resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      this.settings = this.getDefaultSettings();
      this.applySettings();
      this.showNotification('Settings reset to defaults', 'success');
    }
  }

  // Clio Configuration Methods
  applyClioConfig() {
    if (this.clioConfig.clientId) {
      document.getElementById('clio-client-id').value = this.clioConfig.clientId;
    }
    if (this.clioConfig.clientSecret) {
      document.getElementById('clio-client-secret').value = '••••••••••••••••';
    }
    if (this.clioConfig.redirectUri) {
      document.getElementById('clio-redirect-uri').value = this.clioConfig.redirectUri;
    }
  }

  toggleClioConfig() {
    const configSection = document.getElementById('clio-config-section');
    const btn = document.getElementById('configure-clio-btn');
    
    if (configSection.style.display === 'none') {
      configSection.style.display = 'flex';
      btn.textContent = 'Hide Configuration';
      
      // Show notification about pre-configured status
      if (this.clioConfig && this.clioConfig.clientId) {
        this.showNotification('✅ Clio credentials pre-configured and ready to use!', 'success');
      }
    } else {
      configSection.style.display = 'none';
      btn.textContent = 'View Configuration';
    }
  }

  async saveClioConfig() {
    const clientId = document.getElementById('clio-client-id').value.trim();
    const clientSecret = document.getElementById('clio-client-secret').value.trim();
    const redirectUri = document.getElementById('clio-redirect-uri').value.trim();

    if (!clientId || !clientSecret || !redirectUri) {
      this.showNotification('Please fill in all Clio configuration fields', 'error');
      return;
    }

    this.clioConfig = {
      clientId,
      clientSecret: clientSecret === '••••••••••••••••' ? this.clioConfig.clientSecret : clientSecret,
      redirectUri
    };

    try {
      await chrome.storage.local.set({ clioConfig: this.clioConfig });
      this.showNotification('Clio configuration saved successfully', 'success');
      
      // Update the popup's platform configs
      chrome.runtime.sendMessage({
        type: 'UPDATE_CLIO_CONFIG',
        config: this.clioConfig
      });
      
    } catch (error) {
      console.error('Failed to save Clio config:', error);
      this.showNotification('Failed to save Clio configuration', 'error');
    }
  }

  async testClioConnection() {
    const btn = document.getElementById('test-clio-connection');
    btn.textContent = 'Testing...';
    btn.disabled = true;

    try {
      if (!this.clioConfig.clientId || !this.clioConfig.clientSecret) {
        throw new Error('Clio configuration incomplete');
      }

      // Test basic OAuth endpoint accessibility
      const testUrl = 'https://app.clio.com/oauth/authorize';
      const response = await fetch(testUrl, { 
        method: 'HEAD',
        mode: 'no-cors'
      });

      this.showNotification('Clio endpoint accessible. Ready for OAuth flow.', 'success');
      
    } catch (error) {
      console.error('Clio connection test failed:', error);
      this.showNotification('Clio connection test failed', 'error');
    } finally {
      btn.textContent = 'Test Connection';
      btn.disabled = false;
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SettingsPage();
});