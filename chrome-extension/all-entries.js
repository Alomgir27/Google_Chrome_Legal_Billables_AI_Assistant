class AllEntriesPage {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/api';
    this.entries = [];
    this.filteredEntries = [];
    this.currentPage = 1;
    this.entriesPerPage = 20;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadAllEntries();
    await this.loadTodaysStats();
  }

  setupEventListeners() {
    document.getElementById('search-box').addEventListener('input', (e) => {
      this.filterEntries();
    });

    document.getElementById('client-filter').addEventListener('change', (e) => {
      this.filterEntries();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshEntries();
    });

    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportData();
    });

    // Back button event listener
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.close();
      });
    }
  }

  async loadAllEntries() {
    try {
      console.log('📋 Loading all entries from backend...');
      const response = await fetch(`${this.apiBaseUrl}/billables`);
      const data = await response.json();

      if (data.success) {
        this.entries = data.entries;
        this.filteredEntries = [...this.entries];
        this.populateClientFilter();
        this.updateStats();
        this.renderEntries();
        console.log(`✅ Loaded ${data.entries.length} entries successfully`);
      } else {
        this.showError(`Backend Error: ${data.error || 'Failed to load entries'}`);
      }
    } catch (error) {
      console.error('❌ Failed to load entries:', error);
      
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        this.showError('Cannot connect to backend server. Make sure the server is running on localhost:3000.');
      } else if (error.message.includes('JSON')) {
        this.showError('Invalid response from backend server. Check server logs for details.');
      } else {
        this.showError(`Connection Error: ${error.message}`);
      }
    }
  }

  async loadTodaysStats() {
    try {
      console.log('📊 Loading today\'s statistics...');
      const response = await fetch(`${this.apiBaseUrl}/stats`);
      const data = await response.json();

      if (data.success) {
        this.updateTodaysStats(data.stats);
        console.log('✅ Today\'s stats loaded successfully:', data.stats);
      } else {
        console.error('❌ Failed to load today\'s stats:', data.error);
        // Set default stats on error
        this.updateTodaysStats({
          emailsLogged: 0,
          timeTracked: 0,
          revenue: 0,
          uniqueClients: 0
        });
      }
    } catch (error) {
      console.error('❌ Failed to load today\'s stats:', error);
      // Set default stats on connection error
      this.updateTodaysStats({
        emailsLogged: 0,
        timeTracked: 0,
        revenue: 0,
        uniqueClients: 0
      });
    }
  }

  updateTodaysStats(stats) {
    // Update today's summary section
    const summaryElements = {
      emailsLogged: document.querySelector('.summary-stat:nth-child(1) .stat-value'),
      timeTracked: document.querySelector('.summary-stat:nth-child(2) .stat-value'),
      revenue: document.querySelector('.summary-stat:nth-child(3) .stat-value'),
      uniqueClients: document.querySelector('.summary-stat:nth-child(4) .stat-value')
    };

    if (summaryElements.emailsLogged) {
      summaryElements.emailsLogged.textContent = stats.emailsLogged || 0;
    }
    if (summaryElements.timeTracked) {
      summaryElements.timeTracked.textContent = `${stats.timeTracked || 0}h`;
    }
    if (summaryElements.revenue) {
      summaryElements.revenue.textContent = `$${stats.revenue || 0}`;
    }
    if (summaryElements.uniqueClients) {
      summaryElements.uniqueClients.textContent = stats.uniqueClients || 0;
    }

    console.log('✅ Today\'s stats updated:', stats);
  }

  populateClientFilter() {
    const clients = [...new Set(this.entries.map(entry => entry.client))].sort();
    const clientFilter = document.getElementById('client-filter');
    
    clientFilter.innerHTML = '<option value="">All Clients</option>';
    
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client;
      option.textContent = client;
      clientFilter.appendChild(option);
    });
  }

  filterEntries() {
    const searchTerm = document.getElementById('search-box').value.toLowerCase();
    const selectedClient = document.getElementById('client-filter').value;

    this.filteredEntries = this.entries.filter(entry => {
      const matchesSearch = !searchTerm || 
        entry.summary.toLowerCase().includes(searchTerm) ||
        entry.client.toLowerCase().includes(searchTerm);
      
      const matchesClient = !selectedClient || entry.client === selectedClient;

      return matchesSearch && matchesClient;
    });

    this.currentPage = 1;
    this.updateStats();
    this.renderEntries();
  }

  updateStats() {
    const totalEntries = this.filteredEntries.length;
    const totalTime = this.filteredEntries.reduce((sum, entry) => sum + (parseFloat(entry.timeSpent) || 0), 0);
    const totalRevenue = totalTime * 200;
    const uniqueClients = new Set(this.filteredEntries.map(entry => entry.client)).size;

    document.getElementById('total-entries').textContent = totalEntries;
    document.getElementById('total-time').textContent = `${totalTime.toFixed(1)}h`;
    document.getElementById('total-revenue').textContent = `$${totalRevenue.toFixed(0)}`;
    document.getElementById('unique-clients').textContent = uniqueClients;
  }

  renderEntries() {
    const entriesList = document.getElementById('entries-list');
    
    if (this.filteredEntries.length === 0) {
      entriesList.innerHTML = `
        <div class="empty-state">
          <h3>No entries found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }

    const startIndex = (this.currentPage - 1) * this.entriesPerPage;
    const endIndex = startIndex + this.entriesPerPage;
    const pageEntries = this.filteredEntries.slice(startIndex, endIndex);

    entriesList.innerHTML = pageEntries.map(entry => `
      <div class="entry-row">
        <div class="entry-time">
          ${this.formatDate(entry.timestamp)}<br>
          <small>${this.formatTime(entry.timestamp)}</small>
        </div>
        <div class="entry-summary">${entry.summary}</div>
        <div class="entry-client">${entry.client}</div>
        <div class="entry-duration">${entry.timeSpent}h</div>
        <div class="entry-actions">
          <button class="action-btn view-btn" data-entry-id="${entry.id}">View</button>
          <button class="action-btn edit-btn" data-entry-id="${entry.id}">Edit</button>
        </div>
      </div>
    `).join('');

    this.attachActionListeners();
    this.renderPagination();
  }

  attachActionListeners() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const entryId = e.target.getAttribute('data-entry-id');
        this.viewEntry(entryId);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const entryId = e.target.getAttribute('data-entry-id');
        this.editEntry(entryId);
      });
    });
  }

  renderPagination() {
    const totalPages = Math.ceil(this.filteredEntries.length / this.entriesPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
      pagination.style.display = 'none';
      return;
    }

    pagination.style.display = 'block';
    
    let paginationHTML = '';
    
    paginationHTML += `<button class="prev-btn" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        paginationHTML += '<span>...</span>';
      }
    }
    
    paginationHTML += `<button class="next-btn" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
    
    pagination.innerHTML = paginationHTML;

    this.attachPaginationListeners();
  }

  attachPaginationListeners() {
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.goToPage(this.currentPage - 1);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.filteredEntries.length / this.entriesPerPage);
        if (this.currentPage < totalPages) {
          this.goToPage(this.currentPage + 1);
        }
      });
    }

    document.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.getAttribute('data-page'));
        this.goToPage(page);
      });
    });
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderEntries();
  }

  async refreshEntries() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.textContent = '⟳ Refreshing...';
    refreshBtn.disabled = true;

    await this.loadAllEntries();
    await this.loadTodaysStats();

    refreshBtn.textContent = '🔄 Refresh';
    refreshBtn.disabled = false;
  }

  async exportData() {
    try {
      const jsonData = JSON.stringify(this.filteredEntries, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `billables-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully');
    } catch (error) {
      this.showNotification('Export failed', 'error');
    }
  }

  viewEntry(entryId) {
    const entry = this.entries.find(e => e.id === entryId);
    if (entry) {
      alert(`Entry Details:\n\nClient: ${entry.client}\nTime: ${entry.timeSpent}h\nDate: ${this.formatDate(entry.timestamp)}\n\nSummary: ${entry.summary}\n\nEmail Content: ${entry.emailData?.content || 'N/A'}`);
    }
  }

  editEntry(entryId) {
    alert('Edit functionality would be implemented here');
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  showError(message) {
    document.getElementById('entries-list').innerHTML = `
      <div class="empty-state">
        <h3>Error</h3>
        <p>${message}</p>
      </div>
    `;
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      background: ${type === 'error' ? '#f44336' : '#4caf50'};
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.allEntriesPage = new AllEntriesPage();
}); 