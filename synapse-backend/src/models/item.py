"""
Data models for Synapse items (nodes in the knowledge graph)
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class ItemType(str, Enum):
    """Types of content that can be added to the canvas"""
    NOTE = "note"
    LINK = "link"
    IMAGE = "image"
    PDF = "pdf"
    CODE = "code"
    FILE = "file"


class Item(BaseModel):
    """
    Represents a single item/node in the Synapse workspace.
    Each item has semantic embedding and physical position.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    item_type: ItemType
    
    # Semantic embedding vector (1536 dims for text-embedding-3-small)
    embedding: Optional[List[float]] = None
    
    # Physical position on canvas
    position_x: float = 0.0
    position_y: float = 0.0
    
    # Physics properties
    velocity_x: float = 0.0
    velocity_y: float = 0.0
    mass: float = 1.0
    radius: float = 40.0
    
    # Clustering
    cluster_id: Optional[str] = None
    
    # Metadata
    title: Optional[str] = None
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    # For links - extracted content
    extracted_text: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "content": "Machine learning is a subset of artificial intelligence...",
                "item_type": "note",
                "position_x": 100.0,
                "position_y": 200.0,
                "cluster_id": "ai-research"
            }
        }


class ItemCreate(BaseModel):
    """Request model for creating a new item"""
    workspace_id: str
    content: str
    item_type: ItemType
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    title: Optional[str] = None
    source_url: Optional[str] = None


class ItemUpdate(BaseModel):
    """Request model for updating an item"""
    content: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    cluster_id: Optional[str] = None


class SimilarityResult(BaseModel):
    """Result of semantic similarity query"""
    item_id: str
    similarity_score: float
    item: Item


class Cluster(BaseModel):
    """Represents a cluster of semantically related items"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    center_x: float = 0.0
    center_y: float = 0.0
    item_count: int = 0
    color: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
