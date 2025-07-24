// === SIMPLE POPUP WITH CLIO OAUTH INTEGRATION ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Simple Popup loaded');

    // Check token status and services
    checkServiceStatus();
    
    // Event listeners
    document.getElementById('view-all-entries').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('all-entries.html') });
    });

    document.getElementById('view-settings').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });

    // Platform selector event
    const platformSelect = document.getElementById('platform-select');
    if (platformSelect) {
        platformSelect.addEventListener('change', handlePlatformChange);
    }

    // Connect button event
    const connectBtn = document.getElementById('connect-platform');
    if (connectBtn) {
        connectBtn.addEventListener('click', handleConnect);
    }

    // Clio quick setup button
    const clioTokenBtn = document.getElementById('get-clio-token');
    if (clioTokenBtn) {
        clioTokenBtn.addEventListener('click', handleClioOAuthSetup);
    }

    // === SIMPLIFIED BACKEND SERVICE INTEGRATION ===

    // Single API call to check all services at once
    async function checkServiceStatus() {
        try {
            updateStatus('🔄 Checking connection...', 'info');
            
            // Only one API call - wait for response
            const response = await fetch('https://googlechromelegalbillablesaiassistant-production.up.railway.app//api/health');
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Service check complete:', data);
                
                // Update UI based on response
                updateServiceStatus(data.services);
                updateStatus('✅ Backend Connected', 'success');
                
                // Check if Clio is connected
                if (data.services && data.services.clio) {
                    updatePlatformStatus('clio', true);
                } else {
                    updatePlatformStatus('backend', true);
                }
                
            } else {
                throw new Error('Service unavailable');
            }
        } catch (error) {
            console.log('ℹ️ Backend offline - using local mode');
            updateStatus('❌ Backend Offline', 'error');
            updatePlatformStatus('local', false);
        }
    }

    // === OAUTH FLOW ===

    // Get OAuth URL and open authorization window
    async function startClioOAuth() {
        try {
            console.log('🔗 Starting Clio OAuth flow...');
            updateStatus('🔄 Getting OAuth URL...', 'info');
            
            const response = await fetch('https://googlechromelegalbillablesaiassistant-production.up.railway.app//api/auth/url');
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.authUrl) {
                    console.log('✅ OAuth URL received');
                    updateStatus('🔗 Opening Clio authorization...', 'info');
                    
                    // Open OAuth URL in new window
                    const authWindow = window.open(
                        data.authUrl,
                        'clioOAuth',
                        'width=600,height=700,scrollbars=yes,resizable=yes'
                    );
                    
                    if (authWindow) {
                        // Listen for OAuth success message
                        const messageListener = (event) => {
                            if (event.data && event.data.type === 'CLIO_AUTH_SUCCESS') {
                                console.log('🎉 OAuth success received!');
                                
                                // Save token locally
                                chrome.storage.local.set({
                                    clioAccessToken: event.data.accessToken,
                                    clioAuthStatus: 'authenticated',
                                    clioAuthTime: Date.now(),
                                    selectedPlatform: 'clio'
                                }).then(() => {
                                    updateStatus('✅ Clio Connected', 'success');
                                    updatePlatformStatus('clio', true);
                                    
                                    // Update platform selector
                                    if (platformSelect) {
                                        platformSelect.value = 'clio';
                                    }
                                    
                                    // Hide setup section
                                    hideClioSetup();
                                    
                                    // Remove event listener
                                    window.removeEventListener('message', messageListener);
                                    
                                    console.log('✅ Token saved successfully');
                                });
                            }
                        };
                        
                        // Add message listener
                        window.addEventListener('message', messageListener);
                        
                        // Check if window is closed manually
                        const checkClosed = setInterval(() => {
                            if (authWindow.closed) {
                                clearInterval(checkClosed);
                                window.removeEventListener('message', messageListener);
                                
                                // Check if we got a token
                                setTimeout(async () => {
                                    const result = await chrome.storage.local.get(['clioAccessToken']);
                                    if (!result.clioAccessToken) {
                                        updateStatus('⚠️ OAuth cancelled', 'warning');
                                    }
                                }, 1000);
                            }
                        }, 1000);
                        
                    } else {
                        throw new Error('Failed to open OAuth window. Please allow popups.');
                    }
                    
                } else {
                    throw new Error(data.error || 'Failed to get OAuth URL');
                }
            } else {
                throw new Error('Backend not responding');
            }
            
        } catch (error) {
            console.error('❌ OAuth flow error:', error);
            updateStatus('❌ OAuth failed', 'error');
            alert(`OAuth Error: ${error.message}`);
        }
    }

    // Fallback token fetch from backend (for development)
    async function fetchTokenFromBackend() {
        try {
            console.log('🔄 Fetching fallback token from backend...');
            
            const response = await fetch('https://googlechromelegalbillablesaiassistant-production.up.railway.app//api/get-token', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.accessToken) {
                    // Save token locally
                    await chrome.storage.local.set({
                        clioAccessToken: data.accessToken,
                        clioAuthStatus: 'authenticated',
                        clioAuthTime: Date.now(),
                        selectedPlatform: 'clio'
                    });
                    
                    console.log('✅ Fallback token fetched and saved');
                    return data.accessToken;
                }
            }
            throw new Error('Invalid response from backend');
        } catch (error) {
            console.error('❌ Failed to fetch fallback token:', error);
            return null;
        }
    }

    // Handle platform selection
    async function handlePlatformChange() {
        const selectedPlatform = platformSelect.value;
        console.log('🔄 Platform selected:', selectedPlatform);
        
        if (selectedPlatform === 'clio') {
            showClioSetup();
        } else {
            hideClioSetup();
        }
        
        // Save selection
        await chrome.storage.local.set({ selectedPlatform });
    }

    // Handle connect button
    async function handleConnect() {
        const selectedPlatform = platformSelect.value;
        
        if (!selectedPlatform) {
            alert('Please select a platform first');
            return;
        }
        
        updateStatus('🔄 Connecting...', 'info');
        
        if (selectedPlatform === 'clio') {
            // Start OAuth flow for Clio
            await startClioOAuth();
        } else {
            // For other platforms or local storage
            await chrome.storage.local.set({ selectedPlatform });
            updateStatus(`✅ Using ${selectedPlatform}`, 'success');
            updatePlatformStatus(selectedPlatform, true);
        }
    }

    // Handle Clio OAuth setup
    async function handleClioOAuthSetup() {
        // Ask user preference: OAuth or fallback token
        const useOAuth = confirm(
            'Choose Clio connection method:\n\n' +
            'OK = OAuth (recommended) - Opens Clio authorization page\n' +
            'Cancel = Development token (fallback)'
        );
        
        if (useOAuth) {
            await startClioOAuth();
        } else {
            await handleFallbackTokenSetup();
        }
    }

    // Handle fallback token setup
    async function handleFallbackTokenSetup() {
        try {
            updateStatus('🔄 Setting up fallback token...', 'info');
            
            const token = await fetchTokenFromBackend();
            
            if (token) {
                console.log('✅ Fallback token set!');
                updateStatus('✅ Clio Connected (Dev)', 'success');
                updatePlatformStatus('clio', true);
                
                // Update platform selector
                if (platformSelect) {
                    platformSelect.value = 'clio';
                }
                
                // Hide setup section
                hideClioSetup();
            } else {
                console.log('❌ Failed to set fallback token');
                updateStatus('❌ Token setup failed', 'error');
            }
        } catch (error) {
            console.error('❌ Fallback token setup error:', error);
            updateStatus('❌ Token setup failed', 'error');
        }
    }

    // UI Helper Functions
    function updateStatus(message, type) {
        const statusElement = document.querySelector('.status-text');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-text ${type}`;
        }
    }

    function updateServiceStatus(services) {
        // Update service indicators in the UI
        if (services.ai) {
            console.log('✅ AI Service available');
        }
        
        if (services.clio) {
            console.log('✅ Clio Service authenticated');
        }
        
        console.log('🔧 Platform:', services.platform || 'None');
    }

    function updatePlatformStatus(platform, connected) {
        const statusElement = document.getElementById('platform-status');
        if (statusElement) {
            const dot = statusElement.querySelector('.status-dot');
            const text = statusElement.querySelector('span:last-child') || statusElement;
            
            if (dot) {
                dot.className = connected ? 'status-dot online' : 'status-dot offline';
            }
            
            const platformNames = {
                'clio': 'Clio',
                'practicepanther': 'PracticePanther',
                'mycase': 'MyCase',
                'backend': 'Backend API',
                'local': 'Local Storage'
            };
            
            text.textContent = connected ? 
                `Connected to ${platformNames[platform] || platform}` : 
                `Backend Offline - Local Mode`;
        }
    }

    function showClioSetup() {
        const setupSection = document.getElementById('clio-quick-setup');
        if (setupSection) {
            setupSection.style.display = 'block';
        }
    }

    function hideClioSetup() {
        const setupSection = document.getElementById('clio-quick-setup');
        if (setupSection) {
            setupSection.style.display = 'none';
        }
    }

    // === STATS LOADING ===

    // Load and display today's statistics
    async function loadTodaysStats() {
        try {
            const response = await fetch('https://googlechromelegalbillablesaiassistant-production.up.railway.app//api/stats');
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    updateStatsDisplay(data.stats);
                    console.log('✅ Stats loaded:', data.stats);
                } else {
                    console.error('❌ Failed to load stats:', data.error);
                }
            } else {
                throw new Error('Stats API unavailable');
            }
        } catch (error) {
            console.log('ℹ️ Stats unavailable:', error.message);
            // Set default values if stats can't be loaded
            updateStatsDisplay({
                emailsLogged: 0,
                timeTracked: 0
            });
        }
    }

    // Update stats display elements
    function updateStatsDisplay(stats) {
        const emailsElement = document.getElementById('emails-logged');
        const timeElement = document.getElementById('time-tracked');
        
        if (emailsElement) {
            emailsElement.textContent = stats.emailsLogged || 0;
        }
        if (timeElement) {
            timeElement.textContent = `${stats.timeTracked || 0}h`;
        }
    }

    // === PLATFORM MANAGEMENT ===

    // Global function for manual token refresh
    window.setTokenQuick = async function() {
        await handleClioOAuthSetup();
    };

    // Add refresh button functionality
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄 Refresh Token';
    refreshBtn.style.cssText = 'margin: 10px; padding: 8px 16px; background: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;';
    refreshBtn.onclick = () => window.setTokenQuick();
    
    // Try to add refresh button to popup if container exists
    setTimeout(() => {
        const container = document.querySelector('.popup-container') || document.body;
        if (container && !document.querySelector('[data-refresh-btn]')) {
            refreshBtn.setAttribute('data-refresh-btn', 'true');
            container.appendChild(refreshBtn);
        }
    }, 500);

    // Initialize platform selector and check authentication status
    setTimeout(async () => {
        try {
            // Check for stored platform and token
            const result = await chrome.storage.local.get(['selectedPlatform', 'clioAccessToken', 'clioAuthStatus']);
            
            if (platformSelect) {
                if (result.selectedPlatform) {
                    platformSelect.value = result.selectedPlatform;
                    
                    if (result.selectedPlatform === 'clio') {
                        showClioSetup();
                        
                        // Check if already authenticated with Clio
                        if (result.clioAccessToken && result.clioAuthStatus === 'authenticated') {
                            updateStatus('✅ Clio Connected', 'success');
                            updatePlatformStatus('clio', true);
                            hideClioSetup();
                        }
                    }
                }
            }
            
            // Always check backend status
            await checkServiceStatus();
            
            // Load and display today's stats
            await loadTodaysStats();
            
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }, 100);
}); 