"""
OpenAI Embedding Service for Synapse
Generates vector embeddings for content using text-embedding-3-small
"""
import os
from typing import List, Optional
import openai
import numpy as np
from langchain_openai import OpenAIEmbeddings


class EmbeddingService:
    """
    Service for generating and managing text embeddings.
    Uses OpenAI's text-embedding-3-small model (1536 dimensions).
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None, 
        provider: str = "openai",
        model: Optional[str] = None
    ):
        """
        Initialize the embedding service.
        
        Args:
            api_key: OpenAI API key (required if provider is 'openai')
            provider: 'openai' or 'ollama'
            model: Model name (defaults based on provider)
        """
        self.provider = provider
        
        if provider == "openai":
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            self.model = model or "text-embedding-3-small"
            
            if not self.api_key:
                # If no key, warn but don't crash yet (might switch to ollama)
                print("⚠️ Warning: OpenAI API key is missing")
            
            self.client = openai.OpenAI(api_key=self.api_key)
            self.dimensions = 1536
            
            # LangChain wrapper
            if self.api_key:
                self.embeddings = OpenAIEmbeddings(
                    model=self.model,
                    openai_api_key=self.api_key
                )
        
        elif provider == "ollama":
            from langchain_community.embeddings import OllamaEmbeddings
            
            # Use local Ollama
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            self.model = model or "nomic-embed-text"
            
            self.embeddings = OllamaEmbeddings(
                base_url=base_url,
                model=self.model
            )
            # Dimensions depend on model (nomic-embed-text is 768)
            self.dimensions = 768
            print(f"✅ Initialized Ollama embeddings with model: {self.model}")
    
    async def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: The text to embed
            
        Returns:
            List of floating point values
        """
        if not self.embeddings:
            raise ValueError("Embedding service not initialized properly")

        # Truncate text if too long
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars]
        
        # Use LangChain wrapper (works for both OpenAI and Ollama)
        return await self.embeddings.aembed_query(text)
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in batch.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        if not self.embeddings:
            raise ValueError("Embedding service not initialized properly")

        # Truncate texts
        max_chars = 8000
        truncated_texts = [t[:max_chars] if len(t) > max_chars else t for t in texts]
        
        # Use LangChain wrapper
        return await self.embeddings.aembed_documents(truncated_texts)
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compute cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score (0 to 1)
        """
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Normalize vectors
        vec1_norm = vec1 / np.linalg.norm(vec1)
        vec2_norm = vec2 / np.linalg.norm(vec2)
        
        # Compute cosine similarity
        similarity = np.dot(vec1_norm, vec2_norm)
        
        # Convert to 0-1 range
        return float((similarity + 1) / 2)
    
    def compute_similarities(self, query_embedding: List[float], embeddings: List[List[float]]) -> List[float]:
        """
        Compute similarities between query and multiple embeddings.
        
        Args:
            query_embedding: The query embedding
            embeddings: List of embeddings to compare against
            
        Returns:
            List of similarity scores
        """
        query_vec = np.array(query_embedding)
        query_norm = query_vec / np.linalg.norm(query_vec)
        
        similarities = []
        for emb in embeddings:
            emb_vec = np.array(emb)
            emb_norm = emb_vec / np.linalg.norm(emb_vec)
            sim = np.dot(query_norm, emb_norm)
            similarities.append(float((sim + 1) / 2))
        
        return similarities
