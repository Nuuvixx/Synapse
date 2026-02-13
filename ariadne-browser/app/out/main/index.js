import { app, session, ipcMain, BrowserWindow, WebContentsView, Menu, clipboard, shell } from "electron";
import { join } from "path";
import { v4 } from "uuid";
import WebSocket from "ws";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const is = {
  dev: !app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      app.setLoginItemSettings({ openAtLogin: auto });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "KeyI" && (input.alt && input.meta || input.control && input.shift)) {
            event.preventDefault();
          }
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    ipcMain.on("win:invoke", (event, action) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const icon = join(import.meta.dirname, "../../resources/icon.png");
const BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TITLE_BAR_HEIGHT = 32;
class TabManager {
  constructor() {
    this.tabs = /* @__PURE__ */ new Map();
    this.activeTabId = null;
    this.mainWindow = null;
    this.viewportBounds = null;
    this.browserSession = null;
    this.synapseConnection = null;
  }
  static getInstance() {
    if (!TabManager.instance) {
      TabManager.instance = new TabManager();
    }
    return TabManager.instance;
  }
  /**
   * Initialize the TabManager with the main window
   */
  init(mainWindow) {
    this.mainWindow = mainWindow;
    this.setupSession();
    this.setupIpcHandlers();
    this.setupWindowListeners();
    this.connectToSynapse();
  }
  /**
   * Set up a persistent session with permission handling
   */
  setupSession() {
    this.browserSession = session.fromPartition("persist:ariadne");
    this.browserSession.setUserAgent(BROWSER_USER_AGENT);
    this.browserSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowedPermissions = [
        "clipboard-read",
        "clipboard-sanitized-write",
        "media",
        "mediaKeySystem",
        "geolocation",
        "notifications",
        "fullscreen",
        "pointerLock",
        "idle-detection",
        "window-management"
      ];
      callback(allowedPermissions.includes(permission));
    });
  }
  /**
   * Connect to NeuralNotes Synapse server
   */
  connectToSynapse() {
    try {
      this.synapseConnection = new WebSocket("ws://localhost:9847");
      this.synapseConnection.on("open", () => {
        console.log("[TabManager] Connected to Synapse");
      });
      this.synapseConnection.on("close", () => {
        console.log("[TabManager] Synapse connection closed");
        setTimeout(() => this.connectToSynapse(), 5e3);
      });
      this.synapseConnection.on("error", (err) => {
        console.warn("[TabManager] Synapse connection error:", err.message);
      });
    } catch (error) {
      console.error("[TabManager] Failed to connect to Synapse:", error);
    }
  }
  /**
   * Send content to NeuralNotes via Synapse
   */
  sendToNeuralNotes(data) {
    if (this.synapseConnection?.readyState === WebSocket.OPEN) {
      this.synapseConnection.send(JSON.stringify({
        type: "CAPTURE_PAGE",
        payload: data
      }));
      console.log("[TabManager] Sent to NeuralNotes:", data.title);
    } else {
      console.warn("[TabManager] Cannot send to NeuralNotes - Synapse not connected");
    }
  }
  /**
   * Set up IPC handlers for renderer communication
   */
  setupIpcHandlers() {
    ipcMain.handle("tab:create", async (_event, url, nodeId) => {
      return this.createTab(url, nodeId);
    });
    ipcMain.handle("tab:switch", async (_event, tabId) => {
      return this.switchTab(tabId);
    });
    ipcMain.handle("tab:close", async (_event, tabId) => {
      return this.closeTab(tabId);
    });
    ipcMain.handle("capture-selection-from-fab", async (_event, data) => {
      this.sendToNeuralNotes({
        title: data.title ? `Selection from ${data.title}` : "Selection",
        url: data.url,
        content: data.content,
        type: "text"
      });
      return { success: true };
    });
    ipcMain.handle("tab:navigate", async (_event, tabId, url) => {
      return this.navigateTab(tabId, url);
    });
    ipcMain.handle("tab:getAll", async () => {
      return this.getAllTabInfo();
    });
    ipcMain.handle("tab:getActive", async () => {
      return this.getActiveTabInfo();
    });
    ipcMain.handle("tab:goBack", async (_event, tabId) => {
      const tab = this.tabs.get(tabId);
      if (tab?.view.webContents.canGoBack()) {
        tab.view.webContents.goBack();
        return true;
      }
      return false;
    });
    ipcMain.handle("tab:goForward", async (_event, tabId) => {
      const tab = this.tabs.get(tabId);
      if (tab?.view.webContents.canGoForward()) {
        tab.view.webContents.goForward();
        return true;
      }
      return false;
    });
    ipcMain.handle("tab:reload", async (_event, tabId) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.view.webContents.reload();
        return true;
      }
      return false;
    });
    ipcMain.on("browser:viewport-bounds", (_event, bounds) => {
      this.viewportBounds = bounds;
      this.resizeActiveView();
    });
  }
  /**
   * Set up window resize listeners
   */
  setupWindowListeners() {
    if (!this.mainWindow) return;
    this.mainWindow.on("resize", () => {
      this.resizeActiveView();
    });
  }
  /**
   * Create a new tab with a WebContentsView
   */
  createTab(url, nodeId) {
    if (!this.mainWindow) {
      throw new Error("TabManager not initialized");
    }
    const id = v4();
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        // Allow modern web APIs (service workers, etc.)
        ...this.browserSession ? { session: this.browserSession } : {}
      }
    });
    view.webContents.setUserAgent(BROWSER_USER_AGENT);
    view.webContents.loadURL(url);
    const tab = {
      id,
      nodeId: nodeId || null,
      view,
      url,
      title: "Loading...",
      favicon: null,
      screenshot: null,
      isActive: false
    };
    view.webContents.on("page-title-updated", (_event, title) => {
      tab.title = title;
      this.notifyTabUpdate(tab);
    });
    view.webContents.on("page-favicon-updated", (_event, favicons) => {
      tab.favicon = favicons[0] || null;
      this.notifyTabUpdate(tab);
    });
    view.webContents.on("did-navigate", (_event, url2) => {
      tab.url = url2;
      this.notifyTabUpdate(tab);
    });
    view.webContents.on("did-navigate-in-page", (_event, url2) => {
      tab.url = url2;
      this.notifyTabUpdate(tab);
    });
    view.webContents.on("did-finish-load", async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const image = await view.webContents.capturePage({
          x: 0,
          y: 0,
          width: 1280,
          height: 720
        });
        const resized = image.resize({ width: 320, height: 180 });
        tab.screenshot = resized.toDataURL();
        this.notifyTabUpdate(tab);
      } catch (error) {
        console.error("Failed to capture screenshot:", error);
      }
    });
    view.webContents.setWindowOpenHandler(({ url: url2 }) => {
      this.createTab(url2);
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (_event, url2) => {
      tab.url = url2;
      this.notifyTabUpdate(tab);
    });
    view.webContents.on("context-menu", (_event, params) => {
      this.showContextMenu(params, tab);
    });
    this.tabs.set(id, tab);
    this.notifyTabCreated(tab);
    this.switchTab(id);
    return this.tabToInfo(tab);
  }
  /**
   * Switch to a specific tab
   */
  switchTab(tabId) {
    if (!this.mainWindow) return null;
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.isActive = false;
        this.mainWindow.contentView.removeChildView(currentTab.view);
        this.notifyTabUpdate(currentTab);
      }
    }
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
  closeTab(tabId) {
    if (!this.mainWindow) return false;
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    if (tab.isActive) {
      this.mainWindow.contentView.removeChildView(tab.view);
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabs.keys()).filter((id) => id !== tabId);
      if (remainingTabs.length > 0) {
        this.switchTab(remainingTabs[0]);
      }
    }
    tab.view.webContents.close();
    this.tabs.delete(tabId);
    this.notifyTabRemoved(tabId);
    return true;
  }
  /**
   * Navigate a tab to a new URL
   */
  navigateTab(tabId, url) {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    tab.view.webContents.loadURL(url);
    tab.url = url;
    return true;
  }
  /**
   * Resize the active view to fit the viewport bounds
   */
  resizeActiveView() {
    if (!this.mainWindow || !this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;
    if (this.viewportBounds) {
      tab.view.setBounds(this.viewportBounds);
    } else {
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
  getAllTabInfo() {
    return Array.from(this.tabs.values()).map((tab) => this.tabToInfo(tab));
  }
  /**
   * Get info for the active tab
   */
  getActiveTabInfo() {
    if (!this.activeTabId) return null;
    const tab = this.tabs.get(this.activeTabId);
    return tab ? this.tabToInfo(tab) : null;
  }
  /**
   * Convert Tab to TabInfo (without the view)
   */
  tabToInfo(tab) {
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
  notifyTabUpdate(tab) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("tab:updated", this.tabToInfo(tab));
  }
  /**
   * Notify renderer of tab creation
   */
  notifyTabCreated(tab) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("tab:created", this.tabToInfo(tab));
  }
  /**
   * Notify renderer of tab removal
   */
  notifyTabRemoved(tabId) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("tab:removed", tabId);
  }
  /**
   * Show context menu based on what was right-clicked
   */
  showContextMenu(params, tab) {
    const template = [];
    if (params.selectionText) {
      template.push(
        {
          label: "Send Selection to NeuralNotes",
          click: async () => {
            try {
              const extraction = await tab.view.webContents.executeJavaScript(`
                                window.api.extractSelection()
                            `);
              if (extraction) {
                this.sendToNeuralNotes({
                  title: extraction.title ? `Selection from ${extraction.title}` : `Selection from ${tab.title}`,
                  url: tab.url,
                  content: extraction.content,
                  type: "text"
                });
              } else {
                this.sendToNeuralNotes({
                  title: `Selection from ${tab.title}`,
                  url: tab.url,
                  content: params.selectionText,
                  type: "text"
                });
              }
            } catch (e) {
              console.error("Failed to extract selection:", e);
              this.sendToNeuralNotes({
                title: `Selection from ${tab.title}`,
                url: tab.url,
                content: params.selectionText,
                type: "text"
              });
            }
          }
        },
        { type: "separator" },
        {
          label: "Copy",
          role: "copy"
        },
        {
          label: "Search Google",
          click: () => {
            const query = encodeURIComponent(params.selectionText);
            this.createTab(`https://www.google.com/search?q=${query}`);
          }
        }
      );
    }
    if (params.linkURL) {
      template.push(
        {
          label: "Send Link to NeuralNotes",
          click: () => {
            this.sendToNeuralNotes({
              title: params.linkText || "Link",
              url: params.linkURL,
              content: `[${params.linkText || "Link"}](${params.linkURL})`,
              type: "link"
            });
          }
        },
        { type: "separator" },
        {
          label: "Open Link in New Tab",
          click: () => {
            this.createTab(params.linkURL);
          }
        },
        {
          label: "Copy Link Address",
          click: () => {
            clipboard.writeText(params.linkURL);
          }
        }
      );
    }
    if (params.mediaType === "image") {
      template.push(
        {
          label: "Send Image to NeuralNotes",
          click: () => {
            this.sendToNeuralNotes({
              title: `Image from ${tab.title}`,
              url: tab.url,
              content: `![Image](${params.srcURL})`,
              type: "image"
            });
          }
        },
        { type: "separator" },
        {
          label: "Open Image in New Tab",
          click: () => {
            this.createTab(params.srcURL);
          }
        },
        {
          label: "Copy Image Address",
          click: () => {
            clipboard.writeText(params.srcURL);
          }
        }
      );
    }
    if (!params.selectionText && !params.linkURL && params.mediaType !== "image") {
      template.push(
        {
          label: "Send Page to NeuralNotes",
          click: async () => {
            try {
              const extraction = await tab.view.webContents.executeJavaScript(`
                                window.api.extractContent()
                            `);
              this.sendToNeuralNotes({
                title: extraction.title,
                url: extraction.url,
                content: extraction.content,
                type: "text"
              });
            } catch (error) {
              console.error("Failed to get page content:", error);
            }
          }
        }
      );
    }
    template.push(
      { type: "separator" },
      {
        label: "Back",
        enabled: tab.view.webContents.navigationHistory.canGoBack(),
        click: () => tab.view.webContents.navigationHistory.goBack()
      },
      {
        label: "Forward",
        enabled: tab.view.webContents.navigationHistory.canGoForward(),
        click: () => tab.view.webContents.navigationHistory.goForward()
      },
      {
        label: "Reload",
        role: "reload"
      },
      { type: "separator" },
      {
        label: "Inspect Element",
        click: () => {
          tab.view.webContents.inspectElement(params.x, params.y);
        }
      }
    );
    const menu = Menu.buildFromTemplate(template);
    menu.popup();
  }
}
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    frame: false,
    // Frameless window
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    // Inset traffic lights on macOS
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false
    }
  });
  const tabManager = TabManager.getInstance();
  tabManager.init(mainWindow);
  ipcMain.on("window-minimize", () => mainWindow.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow.close());
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.ariadne.browser");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  app.on("activate", function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
