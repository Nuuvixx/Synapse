/**
 * TabManager - Spatial Browser Engine
 * 
 * Manages WebContentsView instances for the browsing experience.
 * Each graph node can have an associated web view.
 */

import { WebContentsView, BrowserWindow, ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export interface Tab {
    id: string;
    nodeId: string | null; // Associated graph node
    view: WebContentsView;
    url: string;
    title: string;
    favicon: string | null;
    isActive: boolean;
}

export interface TabInfo {
    id: string;
    nodeId: string | null;
    url: string;
    title: string;
    favicon: string | null;
    isActive: boolean;
}

const TITLE_BAR_HEIGHT = 32; // Height of custom title bar

export class TabManager {
    private static instance: TabManager;
    private tabs: Map<string, Tab> = new Map();
    private activeTabId: string | null = null;
    private mainWindow: BrowserWindow | null = null;
    private viewportBounds: { x: number; y: number; width: number; height: number } | null = null;

    private constructor() { }

    static getInstance(): TabManager {
        if (!TabManager.instance) {
            TabManager.instance = new TabManager();
        }
        return TabManager.instance;
    }

    /**
     * Initialize the TabManager with the main window
     */
    init(mainWindow: BrowserWindow): void {
        this.mainWindow = mainWindow;
        this.setupIpcHandlers();
        this.setupWindowListeners();
    }

    /**
     * Set up IPC handlers for renderer communication
     */
    private setupIpcHandlers(): void {
        ipcMain.handle('tab:create', async (_event, url: string, nodeId?: string) => {
            return this.createTab(url, nodeId);
        });

        ipcMain.handle('tab:switch', async (_event, tabId: string) => {
            return this.switchTab(tabId);
        });

        ipcMain.handle('tab:close', async (_event, tabId: string) => {
            return this.closeTab(tabId);
        });

        ipcMain.handle('tab:navigate', async (_event, tabId: string, url: string) => {
            return this.navigateTab(tabId, url);
        });

        ipcMain.handle('tab:getAll', async () => {
            return this.getAllTabInfo();
        });

        ipcMain.handle('tab:getActive', async () => {
            return this.getActiveTabInfo();
        });

        // Navigation controls
        ipcMain.handle('tab:goBack', async (_event, tabId: string) => {
            const tab = this.tabs.get(tabId);
            if (tab?.view.webContents.canGoBack()) {
                tab.view.webContents.goBack();
                return true;
            }
            return false;
        });

        ipcMain.handle('tab:goForward', async (_event, tabId: string) => {
            const tab = this.tabs.get(tabId);
            if (tab?.view.webContents.canGoForward()) {
                tab.view.webContents.goForward();
                return true;
            }
            return false;
        });

        ipcMain.handle('tab:reload', async (_event, tabId: string) => {
            const tab = this.tabs.get(tabId);
            if (tab) {
                tab.view.webContents.reload();
                return true;
            }
            return false;
        });

        // Listen for viewport bounds updates from renderer
        ipcMain.on('browser:viewport-bounds', (_event, bounds) => {
            this.viewportBounds = bounds;
            this.resizeActiveView();
        });
    }

    /**
     * Set up window resize listeners
     */
    private setupWindowListeners(): void {
        if (!this.mainWindow) return;

        this.mainWindow.on('resize', () => {
            // Viewport bounds will be updated by the renderer via IPC
            // Just trigger a resize to use the latest bounds
            this.resizeActiveView();
        });
    }

    /**
     * Create a new tab with a WebContentsView
     */
    createTab(url: string, nodeId?: string): TabInfo {
        if (!this.mainWindow) {
            throw new Error('TabManager not initialized');
        }

        const id = uuidv4();

        const view = new WebContentsView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            }
        });

        // Load the URL
        view.webContents.loadURL(url);

        // Create tab object
        const tab: Tab = {
            id,
            nodeId: nodeId || null,
            view,
            url,
            title: 'Loading...',
            favicon: null,
            isActive: false
        };

        // Track page info updates
        view.webContents.on('page-title-updated', (_event, title) => {
            tab.title = title;
            this.notifyTabUpdate(tab);
        });

        view.webContents.on('page-favicon-updated', (_event, favicons) => {
            tab.favicon = favicons[0] || null;
            this.notifyTabUpdate(tab);
        });

        view.webContents.on('did-navigate', (_event, url) => {
            tab.url = url;
            this.notifyTabUpdate(tab);
        });

        view.webContents.on('did-navigate-in-page', (_event, url) => {
            tab.url = url;
            this.notifyTabUpdate(tab);
        });

        // Intercept link clicks that try to open new windows
        // This keeps all navigation inside Ariadne instead of opening external browser
        view.webContents.setWindowOpenHandler(({ url }) => {
            // Create a new tab for the URL instead of opening external browser
            this.createTab(url);
            return { action: 'deny' };
        });

        // Handle middle-click and ctrl+click on links
        view.webContents.on('will-navigate', (_event, url) => {
            // Allow navigation in the same tab
            tab.url = url;
            this.notifyTabUpdate(tab);
        });

        this.tabs.set(id, tab);

        // Notify renderer
        this.notifyTabCreated(tab);

        // Switch to the new tab
        this.switchTab(id);

        return this.tabToInfo(tab);
    }

    /**
     * Switch to a specific tab
     */
    switchTab(tabId: string): TabInfo | null {
        if (!this.mainWindow) return null;

        const tab = this.tabs.get(tabId);
        if (!tab) return null;

        // Deactivate current tab
        if (this.activeTabId && this.activeTabId !== tabId) {
            const currentTab = this.tabs.get(this.activeTabId);
            if (currentTab) {
                currentTab.isActive = false;
                this.mainWindow.contentView.removeChildView(currentTab.view);
                this.notifyTabUpdate(currentTab);
            }
        }

        // Activate new tab
        tab.isActive = true;
        this.activeTabId = tabId;
        this.mainWindow.contentView.addChildView(tab.view);
        this.resizeActiveView();

        this.notifyTabUpdate(tab);

        return this.tabToInfo(tab);
    }

    /**
     * Close a tab
     */
    closeTab(tabId: string): boolean {
        if (!this.mainWindow) return false;

        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        // Remove from window if active
        if (tab.isActive) {
            this.mainWindow.contentView.removeChildView(tab.view);
            this.activeTabId = null;

            // Switch to another tab if available
            const remainingTabs = Array.from(this.tabs.keys()).filter(id => id !== tabId);
            if (remainingTabs.length > 0) {
                this.switchTab(remainingTabs[0]);
            }
        }

        // Destroy the view
        tab.view.webContents.close();
        this.tabs.delete(tabId);

        this.notifyTabRemoved(tabId);

        return true;
    }

    /**
     * Navigate a tab to a new URL
     */
    navigateTab(tabId: string, url: string): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.view.webContents.loadURL(url);
        tab.url = url;
        return true;
    }

    /**
     * Resize the active view to fit the viewport bounds
     */
    private resizeActiveView(): void {
        if (!this.mainWindow || !this.activeTabId) return;

        const tab = this.tabs.get(this.activeTabId);
        if (!tab) return;

        // Use viewport bounds if available, otherwise fallback to full window
        if (this.viewportBounds) {
            tab.view.setBounds(this.viewportBounds);
        } else {
            // Fallback: use full window bounds minus title bar
            const bounds = this.mainWindow.getBounds();
            tab.view.setBounds({
                x: 0,
                y: TITLE_BAR_HEIGHT,
                width: bounds.width,
                height: bounds.height - TITLE_BAR_HEIGHT
            });
        }
    }

    /**
     * Get info for all tabs
     */
    getAllTabInfo(): TabInfo[] {
        return Array.from(this.tabs.values()).map(tab => this.tabToInfo(tab));
    }

    /**
     * Get info for the active tab
     */
    getActiveTabInfo(): TabInfo | null {
        if (!this.activeTabId) return null;
        const tab = this.tabs.get(this.activeTabId);
        return tab ? this.tabToInfo(tab) : null;
    }

    /**
     * Convert Tab to TabInfo (without the view)
     */
    private tabToInfo(tab: Tab): TabInfo {
        return {
            id: tab.id,
            nodeId: tab.nodeId,
            url: tab.url,
            title: tab.title,
            favicon: tab.favicon,
            isActive: tab.isActive
        };
    }

    /**
     * Notify renderer of tab updates
     */
    private notifyTabUpdate(tab: Tab): void {
        if (!this.mainWindow) return;
        this.mainWindow.webContents.send('tab:updated', this.tabToInfo(tab));
    }

    /**
     * Notify renderer of tab creation
     */
    private notifyTabCreated(tab: Tab): void {
        if (!this.mainWindow) return;
        this.mainWindow.webContents.send('tab:created', this.tabToInfo(tab));
    }

    /**
     * Notify renderer of tab removal
     */
    private notifyTabRemoved(tabId: string): void {
        if (!this.mainWindow) return;
        this.mainWindow.webContents.send('tab:removed', tabId);
    }
}
