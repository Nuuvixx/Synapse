/**
 * Session Store
 * 
 * Manages browsing sessions:
 * - Create, read, update, delete sessions
 * - Track current session
 * - Handle session metadata
 */

export class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.currentSessionId = null;
    this.windows = new Map();
  }

  // Initialize from storage
  async initialize() {
    const result = await chrome.storage.local.get([
      'ariadne_sessions',
      'ariadne_current_session',
      'ariadne_windows'
    ]);

    this.sessions = new Map(result.ariadne_sessions || []);
    this.currentSessionId = result.ariadne_current_session || null;
    this.windows = new Map(result.ariadne_windows || []);

    // Create default session if none exists
    if (this.sessions.size === 0) {
      await this.createSession('Default Session');
    }

    console.log('[SessionStore] Initialized with', this.sessions.size, 'sessions');
  }

  // Persist to storage
  async saveToStorage() {
    await chrome.storage.local.set({
      'ariadne_sessions': Array.from(this.sessions.entries()),
      'ariadne_current_session': this.currentSessionId,
      'ariadne_windows': Array.from(this.windows.entries())
    });
  }

  // Create a new session
  async createSession(name, createdAt = null) {
    const sessionId = `session-${Date.now()}`;
    const session = {
      id: sessionId,
      name: name || `Session ${this.sessions.size + 1}`,
      createdAt: createdAt || Date.now(),
      updatedAt: Date.now(),
      nodeCount: 0,
      edgeCount: 0,
      isActive: true
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    await this.saveToStorage();
    
    console.log('[SessionStore] Created session:', sessionId);
    return session;
  }

  // Get current session
  async getCurrentSession() {
    if (!this.currentSessionId) {
      return null;
    }
    return this.sessions.get(this.currentSessionId);
  }

  // Get current session ID
  async getCurrentSessionId() {
    return this.currentSessionId;
  }

  // Set current session
  async setCurrentSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found: ' + sessionId);
    }

    this.currentSessionId = sessionId;
    
    // Update session activity
    const session = this.sessions.get(sessionId);
    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);
    
    await this.saveToStorage();
    
    console.log('[SessionStore] Switched to session:', sessionId);
    return session;
  }

  // Get a specific session
  async getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Get all sessions
  async getAllSessions() {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Update session
  async updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found: ' + sessionId);
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: Date.now()
    };

    this.sessions.set(sessionId, updatedSession);
    await this.saveToStorage();
    
    return updatedSession;
  }

  // Delete session
  async deleteSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found: ' + sessionId);
    }

    this.sessions.delete(sessionId);
    
    // Switch to another session if this was current
    if (this.currentSessionId === sessionId) {
      const remainingSessions = Array.from(this.sessions.keys());
      this.currentSessionId = remainingSessions.length > 0 ? remainingSessions[0] : null;
      
      // Create default if none left
      if (!this.currentSessionId) {
        await this.createSession('Default Session');
      }
    }

    await this.saveToStorage();
    
    console.log('[SessionStore] Deleted session:', sessionId);
    return { success: true };
  }

  // Rename session
  async renameSession(sessionId, newName) {
    return this.updateSession(sessionId, { name: newName });
  }

  // Update session statistics
  async updateSessionStats(sessionId, nodeCount, edgeCount) {
    return this.updateSession(sessionId, { nodeCount, edgeCount });
  }

  // Window tracking
  async addWindow(windowId, type = 'normal') {
    this.windows.set(windowId, {
      id: windowId,
      type,
      createdAt: Date.now()
    });
    await this.saveToStorage();
  }

  async removeWindow(windowId) {
    this.windows.delete(windowId);
    await this.saveToStorage();
  }

  async getWindows() {
    return Array.from(this.windows.values());
  }

  // Clear all data
  async clearAll() {
    this.sessions.clear();
    this.windows.clear();
    this.currentSessionId = null;
    await this.saveToStorage();
    
    // Create fresh default session
    await this.createSession('Default Session');
  }

  // Export session data
  async exportSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found: ' + sessionId);
    }

    return {
      version: '1.0.0',
      exportDate: Date.now(),
      session: { ...session }
    };
  }

  // Import session data
  async importSession(sessionData) {
    const newSessionId = `session-${Date.now()}`;
    const importedSession = {
      ...sessionData.session,
      id: newSessionId,
      name: `${sessionData.session.name} (Imported)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isImported: true
    };

    this.sessions.set(newSessionId, importedSession);
    await this.saveToStorage();

    return importedSession;
  }

  // Get storage usage
  async getStorageUsage() {
    const result = await chrome.storage.local.get(null);
    const bytes = JSON.stringify(result).length;
    
    return {
      bytes,
      kb: Math.round(bytes / 1024 * 100) / 100,
      mb: Math.round(bytes / (1024 * 1024) * 100) / 100
    };
  }
}
