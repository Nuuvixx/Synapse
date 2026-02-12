import { webUtils, webFrame, ipcRenderer, contextBridge } from "electron";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      ipcRenderer.on(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      ipcRenderer.once(channel, listener);
      return () => {
        ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
class ContentExtractor {
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced"
    });
  }
  extract(doc, url) {
    const isChatGPT = url.includes("chatgpt.com") || url.includes("chat.openai.com");
    if (isChatGPT) {
      return this.extractChatGPT(doc, url);
    }
    return this.extractArticle(doc, url);
  }
  extractSelection(doc, url, selectionHtml) {
    const markdown = this.turndown.turndown(selectionHtml);
    return {
      title: doc.title,
      content: markdown,
      url,
      type: "selection"
    };
  }
  extractArticle(doc, url) {
    const clone = doc.cloneNode(true);
    const reader = new Readability(clone);
    const article = reader.parse();
    if (!article) {
      return {
        title: doc.title,
        content: this.turndown.turndown(doc.body.innerHTML),
        url,
        type: "unknown"
      };
    }
    const markdown = this.turndown.turndown(article.content);
    return {
      title: article.title,
      content: markdown,
      excerpt: article.excerpt,
      byline: article.byline,
      url,
      type: "article"
    };
  }
  extractChatGPT(doc, url) {
    let content = "";
    const turns = doc.querySelectorAll("div[data-message-author-role]");
    if (turns.length > 0) {
      turns.forEach((turn) => {
        const role = turn.getAttribute("data-message-author-role");
        const text = turn.innerText;
        content += `**${role?.toUpperCase()}**:
${text}

---

`;
      });
    } else {
      content = this.turndown.turndown(doc.body.innerHTML);
    }
    return {
      title: doc.title || "ChatGPT Conversation",
      content,
      url,
      type: "chat"
    };
  }
}
const tabApi = {
  // Tab lifecycle
  createTab: (url, nodeId) => ipcRenderer.invoke("tab:create", url, nodeId),
  switchTab: (tabId) => ipcRenderer.invoke("tab:switch", tabId),
  closeTab: (tabId) => ipcRenderer.invoke("tab:close", tabId),
  navigateTab: (tabId, url) => ipcRenderer.invoke("tab:navigate", tabId, url),
  // Navigation controls
  goBack: (tabId) => ipcRenderer.invoke("tab:goBack", tabId),
  goForward: (tabId) => ipcRenderer.invoke("tab:goForward", tabId),
  reload: (tabId) => ipcRenderer.invoke("tab:reload", tabId),
  // Tab queries
  getAllTabs: () => ipcRenderer.invoke("tab:getAll"),
  getActiveTab: () => ipcRenderer.invoke("tab:getActive"),
  // Event listeners
  onTabUpdated: (callback) => {
    const listener = (_event, tabInfo) => callback(tabInfo);
    ipcRenderer.on("tab:updated", listener);
    return () => ipcRenderer.removeListener("tab:updated", listener);
  },
  onTabCreated: (callback) => {
    const listener = (_event, tabInfo) => callback(tabInfo);
    ipcRenderer.on("tab:created", listener);
    return () => ipcRenderer.removeListener("tab:created", listener);
  },
  onTabRemoved: (callback) => {
    const listener = (_event, tabId) => callback(tabId);
    ipcRenderer.on("tab:removed", listener);
    return () => ipcRenderer.removeListener("tab:removed", listener);
  }
};
let extractor = null;
try {
  extractor = new ContentExtractor();
} catch (e) {
  console.error("Failed to initialize ContentExtractor:", e);
}
const api = {
  extractContent: () => {
    if (!extractor) throw new Error("ContentExtractor not initialized");
    try {
      return extractor.extract(document, window.location.href);
    } catch (e) {
      console.error("Content extraction failed:", e);
      throw e;
    }
  },
  extractSelection: () => {
    if (!extractor) throw new Error("ContentExtractor not initialized");
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const container = document.createElement("div");
        for (let i = 0; i < selection.rangeCount; i++) {
          container.appendChild(selection.getRangeAt(i).cloneContents());
        }
        return extractor.extractSelection(document, window.location.href, container.innerHTML);
      }
      return null;
    } catch (e) {
      console.error("Selection extraction failed:", e);
      throw e;
    }
  },
  tab: tabApi
};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
