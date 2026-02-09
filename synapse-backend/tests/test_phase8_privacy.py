"""
Tests for Phase 8: Local LLM & Privacy Mode

Tests for Ollama embedding service, ChromaDB vector store,
and unified privacy-aware services.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
import numpy as np

from src.services.ollama_service import (
    OllamaEmbeddingService,
    UnifiedEmbeddingService,
    EmbeddingConfig,
    EmbeddingProvider,
    OllamaModel,
)
from src.services.chroma_service import (
    ChromaVectorStore,
    UnifiedVectorStore,
    ChromaConfig,
)


# ============ Ollama Service Tests ============

class TestOllamaConfig:
    """Tests for Ollama configuration"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = EmbeddingConfig()
        assert config.provider == EmbeddingProvider.OPENAI
        assert config.ollama_model == OllamaModel.NOMIC_EMBED
        assert config.ollama_base_url == "http://localhost:11434"
        assert config.privacy_mode is False
    
    def test_config_from_env(self):
        """Test configuration from environment variables"""
        with patch.dict('os.environ', {
            'PRIVACY_MODE': 'true',
            'OLLAMA_MODEL': 'all-minilm',
            'OLLAMA_BASE_URL': 'http://custom:11434',
        }):
            config = EmbeddingConfig.from_env()
            assert config.provider == EmbeddingProvider.OLLAMA  # Forced by privacy mode
            assert config.ollama_model == OllamaModel.ALL_MINILM
            assert config.ollama_base_url == 'http://custom:11434'
            assert config.privacy_mode is True


class TestOllamaEmbeddingService:
    """Tests for Ollama embedding service"""
    
    def test_model_dimensions(self):
        """Test model dimension mapping"""
        service = OllamaEmbeddingService()
        assert service.get_dimensions(OllamaModel.NOMIC_EMBED) == 768
        assert service.get_dimensions(OllamaModel.ALL_MINILM) == 384
        assert service.get_dimensions(OllamaModel.MXBAI_LARGE) == 1024
        assert service.get_dimensions(OllamaModel.BGE_M3) == 1024
    
    @pytest.mark.asyncio
    async def test_check_availability_not_running(self):
        """Test availability check when Ollama is not running"""
        service = OllamaEmbeddingService()
        with patch.object(service.client, 'get', side_effect=Exception("Connection refused")):
            result = await service.check_availability()
            assert result is False
    
    @pytest.mark.asyncio
    async def test_check_availability_running(self):
        """Test availability check when Ollama is running"""
        service = OllamaEmbeddingService()
        mock_response = Mock()
        mock_response.status_code = 200
        
        with patch.object(service.client, 'get', new_callable=AsyncMock, return_value=mock_response):
            result = await service.check_availability()
            assert result is True
    
    @pytest.mark.asyncio
    async def test_list_models(self):
        """Test listing available models"""
        service = OllamaEmbeddingService()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": "nomic-embed-text:latest"},
                {"name": "llama3:latest"},
            ]
        }
        
        with patch.object(service.client, 'get', new_callable=AsyncMock, return_value=mock_response):
            models = await service.list_models()
            assert "nomic-embed-text:latest" in models
            assert "llama3:latest" in models
    
    @pytest.mark.asyncio
    async def test_embed_text(self):
        """Test text embedding generation"""
        service = OllamaEmbeddingService()
        mock_embedding = [0.1] * 768
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"embedding": mock_embedding}
        
        with patch.object(service.client, 'post', new_callable=AsyncMock, return_value=mock_response):
            embedding = await service.embed_text("test text")
            assert len(embedding) == 768
            assert embedding == mock_embedding
    
    @pytest.mark.asyncio
    async def test_embed_batch(self):
        """Test batch embedding generation"""
        service = OllamaEmbeddingService()
        mock_embedding = [0.1] * 768
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"embedding": mock_embedding}
        
        with patch.object(service.client, 'post', new_callable=AsyncMock, return_value=mock_response):
            texts = ["text 1", "text 2", "text 3"]
            embeddings = await service.embed_batch(texts)
            assert len(embeddings) == 3
            for emb in embeddings:
                assert len(emb) == 768


class TestUnifiedEmbeddingService:
    """Tests for unified embedding service"""
    
    @pytest.mark.asyncio
    async def test_get_status(self):
        """Test getting service status"""
        config = EmbeddingConfig(
            provider=EmbeddingProvider.OPENAI,
            openai_api_key="test-key",
        )
        service = UnifiedEmbeddingService(config)
        
        with patch.object(service._ollama, 'check_availability', new_callable=AsyncMock, return_value=False):
            with patch.object(service._ollama, 'list_models', new_callable=AsyncMock, return_value=[]):
                status = await service.get_status()
                
                assert status['current_provider'] == 'openai'
                assert status['privacy_mode'] is False
                assert status['openai']['configured'] is True
                assert status['ollama']['available'] is False
    
    @pytest.mark.asyncio
    async def test_privacy_mode_forces_ollama(self):
        """Test that privacy mode forces Ollama usage"""
        config = EmbeddingConfig(
            privacy_mode=True,
            openai_api_key="test-key",
        )
        service = UnifiedEmbeddingService(config)
        
        mock_embedding = [0.1] * 768
        with patch.object(service._ollama, 'embed_text', new_callable=AsyncMock, return_value=mock_embedding):
            embedding = await service.embed_text("test")
            assert embedding == mock_embedding
            service._ollama.embed_text.assert_called_once()
    
    def test_get_dimensions_openai(self):
        """Test dimensions for OpenAI provider"""
        config = EmbeddingConfig(provider=EmbeddingProvider.OPENAI)
        service = UnifiedEmbeddingService(config)
        assert service.get_dimensions() == 1536
    
    def test_get_dimensions_ollama(self):
        """Test dimensions for Ollama provider"""
        config = EmbeddingConfig(
            provider=EmbeddingProvider.OLLAMA,
            ollama_model=OllamaModel.NOMIC_EMBED,
        )
        service = UnifiedEmbeddingService(config)
        assert service.get_dimensions() == 768


# ============ ChromaDB Service Tests ============

class TestChromaConfig:
    """Tests for ChromaDB configuration"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = ChromaConfig()
        assert config.persist_directory == "./data/chroma"
        assert config.collection_name == "synapse_items"
        assert config.distance_function == "cosine"


class TestChromaVectorStore:
    """Tests for ChromaDB vector store"""
    
    @pytest.mark.asyncio
    async def test_initialize_without_chromadb(self):
        """Test initialization when chromadb is not installed"""
        store = ChromaVectorStore()
        
        with patch.dict('sys.modules', {'chromadb': None}):
            with patch('builtins.__import__', side_effect=ImportError):
                result = await store.initialize()
                # Should handle gracefully
                assert store.is_available is False
    
    @pytest.mark.asyncio
    async def test_upsert_and_query(self):
        """Test upserting and querying vectors"""
        store = ChromaVectorStore(ChromaConfig(persist_directory="./test_chroma"))
        
        # Mock ChromaDB
        mock_collection = Mock()
        mock_collection.count.return_value = 0
        mock_collection.upsert = Mock()
        mock_collection.query = Mock(return_value={
            "ids": [["id1", "id2"]],
            "distances": [[0.1, 0.2]],
            "metadatas": [[{"key": "val1"}, {"key": "val2"}]],
            "documents": [["doc1", "doc2"]],
        })
        
        store._collection = mock_collection
        store._is_initialized = True
        
        # Test upsert
        ids = ["id1", "id2"]
        embeddings = [[0.1] * 768, [0.2] * 768]
        metadatas = [{"key": "val1"}, {"key": "val2"}]
        
        result = await store.upsert(ids, embeddings, metadatas)
        assert result is True
        
        # Test query
        query_result = await store.query([0.15] * 768, n_results=2)
        assert len(query_result["ids"]) == 2
        assert query_result["ids"] == ["id1", "id2"]


class TestUnifiedVectorStore:
    """Tests for unified vector store"""
    
    @pytest.mark.asyncio
    async def test_local_mode(self):
        """Test local mode uses ChromaDB"""
        store = UnifiedVectorStore(use_local=True)
        assert store.use_local is True
    
    @pytest.mark.asyncio
    async def test_fallback_to_chroma_without_pinecone(self):
        """Test fallback to ChromaDB when Pinecone is not configured"""
        with patch.dict('os.environ', {'PINECONE_API_KEY': ''}, clear=False):
            store = UnifiedVectorStore(use_local=False)
            
            # Mock ChromaDB initialization
            with patch.object(store, '_chroma', None):
                mock_chroma = Mock()
                mock_chroma.initialize = AsyncMock(return_value=True)
                mock_chroma.is_available = True
                
                with patch('src.services.chroma_service.ChromaVectorStore', return_value=mock_chroma):
                    await store.initialize()
                    # Should fall back to local
                    assert store.use_local is True


# ============ Integration Tests ============

class TestPrivacyModeIntegration:
    """Integration tests for privacy mode"""
    
    @pytest.mark.asyncio
    async def test_full_privacy_mode_workflow(self):
        """Test complete privacy mode workflow"""
        # Create config with privacy mode
        config = EmbeddingConfig(privacy_mode=True)
        embedding_service = UnifiedEmbeddingService(config)
        vector_store = UnifiedVectorStore(use_local=True)
        
        # Verify privacy mode is active
        assert embedding_service.config.privacy_mode is True
        assert vector_store.use_local is True
        
        # Clean up
        await embedding_service.close()


# Running the tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
