// Prevent multiple instances
(function() {
  if (window.gmailBillableTracker) {
    return;
  }
  
  // Gmail Billable Tracker v2.0 - Enhanced auto-pause functionality

  const INACTIVITY_TIMEOUT = 60 * 1000; // 60 seconds
  const WARNING_30S = 30 * 1000; // 30 seconds
  const WARNING_45S = 45 * 1000; // 45 seconds

  class ComposeTracker {
    constructor(composeElement, manager, index) {
      this.composeElement = composeElement;
      this.manager = manager;
      this.isTracking = false;
      this.startTime = null;
      this.lastActivity = Date.now(); // Initialize with current time
      this.totalTime = 0;
      this.inactivityTimer = null;
      this.displayUpdateTimer = null;
      this.id = `billable-tracker-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.uiIndex = index;
      this.warning30Timer = null;
      this.warning45Timer = null;

      this.init();
    }

    init() {
      this.composeElement.setAttribute('data-billable-tracked', this.id);
      
      const contentEditable = this.findContentArea();
      const sendButton = this.findSendButton();

      if (contentEditable) {
        this.attachEventListeners(contentEditable);
      }

      if (sendButton) {
        this.attachSendListener(sendButton);
      }

      this.addBillableIndicator();
      this.startDisplayUpdates();
    }

    findContentArea() {
      const selectors = [
        'div[contenteditable="true"][aria-label*="Message Body"]',
        'div[contenteditable="true"][g_editable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        '[role="textbox"]',
        'textarea[name="to"]',
        'div[aria-label="Message Body"]'
      ];
      
      for (const selector of selectors) {
        const element = this.composeElement.querySelector(selector);
        if (element) {
          return element;
        }
      }
      return null;
    }

    findSendButton() {
      const selectors = [
        '[role="button"][data-tooltip*="Send"]',
        '[aria-label*="Send"]',
        'div[data-tooltip="Send"]',
        '[role="button"][aria-label*="Send"]',
        'div[role="button"][aria-label*="Send"]',
        'div[data-tooltip*="Send"]',
        'button[aria-label*="Send"]'
      ];
      
      for (const selector of selectors) {
        const element = this.composeElement.querySelector(selector);
        if (element) {
          return element;
        }
      }
      
      return null;
    }

    /**
     * Attaches event listeners for activity detection
     * Uses immediate response for compose-specific events and debounced for global events
     */
    attachEventListeners(contentEditable) {
      const activityHandler = () => {
        if (!this.isTracking) {
          this.startTracking();
        }
        this.updateActivity();
      };

      // Debounced activity handler for global events (prevents excessive timer resets)
      const debouncedActivityHandler = this.debounce(() => {
        this.updateActivity();
      }, 2000);

      // Content area events (immediate response for typing)
      contentEditable.addEventListener('keydown', activityHandler);
      contentEditable.addEventListener('input', activityHandler);
      contentEditable.addEventListener('paste', activityHandler);
      contentEditable.addEventListener('focus', activityHandler);
      
      // Compose window specific events (immediate response)
      this.composeElement.addEventListener('click', activityHandler);
      this.composeElement.addEventListener('keydown', activityHandler);
      this.composeElement.addEventListener('input', activityHandler);
      this.composeElement.addEventListener('paste', activityHandler);
      
      // Global events for background activity detection (debounced to prevent spam)
      this.globalActivityHandler = debouncedActivityHandler;
      document.addEventListener('keydown', this.globalActivityHandler);
      document.addEventListener('click', this.globalActivityHandler);
    }

    /**
     * Debounce utility function to limit frequent function calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, delay) {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    }

    startTracking() {
      if(this.isTracking) return;
      
      this.isTracking = true;
      this.startTime = Date.now();
      this.lastActivity = Date.now();
      this.updateBillableIndicator();
    }

    /**
     * Updates activity timestamp and resets inactivity timers
     * Automatically starts tracking if not already active
     */
    updateActivity() {
      this.lastActivity = Date.now();

      if(!this.isTracking){
        this.isTracking = true;
        this.startTime = this.lastActivity;
      }

      // Clear existing timers
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
      }
      if (this.warning30Timer) {
        clearTimeout(this.warning30Timer);
      }
      if (this.warning45Timer) {
        clearTimeout(this.warning45Timer);
      }

      // Hide any existing warning
      this.hideInactivityWarning();

      // Only set new timers if compose window is still valid
      if (this.isComposeWindowValid()) {
        // Set 30 second warning timer
        this.warning30Timer = setTimeout(() => {
          if (this.isComposeWindowValid()) {
            this.show30SecondWarning();
          } else {
            console.log('🗑️ Compose window no longer valid, destroying tracker');
            this.destroyTracker();
          }
        }, WARNING_30S);

        // Set 45 second warning timer
        this.warning45Timer = setTimeout(() => {
          if (this.isComposeWindowValid()) {
            this.show45SecondWarning();
          } else {
            console.log('🗑️ Compose window no longer valid, destroying tracker');
            this.destroyTracker();
          }
        }, WARNING_45S);

        // Set main inactivity timer (60 seconds)
        this.inactivityTimer = setTimeout(() => {
          if (this.isComposeWindowValid()) {
            this.pauseTracking('inactivity');
            this.hideInactivityWarning();
          } else {
            console.log('🗑️ Compose window no longer valid, destroying tracker');
            this.destroyTracker();
          }
        }, INACTIVITY_TIMEOUT);
      } else {
        console.log('🗑️ Compose window no longer valid during activity update, destroying tracker');
        this.destroyTracker();
      }
    }

    /**
     * Checks if the compose window is still valid and visible in the DOM
     */
    isComposeWindowValid() {
      // Check if compose element still exists in DOM
      if (!this.composeElement || !document.body.contains(this.composeElement)) {
        return false;
      }

      // Check if compose element is still visible
      const style = window.getComputedStyle(this.composeElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      // Check if it still has compose window characteristics
      return this.manager.isComposeWindow(this.composeElement);
    }

    /**
     * Pauses time tracking and accumulates tracked time
     * @param {string} reason - 'manual' or 'inactivity'
     */
    pauseTracking(reason = 'manual') {
      // Check if compose window is still valid
      if (!this.isComposeWindowValid() && reason === 'inactivity') {
        console.log('🗑️ Compose window invalid during inactivity pause, destroying tracker');
        this.destroyTracker();
        return;
      }

      if (this.isTracking && this.startTime) {
        this.totalTime += (Date.now() - this.startTime);
        this.isTracking = false;
        this.startTime = null;
        this.updateBillableIndicator();
        
        // Show notification for auto-pause due to inactivity (only if compose window is still valid)
        if (reason === 'inactivity' && this.isComposeWindowValid()) {
          const timeData = this.getTimeFormatted();
          this.showNotification(
            '⏸️ Tracking Paused', 
            `Automatically paused due to inactivity.<br>Total time: ${timeData.formatted}<br>Start typing to resume tracking.`, 
            'warning'
          );
        }
      }
    }

    calculateCurrentTime() {
      let currentSessionTime = 0;
      if (this.isTracking && this.startTime) {
        currentSessionTime = Date.now() - this.startTime;
      }
      return this.totalTime + currentSessionTime;
    }

    getTimeFormatted() {
      const totalMs = this.calculateCurrentTime();
      const hours = Math.floor(totalMs / 3600000);
      const minutes = Math.floor((totalMs % 3600000) / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const hoursDecimal = (totalMs / 3600000).toFixed(2);
      
      return {
        formatted: `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        decimal: hoursDecimal
      };
    }

    attachSendListener(sendButton) {
      sendButton.addEventListener('click', () => {
        this.handleEmailSend();
      });
    }

    async handleEmailSend() {
      console.log('📧 Email send detected, processing billable entry...');
      this.pauseTracking();
      const totalHours = (this.calculateCurrentTime() / 3600000).toFixed(2);
      
      // Always process emails with minimum 0.1 hours (6 minutes) for quick emails
      const minTime = Math.max(parseFloat(totalHours), 0.1);
      
      try {
        const emailData = this.extractEmailData();
        
        // Show processing notification
        this.showNotification(
          '⏳ Processing Entry', 
          'Sending billable entry to backend...', 
          'info'
        );
        
        const result = await this.processBillableEntry(emailData, minTime);
        
        if (result && result.success) {
          console.log('✅ Billable entry processed successfully');
          console.log('📊 Result details:', {
            entryId: result.entryId,
            client: result.billableEntry?.client,
            clioSynced: result.clioSync?.success,
            platform: result.platform
          });
          
          // Hide processing notification
          this.hideAllNotifications();
          
          // Show success modal on left side
          this.showSuccessModal(result, minTime);
          
          // Keep tracker for 5 seconds to show modal, then destroy
          setTimeout(() => {
            this.destroyTracker();
          }, 5000);
          
        } else {
          console.log('❌ Billable entry processing failed:', result?.error || 'Unknown error');
          
          // Hide processing notification
          this.hideAllNotifications();
          
          // Show specific error message based on error type
          const errorMsg = result?.error || 'Unknown error occurred';
          let friendlyMessage = '';
          
          if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            friendlyMessage = 'Backend server error. Please check server logs and try again.';
          } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('connection')) {
            friendlyMessage = 'Cannot connect to backend API. Make sure server is running on localhost:3000.';
          } else {
            friendlyMessage = errorMsg;
          }
          
          setTimeout(() => {
            this.showNotification(
              '⚠️ Entry Processing Failed', 
              `${friendlyMessage}<br>Tracker will close in 3 seconds.`, 
              'error'
            );
            
            // Destroy tracker after showing error
            setTimeout(() => {
              this.destroyTracker();
            }, 3000);
          }, 500);
        }
        
      } catch (error) {
        console.error('❌ Unexpected error during email send handling:', error);
        
        // Hide processing notification
        this.hideAllNotifications();
        
        // Show specific error based on error type
        let friendlyMessage = 'Failed to process billable entry.';
        
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          friendlyMessage = 'Cannot connect to backend API. Make sure server is running on localhost:3000.';
        } else if (error.message.includes('500')) {
          friendlyMessage = 'Backend server error. Check server logs for details.';
        }
        
        setTimeout(() => {
          this.showNotification(
            '❌ Connection Error', 
            `${friendlyMessage}<br>Please try again.`, 
            'error'
          );
          
          // Destroy tracker after error
          setTimeout(() => {
            this.destroyTracker();
          }, 3000);
        }, 500);
      }
    }

    /**
     * Shows a success modal on the left side of Gmail after email is sent
     */
    showSuccessModal(result, timeSpent) {
      // Remove any existing modal
      const existingModal = document.getElementById('billable-success-modal');
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal container
      const modal = document.createElement('div');
      modal.id = 'billable-success-modal';
      modal.style.cssText = `
        position: fixed;
        top: 80px;
        left: 20px;
        width: 320px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        border: 1px solid #e1e5e9;
        padding: 20px;
        z-index: 10000;
        font-family: 'Google Sans', Arial, sans-serif;
        font-size: 14px;
        color: #202124;
        animation: slideIn 0.3s ease-out;
      `;

      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { 
            transform: translateX(-100%);
            opacity: 0;
          }
          to { 
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from { 
            transform: translateX(0);
            opacity: 1;
          }
          to { 
            transform: translateX(-100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);

      // Process response data - simplified
      const entryDetails = result.billableEntry || {};
      
      // Modal content - API only mode
      modal.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="
            width: 32px; 
            height: 32px; 
            background: #34a853; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            margin-right: 12px;
          ">
            <span style="color: white; font-size: 18px;">✓</span>
          </div>
          <div>
            <div style="font-weight: 600; color: #34a853;">Email Sent & Logged</div>
            <div style="font-size: 12px; color: #5f6368;">Entry processed via backend API</div>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-weight: 500; margin-bottom: 8px;">📊 Entry Details</div>
          <div style="font-size: 12px; line-height: 1.4;">
            <div><strong>Time:</strong> ${timeSpent} hours</div>
            <div><strong>Client:</strong> ${entryDetails?.client || 'Unknown Client'}</div>
            <div><strong>Summary:</strong> ${(entryDetails?.summary || 'Email communication').substring(0, 60)}${entryDetails?.summary && entryDetails?.summary.length > 60 ? '...' : ''}</div>
          </div>
        </div>
        
        <div style="background: #e8f0fe; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; color: #1967d2;">
          <strong>🚀 Backend API</strong><br>
          Entry processed and saved successfully
        </div>
        
        <button id="close-modal-btn" style="
          width: 100%;
          padding: 8px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          font-weight: 500;
        ">Close</button>
      `;

      // Add to page
      document.body.appendChild(modal);

      // Close button functionality
      const closeBtn = modal.querySelector('#close-modal-btn');
      closeBtn.addEventListener('click', () => {
        modal.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.remove();
          }
        }, 300);
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        if (document.getElementById('billable-success-modal')) {
          modal.style.animation = 'slideOut 0.3s ease-in forwards';
          setTimeout(() => {
            if (modal.parentNode) {
              modal.remove();
            }
          }, 300);
        }
      }, 5000);

      console.log('✅ Success modal displayed - API processed entry');
    }

    /**
     * Properly destroys the tracker (calls the manager's cleanup)
     */
    destroyTracker() {
      console.log('🗑️ Destroying tracker:', this.id);
      this.manager.untrackComposeWindow(this.composeElement);
    }

    /**
     * Clears the billable entry and resets the tracker
     */
    clearBillableEntry() {
      // Reset all timing data
      this.totalTime = 0;
      this.startTime = null;
      this.isTracking = false;
      this.lastActivity = Date.now();
      
      // Clear all timers
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      if (this.warning30Timer) clearTimeout(this.warning30Timer);
      if (this.warning45Timer) clearTimeout(this.warning45Timer);
      
      // Update the UI to show cleared state
      this.updateBillableIndicator();
      
      // Hide any warnings
      this.hideInactivityWarning();
      
      // Show cleared notification
      this.showNotification(
        '🗑️ Entry Cleared', 
        'Billable entry has been cleared. Ready for new tracking.', 
        'success'
      );
    }

    /**
     * Extract email data from the compose window
     */
    extractEmailData() {
      const toSelectors = [
        'span[email]',
        '.vR span[email]',
        '.aoD .vR span[email]',
        '.vR .vN',
        '.aoD .vR',
        '.aoD span[email]',
        'div[aria-label*="To"] span[email]',
        'div[aria-label*="To"] .vR',
        '.vR span[title*="@"]',
        '.vR .go span[title*="@"]',
        '[jslog*="compose"] span[email]',
        'div[data-tooltip*="@"]',
        '[data-hovercard-id*="@"]',
        'span[email]',
        '.vR span[email]',
        '.vR .vN',
        '.aoD .vR',
        '.aoD span[email]',
        '.vR span[title*="@"]',
        '.vR .go span[title*="@"]',
        'div[aria-label*="To"] span[email]',
        'div[aria-label*="To"] .vR',
        '[jslog*="compose"] span[email]',
        'div[data-tooltip*="@"]'
      ];
      
      const subjectSelectors = [
        'input[name="subjectbox"]',
        'input[aria-label*="Subject"]',
        'input[placeholder*="Subject"]',
        '.aoT input',
        'div[aria-label*="Subject"] input'
      ];
      
      const contentSelectors = [
        'div[contenteditable="true"][aria-label*="Message Body"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"].Am',
        'div[contenteditable="true"]',
        '[role="textbox"]'
      ];
      
      let recipientEmail = '';
      let subject = '';
      let content = '';
      
      // Enhanced TO field extraction
      for (const selector of toSelectors) {
        const elements = this.composeElement.querySelectorAll(selector);
        
        for (const element of elements) {
          const emailText = element.getAttribute('email') || 
                           element.getAttribute('title') || 
                           element.getAttribute('data-tooltip') ||
                           element.textContent || 
                           element.value || '';
          
          // Check if it's a valid email
          if (emailText && emailText.includes('@') && !emailText.includes('To')) {
            recipientEmail = emailText.trim();
            break;
          }
        }
        if (recipientEmail) break;
      }
      
      // If still no email found, try alternative method
      if (!recipientEmail || recipientEmail === 'To') {
        const toContainer = this.composeElement.querySelector('.aoD, div[aria-label*="To"]');
        if (toContainer) {
          const emailSpans = toContainer.querySelectorAll('span');
          
          for (const span of emailSpans) {
            const text = span.textContent || span.getAttribute('title') || '';
            if (text.includes('@') && !text.includes('To')) {
              recipientEmail = text.trim();
              break;
            }
          }
        }
      }
      
      // Subject field extraction
      for (const selector of subjectSelectors) {
        const element = this.composeElement.querySelector(selector);
        if (element) {
          subject = element.value || element.textContent || element.innerText || '';
          if (subject.trim()) break;
        }
      }
      
      // Content field extraction
      for (const selector of contentSelectors) {
        const element = this.composeElement.querySelector(selector);
        if (element) {
          content = element.innerText || element.textContent || '';
          if (content.trim()) break;
        }
      }
      
      const emailData = {
        recipient: recipientEmail || 'Unknown Recipient',
        subject: subject || 'No Subject',
        content: content || ''
      };
      
      return emailData;
    }

    /**
     * Process billable entry - Call backend API only
     */
    async processBillableEntry(emailData, timeSpent) {
      try {
        console.log('📤 Calling backend API to process billable entry...');
        
        // Validate email data
        if (!emailData || !emailData.recipient) {
          console.error('❌ Invalid email data:', emailData);
          throw new Error('Invalid email data - recipient is required');
        }

        // Get Clio access token if available
        const storage = await chrome.storage.local.get(['clioAccessToken']);
        const clioAccessToken = storage.clioAccessToken || null;

        // Prepare API request data
        const requestData = {
          emailData: emailData,
          timeSpent: parseFloat(timeSpent)
        };

        // Add Clio token if available
        if (clioAccessToken) {
          requestData.clioAccessToken = clioAccessToken;
        }

        console.log('📝 Sending data to backend:', requestData);

        // Call backend API
        const response = await fetch('http://localhost:3000/api/process-billable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });

        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success) {
          console.log('✅ Backend processed entry successfully:', result);
          
          return {
            success: true,
            entryId: result.entryId,
            billableEntry: {
              client: result.client,
              summary: result.summary,
              timeSpent: result.timeSpent
            },
            clioSync: result.clioSync || { success: false },
            platform: result.platform || 'Backend API'
          };
        } else {
          throw new Error(result.error || 'Backend processing failed');
        }
        
      } catch (error) {
        console.error('❌ API call failed:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    /**
     * Test backend connection
     */
    async testBackendConnection() {
      try {
        console.log('🔗 Testing backend connection...');
        
        const response = await fetch('http://localhost:3000/api/health');
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Backend connection successful:', data);
          
          this.showNotification(
            '✅ Backend Connected', 
            'API connection test successful', 
            'success'
          );
          
          return { success: true, data };
        } else {
          throw new Error(`API not responding: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Backend connection failed:', error);
        
        this.showNotification(
          '❌ Connection Failed', 
          `Backend API unavailable: ${error.message}`, 
          'error'
        );
        
        return { success: false, error: error.message };
      }
    }

   
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    addBillableIndicator() {
      const indicator = document.createElement('div');
      indicator.id = this.id;
      indicator.className = 'billable-tracker-indicator';
      indicator.innerHTML = `
        <div class="billable-header">
          <div class="billable-top-section">
            <div class="billable-icon-container">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
              </svg>
            </div>
            <div class="billable-info">
              <span class="billable-title">BillSync</span>
              <span class="billable-status">Paused</span>
            </div>
          </div>
          <div class="billable-time-display">
            <span class="billable-time">0:00:00</span>
          </div>
        </div>
      `;
      
      document.body.appendChild(indicator);
      this.updatePosition();
      this.attachDragListeners(indicator);


    }

    updatePosition() {
      const indicator = document.getElementById(this.id);
      if (indicator) {
        // Check if custom position is stored
        const storedPosition = localStorage.getItem(`billable-position-${this.id}`);
        if (storedPosition) {
          const { right, bottom } = JSON.parse(storedPosition);
          indicator.style.right = `${right}px`;
          indicator.style.bottom = `${bottom}px`;
        } else {
          const bottomOffset = 15 + (this.uiIndex * 60);
          indicator.style.bottom = `${bottomOffset}px`;
          indicator.style.right = '20px';
        }
      }
    }

    attachDragListeners(indicator) {
      let isDragging = false;
      let hasMovedWhileDragging = false;
      let dragOffset = { x: 0, y: 0 };
      this.isDragging = false;

      const header = indicator.querySelector('.billable-header');
      header.style.cursor = 'pointer';

      header.addEventListener('mousedown', (e) => {
        
        isDragging = true;
        hasMovedWhileDragging = false;
        header.style.cursor = 'grabbing';
        indicator.classList.add('dragging');
        indicator.style.transition = 'none';
        
        const rect = indicator.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        hasMovedWhileDragging = true;
        this.isDragging = true;
        
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - indicator.offsetWidth;
        const maxY = window.innerHeight - indicator.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        // Convert to right/bottom positioning
        const right = window.innerWidth - constrainedX - indicator.offsetWidth;
        const bottom = window.innerHeight - constrainedY - indicator.offsetHeight;
        
        indicator.style.right = `${right}px`;
        indicator.style.bottom = `${bottom}px`;
        indicator.style.left = 'auto';
        indicator.style.top = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          
          setTimeout(() => {
            this.isDragging = hasMovedWhileDragging;
            setTimeout(() => {
              this.isDragging = false;
            }, 150);
          }, 50);
          
          header.style.cursor = 'pointer';
          indicator.classList.remove('dragging');
          indicator.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          
          // Save position to localStorage only if actually moved
          if (hasMovedWhileDragging) {
            const right = parseInt(indicator.style.right);
            const bottom = parseInt(indicator.style.bottom);
            localStorage.setItem(`billable-position-${this.id}`, 
              JSON.stringify({ right, bottom }));
          }
        }
      });

      // Show drag hint on hover
      header.addEventListener('mouseenter', () => {
        if (!isDragging) {
          header.style.cursor = 'grab';
        }
      });

      header.addEventListener('mouseleave', () => {
        if (!isDragging) {
          header.style.cursor = 'pointer';
        }
      });
    }



    updateBillableIndicator() {
      const indicator = document.getElementById(this.id);
      if (indicator) {
        const timeDisplay = indicator.querySelector('.billable-time');
        const statusDisplay = indicator.querySelector('.billable-status');
        
        const timeData = this.getTimeFormatted();
        
        if(timeDisplay) timeDisplay.textContent = timeData.formatted;
        if(statusDisplay) {
          if (this.isTracking) {
            statusDisplay.textContent = 'Active';
          } else {
            statusDisplay.innerHTML = 'Paused <small>(click to resume)</small>';
          }
        }

        indicator.classList.toggle('tracking-active', this.isTracking);
        
        // Add click-to-resume functionality when paused
        if (!this.isTracking && !indicator.hasAttribute('data-resume-listener')) {
          indicator.setAttribute('data-resume-listener', 'true');
          indicator.addEventListener('click', () => {
            if (!this.isTracking) {
              this.startTracking();
              this.showNotification('▶️ Tracking Resumed', 'Manual resume - tracking is now active', 'success');
            }
          });
        } else if (this.isTracking && indicator.hasAttribute('data-resume-listener')) {
          // Remove the resume listener when tracking is active
          indicator.removeAttribute('data-resume-listener');
        }
      }
    }

    startDisplayUpdates() {
      if (this.displayUpdateTimer) clearInterval(this.displayUpdateTimer);
      this.displayUpdateTimer = setInterval(() => {
        // Check if compose window is still valid before updating
        if (this.isComposeWindowValid()) {
          this.updateBillableIndicator();
        } else {
          console.log('🗑️ Compose window invalid during display update, destroying tracker');
          this.destroyTracker();
        }
      }, 1000);
    }

    // Success notification removed - simple tracking only

    showErrorNotification(error) {
        this.showNotification('❌ Error Logging Billable', error, 'error');
    }

    showNotification(title, details, type) {
        // Remove any existing notifications first
        this.hideAllNotifications();
        
        const notification = document.createElement('div');
        notification.className = `billable-notification ${type}`;
        notification.id = `billable-notification-${this.id}`;
        notification.innerHTML = `
          <div class="notification-title">${title}</div>
          <div class="notification-details">${details}</div>
        `;
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds unless it's an error (keep longer)
        const timeout = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, timeout);
    }

    /**
     * Hides all notifications for this tracker
     */
    hideAllNotifications() {
      // Remove notifications by class
      const notifications = document.querySelectorAll('.billable-notification');
      notifications.forEach(notification => {
        if (notification.parentNode) {
          notification.remove();
        }
      });
      
      // Also remove any processing notifications
      const processingNotifications = document.querySelectorAll(`#billable-notification-${this.id}`);
      processingNotifications.forEach(notification => {
        if (notification.parentNode) {
          notification.remove();
        }
      });
    }

    show30SecondWarning() {
      // Check if compose window is still valid before showing warning
      if (!this.isComposeWindowValid()) {
        console.log('🗑️ Compose window invalid during 30s warning, destroying tracker');
        this.destroyTracker();
        return;
      }

      // Add warning indicator to the tracker UI
      const indicator = document.getElementById(this.id);
      if (indicator) {
        indicator.classList.add('warning-30s');
        
        // Add warning icon
        const statusDisplay = indicator.querySelector('.billable-status');
        if (statusDisplay) {
          statusDisplay.innerHTML = '⚠️ 30s warning';
        }
      }

      // Show warning notification
      this.showNotification(
        '⚠️ 30 Second Warning', 
        'You have been inactive for 30 seconds. Move your mouse or type to continue tracking.', 
        'warning'
      );
    }

    show45SecondWarning() {
      // Check if compose window is still valid before showing warning
      if (!this.isComposeWindowValid()) {
        console.log('🗑️ Compose window invalid during 45s warning, destroying tracker');
        this.destroyTracker();
        return;
      }

      // Add warning indicator to the tracker UI
      const indicator = document.getElementById(this.id);
      if (indicator) {
        indicator.classList.remove('warning-30s');
        indicator.classList.add('warning-45s');
        
        // Add warning icon
        const statusDisplay = indicator.querySelector('.billable-status');
        if (statusDisplay) {
          statusDisplay.innerHTML = '⚠️ 45s warning - pausing soon';
        }
      }

      // Show warning notification
      this.showNotification(
        '⚠️ 45 Second Warning', 
        'Auto-pause in 15 seconds due to inactivity. Move your mouse or type to continue tracking.', 
        'warning'
      );
    }

    showInactivityWarning() {
        // This method is kept for compatibility but now handled by specific warning methods
    }

    hideInactivityWarning() {
        const indicator = document.getElementById(this.id);
        if (indicator) {
            indicator.classList.remove('inactivity-warning');
            indicator.classList.remove('warning-30s');
            indicator.classList.remove('warning-45s');
            // Restore normal status display
            this.updateBillableIndicator();
        }
    }
    
    destroy() {
      // Clear timers
      clearInterval(this.displayUpdateTimer);
      clearTimeout(this.inactivityTimer);
      clearTimeout(this.warning30Timer);
      clearTimeout(this.warning45Timer);
      
      // Remove global event listeners
      if (this.globalActivityHandler) {
        document.removeEventListener('keydown', this.globalActivityHandler);
        document.removeEventListener('click', this.globalActivityHandler);
      }
      
      // Remove UI elements
      const indicator = document.getElementById(this.id);
      if (indicator) indicator.remove();
      
      // Clean up stored position
      localStorage.removeItem(`billable-position-${this.id}`);
      
      this.composeElement.removeAttribute('data-billable-tracked');
      this.manager.notifyTrackerDestroyed();
    }
  }

  class GmailBillableTracker {
    constructor() {
      this.trackedComposeWindows = new Map();
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.waitForGmail());
      } else {
        this.waitForGmail();
      }
      this.injectStyles();
    }

    waitForGmail() {
      const checkGmail = () => {
        if (document.querySelector('[role="main"]')) {
          this.setupObserver();
          this.scanForExistingCompose();
        } else {
          setTimeout(checkGmail, 500);
        }
      };
      checkGmail();
    }

    setupObserver() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // Handle added nodes - track new compose windows
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) this.findAndTrackCompose(node);
          });
          
          // Handle removed nodes - cleanup trackers for removed compose windows
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Check if the removed node itself was tracked
              if (node.hasAttribute && node.hasAttribute('data-billable-tracked')) {
                console.log('🗑️ Tracked compose window removed from DOM:', node.getAttribute('data-billable-tracked'));
                this.untrackComposeWindow(node);
              }
              
              // Check for tracked compose windows inside the removed node
              if (node.querySelectorAll) {
                node.querySelectorAll('[data-billable-tracked]').forEach(el => {
                  console.log('🗑️ Child tracked compose window removed from DOM:', el.getAttribute('data-billable-tracked'));
                  this.untrackComposeWindow(el);
                });
              }
            }
          });
        });
      });
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      console.log('👁️ DOM mutation observer setup for compose window cleanup');
    }

    scanForExistingCompose() {
      this.findAndTrackCompose(document.body);
    }

    findAndTrackCompose(element) {
      // Find compose dialogs that are not yet tracked
      const composeSelector = 'div[role="dialog"]';
      const candidates = element.matches(composeSelector) ? [element] : element.querySelectorAll(composeSelector);
      
      candidates.forEach(el => {
        if (!el.hasAttribute('data-billable-tracked') && !el.closest('[data-billable-tracked]') && this.isComposeWindow(el)) {
          this.trackComposeWindow(el);
        }
      });
    }

    isComposeWindow(element) {
      const composeSelectors = [
        'div[contenteditable="true"]',
        '[role="textbox"]',
        '[aria-label*="Message Body"]',
        'textarea[name="to"]'
      ];
      
      const sendButtonSelectors = [
        '[role="button"][data-tooltip*="Send"]',
        '[aria-label*="Send"]',
        '[role="button"][aria-label*="Send"]',
        'div[data-tooltip*="Send"]',
        'button[aria-label*="Send"]'
      ];
      
      let hasComposeArea = false;
      let hasSendButton = false;
      
      // Check for compose area
      for (const selector of composeSelectors) {
        if (element.querySelector(selector)) {
          hasComposeArea = true;
          break;
        }
      }
      
      // Check for send button
      for (const selector of sendButtonSelectors) {
        if (element.querySelector(selector)) {
          hasSendButton = true;
          break;
        }
      }
      
      return hasComposeArea && hasSendButton;
    }

    trackComposeWindow(composeEl) {
      if (this.trackedComposeWindows.has(composeEl)) return;
      
      const tracker = new ComposeTracker(composeEl, this, this.trackedComposeWindows.size);
      this.trackedComposeWindows.set(composeEl, tracker);
    }

    untrackComposeWindow(composeEl) {
      if (this.trackedComposeWindows.has(composeEl)) {
        const tracker = this.trackedComposeWindows.get(composeEl);
        tracker.destroy();
        this.trackedComposeWindows.delete(composeEl);
      }
    }

    notifyTrackerDestroyed() {
      this.updateTrackerPositions();
    }

    updateTrackerPositions() {
      let index = 0;
      this.trackedComposeWindows.forEach(tracker => {
        tracker.uiIndex = index++;
        tracker.updatePosition();
      });
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .billable-tracker-indicator {
          position: fixed;
          right: 20px;
          z-index: 10000;
          background: rgba(255, 255, 255, 0.95);
          border: none;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          font-family: 'Google Sans', Roboto, sans-serif;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: #3c4043;
          user-select: none;
          min-width: 120px;
          overflow: hidden;
          opacity: 0.7;
        }
        .billable-tracker-indicator:hover {
          opacity: 1;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          transform: translateY(-2px) scale(1.02);
          background: rgba(255, 255, 255, 0.98);
        }
        .billable-tracker-indicator.tracking-active {
          opacity: 1;
          background: linear-gradient(135deg, rgba(26, 115, 232, 0.05) 0%, rgba(255, 255, 255, 0.95) 100%);
          box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2), 0 4px 16px rgba(26, 115, 232, 0.15);
        }
        .billable-tracker-indicator.inactivity-warning {
          opacity: 1;
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 255, 255, 0.95) 100%);
          box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3), 0 4px 16px rgba(255, 193, 7, 0.2);
          animation: warningPulse 2s infinite;
        }
        .billable-tracker-indicator.warning-30s {
          opacity: 1;
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 255, 255, 0.95) 100%);
          box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3), 0 4px 16px rgba(255, 193, 7, 0.2);
          animation: warningPulse 2s infinite;
        }
        .billable-tracker-indicator.warning-45s {
          opacity: 1;
          background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 255, 255, 0.95) 100%);
          box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.3), 0 4px 16px rgba(255, 193, 7, 0.2);
          animation: warningPulse 2s infinite;
        }
        @keyframes warningPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .billable-tracker-indicator:not(.expanded) {
          height: 50px;
          width: 120px;
        }

        .billable-tracker-indicator .billable-header {
          display: flex;
          flex-direction: column;
          padding: 8px 12px 4px 12px;
          position: relative;
        }
        .billable-tracker-indicator .billable-header::before {
          content: '';
          position: absolute;
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 2px;
          background: rgba(154, 160, 166, 0.3);
          border-radius: 1px;
          transition: all 0.2s ease;
          opacity: 0;
        }
        .billable-tracker-indicator .billable-header:hover::before {
          opacity: 1;
          background: rgba(154, 160, 166, 0.6);
          width: 20px;
        }
        .billable-tracker-indicator.dragging .billable-header::before {
          opacity: 1;
          background: rgba(26, 115, 232, 0.8);
          width: 24px;
        }
        .billable-tracker-indicator .billable-top-section {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .billable-tracker-indicator .billable-icon-container {
          color: #9aa0a6;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: transparent;
          transition: all 0.2s ease;
          position: relative;
        }
        .billable-tracker-indicator .billable-icon-container::before {
          content: '';
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9aa0a6;
          top: -2px;
          right: -2px;
          transition: all 0.2s ease;
          opacity: 0;
        }
        .billable-tracker-indicator.tracking-active .billable-icon-container {
          color: #1a73e8;
        }
        .billable-tracker-indicator.tracking-active .billable-icon-container::before {
          background: #1a73e8;
          opacity: 1;
          box-shadow: 0 0 6px rgba(26, 115, 232, 0.4);
        }
        .billable-tracker-indicator.warning-30s .billable-icon-container {
          color: #ff9800;
        }
        .billable-tracker-indicator.warning-30s .billable-icon-container::before {
          background: #ff9800;
          opacity: 1;
          box-shadow: 0 0 6px rgba(255, 152, 0, 0.4);
        }
        .billable-tracker-indicator.warning-45s .billable-icon-container {
          color: #ff9800;
        }
        .billable-tracker-indicator.warning-45s .billable-icon-container::before {
          background: #ff9800;
          opacity: 1;
          box-shadow: 0 0 6px rgba(255, 152, 0, 0.4);
        }
        .billable-tracker-indicator .billable-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
        }
        .billable-tracker-indicator .billable-title {
          font-weight: 600;
          font-size: 11px;
          color: #5f6368;
          letter-spacing: 0.3px;
        }
        .billable-tracker-indicator .billable-status {
          font-size: 8px;
          font-weight: 500;
          color: #9aa0a6;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .billable-tracker-indicator.tracking-active .billable-title {
          color: #1967d2;
        }
        .billable-tracker-indicator.tracking-active .billable-status {
          color: #1967d2;
        }
        .billable-tracker-indicator.warning-30s .billable-title {
          color: #ff9800;
        }
        .billable-tracker-indicator.warning-30s .billable-status {
          color: #ff9800;
        }
        .billable-tracker-indicator.warning-45s .billable-title {
          color: #ff9800;
        }
        .billable-tracker-indicator.warning-45s .billable-status {
          color: #ff9800;
        }
        .billable-tracker-indicator .billable-expand-btn {
          color: #dadce0;
          flex-shrink: 0;
          padding: 2px;
          border-radius: 50%;
          transition: all 0.2s ease;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .billable-tracker-indicator:hover .billable-expand-btn {
          color: #9aa0a6;
          background: rgba(241, 243, 244, 0.5);
        }
        .billable-tracker-indicator .billable-expand-btn svg {
          transition: transform 0.2s ease;
          width: 10px;
          height: 10px;
        }
        .billable-tracker-indicator .billable-time-display {
          padding: 4px 12px 8px 12px;
          text-align: center;
          background: transparent;
        }
        .billable-tracker-indicator:not(.expanded) .billable-time-display {
          padding: 0px 12px 4px 12px;
        }
        .billable-tracker-indicator .billable-time {
          font-size: 13px;
          font-weight: 600;
          color: #9aa0a6;
          font-family: 'Google Sans', monospace;
          letter-spacing: 0.5px;
        }
        .billable-tracker-indicator.tracking-active .billable-time {
          color: #1967d2;
          font-weight: 700;
        }
        .billable-tracker-indicator.expanded .billable-time {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 1px;
        }


        .billable-notification {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 10000;
          background: #323232;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: Roboto, sans-serif;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .billable-notification.error {
          background: #d93025;
        }
        .billable-notification.warning {
          background: #ff9800;
          color: white;
        }
        .billable-notification.info {
          background: #1a73e8;
          color: white;
        }
        .billable-notification.success {
          background: #34a853;
          color: white;
        }
        .billable-notification .notification-title {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .billable-notification .notification-details {
          opacity: 0.9;
          font-size: 13px;
        }
        .billable-success-notification {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 10000;
          background: #323232;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: Roboto, sans-serif;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 350px;
          opacity: 0.9;
          transition: opacity 0.3s ease-in-out;
        }
        .billable-success-notification:hover {
          opacity: 1;
        }
        .billable-success-notification .notification-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .billable-success-notification .notification-icon {
          font-size: 20px;
          color: #4CAF50; /* A green color for success */
        }
        .billable-success-notification .notification-text {
          flex: 1;
          font-size: 13px;
          color: #e0e0e0;
        }
        .billable-success-notification .notification-text strong {
          color: #81C784; /* A slightly darker green for emphasis */
        }
        .billable-success-notification .notification-text br {
          display: none; /* Hide line breaks in the text */
        }
        .billable-success-notification .notification-close {
          background: none;
          border: none;
          color: #81C784;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: color 0.2s ease;
        }
        .billable-success-notification .notification-close:hover {
          color: #66BB6A; /* A slightly darker green on hover */
        }
        .billable-success-notification.fade-out {
          opacity: 0;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Initialize the Gmail Billable Tracker
  window.gmailBillableTracker = new GmailBillableTracker();
  
  // Backend API testing function
  window.testBillableBackend = async function() {
    console.log('🔗 Testing backend API connection...');
    
    try {
      const response = await fetch('http://localhost:3000/api/health');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend API is working:', data);
        return { success: true, message: 'Backend API connected successfully', data };
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Backend API test failed:', error);
      return { success: false, message: error.message };
    }
  };
  
  // Helper function to check tracker status
  window.testTracker = function() {
    const tracker = window.gmailBillableTracker;
    const activeTrackers = tracker.trackedComposeWindows.size;
    
    console.log('📊 Gmail Tracker Status:');
    console.log('Active trackers:', activeTrackers);
    console.log('🚀 Mode: Backend API only');
    console.log('✅ API endpoint: http://localhost:3000/api/process-billable');
    
    if (activeTrackers > 0) {
      const trackerDetails = Array.from(tracker.trackedComposeWindows.values()).map((t, i) => ({
        index: i + 1,
        id: t.id,
        isTracking: t.isTracking,
        totalTime: t.totalTime
      }));
      console.log('Tracker details:', trackerDetails);
    } else {
      console.log('⚠️ No active compose windows. Open a Gmail compose window to start tracking.');
    }
    
    return { activeTrackers, mode: 'backend_api_only' };
  };
  
  console.log('🚀 Gmail Billable Tracker loaded successfully!');
  console.log('🚀 Extension Mode: BACKEND API ONLY');
  console.log('✅ API endpoint: http://localhost:3000/api/process-billable');
  console.log('💡 Test backend: testBillableBackend()');
  console.log('💡 Check tracker: testTracker()');
})(); // End of IIFE