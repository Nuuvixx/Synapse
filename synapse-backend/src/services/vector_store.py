"""
Vector Database Service for Synapse
Uses Pinecone for storing and querying embeddings
"""
import os
from typing import List, Optional, Dict, Any
import pinecone
from pinecone import Pinecone, ServerlessSpec
import numpy as np


class VectorStore:
    """
    Service for managing vector storage and similarity search.
    Uses Pinecone as the vector database.
    """
    
    def __init__(self, api_key: Optional[str] = None, index_name: str = "synapse-items"):
        """
        Initialize the vector store.
        
        Args:
            api_key: Pinecone API key
            index_name: Name of the Pinecone index
        """
        self.api_key = api_key or os.getenv("PINECONE_API_KEY")
        if not self.api_key:
            raise ValueError("Pinecone API key is required")
        
        self.index_name = index_name
        self.dimension = 1536  # text-embedding-3-small
        
        # Initialize Pinecone client
        self.pc = Pinecone(api_key=self.api_key)
        
        # Create index if it doesn't exist
        self._ensure_index_exists()
        
        # Get index reference
        self.index = self.pc.Index(self.index_name)
    
    def _ensure_index_exists(self):
        """Create the index if it doesn't exist"""
        existing_indexes = self.pc.list_indexes().names()
        
        if self.index_name not in existing_indexes:
            self.pc.create_index(
                name=self.index_name,
                dimension=self.dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
            print(f"Created Pinecone index: {self.index_name}")
    
    async def upsert_item(self, item_id: str, embedding: List[float], metadata: Dict[str, Any]):
        """
        Insert or update an item in the vector store.
        
        Args:
            item_id: Unique identifier for the item
            embedding: The embedding vector
            metadata: Additional metadata to store
        """
        # Clean metadata - Pinecone only accepts strings, numbers, booleans, lists of strings
        clean_metadata = self._clean_metadata(metadata)
        
        self.index.upsert(
            vectors=[{
                "id": item_id,
                "values": embedding,
                "metadata": clean_metadata
            }]
        )
    
    async def upsert_items(self, items: List[Dict[str, Any]]):
        """
        Batch insert/update items.
        
        Args:
            items: List of dicts with 'id', 'embedding', 'metadata'
        """
        vectors = []
        for item in items:
            clean_metadata = self._clean_metadata(item.get("metadata", {}))
            vectors.append({
                "id": item["id"],
                "values": item["embedding"],
                "metadata": clean_metadata
            })
        
        self.index.upsert(vectors=vectors)
    
    async def query_similar(
        self, 
        embedding: List[float], 
        top_k: int = 10,
        filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Query for similar items.
        
        Args:
            embedding: Query embedding vector
            top_k: Number of results to return
            filter_dict: Optional metadata filter
            
        Returns:
            List of similar items with scores
        """
        results = self.index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter_dict
        )
        
        return [
            {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata
            }
            for match in results.matches
        ]
    
    async def delete_item(self, item_id: str):
        """Delete an item from the vector store"""
        self.index.delete(ids=[item_id])
    
    async def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Get a single item by ID"""
        result = self.index.fetch(ids=[item_id])
        if item_id in result.vectors:
            vector = result.vectors[item_id]
            return {
                "id": item_id,
                "embedding": vector.values,
                "metadata": vector.metadata
            }
        return None
    
    def _clean_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Clean metadata for Pinecone compatibility.
        Only strings, numbers, booleans, and lists of strings are allowed.
        """
        clean = {}
        for key, value in metadata.items():
            if isinstance(value, (str, int, float, bool)):
                clean[key] = value
            elif isinstance(value, list) and all(isinstance(v, str) for v in value):
                clean[key] = value
            elif value is not None:
                # Convert other types to string
                clean[key] = str(value)
        return clean
