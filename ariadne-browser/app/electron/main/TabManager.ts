/**
 * TabManager - Spatial Browser Engine
 * 
 * Manages WebContentsView instances for the browsing experience.
 * Each graph node can have an associated web view.
 */

import { WebContentsView, BrowserWindow, ipcMain, session, Menu, clipboard } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

// Chrome-like user agent to avoid degraded experiences on modern sites
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface Tab {
    id: string;
    nodeId: string | null; // Associated graph node
    view: WebContentsView;
    url: string;
    title: string;
    favicon: string | null;
    screenshot: string | null; // Base64 data URL of page screenshot
    isActive: boolean;
}

export interface TabInfo {
    id: string;
    nodeId: string | null;
    url: string;
    title: string;
    favicon: string | null;
    screenshot: string | null;
    isActive: boolean;
    isLoading: boolean;
}

const TITLE_BAR_HEIGHT = 32; // Height of custom title bar

export class TabManager {
    private static instance: TabManager;
    private tabs: Map<string, Tab> = new Map();
    private activeTabId: string | null = null;
    private mainWindow: BrowserWindow | null = null;
    private viewportBounds: { x: number; y: number; width: number; height: number } | null = null;
    private browserSession: Electron.Session | null = null;
    private synapseConnection: WebSocket | null = null;

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
        this.setupSession();
        this.setupIpcHandlers();
        this.setupWindowListeners();
        this.connectToSynapse();
    }

    /**
     * Set up a persistent session with permission handling
     */
    private setupSession(): void {
        // Use a persistent partition so logins/cookies survive restarts
        this.browserSession = session.fromPartition('persist:ariadne');

        // Set a proper user agent so sites like Gemini don't serve degraded UIs
        this.browserSession.setUserAgent(BROWSER_USER_AGENT);

        // Grant common permissions that modern sites need
        this.browserSession.setPermissionRequestHandler((_webContents, permission, callback) => {
            const allowedPermissions = [
                'clipboard-read',
                'clipboard-sanitized-write',
                'media',
                'mediaKeySystem',
                'geolocation',
                'notifications',
                'fullscreen',
                'pointerLock',
                'idle-detection',
                'window-management'
            ];
            callback(allowedPermissions.includes(permission));
        });
    }

    /**
     * Connect to NeuralNotes Synapse server
     */
    private connectToSynapse(): void {
        try {
            this.synapseConnection = new WebSocket('ws://localhost:9847');

            this.synapseConnection.on('open', () => {
                console.log('[TabManager] Connected to Synapse');
            });

            this.synapseConnection.on('close', () => {
                console.log('[TabManager] Synapse connection closed');
                // Auto-reconnect after 5 seconds
                setTimeout(() => this.connectToSynapse(), 5000);
            });

            this.synapseConnection.on('error', (err) => {
                console.warn('[TabManager] Synapse connection error:', err.message);
            });
        } catch (error) {
            console.error('[TabManager] Failed to connect to Synapse:', error);
        }
    }

    /**
     * Send content to NeuralNotes via Synapse
     */
    private sendToNeuralNotes(data: { title: string; url: string; content: string; type: 'text' | 'link' | 'image' }): void {
        if (this.synapseConnection?.readyState === WebSocket.OPEN) {
            this.synapseConnection.send(JSON.stringify({
                type: 'CAPTURE_PAGE',
                payload: data
            }));
            console.log('[TabManager] Sent to NeuralNotes:', data.title);
        } else {
            console.warn('[TabManager] Cannot send to NeuralNotes - Synapse not connected');
        }
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

        // Handle capture from FAB
        ipcMain.handle('capture-selection-from-fab', async (_event, data: any) => {
            // data is { title, content, url, type }
            this.sendToNeuralNotes({
                title: data.title ? `Selection from ${data.title}` : 'Selection',
                url: data.url,
                content: data.content,
                type: 'text'
            });
            return { success: true };
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
                sandbox: false, // Allow modern web APIs (service workers, etc.)
                ...(this.browserSession ? { session: this.browserSession } : {})
            }
        });

        // Set user agent per-webContents as well
        view.webContents.setUserAgent(BROWSER_USER_AGENT);

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
            screenshot: null,
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

        // Capture screenshot when page finishes loading
        view.webContents.on('did-finish-load', async () => {
            try {
                // Wait a bit for dynamic content to render
                await new Promise(resolve => setTimeout(resolve, 500));

                // Capture page screenshot (optimized for thumbnails)
                const image = await view.webContents.capturePage({
                    x: 0,
                    y: 0,
                    width: 1280,
                    height: 720
                });

                // Resize to thumbnail size (320x180) to save memory
                const resized = image.resize({ width: 320, height: 180 });
                tab.screenshot = resized.toDataURL();
                this.notifyTabUpdate(tab);
            } catch (error) {
                console.error('Failed to capture screenshot:', error);
            }
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

        // Setup context menu
        view.webContents.on('context-menu', (_event, params) => {
            this.showContextMenu(params, tab);
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
            screenshot: tab.screenshot,
            isActive: tab.isActive,
            isLoading: tab.view.webContents.isLoading()
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

    /**
     * Show context menu based on what was right-clicked
     */
    private showContextMenu(params: Electron.ContextMenuParams, tab: Tab): void {
        const template: Electron.MenuItemConstructorOptions[] = [];

        // Text selection actions
        if (params.selectionText) {
            template.push(
                {
                    label: 'Send Selection to NeuralNotes',
                    click: async () => {
                        try {
                            // Try to get rich markdown selection
                            const extraction = await tab.view.webContents.executeJavaScript(`
                                window.api.extractSelection()
                            `);

                            if (extraction) {
                                this.sendToNeuralNotes({
                                    title: extraction.title ? `Selection from ${extraction.title}` : `Selection from ${tab.title}`,
                                    url: tab.url,
                                    content: extraction.content,
                                    type: 'text'
                                });
                            } else {
                                // Fallback to plain text
                                this.sendToNeuralNotes({
                                    title: `Selection from ${tab.title}`,
                                    url: tab.url,
                                    content: params.selectionText,
                                    type: 'text'
                                });
                            }
                        } catch (e) {
                            console.error('Failed to extract selection:', e);
                            // Fallback
                            this.sendToNeuralNotes({
                                title: `Selection from ${tab.title}`,
                                url: tab.url,
                                content: params.selectionText,
                                type: 'text'
                            });
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Copy',
                    role: 'copy'
                },
                {
                    label: 'Search Google',
                    click: () => {
                        const query = encodeURIComponent(params.selectionText);
                        this.createTab(`https://www.google.com/search?q=${query}`);
                    }
                }
            );
        }

        // Link actions  
        if (params.linkURL) {
            template.push(
                {
                    label: 'Send Link to NeuralNotes',
                    click: () => {
                        this.sendToNeuralNotes({
                            title: params.linkText || 'Link',
                            url: params.linkURL,
                            content: `[${params.linkText || 'Link'}](${params.linkURL})`,
                            type: 'link'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Link in New Tab',
                    click: () => {
                        this.createTab(params.linkURL);
                    }
                },
                {
                    label: 'Copy Link Address',
                    click: () => {
                        clipboard.writeText(params.linkURL);
                    }
                }
            );
        }

        // Image actions
        if (params.mediaType === 'image') {
            template.push(
                {
                    label: 'Send Image to NeuralNotes',
                    click: () => {
                        this.sendToNeuralNotes({
                            title: `Image from ${tab.title}`,
                            url: tab.url,
                            content: `![Image](${params.srcURL})`,
                            type: 'image'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Image in New Tab',
                    click: () => {
                        this.createTab(params.srcURL);
                    }
                },
                {
                    label: 'Copy Image Address',
                    click: () => {
                        clipboard.writeText(params.srcURL);
                    }
                }
            );
        }

        // Page actions (when nothing specific is clicked)
        // If template has items (e.g. standard actions added later), we still want "Send Page"
        // But the previous logic was "if template.length === 0". 
        // We should add "Send Page" ALWAYS as an option in the page context?
        // Or strictly when no selection/link/image.
        // The previous logic was: if (template.length === 0) -> Send Page.
        // Usage: user clicks on blank space.

        if (!params.selectionText && !params.linkURL && params.mediaType !== 'image') {
            template.push(
                {
                    label: 'Send Page to NeuralNotes',
                    click: async () => {
                        try {
                            const extraction = await tab.view.webContents.executeJavaScript(`
                                window.api.extractContent()
                            `);
                            this.sendToNeuralNotes({
                                title: extraction.title,
                                url: extraction.url,
                                content: extraction.content,
                                type: 'text'
                            });
                        } catch (error) {
                            console.error('Failed to get page content:', error);
                        }
                    }
                }
            );
        }

        // Standard page actions
        template.push(
            { type: 'separator' },
            {
                label: 'Back',
                enabled: tab.view.webContents.navigationHistory.canGoBack(),
                click: () => tab.view.webContents.navigationHistory.goBack()
            },
            {
                label: 'Forward',
                enabled: tab.view.webContents.navigationHistory.canGoForward(),
                click: () => tab.view.webContents.navigationHistory.goForward()
            },
            {
                label: 'Reload',
                role: 'reload'
            },
            { type: 'separator' },
            {
                label: 'Inspect Element',
                click: () => {
                    tab.view.webContents.inspectElement(params.x, params.y);
                }
            }
        );

        const menu = Menu.buildFromTemplate(template);
        menu.popup();
    }
}
