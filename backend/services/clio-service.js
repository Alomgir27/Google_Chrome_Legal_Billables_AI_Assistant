const axios = require('axios');
const LocalStorageService = require('./local-storage-service');

class ClioService {
  constructor() {
    this.clientId = process.env.CLIO_CLIENT_ID;
    this.clientSecret = process.env.CLIO_CLIENT_SECRET;
    // Fix: Correct Clio API base URL
    this.baseUrl = 'https://app.clio.com/api/v4';
    this.accessToken = null;
    this.localStorage = new LocalStorageService();
  }

  // Set access token manually
  setAccessToken(token) {
    this.accessToken = token;
    console.log('✅ Clio access token set manually');
    
    // Also store in global for consistency
    if (!global.clioTokens) {
      global.clioTokens = {};
    }
    global.clioTokens.accessToken = token;
    global.clioTokens.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from now
    global.clioTokens.tokenType = 'Bearer';
  }

  // Check if authenticated with any platform (always true for Clio when token exists)
  isAuthenticatedWithPlatform() {
    return !!(this.accessToken || (global.clioTokens && global.clioTokens.accessToken));
  }

  // Get authenticated platform name
  getAuthenticatedPlatform() {
    return this.isAuthenticatedWithPlatform() ? 'Clio' : null;
  }

  // Identify client from email address
  async identifyClient(emailAddress) {
    try {
      // Simple client identification from email
      const clientName = emailAddress.split('@')[0].replace(/[._]/g, ' ');
      return {
        client: clientName.charAt(0).toUpperCase() + clientName.slice(1),
        case: 'General Legal Matter'
      };
    } catch (error) {
      console.error('Client identification failed:', error);
      return {
        client: 'Unknown Client',
        case: 'General Legal Matter'
      };
    }
  }

  // Log billable entry (save locally and try to push to Clio)
  async logBillableEntry(billableEntry, clioAccessToken) {
    try {
   

      // Try to push to Clio if enabled and authenticated
      let clioResult = null;
        try {
          clioResult = await this.pushBillableEntry(billableEntry, clioAccessToken);
          console.log('📊 Clio sync:', clioResult?.success ? 'Success' : 'Failed');
        } catch (clioError) {
          console.error('⚠️ Clio push failed, but local save succeeded:', clioError.message);
          clioResult = { success: false, error: clioError.message };
        }
      
      const localResult = await this.localStorage.saveBillableEntry(billableEntry);

      return {
        success: true,
        entryId: localResult.entryId,
        message: 'Billable entry saved locally' + (clioResult?.success ? ' and synced to Clio' : ''),
        localPath: localResult.localPath,
        clioSync: clioResult?.success || false
      };

    } catch (error) {
      console.error('Failed to log billable entry:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all billable entries from local storage
  async getAllBillableEntries() {
    try {
      return await this.localStorage.getAllBillableEntries();
    } catch (error) {
      console.error('Failed to get all entries:', error);
      return [];
    }
  }

  // Get today's billable entries
  async getTodaysBillables() {
    try {
      return await this.localStorage.getTodaysBillables();
    } catch (error) {
      console.error('Failed to get today\'s entries:', error);
      return [];
    }
  }

  // Get daily statistics
  async getDailyStats() {
    try {
      return await this.localStorage.getDailyStats();
    } catch (error) {
      console.error('Failed to get daily stats:', error);
      return {
        emailsLogged: 0,
        timeTracked: 0,
        revenue: 0
      };
    }
  }

  // Get clients (mock implementation)
  async getClients() {
    try {
      const allEntries = await this.getAllBillableEntries();
      const clients = [...new Set(allEntries.map(entry => entry.client))].map(client => ({
        id: client.toLowerCase().replace(/\s+/g, '_'),
        name: client
      }));
      
      return clients;
    } catch (error) {
      console.error('Failed to get clients:', error);
      return [];
    }
  }

  // Get auth URL for Clio OAuth
  getAuthUrl(platform) {
    if (!this.clientId) {
      throw new Error('Clio client ID not configured');
    }

    const redirectUri = 'https://googlechromelegalbillablesaiassistant-production.up.railway.appauth/clio/callback'; // Backend callback URL
    const scope = 'read write';
    const state = Math.random().toString(36).substring(2, 15);

    return `https://app.clio.com/oauth/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(authCode) {
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Clio client ID and secret are required');
      }

      console.log('🔄 Exchanging authorization code for access token...');

      const tokenData = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authCode,
        redirect_uri: 'https://googlechromelegalbillablesaiassistant-production.up.railway.appauth/clio/callback'
      });

      const response = await axios.post('https://app.clio.com/oauth/token', tokenData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      if (response.data && response.data.access_token) {
        console.log('✅ Successfully exchanged code for access token');
        
        // Store the token
        this.setAccessToken(response.data.access_token);
        
        return {
          success: true,
          accessToken: response.data.access_token,
          tokenType: response.data.token_type || 'Bearer',
          expiresIn: response.data.expires_in
        };
      } else {
        throw new Error('Invalid response from Clio token endpoint');
      }

    } catch (error) {
      console.error('❌ Failed to exchange authorization code:', error.response?.data || error.message);
      
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'Invalid authorization code. Please get a new code from Clio.'
        };
      }
      
      return {
        success: false,
        error: `Token exchange failed: ${error.message}`
      };
    }
  }

  // Authenticate (not implemented for direct token approach)
  async authenticate(platform, authCode) {
    throw new Error('OAuth authentication not implemented. Please use direct access token.');
  }

  // Get access token from stored credentials
  async getAccessToken() {
    // Check if token is manually set
    if (this.accessToken) {
      return this.accessToken;
    }

    // Check global storage for OAuth tokens
    if (global.clioTokens && global.clioTokens.accessToken) {
      // Check if token is still valid
      if (global.clioTokens.expiresAt > Date.now()) {
        this.accessToken = global.clioTokens.accessToken;
        return this.accessToken;
      } else {
        console.log('🔄 Clio access token expired, need to refresh');
        // TODO: Implement refresh token logic
        return null;
      }
    }

    console.log('⚠️ No Clio access token available. OAuth authentication required.');
    return null;
  }

  // Format billable entry for Clio Activities API
  formatBillableForClio(billableEntry) {
    const { summary, timeSpent, client, timestamp } = billableEntry;
    
    // Convert time from hours to seconds (latest Clio API expects seconds)
    const timeInSeconds = Math.round(timeSpent * 3600);
    
    // Use current date if timestamp not provided
    const currentDate = timestamp ? new Date(timestamp) : new Date();
    const date = currentDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    console.log('📅 Using date for Clio entry:', date);
    
    // Use Activities API format instead of time_entries
    return {
      data: {
        type: "TimeEntry",
        note: summary,
        quantity: timeInSeconds, // i2025-07-20 dicce but 2025-07-21 deya ucit
        date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
        non_billable: false,
        no_charge: false,
        tax_setting: "no_tax",
        reference: "string",
        price: 200 * parseFloat(timeSpent),
        currency: "USD"
      }
    };
  }

  // Get current authenticated user info
  async getAuthenticatedUser() {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return null;
      }

      const tokenType = global.clioTokens?.tokenType || 'Bearer';
      const response = await axios.get(`${this.baseUrl}/users/who_am_i`, {
        headers: {
          'Authorization': `${tokenType} ${token}`,
          'Accept': 'application/json'
        }
      });

      console.log('✅ Got Clio user info:', response.data.data.name);
      
      // Store user info globally for future use
      global.clioUserInfo = response.data.data;
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get Clio user info:', error.response?.data || error.message);
      return null;
    }
  }

  // Push billable entry to Clio using Activities API
  async pushBillableEntry(billableEntry, clioAccessToken) {
   
    
    try {
      // Format entry for Clio Activities API
      const clioEntry = this.formatBillableForClio(billableEntry);
      console.log('📊 Clio API payload:', {
        type: clioEntry.data.type,
        note: clioEntry.data.note.substring(0, 50) + '...',
        quantity: clioEntry.data.quantity,
        date: clioEntry.data.date,
        non_billable: clioEntry.data.non_billable,
        no_charge: clioEntry.data.no_charge,
        tax_setting: clioEntry.data.tax_setting,
        reference: clioEntry.data.reference,
        price: clioEntry.data.price,
        currency: clioEntry.data.currency,
        token: clioAccessToken
      });
      
      // Push to Clio Activities API
      const response = await axios.post(`${this.baseUrl}/activities.json`, clioEntry, {
        headers: {
          'Authorization': `Bearer ${clioAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      console.log('📊 Clio API response:', response.data);

      if (response.status === 201) {
        console.log('✅ Successfully pushed to Clio Activities:', response.data.data.id);
        return {
          success: true,
          clioId: response.data.data.id,
          message: `Billable entry synced to Clio (ID: ${response.data.data.id})`,
          clioData: {
            id: response.data.data.id,
            type: response.data.data.type,
            quantity_in_hours: response.data.data.quantity_in_hours,
            total: response.data.data.total
          }
        };
      }

    } catch (error) {
      console.error('❌ Clio Activities API error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Clio authentication expired - please re-authenticate',
          requiresAuth: true
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          error: `Clio API validation error: ${error.response?.data?.errors || error.message}`,
          requiresAuth: false
        };
      }

      if (error.response?.status === 422) {
        return {
          success: false,
          error: `Clio API unprocessable entity: ${error.response?.data?.errors || 'Invalid data format'}`,
          requiresAuth: false
        };
      }

      return {
        success: false,
        error: `Clio sync failed: ${error.message}`,
        requiresAuth: false,
        details: error.response?.data
      };
    }
  }

  // Test Clio API connection
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return {
          success: false,
          error: 'No access token available - OAuth authentication required'
        };
      }

      const tokenType = global.clioTokens?.tokenType || 'Bearer';
      console.log('🧪 Testing Clio connection...');
      
      const response = await axios.get(`${this.baseUrl}/users/who_am_i.json`, {
        headers: {
          'Authorization': `${tokenType} ${token}`,
          'Accept': 'application/json'
        }
      });

      console.log('✅ Clio connection test successful');
      return {
        success: true,
        message: 'Clio connection successful',
        user: {
          id: response.data.data.id,
          name: response.data.data.name,
          email: response.data.data.email
        }
      };
    } catch (error) {
      console.error('❌ Clio connection test failed:', error.response?.data || error.message);
      return {
        success: false,
        error: `Clio connection failed: ${error.response?.data?.error || error.message}`,
        requiresAuth: error.response?.status === 401
      };
    }
  }

  // Mock success for testing when OAuth not available
  async mockPushBillableEntry(billableEntry) {
    console.log('🧪 Mock Clio push for testing:', billableEntry.summary.substring(0, 50) + '...');
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
    
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      success: true,
      clioId: mockId,
      message: `Mock: Billable entry would be synced to Clio (Mock ID: ${mockId})`,
      clioData: {
        id: mockId,
        type: "TimeEntry",
        quantity_in_hours: billableEntry.timeSpent,
        total: billableEntry.timeSpent * 200 // Mock $200/hour
      }
    };
  }

  // Get Clio OAuth authorization URL
  getAuthUrl() {
    if (!this.clientId) {
      throw new Error('Clio client ID not configured');
    }

    const redirectUri = 'https://googlechromelegalbillablesaiassistant-production.up.railway.appauth/clio/callback';
    const scope = 'read write';
    const state = Math.random().toString(36).substring(2, 15);

    return `https://app.clio.com/oauth/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }
}

module.exports = ClioService;