const fs = require('fs').promises;
const path = require('path');

class LocalStorageService {
  constructor() {
    this.billablesDir = path.join(process.cwd(), 'data', 'billables');
    this.ensureDirectoryExists();
  }

  async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.billablesDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('❌ Failed to create billables directory:', error);
      }
    }
  }

  // Save billable entry to local JSON file
  async saveBillableEntry(billableEntry) {
    try {
      await this.ensureDirectoryExists();
      
      const timestamp = Date.now();
      const filename = `billable_${timestamp}.json`;
      const filepath = path.join(this.billablesDir, filename);
      
      const entryData = {
        id: timestamp,
        ...billableEntry,
        createdAt: new Date().toISOString(),
        source: 'chrome-extension'
      };
      
      await fs.writeFile(filepath, JSON.stringify(entryData, null, 2));
      
      console.log('💾 Billable entry saved locally:', filename);
      
      return {
        success: true,
        entryId: timestamp,
        filepath: filepath
      };
    } catch (error) {
      console.error('❌ Failed to save billable entry:', error);
      throw error;
    }
  }

  // Get all billable entries
  async getAllBillableEntries() {
    try {
      await this.ensureDirectoryExists();
      
      const files = await fs.readdir(this.billablesDir);
      const billableFiles = files.filter(file => file.startsWith('billable_') && file.endsWith('.json'));
      
      const entries = [];
      
      for (const file of billableFiles) {
        try {
          const filepath = path.join(this.billablesDir, file);
          const content = await fs.readFile(filepath, 'utf8');
          const entry = JSON.parse(content);
          entries.push(entry);
        } catch (error) {
          console.error(`❌ Failed to read billable file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.id - a.id);
      
      return entries;
    } catch (error) {
      console.error('❌ Failed to get billable entries:', error);
      return [];
    }
  }

  // Get billable entry by ID
  async getBillableEntry(entryId) {
    try {
      const filename = `billable_${entryId}.json`;
      const filepath = path.join(this.billablesDir, filename);
      
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to get billable entry ${entryId}:`, error);
      return null;
    }
  }

  // Delete billable entry
  async deleteBillableEntry(entryId) {
    try {
      const filename = `billable_${entryId}.json`;
      const filepath = path.join(this.billablesDir, filename);
      
      await fs.unlink(filepath);
      
      console.log('🗑️ Billable entry deleted:', entryId);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to delete billable entry ${entryId}:`, error);
      throw error;
    }
  }

  // Get today's daily statistics
  async getDailyStats() {
    try {
      const entries = await this.getAllBillableEntries();
      
      const today = new Date().toDateString();
      const todayEntries = entries.filter(entry => 
        new Date(entry.createdAt).toDateString() === today
      );
      
      const totalTimeToday = todayEntries.reduce((sum, entry) => 
        sum + (parseFloat(entry.timeSpent) || 0), 0
      );
      
      const uniqueClients = [...new Set(todayEntries.map(entry => entry.client))];
      
      // Estimate revenue (assuming $200/hour default rate)
      const hourlyRate = 200;
      const estimatedRevenue = totalTimeToday * hourlyRate;
      
      return {
        emailsLogged: todayEntries.length,
        timeTracked: parseFloat(totalTimeToday.toFixed(2)),
        revenue: estimatedRevenue,
        uniqueClients: uniqueClients.length,
        entries: todayEntries
      };
    } catch (error) {
      console.error('❌ Failed to get daily stats:', error);
      return {
        emailsLogged: 0,
        timeTracked: 0,
        revenue: 0,
        uniqueClients: 0,
        entries: []
      };
    }
  }

  // Get summary statistics
  async getSummaryStats() {
    try {
      const entries = await this.getAllBillableEntries();
      
      const today = new Date().toDateString();
      const todayEntries = entries.filter(entry => 
        new Date(entry.createdAt).toDateString() === today
      );
      
      const totalTimeToday = todayEntries.reduce((sum, entry) => 
        sum + (parseFloat(entry.timeSpent) || 0), 0
      );
      
      return {
        totalEntries: entries.length,
        todayEntries: todayEntries.length,
        totalTimeToday: totalTimeToday
      };
    } catch (error) {
      console.error('❌ Failed to get summary stats:', error);
      return {
        totalEntries: 0,
        todayEntries: 0,
        totalTimeToday: 0
      };
    }
  }
}

module.exports = LocalStorageService; 