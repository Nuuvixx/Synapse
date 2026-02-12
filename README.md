# Synapse Ecosystem 🧠

> **A Spatial Operating System for Your Thoughts.**
> Unifying web browsing, note-taking, and AI reasoning into a single cognitive environment.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Active%20Development-green.svg)

## 🌌 The Vision

**Synapse** is not just a browser or a note-taking app. It is a **"Second Brain"** wrapper around your digital life.
Most workflows are fragmented: you read in a browser, copy-paste to a notes app, and lose the context.

**Synapse fixes this by bridging the gap:**
1.  **Ariadne Browser**: A graph-based web browser that tracks *mental context* alongside history.
2.  **NeuralNotes**: A spatial, infinite-canvas note-taking companion.
3.  **The Synapse Bridge**: A real-time neural link (WebSocket) that instantly extracts visuals, text, and context from the browser to your notes.

---

## 🚀 Core Components

### 1. Ariadne Browser (`/ariadne-browser`)
*The browser that thinks with you.*

-   **Graph Navigation**: Visualizes your browsing history as a connected knowledge graph.
-   **Vertical Tab System**: Manages high-density research sessions without clutter.
-   **Content Intelligence**: Automatically strips clutter (ads/popups) using `Readability` and converts pages to clean **Markdown**.
-   **Context-Aware Capture**:
    -   Right-click "Send Page to NeuralNotes" to save refined articles.
    -   "Send Selection" captures text with source metadata.
-   **Persistent Sessions**: Google/Twitter logins persist securely (Local-First).

### 2. NeuralNotes (`/neuralnotes`)
*Your infinite canvas for thought.*

-   **Spatial Interface**: Drag, drop, and connect notes on an infinite 2D plane.
-   **Rich Markdown Editor**: Powered by **TipTap**, supporting code blocks, images, and live previews.
-   **AI Copilot**: (Coming Soon) Local LLM integration to chat with your knowledge graph.
-   **Synapse Sync**: Automatically receives content pushed from Ariadne.

---

## 🛠️ Tech Stack

**Synapse Architecture:**
-   **Runtime**: [Electron](https://www.electronjs.org/) (Multi-process architecture)
-   **Frontend**: React 18 + TypeScript + Vite
-   **State & Storage**:
    -   **SQLite** (Metadata & Graph Relations)
    -   **File System** (Content Storage - `.neuralnotes` format)
-   **Communication**: Local WebSocket Server (`ws://localhost:9847`)
-   **Intelligence**:
    -   `@mozilla/readability` (Parsing)
    -   `turndown` (Markdown Conversion)
    -   `d3.js` / `react-force-graph` (Visualization)

---

## ⚡ Getting Started

### Prerequisites
-   Node.js (v18+)
-   npm

### Installation

1.  **Clone the Repository**
    ```bash
    git clone git@github.com:Nuuvixx/Synapse.git
    cd Synapse
    ```

2.  **Install Dependencies**
    Synapse uses a monorepo structure. You need to install dependencies for both apps.

    ```bash
    # Install Ariadne dependencies
    cd ariadne-browser/app
    npm install

    # Install NeuralNotes dependencies
    cd ../../neuralnotes
    npm install
    ```

### Running the Ecosystem

For the full experience, you need both applications running simultaneously.

**Terminal 1 (NeuralNotes + Synapse Server):**
```bash
cd neuralnotes
npm run dev
# Starts the UI on localhost and the Synapse WebSocket Server on port 9847
```

**Terminal 2 (Ariadne Browser):**
```bash
cd ariadne-browser/app
npm run dev
# Launches the browser. It will auto-connect to Synapse.
```

---

## 🎮 Usage Guide

1.  **Open NeuralNotes**: You'll see the spatial canvas.
2.  **Open Ariadne**: Browse the web.
3.  **Capture Content**:
    -   Found an interesting article? Right-click -> **"Send Page to NeuralNotes"**.
    -   Found a quote? Select text -> Right-click -> **"Send Selection"**.
4.  **Watch the Magic**: The content instantly appears as a new node in NeuralNotes, ready for connection and analysis.

---

## 🗺️ Roadmap

-   [x] **Phase 1**: Core Architecture (Electron/React/SQLite)
-   [x] **Phase 2**: Synapse Bridge (WebSocket Communication)
-   [x] **Phase 3**: Intelligence Layer (Readability & Markdown Parsing)
-   [ ] **Phase 4**: Cloud Sync (Cross-device knowledge graph)
-   [ ] **Phase 5**: Local LLM (Ollama Integration)

---

## 🤝 Contributing

Synapse is an open-source research project. Issues and PRs are welcome!

## 📄 License

MIT © [Ritin Paul](https://github.com/Ritinpaul)
