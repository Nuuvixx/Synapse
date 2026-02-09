import { app, session, ipcMain, BrowserWindow, WebContentsView, shell } from "electron";
import { join } from "path";
import { v4 } from "uuid";
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
const TITLE_BAR_HEIGHT = 32;
class TabManager {
  constructor() {
    this.tabs = /* @__PURE__ */ new Map();
    this.activeTabId = null;
    this.mainWindow = null;
    this.viewportBounds = null;
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
    this.setupIpcHandlers();
    this.setupWindowListeners();
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
        sandbox: true
      }
    });
    view.webContents.loadURL(url);
    const tab = {
      id,
      nodeId: nodeId || null,
      view,
      url,
      title: "Loading...",
      favicon: null,
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
    this.tabs.set(id, tab);
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
      }
    }
    tab.isActive = true;
    this.activeTabId = tabId;
    this.mainWindow.contentView.addChildView(tab.view);
    this.resizeActiveView();
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
      isActive: tab.isActive
    };
  }
  /**
   * Notify renderer of tab updates
   */
  notifyTabUpdate(tab) {
    if (!this.mainWindow) return;
    this.mainWindow.webContents.send("tab:updated", this.tabToInfo(tab));
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
