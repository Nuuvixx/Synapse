
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
    }
}

// Custom APIs for renderer
const api = {
    tab: tabApi
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

