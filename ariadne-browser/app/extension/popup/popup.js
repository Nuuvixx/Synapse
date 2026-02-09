/**
 * Ariadne Popup Script
 * 
 * Handles popup UI interactions and communication with background script.
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Ariadne Popup] Loaded');

  // Load and display stats
  await loadStats();
  
  // Load sessions
  await loadSessions();

  // Setup event listeners
  setupEventListeners();
});

// Load statistics from background
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getGraphData' });
    
    if (response && response.nodes) {
      document.getElementById('nodeCount').textContent = response.nodes.length;
      document.getElementById('edgeCount').textContent = response.edges.length;
    }

    const sessions = await chrome.runtime.sendMessage({ action: 'getSessions' });
    if (sessions) {
      document.getElementById('sessionCount').textContent = sessions.length;
    }
  } catch (error) {
    console.error('[Ariadne Popup] Failed to load stats:', error);
  }
}

// Load and display sessions
async function loadSessions() {
  try {
    const sessions = await chrome.runtime.sendMessage({ action: 'getSessions' });
    const sessionList = document.getElementById('sessionList');
    const currentSession = await chrome.runtime.sendMessage({ action: 'getSessions' })
      .then(sessions => sessions.find(s => s.isActive));

    sessionList.innerHTML = '';

    sessions.slice(0, 5).forEach(session => {
      const item = document.createElement('div');
      item.className = `session-item ${session.id === currentSession?.id ? 'active' : ''}`;
      item.innerHTML = `
        <span class="session-name">${escapeHtml(session.name)}</span>
        <span class="session-time">${formatTime(session.updatedAt)}</span>
      `;
      item.addEventListener('click', () => switchSession(session.id));
      sessionList.appendChild(item);
    });
  } catch (error) {
    console.error('[Ariadne Popup] Failed to load sessions:', error);
  }
}

// Setup button event listeners
function setupEventListeners() {
  // Open Graph View
  document.getElementById('openGraph').addEventListener('click', async () => {
    const graphUrl = chrome.runtime.getURL('graph/index.html');
    
    // Check if graph tab already exists
    const tabs = await chrome.tabs.query({ url: graphUrl });
    
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      await chrome.tabs.create({ url: graphUrl });
    }
    
    window.close();
  });

  // Save Current Tree
  document.getElementById('saveTree').addEventListener('click', async () => {
    const name = prompt('Enter a name for this tree:');
    if (name) {
      try {
        const graphData = await chrome.runtime.sendMessage({ action: 'getGraphData' });
        const nodeIds = graphData.nodes.map(n => n.id);
        
        await chrome.runtime.sendMessage({
          action: 'saveTree',
          name,
          nodeIds
        });
        
        alert('Tree saved successfully!');
      } catch (error) {
        console.error('[Ariadne Popup] Failed to save tree:', error);
        alert('Failed to save tree');
      }
    }
  });

  // Export Session
  document.getElementById('exportData').addEventListener('click', async () => {
    try {
      const sessions = await chrome.runtime.sendMessage({ action: 'getSessions' });
      const currentSession = sessions.find(s => s.isActive);
      
      if (!currentSession) {
        alert('No active session found');
        return;
      }

      const exportData = await chrome.runtime.sendMessage({
        action: 'exportSession',
        sessionId: currentSession.id
      });

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url,
        filename: `ariadne-session-${currentSession.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`,
        saveAs: true
      });
    } catch (error) {
      console.error('[Ariadne Popup] Failed to export:', error);
      alert('Failed to export session');
    }
  });
}

// Switch to a different session
async function switchSession(sessionId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'switchSession',
      sessionId
    });
    
    await loadSessions();
    await loadStats();
  } catch (error) {
    console.error('[Ariadne Popup] Failed to switch session:', error);
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Keyboard shortcut listener
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'open-graph') {
    const graphUrl = chrome.runtime.getURL('graph/index.html');
    chrome.tabs.create({ url: graphUrl });
  }
});
