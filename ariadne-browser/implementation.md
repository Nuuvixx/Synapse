# Ariadne Browser — Implementation Plan

A spatial-first web browser where the tab bar IS a knowledge graph.

---

## Project Status

### Existing Foundation (Already Built)
| Component | File | Status |
|-----------|------|--------|
| Graph Canvas | `GraphCanvas.tsx` (14KB) | ✅ Complete |
| Force Simulation | `useForceSimulation.ts` (8KB) | ✅ Complete |
| Graph Store | `graphStore.ts` (16KB) | ✅ Complete |
| Node Cards | `NodeCard.tsx` | ✅ Complete |
| Timeline Slider | `TimelineSlider.tsx` | ✅ Complete |
| Graph Toolbar | `GraphToolbar.tsx` | ✅ Complete |
| Sidebar | `Sidebar.tsx` | ✅ Complete |
| UI Components | shadcn/ui | ✅ Complete |

### What Needs to Be Built
| Component | Status |
|-----------|--------|
| Electron Shell | ❌ Not Started |
| BrowserView Manager | ❌ Not Started |
| Address Bar | ❌ Not Started |
| Tab ↔ Node Sync | ❌ Not Started |
| Synapse Bridge Client | ❌ Not Started |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ARIADNE BROWSER                          │
├─────────────────────────────────────────────────────────────┤
│  [Main Process - Electron]                                  │
│    ├── windowManager.ts     (BrowserWindow creation)        │
│    ├── tabManager.ts        (BrowserView lifecycle)         │
│    ├── synapseClient.ts     (WebSocket to NeuralNotes)      │
│    └── ipcHandlers.ts       (IPC bridge)                    │
├─────────────────────────────────────────────────────────────┤
│  [Renderer Process - React]                                 │
│    ├── GraphCanvas.tsx      (Existing - spatial tabs)       │
│    ├── AddressBar.tsx       (NEW - URL input)               │
│    ├── BrowserPane.tsx      (NEW - webview container)       │
│    └── SynapsePanel.tsx     (NEW - capture UI)              │
└─────────────────────────────────────────────────────────────┘
         │
         │ WebSocket (ws://localhost:9847)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEURALNOTES                              │
│    └── synapseServer.ts     (Receives captured content)     │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Electron Shell (Days 1-2)

### Objective
Wrap the existing React app in an Electron shell with a frameless window.

### Tasks
1. Install Electron and electron-vite
2. Create main process entry (`electron/main/index.ts`)
3. Create preload script with context bridge
4. Configure Vite for Electron builds
5. Add custom title bar with window controls

### Key Files to Create
```
ariadne-browser/
├── electron/
│   ├── main/
│   │   └── index.ts          # Main process entry
│   └── preload/
│       └── index.ts          # Context bridge
├── src/                      # (existing React app)
└── electron-builder.json     # Packaging config
```

---

## Phase 2: Browser Engine (Days 3-4)

### Objective
Implement BrowserView management so each graph node can display a webpage.

### Tasks
1. Create `TabManager` class for BrowserView lifecycle
2. Wire navigation events (back, forward, reload)
3. Capture page info (title, favicon, URL)
4. Sync BrowserView state with graph nodes
5. Handle tab switching via node selection

### Core Logic
- **Create Tab**: `tabManager.createTab(url)` → Creates BrowserView → Creates Graph Node
- **Switch Tab**: Click node → `tabManager.switchToTab(nodeId)` → Shows corresponding BrowserView
- **Close Tab**: Delete node → `tabManager.closeTab(nodeId)` → Destroys BrowserView

---

## Phase 3: Graph-Browser Sync (Days 5-6)

### Objective
Connect the existing graph system to the browser engine so nodes represent live tabs.

### Tasks
1. Extend `graphStore` with tab-related actions
2. Add `tabId` field to node type
3. Listen for `did-navigate` to update node URL/title
4. Capture screenshots for node thumbnails
5. Track parent-child relationships (opener tracking)

### Data Flow
```
[User clicks link] 
    → BrowserView navigates 
    → Main process emits 'tab-updated' 
    → Renderer updates graphStore 
    → GraphCanvas re-renders node
```

---

## Phase 4: Synapse Bridge (Days 7-8)

### Objective
Implement the WebSocket client that sends captured content to NeuralNotes.

### Tasks
1. Create `SynapseClient` in main process
2. Add "Synapse" button to UI (floating action)
3. Implement content extraction (page HTML, or ChatGPT conversation)
4. Send JSON payload to NeuralNotes bridge server
5. Handle connection status (connected/disconnected indicator)

### Protocol
```json
{
  "type": "capture-note",
  "payload": {
    "title": "ChatGPT - My Conversation",
    "url": "https://chat.openai.com/...",
    "content": "# Conversation\n\n**User**: How do I...",
    "capturedAt": "2024-02-09T15:00:00Z"
  }
}
```

---

## Phase 5: Polish & Distribution (Days 9-10)

### Objective
Finalize the UI, add keyboard shortcuts, and prepare for distribution.

### Tasks
1. Implement keyboard shortcuts (Cmd+T, Cmd+W, Cmd+L)
2. Add command palette (Cmd+K)
3. Polish animations and transitions
4. Create app icons (Win/Mac/Linux)
5. Configure electron-builder for packaging
6. Record demo video

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Framework | Electron 28+ |
| Build | electron-vite |
| Frontend | React 19 + TypeScript |
| Graph | React Flow + D3-force (existing) |
| State | Zustand (existing) |
| Styling | Tailwind CSS + shadcn/ui (existing) |
| Database | IndexedDB (existing, via `idb`) |

---

## Success Criteria

- [ ] Electron app launches with frameless window
- [ ] Address bar navigates to URLs
- [ ] Graph nodes represent live tabs
- [ ] Clicking a node switches to that tab
- [ ] "Synapse" button captures current page to NeuralNotes
- [ ] App packages for Windows/Mac
