# Synapse Architecture

## Overview

**Synapse is a web-based application** (not a desktop app) that provides an infinite, self-organizing workspace where content arranges itself based on semantic similarity using AI.

Think of it as: **Notion + Miro + Physics Simulation**

---

## Application Type & Scope

### What Synapse IS:
- 🌐 **Web Application** - Runs in browser, accessed via URL
- ☁️ **Cloud-Stored** - Content lives in your database, not user's hard drive
- 🤝 **Collaborative** - Multi-user workspaces with real-time sync
- 🧠 **AI-Powered** - Semantic understanding via embeddings
- 🎨 **Canvas-Based** - Infinite 2D workspace like Figma/Miro

### What Synapse is NOT:
- ❌ Not a desktop file manager
- ❌ Not a local disk indexer
- ❌ Not a file browser for user's filesystem
- ❌ Doesn't access user's local files without upload

### Similar Applications:
- **Notion** - Content creation & organization (but linear)
- **Miro/Figma** - Infinite canvas collaboration (but manual positioning)
- **Obsidian** - Knowledge graph (but file-based, not physics-based)
- **Synapse** = All of the above + AI auto-organization

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React Frontend (synapse-frontend)            │   │
│  │  • Infinite Canvas (pan/zoom)                        │   │
│  │  • Item Rendering (notes, files, links)             │   │
│  │  • Real-time Collaboration UI                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (synapse-backend)               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  REST API      │  │  WebSocket     │  │ Background   │  │
│  │  - Items       │  │  - Real-time   │  │ Processing   │  │
│  │  - Files       │  │  - Cursors     │  │ - OCR        │  │
│  │  - Workspaces  │  │  - Updates     │  │ - Embeddings │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Physics Engine │  │ Embedding Svc  │  │ Vector Store │  │
│  │ - Gravity sim  │  │ - OpenAI API   │  │ - Pinecone   │  │
│  │ - Positioning  │  │ - or Ollama    │  │ - or Chroma  │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL  │  │ Local Storage│  │  Vector Database │  │
│  │  - Users     │  │ - Uploaded   │  │  - Embeddings    │  │
│  │  - Workspaces│  │   Files      │  │  - Similarity    │  │
│  │  - Items     │  │ - Thumbnails │  │    Search        │  │
│  │  - Files     │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. User Creates a Note

```
User types text in browser
    ↓
Frontend sends POST /api/items
    ↓
Backend:
  - Creates Item record in database
  - Generates embedding (OpenAI/Ollama)
  - Stores embedding in vector DB
  - Physics engine suggests position
  - Returns item data
    ↓
Frontend displays item on canvas
```

### 2. User Uploads a File (PDF/Image)

```
User selects file from their computer
    ↓
Frontend sends POST /api/files/upload
    ↓
Backend:
  - Saves file to storage (data/uploads/)
  - Creates File record in database
  - [Background] Extracts text (OCR/PDF parsing)
  - [Background] Generates embedding
  - Creates Item record linked to file
  - Returns file + item data
    ↓
Frontend displays file as item on canvas
```

### 3. Physics-Based Auto-Organization

```
Every 100ms, backend physics engine:
  1. For each item pair:
     - Calculate semantic similarity (cosine)
     - If similar > threshold: Apply attraction force
     - If too close: Apply repulsion force
  2. Update all velocities and positions
  3. Broadcast positions via WebSocket
     ↓
Frontend smoothly animates items to new positions
```

---

## Database Schema

### Core Tables

#### `users`
- Stores user accounts and authentication
- Links to workspaces via `workspace_members`

#### `workspaces`
- Collaborative spaces for organizing content
- Each user can have multiple workspaces
- Each workspace has multiple items

#### `items` 
**The main entity displayed on canvas**
- `id` - Unique identifier
- `workspace_id` - Which workspace this belongs to
- `item_type` - note, link, code, pdf, image, file
- `content` - Text content (or extracted text for files)
- `title` - Optional title
- `position_x`, `position_y` - Canvas coordinates
- `embedding` - Semantic vector (JSONB)
- `file_id` - Links to `files` table if uploaded
- `cluster_id` - Auto-assigned cluster

#### `files`
**Storage metadata for uploaded files**
- `id` - Unique identifier
- `workspace_id` - Which workspace
- `uploaded_by` - User who uploaded
- `original_filename` - User's filename
- `storage_path` - Where file is stored
- `content_type` - MIME type
- `size` - File size in bytes
- `extracted_text` - Text from OCR/PDF
- `thumbnail_path` - Preview image

#### `clusters`
**Auto-generated semantic groups**
- `id` - Unique identifier
- `workspace_id` - Which workspace
- `name` - AI-generated or manual name
- `center_x`, `center_y` - Visual position
- `color` - Display color

---

## Key Concepts

### 1. Items vs Files

**Items** are what you see on the canvas. They can be:
- Notes you type in the app
- Links you paste
- Code snippets
- **Uploaded files** (PDFs, images)

**Files** are uploaded binary data (PDFs, images, etc.). When you upload a file:
1. File is saved to disk → `files` table
2. System creates an `item` pointing to that file
3. Item appears on canvas

### 2. Semantic Embeddings

Every item gets a **1536-dimensional vector** representing its meaning:
- Generated by OpenAI's `text-embedding-3-small` or Ollama's `nomic-embed-text`
- Enables similarity search
- Powers the physics gravity system

Example:
```python
"Machine learning" → [0.23, -0.45, 0.67, ..., 0.12]
"Neural networks"  → [0.21, -0.43, 0.71, ..., 0.15]
# These are very similar, so they attract each other!
```

### 3. Physics Simulation

The "gravity" system uses real physics formulas:

**Attraction Force** (items with similar meaning pull together):
```python
similarity = cosine_similarity(item1.embedding, item2.embedding)
if similarity > 0.7:
    force = 5000 * similarity / distance²
```

**Repulsion Force** (prevent overlap):
```python
if distance < 100:
    force = 2000 * (1 - distance/100)
```

This creates **self-organizing clusters** - related items naturally group together!

### 4. Privacy Mode

Two deployment modes:

**Cloud Mode** (Default for production):
- OpenAI API for embeddings
- Pinecone for vector storage
- Requires API keys

**Privacy Mode** (Local LLM):
- Ollama for embeddings
- ChromaDB for vector storage
- No external API calls
- All data stays local

---

## User Workflow

### Creating Content

1. **Add a Note**
   - Click note icon → Type content → Save
   - System generates embedding and positions it
   
2. **Add a Link**
   - Click link icon → Paste URL → Save
   - Backend fetches page content for embedding

3. **Upload a File**
   - Click upload icon → Select file
   - Backend extracts text, generates embedding
   - File appears as item on canvas

### Organizing Content

**Automatic** (default):
- Items drift and settle based on semantic similarity
- Similar concepts cluster together naturally

**Manual** (if desired):
- Drag items to desired positions
- Create manual clusters
- Pin items to prevent movement

### Collaboration

- Multiple users see same workspace
- Real-time cursor tracking
- Live updates when anyone:
  - Adds an item
  - Moves an item
  - Edits content

---

## Technical Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling

### Backend
- **FastAPI** - Web framework
- **SQLAlchemy** - Database ORM
- **Socket.IO** - Real-time communication
- **PostgreSQL** - Main database
- **Pinecone/ChromaDB** - Vector storage

### AI/ML
- **OpenAI API** - Embeddings (cloud mode)
- **Ollama** - Local LLM (privacy mode)
- **PyTorch** - Image processing
- **PyMuPDF** - PDF text extraction
- **Pillow** - Image processing

---

## Deployment Models

### Development
```
Frontend: npm run dev (localhost:5173)
Backend: uvicorn main:app --reload (localhost:8000)
Database: Local PostgreSQL
```

### Production
```
Frontend: Static files served by backend
Backend: Gunicorn + Uvicorn workers
Database: Managed PostgreSQL (AWS RDS, etc.)
Storage: S3 or local filesystem
```

### Docker
```
docker-compose up -d
  - frontend (Nginx)
  - backend (FastAPI)
  - postgres
  - redis (optional, for caching)
```

---

## Future Enhancements

- **Mobile App** - React Native version
- **Desktop App** - Electron wrapper for offline mode
- **API Integrations** - Import from Notion, Google Docs, etc.
- **Advanced Search** - Temporal queries, filters
- **Templates** - Pre-built workspace layouts
- **Export** - Generate reports, mind maps, etc.

---

## FAQ

**Q: Can I import my existing files?**  
A: Yes! Upload files via the upload button. The system will extract text and position them automatically.

**Q: Does this work offline?**  
A: Currently no, but Privacy Mode + local database = minimal external dependencies. Desktop app could enable full offline mode.

**Q: Is my data private?**  
A: In Privacy Mode (Ollama + ChromaDB), nothing leaves your server. In Cloud Mode, embeddings go to OpenAI.

**Q: How many items can I have?**  
A: Thousands! Vector DB handles scale. Physics simulation optimized with spatial partitioning.

**Q: Can I disable auto-organization?**  
A: Yes, pin items or disable physics entirely in settings.

---

Built with 💜 by the Synapse Team
