"""
Privacy and Settings API Routes

Manages user preferences for embedding providers, privacy mode,
and system configuration.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum

from ..services.ollama_service import (
    get_embedding_service,
    EmbeddingProvider,
    OllamaModel,
)
from ..services.chroma_service import get_vector_store
from ..api.auth_routes import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


# Request/Response Models

class EmbeddingProviderEnum(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"


class OllamaModelEnum(str, Enum):
    NOMIC_EMBED = "nomic-embed-text"
    ALL_MINILM = "all-minilm"
    MXBAI_LARGE = "mxbai-embed-large"
    BGE_M3 = "bge-m3"


class PrivacySettingsRequest(BaseModel):
    privacy_mode: bool = Field(
        default=False,
        description="Enable privacy mode (forces local processing)"
    )
    embedding_provider: EmbeddingProviderEnum = Field(
        default=EmbeddingProviderEnum.OPENAI,
        description="Embedding provider to use"
    )
    ollama_model: Optional[OllamaModelEnum] = Field(
        default=OllamaModelEnum.NOMIC_EMBED,
        description="Ollama model for local embeddings"
    )


class SystemStatusResponse(BaseModel):
    embedding_service: Dict[str, Any]
    vector_store: Dict[str, Any]
    privacy_mode: bool


class OllamaStatusResponse(BaseModel):
    available: bool
    base_url: str
    current_model: str
    available_models: List[str]


class ModelPullRequest(BaseModel):
    model: OllamaModelEnum = Field(
        default=OllamaModelEnum.NOMIC_EMBED,
        description="Model to pull"
    )


# Routes

@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    current_user: dict = Depends(get_current_user)
):
    """Get overall system status including embedding and vector store services"""
    embedding_service = get_embedding_service()
    vector_store = get_vector_store()
    
    embedding_status = await embedding_service.get_status()
    vector_status = await vector_store.get_status()
    
    return SystemStatusResponse(
        embedding_service=embedding_status,
        vector_store=vector_status,
        privacy_mode=embedding_service.config.privacy_mode,
    )


@router.get("/ollama/status", response_model=OllamaStatusResponse)
async def get_ollama_status(
    current_user: dict = Depends(get_current_user)
):
    """Get Ollama service status and available models"""
    from ..services.ollama_service import OllamaEmbeddingService
    
    ollama = OllamaEmbeddingService()
    is_available = await ollama.check_availability()
    models = await ollama.list_models() if is_available else []
    
    await ollama.close()
    
    return OllamaStatusResponse(
        available=is_available,
        base_url=ollama.config.ollama_base_url,
        current_model=ollama.config.ollama_model.value,
        available_models=models,
    )


@router.post("/ollama/pull")
async def pull_ollama_model(
    request: ModelPullRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Pull an Ollama model in the background.
    This can take several minutes for large models.
    """
    from ..services.ollama_service import OllamaEmbeddingService
    
    ollama = OllamaEmbeddingService()
    is_available = await ollama.check_availability()
    
    if not is_available:
        await ollama.close()
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please start Ollama first."
        )
    
    # Start pull in background
    async def pull_model():
        try:
            success = await ollama.pull_model(request.model.value)
            if success:
                print(f"Successfully pulled model: {request.model.value}")
            else:
                print(f"Failed to pull model: {request.model.value}")
        finally:
            await ollama.close()
    
    background_tasks.add_task(pull_model)
    
    return {
        "status": "pulling",
        "model": request.model.value,
        "message": "Model pull started in background. This may take several minutes."
    }


@router.post("/ollama/test")
async def test_ollama_embedding(
    current_user: dict = Depends(get_current_user)
):
    """Test Ollama embedding generation"""
    from ..services.ollama_service import OllamaEmbeddingService
    
    ollama = OllamaEmbeddingService()
    
    try:
        is_available = await ollama.check_availability()
        if not is_available:
            raise HTTPException(
                status_code=503,
                detail="Ollama is not running"
            )
        
        # Ensure model is available
        has_model = await ollama.ensure_model()
        if not has_model:
            raise HTTPException(
                status_code=503,
                detail=f"Model {ollama.config.ollama_model.value} not available"
            )
        
        # Generate test embedding
        test_text = "This is a test sentence for embedding generation."
        embedding = await ollama.embed_text(test_text)
        
        return {
            "success": True,
            "model": ollama.config.ollama_model.value,
            "dimensions": len(embedding),
            "sample": embedding[:5],  # First 5 dimensions
        }
    finally:
        await ollama.close()


@router.get("/embedding/dimensions")
async def get_embedding_dimensions(
    current_user: dict = Depends(get_current_user)
):
    """Get the current embedding dimensions based on configuration"""
    embedding_service = get_embedding_service()
    
    return {
        "provider": embedding_service.config.provider.value,
        "dimensions": embedding_service.get_dimensions(),
    }


@router.post("/privacy-mode/enable")
async def enable_privacy_mode(
    current_user: dict = Depends(get_current_user)
):
    """
    Enable privacy mode.
    This forces all processing to happen locally using Ollama and ChromaDB.
    """
    import os
    
    # Check if Ollama is available
    from ..services.ollama_service import OllamaEmbeddingService
    
    ollama = OllamaEmbeddingService()
    is_available = await ollama.check_availability()
    await ollama.close()
    
    if not is_available:
        raise HTTPException(
            status_code=503,
            detail="Cannot enable privacy mode: Ollama is not running. "
                   "Please install and start Ollama first: https://ollama.ai"
        )
    
    # Set environment variable (for current session)
    os.environ["PRIVACY_MODE"] = "true"
    os.environ["EMBEDDING_PROVIDER"] = "ollama"
    os.environ["VECTOR_STORE"] = "chroma"
    
    return {
        "privacy_mode": True,
        "message": "Privacy mode enabled. All processing will happen locally."
    }


@router.post("/privacy-mode/disable")
async def disable_privacy_mode(
    current_user: dict = Depends(get_current_user)
):
    """Disable privacy mode and use cloud services"""
    import os
    
    os.environ["PRIVACY_MODE"] = "false"
    
    return {
        "privacy_mode": False,
        "message": "Privacy mode disabled. Cloud services will be used when available."
    }


@router.get("/vector-store/status")
async def get_vector_store_status(
    current_user: dict = Depends(get_current_user)
):
    """Get vector store status"""
    vector_store = get_vector_store()
    
    if not vector_store.is_available:
        await vector_store.initialize()
    
    return await vector_store.get_status()


@router.post("/vector-store/migrate")
async def migrate_vector_store(
    to_local: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Migrate vectors between Pinecone and ChromaDB.
    This is a placeholder for future implementation.
    """
    return {
        "status": "not_implemented",
        "message": "Vector store migration is not yet implemented. "
                   "New items will automatically use the configured store."
    }
