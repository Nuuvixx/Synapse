"""
Synapse Backend - Main Application Entry Point
FastAPI + Socket.IO server for the gravity-based workspace
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import asyncio

# Load environment variables
load_dotenv()

from src.services.embedding_service import EmbeddingService
from src.services.vector_store import VectorStore
from src.services.physics_engine import PhysicsEngine
from src.websocket.socket_manager import SocketManager
from src.api.routes import router as items_router, init_services
from src.api.auth_routes import router as auth_router
from src.api.workspace_routes import router as workspace_router
from src.api.file_routes import router as file_router
from src.api.cluster_routes import router as cluster_router
from src.api.settings_routes import router as settings_router
from src.database.connection import init_db, close_db


# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    print("🧠 Synapse Backend Starting...")
    
    # Initialize database
    try:
        await init_db()
        print("✅ Database initialized")
    except Exception as e:
        print(f"⚠️  Database initialization failed: {e}")
        print("   Running without database persistence")
    
    # Initialize services
    embedding_service = None
    vector_store = None
    
    # Initialize Embedding Service (OpenAI or Ollama)
    try:
        if OPENAI_API_KEY:
            embedding_service = EmbeddingService(api_key=OPENAI_API_KEY, provider="openai")
            print("✅ Embedding service initialized (OpenAI)")
        else:
            # Fallback to Ollama
            embedding_service = EmbeddingService(provider="ollama")
            print("✅ Embedding service initialized (Ollama)")
    except Exception as e:
        print(f"⚠️  Embedding service failed: {e}")
    
    if PINECONE_API_KEY:
        try:
            vector_store = VectorStore(api_key=PINECONE_API_KEY)
            print("✅ Vector store connected")
        except Exception as e:
            print(f"⚠️  Vector store connection failed: {e}")
    
    physics_engine = PhysicsEngine()
    socket_manager = SocketManager()
    
    # Initialize API routes with services
    from src.database.connection import init_db, close_db, async_session
    from src.database.models import Item
    from src.services.physics_engine import PhysicsBody
    from sqlalchemy import select

    # Initialize API routes with services
    init_services(embedding_service, vector_store, physics_engine)
    
    # Store references
    app.state.embedding_service = embedding_service
    app.state.vector_store = vector_store
    app.state.physics_engine = physics_engine
    app.state.socket_manager = socket_manager
    
    # Mount Socket.IO
    socket_app = socket_manager.get_asgi_app()
    app.mount("/socket.io", socket_app)
    socket_manager.register_handlers()
    
    # Load existing items into physics engine
    print("Getting items for physics engine...")
    try:
        async with async_session() as session:
            result = await session.execute(select(Item))
            items = result.scalars().all()
            
            count = 0
            for item in items:
                physics_engine.add_body(PhysicsBody(
                    id=item.id,
                    x=item.position_x,
                    y=item.position_y,
                    embedding=item.embedding,
                    cluster_id=item.cluster_id
                ))
                count += 1
            print(f"✅ Loaded {count} items into physics engine")
    except Exception as e:
        print(f"⚠️  Failed to load items into physics engine: {e}")
    
    # Start physics loop
    asyncio.create_task(socket_manager.start_physics_loop(physics_engine))
    print("✅ Physics engine started")
    
    print("🚀 Synapse Backend Ready!")
    
    yield
    
    # Shutdown
    print("Shutting down Synapse Backend...")
    socket_manager.stop_physics_loop()
    await close_db()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application"""
    
    app = FastAPI(
        title="Synapse API",
        description="Gravity-Based AI Workspace Backend",
        version="0.1.0",
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8080",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(items_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(workspace_router, prefix="/api")
    app.include_router(file_router)  # File router includes its own prefix
    app.include_router(cluster_router)  # Cluster router includes its own prefix
    app.include_router(settings_router)  # Settings router includes its own prefix
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        return {
            "status": "healthy",
            "version": "0.1.0",
            "services": {
                "embedding": hasattr(app.state, "embedding_service") and app.state.embedding_service is not None,
                "vector_store": hasattr(app.state, "vector_store") and app.state.vector_store is not None,
                "physics": hasattr(app.state, "physics_engine") and app.state.physics_engine is not None
            }
        }
    
    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
