"""
ChromaDB Vector Store Service

Local vector database for privacy-focused embedding storage and retrieval.
Alternative to cloud-based Pinecone for offline-first mode.
"""

import os
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
import asyncio


@dataclass
class ChromaConfig:
    """Configuration for ChromaDB"""
    persist_directory: str = "./data/chroma"
    collection_name: str = "synapse_items"
    distance_function: str = "cosine"  # cosine, l2, ip
    
    @classmethod
    def from_env(cls) -> "ChromaConfig":
        return cls(
            persist_directory=os.getenv("CHROMA_PERSIST_DIR", "./data/chroma"),
            collection_name=os.getenv("CHROMA_COLLECTION", "synapse_items"),
            distance_function=os.getenv("CHROMA_DISTANCE", "cosine"),
        )


class ChromaVectorStore:
    """
    Local vector store using ChromaDB.
    Provides similar functionality to Pinecone but runs entirely locally.
    """
    
    def __init__(self, config: Optional[ChromaConfig] = None):
        self.config = config or ChromaConfig.from_env()
        self._client = None
        self._collection = None
        self._is_initialized = False
    
    async def initialize(self) -> bool:
        """Initialize ChromaDB client and collection"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Ensure directory exists
            os.makedirs(self.config.persist_directory, exist_ok=True)
            
            # Create persistent client
            self._client = chromadb.PersistentClient(
                path=self.config.persist_directory,
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                ),
            )
            
            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name=self.config.collection_name,
                metadata={"hnsw:space": self.config.distance_function},
            )
            
            self._is_initialized = True
            print(f"ChromaDB initialized: {self.config.persist_directory}")
            print(f"Collection: {self.config.collection_name} ({self._collection.count()} items)")
            return True
            
        except ImportError:
            print("ChromaDB not installed. Install with: pip install chromadb")
            return False
        except Exception as e:
            print(f"ChromaDB initialization failed: {e}")
            return False
    
    @property
    def is_available(self) -> bool:
        """Check if ChromaDB is initialized and available"""
        return self._is_initialized and self._collection is not None
    
    async def upsert(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        documents: Optional[List[str]] = None,
    ) -> bool:
        """Insert or update vectors in the collection"""
        if not self.is_available:
            raise RuntimeError("ChromaDB not initialized")
        
        try:
            # Run in thread pool to avoid blocking
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    metadatas=metadatas,
                    documents=documents,
                )
            )
            return True
        except Exception as e:
            print(f"ChromaDB upsert failed: {e}")
            return False
    
    async def query(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
        include: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Query the collection for similar vectors"""
        if not self.is_available:
            raise RuntimeError("ChromaDB not initialized")
        
        include = include or ["metadatas", "distances", "documents"]
        
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._collection.query(
                    query_embeddings=[query_embedding],
                    n_results=n_results,
                    where=where,
                    include=include,
                )
            )
            
            # Flatten the results (ChromaDB returns nested lists)
            return {
                "ids": result["ids"][0] if result["ids"] else [],
                "distances": result["distances"][0] if result.get("distances") else [],
                "metadatas": result["metadatas"][0] if result.get("metadatas") else [],
                "documents": result["documents"][0] if result.get("documents") else [],
            }
        except Exception as e:
            print(f"ChromaDB query failed: {e}")
            return {"ids": [], "distances": [], "metadatas": [], "documents": []}
    
    async def delete(self, ids: List[str]) -> bool:
        """Delete vectors by ID"""
        if not self.is_available:
            raise RuntimeError("ChromaDB not initialized")
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._collection.delete(ids=ids)
            )
            return True
        except Exception as e:
            print(f"ChromaDB delete failed: {e}")
            return False
    
    async def get(
        self,
        ids: List[str],
        include: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Get vectors by ID"""
        if not self.is_available:
            raise RuntimeError("ChromaDB not initialized")
        
        include = include or ["metadatas", "embeddings", "documents"]
        
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._collection.get(ids=ids, include=include)
            )
            return result
        except Exception as e:
            print(f"ChromaDB get failed: {e}")
            return {"ids": [], "metadatas": [], "embeddings": [], "documents": []}
    
    async def count(self) -> int:
        """Get the number of items in the collection"""
        if not self.is_available:
            return 0
        
        try:
            return await asyncio.get_event_loop().run_in_executor(
                None,
                self._collection.count
            )
        except Exception:
            return 0
    
    async def reset(self) -> bool:
        """Reset the collection (delete all data)"""
        if not self._client:
            return False
        
        try:
            self._client.delete_collection(self.config.collection_name)
            self._collection = self._client.create_collection(
                name=self.config.collection_name,
                metadata={"hnsw:space": self.config.distance_function},
            )
            return True
        except Exception as e:
            print(f"ChromaDB reset failed: {e}")
            return False


class UnifiedVectorStore:
    """
    Unified vector store that supports both Pinecone and ChromaDB.
    Automatically uses the appropriate backend based on configuration.
    """
    
    def __init__(
        self,
        use_local: bool = False,
        pinecone_api_key: Optional[str] = None,
        pinecone_index: Optional[str] = None,
    ):
        self.use_local = use_local or os.getenv("PRIVACY_MODE", "false").lower() == "true"
        self._chroma: Optional[ChromaVectorStore] = None
        self._pinecone = None
        self._pinecone_index = pinecone_index or os.getenv("PINECONE_INDEX", "synapse")
        self._pinecone_api_key = pinecone_api_key or os.getenv("PINECONE_API_KEY")
    
    async def initialize(self) -> bool:
        """Initialize the appropriate vector store"""
        if self.use_local:
            self._chroma = ChromaVectorStore()
            return await self._chroma.initialize()
        else:
            return await self._init_pinecone()
    
    async def _init_pinecone(self) -> bool:
        """Initialize Pinecone client"""
        if not self._pinecone_api_key:
            print("Pinecone API key not configured, falling back to ChromaDB")
            self.use_local = True
            self._chroma = ChromaVectorStore()
            return await self._chroma.initialize()
        
        try:
            from pinecone import Pinecone
            
            pc = Pinecone(api_key=self._pinecone_api_key)
            self._pinecone = pc.Index(self._pinecone_index)
            print(f"Pinecone initialized: {self._pinecone_index}")
            return True
        except ImportError:
            print("Pinecone not installed, falling back to ChromaDB")
            self.use_local = True
            self._chroma = ChromaVectorStore()
            return await self._chroma.initialize()
        except Exception as e:
            print(f"Pinecone initialization failed: {e}")
            return False
    
    @property
    def is_available(self) -> bool:
        """Check if vector store is available"""
        if self.use_local:
            return self._chroma is not None and self._chroma.is_available
        return self._pinecone is not None
    
    async def upsert(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """Upsert vectors"""
        if self.use_local:
            return await self._chroma.upsert(ids, embeddings, metadatas)
        else:
            return await self._upsert_pinecone(ids, embeddings, metadatas)
    
    async def _upsert_pinecone(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> bool:
        """Upsert to Pinecone"""
        try:
            vectors = []
            for i, (id_, emb) in enumerate(zip(ids, embeddings)):
                vector = {"id": id_, "values": emb}
                if metadatas and i < len(metadatas):
                    vector["metadata"] = metadatas[i]
                vectors.append(vector)
            
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._pinecone.upsert(vectors=vectors)
            )
            return True
        except Exception as e:
            print(f"Pinecone upsert failed: {e}")
            return False
    
    async def query(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """
        Query for similar vectors.
        Returns list of (id, score, metadata) tuples.
        """
        if self.use_local:
            result = await self._chroma.query(
                query_embedding=query_embedding,
                n_results=top_k,
                where=filter,
            )
            return [
                (id_, 1 - dist, meta)  # Convert distance to similarity
                for id_, dist, meta in zip(
                    result["ids"],
                    result["distances"],
                    result["metadatas"],
                )
            ]
        else:
            return await self._query_pinecone(query_embedding, top_k, filter)
    
    async def _query_pinecone(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[str, float, Dict[str, Any]]]:
        """Query Pinecone"""
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._pinecone.query(
                    vector=query_embedding,
                    top_k=top_k,
                    filter=filter,
                    include_metadata=True,
                )
            )
            return [
                (match.id, match.score, match.metadata or {})
                for match in result.matches
            ]
        except Exception as e:
            print(f"Pinecone query failed: {e}")
            return []
    
    async def delete(self, ids: List[str]) -> bool:
        """Delete vectors by ID"""
        if self.use_local:
            return await self._chroma.delete(ids)
        else:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self._pinecone.delete(ids=ids)
                )
                return True
            except Exception as e:
                print(f"Pinecone delete failed: {e}")
                return False
    
    async def get_status(self) -> Dict[str, Any]:
        """Get vector store status"""
        if self.use_local:
            count = await self._chroma.count() if self._chroma else 0
            return {
                "backend": "chroma",
                "available": self._chroma.is_available if self._chroma else False,
                "count": count,
                "persist_directory": self._chroma.config.persist_directory if self._chroma else None,
            }
        else:
            return {
                "backend": "pinecone",
                "available": self._pinecone is not None,
                "index": self._pinecone_index,
            }


# Singleton instance
_vector_store: Optional[UnifiedVectorStore] = None


def get_vector_store() -> UnifiedVectorStore:
    """Get the singleton vector store instance"""
    global _vector_store
    if _vector_store is None:
        use_local = os.getenv("VECTOR_STORE", "pinecone").lower() == "chroma"
        _vector_store = UnifiedVectorStore(use_local=use_local)
    return _vector_store


async def init_vector_store() -> UnifiedVectorStore:
    """Initialize and return the vector store"""
    store = get_vector_store()
    await store.initialize()
    
    status = await store.get_status()
    print(f"Vector Store Status: {status}")
    
    return store
