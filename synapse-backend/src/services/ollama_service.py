"""
Ollama Embedding Service

Provides local embedding generation using Ollama with various models:
- nomic-embed-text (recommended, 768 dimensions)
- all-minilm (384 dimensions)
- mxbai-embed-large (1024 dimensions)

Supports offline-first mode for privacy-conscious users.
"""

import os
import asyncio
import httpx
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class EmbeddingProvider(str, Enum):
    """Available embedding providers"""
    OPENAI = "openai"
    OLLAMA = "ollama"


class OllamaModel(str, Enum):
    """Supported Ollama embedding models"""
    NOMIC_EMBED = "nomic-embed-text"
    ALL_MINILM = "all-minilm"
    MXBAI_LARGE = "mxbai-embed-large"
    BGE_M3 = "bge-m3"


@dataclass
class EmbeddingConfig:
    """Configuration for embedding service"""
    provider: EmbeddingProvider = EmbeddingProvider.OPENAI
    ollama_model: OllamaModel = OllamaModel.NOMIC_EMBED
    ollama_base_url: str = "http://localhost:11434"
    openai_api_key: Optional[str] = None
    openai_model: str = "text-embedding-3-small"
    privacy_mode: bool = False  # When True, forces local embedding
    
    @classmethod
    def from_env(cls) -> "EmbeddingConfig":
        """Create config from environment variables"""
        privacy_mode = os.getenv("PRIVACY_MODE", "false").lower() == "true"
        
        # If privacy mode is enabled, force Ollama
        if privacy_mode:
            provider = EmbeddingProvider.OLLAMA
        else:
            provider_str = os.getenv("EMBEDDING_PROVIDER", "openai").lower()
            provider = EmbeddingProvider(provider_str) if provider_str in ["openai", "ollama"] else EmbeddingProvider.OPENAI
        
        return cls(
            provider=provider,
            ollama_model=OllamaModel(os.getenv("OLLAMA_MODEL", "nomic-embed-text")),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
            privacy_mode=privacy_mode,
        )


class OllamaEmbeddingService:
    """Service for generating embeddings using Ollama"""
    
    # Model dimension mapping
    MODEL_DIMENSIONS = {
        OllamaModel.NOMIC_EMBED: 768,
        OllamaModel.ALL_MINILM: 384,
        OllamaModel.MXBAI_LARGE: 1024,
        OllamaModel.BGE_M3: 1024,
    }
    
    def __init__(self, config: Optional[EmbeddingConfig] = None):
        self.config = config or EmbeddingConfig.from_env()
        self._client: Optional[httpx.AsyncClient] = None
        self._is_available: Optional[bool] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.config.ollama_base_url,
                timeout=60.0,
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def check_availability(self) -> bool:
        """Check if Ollama is running and accessible"""
        try:
            response = await self.client.get("/api/tags")
            self._is_available = response.status_code == 200
            return self._is_available
        except Exception:
            self._is_available = False
            return False
    
    async def list_models(self) -> List[str]:
        """List available models in Ollama"""
        try:
            response = await self.client.get("/api/tags")
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
            return []
        except Exception:
            return []
    
    async def pull_model(self, model: str) -> bool:
        """Pull a model if not available"""
        try:
            response = await self.client.post(
                "/api/pull",
                json={"name": model},
                timeout=300.0,  # Model pulling can take a while
            )
            return response.status_code == 200
        except Exception:
            return False
    
    async def ensure_model(self, model: Optional[str] = None) -> bool:
        """Ensure the specified model is available, pull if needed"""
        model = model or self.config.ollama_model.value
        available_models = await self.list_models()
        
        # Check if model is already available
        if any(model in m for m in available_models):
            return True
        
        # Try to pull the model
        print(f"Pulling Ollama model: {model}")
        return await self.pull_model(model)
    
    async def embed_text(self, text: str, model: Optional[str] = None) -> List[float]:
        """Generate embedding for a single text"""
        model = model or self.config.ollama_model.value
        
        try:
            response = await self.client.post(
                "/api/embeddings",
                json={
                    "model": model,
                    "prompt": text,
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("embedding", [])
            else:
                raise Exception(f"Ollama embedding failed: {response.text}")
                
        except httpx.ConnectError:
            raise ConnectionError(
                "Cannot connect to Ollama. Please ensure Ollama is running: "
                f"ollama serve (default: {self.config.ollama_base_url})"
            )
    
    async def embed_batch(
        self, 
        texts: List[str], 
        model: Optional[str] = None,
        batch_size: int = 10
    ) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        model = model or self.config.ollama_model.value
        embeddings = []
        
        # Process in batches to avoid overwhelming Ollama
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = await asyncio.gather(
                *[self.embed_text(text, model) for text in batch]
            )
            embeddings.extend(batch_embeddings)
        
        return embeddings
    
    def get_dimensions(self, model: Optional[str] = None) -> int:
        """Get embedding dimensions for the model"""
        model = model or self.config.ollama_model
        if isinstance(model, str):
            try:
                model = OllamaModel(model)
            except ValueError:
                return 768  # Default fallback
        return self.MODEL_DIMENSIONS.get(model, 768)


class UnifiedEmbeddingService:
    """
    Unified embedding service that supports both OpenAI and Ollama.
    Automatically falls back to local when OpenAI is unavailable.
    """
    
    def __init__(self, config: Optional[EmbeddingConfig] = None):
        self.config = config or EmbeddingConfig.from_env()
        self._ollama = OllamaEmbeddingService(self.config)
        self._openai_client = None
    
    async def _get_openai_client(self):
        """Lazily initialize OpenAI client"""
        if self._openai_client is None and self.config.openai_api_key:
            try:
                from openai import AsyncOpenAI
                self._openai_client = AsyncOpenAI(api_key=self.config.openai_api_key)
            except ImportError:
                pass
        return self._openai_client
    
    async def close(self):
        """Close all clients"""
        await self._ollama.close()
    
    async def get_status(self) -> Dict[str, Any]:
        """Get status of embedding providers"""
        ollama_available = await self._ollama.check_availability()
        ollama_models = await self._ollama.list_models() if ollama_available else []
        
        return {
            "current_provider": self.config.provider.value,
            "privacy_mode": self.config.privacy_mode,
            "openai": {
                "configured": bool(self.config.openai_api_key),
                "model": self.config.openai_model,
            },
            "ollama": {
                "available": ollama_available,
                "base_url": self.config.ollama_base_url,
                "model": self.config.ollama_model.value,
                "available_models": ollama_models,
            },
        }
    
    async def embed_text(self, text: str) -> List[float]:
        """Generate embedding using configured provider"""
        
        # Privacy mode forces local
        if self.config.privacy_mode or self.config.provider == EmbeddingProvider.OLLAMA:
            return await self._embed_ollama(text)
        
        # Try OpenAI first
        if self.config.openai_api_key:
            try:
                return await self._embed_openai(text)
            except Exception as e:
                print(f"OpenAI embedding failed, falling back to Ollama: {e}")
        
        # Fallback to Ollama
        return await self._embed_ollama(text)
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        
        if self.config.privacy_mode or self.config.provider == EmbeddingProvider.OLLAMA:
            return await self._ollama.embed_batch(texts)
        
        # OpenAI supports batch embedding natively
        if self.config.openai_api_key:
            try:
                return await self._embed_openai_batch(texts)
            except Exception as e:
                print(f"OpenAI batch embedding failed, falling back to Ollama: {e}")
        
        return await self._ollama.embed_batch(texts)
    
    async def _embed_openai(self, text: str) -> List[float]:
        """Generate embedding using OpenAI"""
        client = await self._get_openai_client()
        if not client:
            raise ValueError("OpenAI client not configured")
        
        response = await client.embeddings.create(
            model=self.config.openai_model,
            input=text,
        )
        return response.data[0].embedding
    
    async def _embed_openai_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate batch embeddings using OpenAI"""
        client = await self._get_openai_client()
        if not client:
            raise ValueError("OpenAI client not configured")
        
        response = await client.embeddings.create(
            model=self.config.openai_model,
            input=texts,
        )
        return [item.embedding for item in response.data]
    
    async def _embed_ollama(self, text: str) -> List[float]:
        """Generate embedding using Ollama"""
        return await self._ollama.embed_text(text)
    
    def get_dimensions(self) -> int:
        """Get embedding dimensions for current configuration"""
        if self.config.provider == EmbeddingProvider.OPENAI:
            # OpenAI text-embedding-3-small returns 1536 dimensions
            return 1536
        return self._ollama.get_dimensions()


# Singleton instance
_embedding_service: Optional[UnifiedEmbeddingService] = None


def get_embedding_service() -> UnifiedEmbeddingService:
    """Get the singleton embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = UnifiedEmbeddingService()
    return _embedding_service


async def init_embedding_service() -> UnifiedEmbeddingService:
    """Initialize and return the embedding service"""
    service = get_embedding_service()
    status = await service.get_status()
    
    print(f"Embedding Service Status:")
    print(f"  Provider: {status['current_provider']}")
    print(f"  Privacy Mode: {status['privacy_mode']}")
    print(f"  OpenAI: {'configured' if status['openai']['configured'] else 'not configured'}")
    print(f"  Ollama: {'available' if status['ollama']['available'] else 'not available'}")
    
    return service
