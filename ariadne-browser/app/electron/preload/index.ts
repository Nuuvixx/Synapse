
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Tab management API
const tabApi = {
    // Tab lifecycle
    createTab: (url: string, nodeId?: string) =>
        ipcRenderer.invoke('tab:create', url, nodeId),
    switchTab: (tabId: string) =>
        ipcRenderer.invoke('tab:switch', tabId),
    closeTab: (tabId: string) =>
        ipcRenderer.invoke('tab:close', tabId),
    navigateTab: (tabId: string, url: string) =>
        ipcRenderer.invoke('tab:navigate', tabId, url),

    // Navigation controls
    goBack: (tabId: string) =>
        ipcRenderer.invoke('tab:goBack', tabId),
    goForward: (tabId: string) =>
        ipcRenderer.invoke('tab:goForward', tabId),
    reload: (tabId: string) =>
        ipcRenderer.invoke('tab:reload', tabId),

    // Tab queries
    getAllTabs: () =>
        ipcRenderer.invoke('tab:getAll'),
    getActiveTab: () =>
        ipcRenderer.invoke('tab:getActive'),

    // Event listeners
    onTabUpdated: (callback: (tabInfo: unknown) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, tabInfo: unknown) => callback(tabInfo)
        ipcRenderer.on('tab:updated', listener)
        return () => ipcRenderer.removeListener('tab:updated', listener)
    },
    onTabCreated: (callback: (tabInfo: unknown) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, tabInfo: unknown) => callback(tabInfo)
        ipcRenderer.on('tab:created', listener)
        return () => ipcRenderer.removeListener('tab:created', listener)
    },
    onTabRemoved: (callback: (tabId: string) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, tabId: string) => callback(tabId)
        ipcRenderer.on('tab:removed', listener)
        return () => ipcRenderer.removeListener('tab:removed', listener)
    }
}

import { ContentExtractor } from './ContentExtractor'

let extractor: ContentExtractor | null = null;
try {
    extractor = new ContentExtractor();
} catch (e) {
    console.error('Failed to initialize ContentExtractor:', e);
}

// Custom APIs for renderer
const api = {
    extractContent: () => {
        if (!extractor) throw new Error('ContentExtractor not initialized');
        try {
            return extractor.extract(document, window.location.href)
        } catch (e) {
            console.error('Content extraction failed:', e);
            throw e;
        }
    },
    extractSelection: () => {
        if (!extractor) throw new Error('ContentExtractor not initialized');
        try {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const container = document.createElement('div');
                for (let i = 0; i < selection.rangeCount; i++) {
                    container.appendChild(selection.getRangeAt(i).cloneContents());
                }
                return extractor.extractSelection(document, window.location.href, container.innerHTML);
            }
            return null;
        } catch (e) {
            console.error('Selection extraction failed:', e);
            throw e;
        }
    },
    tab: tabApi
}

let fabManager: FABManager | null = null;
try {
    fabManager = new FABManager();

    // Listen for custom event from FAB
    window.addEventListener('synapse-capture-trigger', () => {
        try {
            const data = api.extractSelection();
            if (data) {
                ipcRenderer.invoke('capture-selection-from-fab', data);
            }
        } catch (error) {
            console.error('Failed to capture from FAB:', error);
        }
    });

} catch (e) {
    console.error('Failed to initialize FABManager:', e);
}

if (fabManager) {
    console.log('FABManager initialized');
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}

