/**
 * Ariadne Background Service Worker
 * 
 * Core responsibilities:
 * - Track tab lifecycle events (created, updated, removed, activated)
 * - Build parent-child relationships between tabs
 * - Capture screenshots on tab deactivation
 * - Persist graph data to storage
 * - Communicate with the graph UI
 */

import { GraphManager } from './graph-manager.js';
import { ScreenshotManager } from './screenshot-manager.js';
import { SessionStore } from './session-store.js';

// Initialize managers
const graphManager = new GraphManager();
const screenshotManager = new ScreenshotManager();
const sessionStore = new SessionStore();

// Track active tab for screenshot capture
let lastActiveTabId = null;
let lastActiveTabData = null;

// Initialize on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Ariadne] Extension installed/updated:', details.reason);
  
  // Initialize storage
  await sessionStore.initialize();
  
  // Load existing sessions
  await graphManager.loadSessions();
  
  // Start new session or resume existing
  const currentSession = await sessionStore.getCurrentSession();
  if (!currentSession) {
    await sessionStore.createSession('Default Session');
  }
});

// Tab created - new node in graph
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('[Ariadne] Tab created:', tab.id, 'Opener:', tab.openerTabId);
  
  const sessionId = await sessionStore.getCurrentSessionId();
  
  // Create node data
  const nodeData = {
    id: `tab-${tab.id}`,
    tabId: tab.id,
    url: tab.url || tab.pendingUrl || 'about:blank',
    title: tab.title || 'New Tab',
    favicon: tab.favIconUrl || null,
    windowId: tab.windowId,
    sessionId: sessionId,
    parentId: tab.openerTabId ? `tab-${tab.openerTabId}` : null,
    timestamp: Date.now(),
    status: 'active',
    screenshot: null,
    metadata: {
      index: tab.index,
      pinned: tab.pinned,
      incognito: tab.incognito
    }
  };
  
  // Add to graph
  await graphManager.addNode(nodeData);
  
  // If has opener, create edge
  if (tab.openerTabId) {
    await graphManager.addEdge({
      id: `edge-${tab.openerTabId}-${tab.id}`,
      source: `tab-${tab.openerTabId}`,
      target: `tab-${tab.id}`,
      type: 'navigation',
      timestamp: Date.now(),
      sessionId: sessionId
    });
  }
  
  // Broadcast update to any open graph views
  broadcastGraphUpdate();
});

// Tab updated - URL or title changed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('[Ariadne] Tab updated:', tabId, changeInfo);
  
  const nodeId = `tab-${tabId}`;
  const updates = {};
  
  if (changeInfo.url) {
    updates.url = changeInfo.url;
  }
  
  if (changeInfo.title) {
    updates.title = changeInfo.title;
  }
  
  if (changeInfo.favIconUrl) {
    updates.favicon = changeInfo.favIconUrl;
  }
  
  if (changeInfo.status === 'complete') {
    updates.loadTime = Date.now();
    
    // Capture screenshot for completed page
    try {
      const screenshot = await screenshotManager.captureTab(tabId);
      if (screenshot) {
        updates.screenshot = screenshot;
      }
    } catch (err) {
      console.warn('[Ariadne] Failed to capture screenshot:', err);
    }
  }
  
  if (Object.keys(updates).length > 0) {
    await graphManager.updateNode(nodeId, updates);
    broadcastGraphUpdate();
  }
});

// Tab activated - track for screenshot capture
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('[Ariadne] Tab activated:', activeInfo.tabId);
  
  // Capture screenshot of previous active tab before switching
  if (lastActiveTabId && lastActiveTabId !== activeInfo.tabId) {
    try {
      const screenshot = await screenshotManager.captureTab(lastActiveTabId);
      if (screenshot) {
        await graphManager.updateNode(`tab-${lastActiveTabId}`, {
          screenshot: screenshot,
          lastActive: Date.now()
        });
      }
    } catch (err) {
      console.warn('[Ariadne] Failed to capture previous tab screenshot:', err);
    }
  }
  
  // Update node status
  await graphManager.updateNode(`tab-${activeInfo.tabId}`, {
    status: 'active',
    lastActive: Date.now()
  });
  
  lastActiveTabId = activeInfo.tabId;
  
  // Get tab info for tracking
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    lastActiveTabData = tab;
  } catch (err) {
    console.warn('[Ariadne] Failed to get tab info:', err);
  }
  
  broadcastGraphUpdate();
});

// Tab removed - dim node instead of deleting
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('[Ariadne] Tab removed:', tabId);
  
  const nodeId = `tab-${tabId}`;
  
  // Mark as closed rather than removing
  await graphManager.updateNode(nodeId, {
    status: 'closed',
    closedAt: Date.now()
  });
  
  broadcastGraphUpdate();
});

// Tab detached/moved - update window info
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  console.log('[Ariadne] Tab detached:', tabId);
  await graphManager.updateNode(`tab-${tabId}`, {
    windowId: null,
    detachedAt: Date.now()
  });
  broadcastGraphUpdate();
});

chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  console.log('[Ariadne] Tab attached:', tabId);
  await graphManager.updateNode(`tab-${tabId}`, {
    windowId: attachInfo.newWindowId,
    attachedAt: Date.now()
  });
  broadcastGraphUpdate();
});

// Window created/removed tracking
chrome.windows.onCreated.addListener(async (window) => {
  console.log('[Ariadne] Window created:', window.id);
  await sessionStore.addWindow(window.id, window.type);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  console.log('[Ariadne] Window removed:', windowId);
  await sessionStore.removeWindow(windowId);
});

// Message handling from popup/content/graph UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Ariadne] Message received:', request.action);
  
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
  
  return true; // Keep channel open for async
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'getGraphData':
      return await graphManager.getGraphData(request.sessionId);
    
    case 'getSessions':
      return await sessionStore.getAllSessions();
    
    case 'createSession':
      return await sessionStore.createSession(request.name);
    
    case 'switchSession':
      return await sessionStore.setCurrentSession(request.sessionId);
    
    case 'deleteSession':
      return await sessionStore.deleteSession(request.sessionId);
    
    case 'saveTree':
      return await graphManager.saveTree(request.name, request.nodeIds);
    
    case 'loadTree':
      return await graphManager.loadTree(request.treeId);
    
    case 'getSavedTrees':
      return await graphManager.getSavedTrees();
    
    case 'reopenNode':
      return await reopenNode(request.nodeId);
    
    case 'focusNode':
      return await focusNode(request.nodeId);
    
    case 'deleteNode':
      return await graphManager.deleteNode(request.nodeId);
    
    case 'updateNodePosition':
      return await graphManager.updateNodePosition(request.nodeId, request.position);
    
    case 'getTimeline':
      return await graphManager.getTimeline(request.sessionId);
    
    case 'exportSession':
      return await exportSession(request.sessionId);
    
    case 'importSession':
      return await importSession(request.data);
    
    case 'clearAllData':
      return await clearAllData();
    
    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

// Reopen a closed node in a new tab
async function reopenNode(nodeId) {
  const node = await graphManager.getNode(nodeId);
  if (!node) {
    throw new Error('Node not found');
  }
  
  const tab = await chrome.tabs.create({
    url: node.url,
    active: true
  });
  
  // Update node with new tab ID
  await graphManager.updateNode(nodeId, {
    tabId: tab.id,
    status: 'active',
    reopenedAt: Date.now()
  });
  
  broadcastGraphUpdate();
  return { success: true, tabId: tab.id };
}

// Focus an existing tab
async function focusNode(nodeId) {
  const node = await graphManager.getNode(nodeId);
  if (!node || !node.tabId) {
    throw new Error('Node or tab not found');
  }
  
  try {
    await chrome.tabs.update(node.tabId, { active: true });
    await chrome.windows.update(node.windowId, { focused: true });
    return { success: true };
  } catch (err) {
    // Tab might be closed, try reopening
    return await reopenNode(nodeId);
  }
}

// Export session data
async function exportSession(sessionId) {
  const graphData = await graphManager.getGraphData(sessionId);
  const session = await sessionStore.getSession(sessionId);
  
  return {
    version: '1.0.0',
    exportDate: Date.now(),
    session,
    graph: graphData
  };
}

// Import session data
async function importSession(data) {
  if (!data.session || !data.graph) {
    throw new Error('Invalid import data');
  }
  
  const newSession = await sessionStore.createSession(
    `${data.session.name} (Imported)`,
    data.session.createdAt
  );
  
  await graphManager.importGraph(data.graph, newSession.id);
  
  return { success: true, sessionId: newSession.id };
}

// Clear all data
async function clearAllData() {
  await sessionStore.clearAll();
  await graphManager.clearAll();
  return { success: true };
}

// Broadcast graph updates to all connected ports
function broadcastGraphUpdate() {
  chrome.runtime.sendMessage({
    action: 'graphUpdated',
    timestamp: Date.now()
  }).catch(() => {
    // No receivers is okay
  });
}

// Periodic cleanup - remove very old closed nodes
setInterval(async () => {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  await graphManager.cleanupOldNodes(Date.now() - THIRTY_DAYS);
}, 24 * 60 * 60 * 1000); // Run daily

console.log('[Ariadne] Background service worker initialized');
