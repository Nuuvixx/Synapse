# Synapse - Gravity-Based AI Workspace

> *"Your ideas organize themselves."*

Synapse is a self-organizing, infinite spatial workspace where ideas, files, and links arrange themselves using AI-generated conceptual gravity.

## Git Structure: The Monorepo 📦

This project uses a **Monorepo** strategy. Both `NeuralNotes` and `Ariadne Browser` live in this single repository under the `projects/` directory.

### Why Monorepo?
- **Unified Versioning**: Synapse updates as a whole system.
- **Shared Tooling**: Linting, formatting, and build scripts can be shared.
- **Easier Integration**: The "Bridge" between apps is local and easier to test.

### Repository Layout
```
/ (Root)
├── projects/
│   ├── neuralnotes/       # The Note-Taking App (Electron)
│   └── ariadne-browser/   # The Spatial Browser (Electron)
├── README.md              # This file
└── package.json           # (Root scripts for managing both apps)
```

### Git Workflow 🌿
- **Main Branch**: `main` (Production-ready Synapse)
- **Feature Branches**:
  - `feat/ariadne-tabs`
  - `feat/neuralnotes-ai`
  - `fix/bridge-connection`

**To Push to GitHub**:
1. `git init` (at root)
2. `git add .`
3. `git commit -m "Initial Synapse Monorepo"`
4. `git push origin main`

![Synapse Demo](docs/demo.png)

## 🌟 Features

### Core Innovation
- **Semantic Gravity**: Items attract to similar concepts automatically
- **Infinite Canvas**: Zoomable, panable 2D workspace with no boundaries
- **Real-time Collaboration**: Multiple users work together with live cursors
- **Tether Effect**: Glowing connection lines show relationships on hover

### Item Types
- 📝 **Notes** - Text content with AI embeddings
- 🔗 **Links** - URLs with extracted content
- 💻 **Code** - Code snippets with syntax awareness
- 🖼️ **Images** - Visual content
- 📄 **PDFs** - Documents

### Visual Design
- Deep space background with animated starfield
- Neon gradient nodes with soft glow
- Smooth physics-based animations
- Semantic zoom (clusters → groups → items)

## 🏗️ Architecture

```
Synapse/
├── synapse-backend/          # FastAPI + WebSocket server
│   ├── src/
│   │   ├── api/             # REST API routes
│   │   ├── models/          # Data models
│   │   ├── services/        # Business logic
│   │   │   ├── embedding_service.py   # OpenAI embeddings
│   │   │   ├── vector_store.py        # Pinecone vector DB
│   │   │   └── physics_engine.py      # Physics simulation
│   │   └── websocket/       # Socket.IO handlers
│   ├── main.py              # Application entry
│   └── requirements.txt
│
├── synapse-frontend/         # React + Vite client
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   └── types/           # TypeScript types
│   └── package.json
│
└── docker-compose.yml        # Deployment config
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- **Optional (for Privacy Mode):** [Ollama](https://ollama.ai) (for local LLMs)
- **Optional (for Cloud Mode):** OpenAI API key, Pinecone API key

### Backend Setup

```bash
cd synapse-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run server
# Run server
# Note: By default, PRIVACY_MODE=true is enabled in .env
# This uses local Ollama + ChromaDB. No API keys required.
python main.py
```

### Privacy Mode (Local LLM)
Synapse now supports a fully local **Privacy Mode** using Ollama and ChromaDB.

1. Install [Ollama](https://ollama.ai)
2. Pull the embedding model:
   ```bash
   ollama pull nomic-embed-text
   ```
3. Start Ollama:
   ```bash
   ollama serve
   ```
4. Ensure `PRIVACY_MODE=true` in `synapse-backend/.env` (default).

### Frontend Setup

```bash
cd synapse-frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env if backend is not on localhost:8000

# Run dev server
npm run dev

# Build for production
npm run build
```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🧠 How It Works

### The Gravity Algorithm

1. **Content Embedding**: When you add an item, OpenAI's `text-embedding-3-small` converts it to a 1536-dimensional vector

2. **Similarity Search**: The system queries the vector database for semantically similar items

3. **Physics Simulation**: Each item experiences:
   - **Attraction force** proportional to semantic similarity
   - **Repulsion force** to prevent overlap
   - **Damping** for smooth, natural movement

4. **Self-Organization**: Items drift and settle into clusters based on meaning

### Physics Formula

```python
# Attraction force between two items
similarity = cosine_similarity(embedding1, embedding2)
if similarity > threshold:
    force = gravity_strength * similarity / distance

# Repulsion force to prevent overlap
if distance < min_distance:
    repulsion = repulsion_strength * (1 - distance/min_distance)
```

## 📡 API Endpoints

### Items
- `POST /api/items` - Create new item
- `GET /api/items` - List all items
- `GET /api/items/{id}` - Get single item
- `PUT /api/items/{id}` - Update item
- `DELETE /api/items/{id}` - Delete item
- `POST /api/items/{id}/similar` - Find similar items

### Search
- `POST /api/search?query={text}` - Semantic search

### Physics
- `GET /api/physics/state` - Get simulation state
- `GET /api/items/{id}/neighbors` - Get nearest neighbors

### WebSocket Events
- `join_workspace` - Join a collaborative workspace
- `item_created` - Broadcast new item
- `item_updated` - Broadcast item changes
- `item_moved` - Broadcast position changes
- `cursor_move` - Broadcast cursor position
- `physics_update` - Receive physics state updates

## 🎨 Customization

### Physics Parameters

Edit `src/services/physics_engine.py`:

```python
self.gravity_strength = 5000.0      # Increase for stronger attraction
self.repulsion_strength = 2000.0    # Increase for more spacing
self.similarity_threshold = 0.7     # Minimum similarity for attraction
self.damping = 0.92                 # Velocity decay (friction)
```

### Visual Theme

Edit `src/index.css`:

```css
/* Change the color scheme */
--primary: 240 5.9% 10%;
--accent: 260 80% 60%;  /* Purple accent */
```

## 🔧 Development

### Running Tests

```bash
# Backend tests
cd synapse-backend
pytest

# Frontend tests
cd synapse-frontend
npm test
```

### Adding New Item Types

1. Add type to `ItemType` enum in `models/item.py`
2. Add icon and colors in `ItemNode.tsx`
3. Add creation form in `AddItemModal.tsx`

## 🚢 Deployment

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for embeddings | Yes |
| `PINECONE_API_KEY` | Pinecone API key for vector storage | No |
| `PORT` | Backend server port | No (default: 8000) |
| `VITE_API_URL` | Frontend API URL | No |

### Production Build

```bash
# Build frontend
cd synapse-frontend
npm run build

# Serve with backend
cd ../synapse-backend
python main.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- OpenAI for embeddings API
- Pinecone for vector database
- Matter.js for physics inspiration
- React Flow for canvas interactions

---

Built with 💜 by the Synapse Team
