const express = require('express');
const cors = require('cors');
require('dotenv').config();

const AIService = require('./services/ai-service');
const ClioService = require('./services/clio-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const aiService = new AIService();
const clioService = new ClioService();

// CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST']
}));

app.use(express.json());

// === OAUTH ENDPOINTS ===

// Get Clio OAuth authorization URL
app.get('/api/auth/url', (req, res) => {
  try {
    console.log('🔗 Generating Clio OAuth URL...');
    
    // Check if client ID is configured
    if (!process.env.CLIO_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        error: 'Clio client ID not configured in environment'
      });
    }
    
    const authUrl = clioService.getAuthUrl('clio');
    
    console.log('✅ OAuth URL generated');
    
    res.json({
      success: true,
      authUrl: authUrl,
      platform: 'clio',
      message: 'Please visit this URL to authorize the application'
    });
  } catch (error) {
    console.error('❌ Error generating OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OAuth callback and exchange code for token
app.get('/auth/clio/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('🔄 OAuth callback received...');
    
    if (error) {
      console.error('❌ OAuth error:', error);
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>❌ Authorization Failed</h2>
            <p>Error: ${error}</p>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }
    
    if (!code) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>❌ No Authorization Code</h2>
            <p>No authorization code received from Clio.</p>
            <p>Please close this window and try again.</p>
          </body>
        </html>
      `);
    }
    
    // Exchange code for token
    const tokenResult = await clioService.exchangeCodeForToken(code);
    
    if (tokenResult.success) {
      console.log('✅ Token exchange successful');
      
      // Set token in service
      clioService.setAccessToken(tokenResult.accessToken);
      
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2>✅ Authorization Successful!</h2>
            <p>Your Clio account has been connected successfully.</p>
            <p>You can now close this window and return to the extension.</p>
            <script>
              // Notify parent window (if opened in popup)
              if (window.opener) {
                window.opener.postMessage({
                  type: 'CLIO_AUTH_SUCCESS',
                  accessToken: '${tokenResult.accessToken}'
                }, '*');
              }
              // Auto-close after 3 seconds
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    } else {
      throw new Error(tokenResult.error || 'Token exchange failed');
    }
    
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>❌ Authorization Failed</h2>
          <p>Error: ${error.message}</p>
          <p>Please close this window and try again.</p>
        </body>
      </html>
    `);
  }
});

// Exchange authorization code for token (API endpoint)
app.post('/api/auth/exchange', async (req, res) => {
  try {
    const { authorizationCode } = req.body;
    
    if (!authorizationCode) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code required'
      });
    }
    
    console.log('🔄 Exchanging authorization code...');
    
    const result = await clioService.exchangeCodeForToken(authorizationCode);
    
    if (result.success) {
      // Set token in service
      clioService.setAccessToken(result.accessToken);
      console.log('✅ Token exchange successful');
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ Token exchange error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === SIMPLE PROCESS BILLABLE ENDPOINT ===
app.post('/api/process-billable', async (req, res) => {
  try {
    console.log('📝 Processing billable entry...');
    
    const { emailData, timeSpent, clioAccessToken } = req.body;
    console.log('🔍 Email data:', emailData);
    console.log('🔍 Time spent:', timeSpent);
    console.log('🔍 Clio access token:', clioAccessToken);
    
    if (!emailData || !timeSpent) {
      return res.status(400).json({
        success: false,
        error: 'Email data and time spent required'
      });
    }

  
    // Generate AI summary using AI service
    let summary = '';
    try {
      console.log('🤖 Generating AI summary...');
      summary = await aiService.generateBillableSummary(emailData);
      console.log('✅ AI summary generated');
    } catch (aiError) {
      console.log('🔄 AI failed, using fallback summary');
      summary = `Email communication with ${emailData.recipient} regarding ${emailData.subject}`;
    }

    // Identify client information using Clio service
    let clientInfo;
    try {
      clientInfo = await clioService.identifyClient(emailData.recipient);
      console.log('✅ Client info identified');
    } catch (clientError) {
      console.log('🔄 Using fallback client info');
      clientInfo = {
        client: emailData.recipient.split('@')[0] || 'Unknown Client',
        case: 'General Legal Matter'
      };
    }

    // Create billable entry object
    const billableEntry = {
      summary: summary,
      timeSpent: parseFloat(timeSpent),
      client: clientInfo.client,
      case: clientInfo.case,
      timestamp: new Date().toISOString(),
      type: 'email',
      emailData: {
        recipient: emailData.recipient,
        subject: emailData.subject,
        content: emailData.content
      }
    };

    // Save locally using Clio service
    let localResult;
    try {
      console.log('💾 Saving locally...');
      localResult = await clioService.logBillableEntry(billableEntry, clioAccessToken);
      console.log('✅ Local storage successful');
    } catch (localError) {
      console.error('❌ Local storage failed:', localError.message);
      return res.status(500).json({
        success: false,
        error: `Failed to save locally: ${localError.message}`
      });
    }

   
    // Success response
    res.json({
      success: true,
      summary: summary,
      client: clientInfo.client,
      case: clientInfo.case,
      timeSpent: timeSpent,
      entryId: localResult.entryId,
      clioSync: { success: localResult.clioSync || false },
      platform: clioService.getAuthenticatedPlatform() || 'Local Storage'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Clio access token for extension (fallback to hardcoded for development)
app.get('/api/get-token', (req, res) => {
  try {
    // First check if we already have a token in the service
    const existingToken = clioService.accessToken || 
                         (global.clioTokens && global.clioTokens.accessToken);
    
    if (existingToken) {
      console.log('📤 Providing existing Clio token to extension');
      return res.json({
        success: true,
        accessToken: existingToken,
        platform: 'clio',
        message: 'Existing token retrieved successfully'
      });
    }
    else {
      console.log('🚫 No token found');
      return res.json({
        success: false,
        error: 'No token found'
      });
    }

  } catch (error) {
    console.error('❌ Error getting token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get access token'
    });
  }
});

// Get all billable entries
app.get('/api/billables', async (req, res) => {
  try {
    console.log('📋 Fetching all billable entries...');
    
    const billables = await clioService.getAllBillableEntries();
    
    console.log(`✅ Found ${billables.length} billable entries`);
    
    res.json({
      success: true,
      entries: billables,
      total: billables.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching billables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billable entries'
    });
  }
});

// Get today's statistics
app.get('/api/stats', async (req, res) => {
  try {
    console.log('📊 Fetching today\'s statistics...');
    
    const stats = await clioService.getDailyStats();
    
    console.log('✅ Stats generated:', stats);
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Simple Billables API running',
    services: {
      ai: !!process.env.OPENAI_API_KEY,
      clio: clioService.isAuthenticatedWithPlatform(),
      clioEnabled: clioService.clioEnabled,
      platform: clioService.getAuthenticatedPlatform() || 'None'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Billables Server running on port ${PORT}`);
}); 