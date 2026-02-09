"""
Database Models for Synapse
SQLAlchemy ORM models for users, workspaces, and items
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Text, Float, Boolean, DateTime, ForeignKey, 
    Index, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from .connection import Base


class ItemType(str, enum.Enum):
    """Types of items in the workspace"""
    NOTE = "note"
    LINK = "link"
    IMAGE = "image"
    PDF = "pdf"
    CODE = "code"
    FILE = "file"


class WorkspaceRole(str, enum.Enum):
    """User roles within a workspace"""
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(Base):
    """User account model"""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # OAuth providers
    github_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    google_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    
    # Settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    owned_workspaces: Mapped[List["Workspace"]] = relationship(
        "Workspace", back_populates="owner", cascade="all, delete-orphan"
    )
    workspace_memberships: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="user", cascade="all, delete-orphan"
    )
    created_items: Mapped[List["Item"]] = relationship(
        "Item", back_populates="created_by_user"
    )

    def __repr__(self):
        return f"<User {self.email}>"


class Workspace(Base):
    """Workspace (canvas) model"""
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    
    # Settings
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_anonymous_view: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Physics settings
    gravity_strength: Mapped[float] = mapped_column(Float, default=5000.0)
    similarity_threshold: Mapped[float] = mapped_column(Float, default=0.7)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="owned_workspaces")
    members: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan"
    )
    items: Mapped[List["Item"]] = relationship(
        "Item", back_populates="workspace", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Workspace {self.name}>"


class WorkspaceMember(Base):
    """Workspace membership (many-to-many with roles)"""
    __tablename__ = "workspace_members"

    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[WorkspaceRole] = mapped_column(
        SQLEnum(WorkspaceRole), default=WorkspaceRole.VIEWER
    )
    
    # Timestamps
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="workspace_memberships")

    __table_args__ = (
        Index("ix_workspace_members_workspace_user", "workspace_id", "user_id", unique=True),
    )


class Item(Base):
    """Item (node) on the workspace canvas"""
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    # Link to uploaded file (if item represents a file)
    file_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    
    # Content
    item_type: Mapped[ItemType] = mapped_column(SQLEnum(ItemType), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # For links
    source_url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    
    # For files
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Extracted text (from PDFs, images via OCR)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Position on canvas
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Physics properties
    velocity_x: Mapped[float] = mapped_column(Float, default=0.0)
    velocity_y: Mapped[float] = mapped_column(Float, default=0.0)
    mass: Mapped[float] = mapped_column(Float, default=1.0)
    radius: Mapped[float] = mapped_column(Float, default=40.0)
    
    # Clustering
    cluster_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    
    # Embedding stored as JSON (PostgreSQL can use ARRAY, but JSON is more portable)
    embedding: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="items")
    created_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="created_items")

    __table_args__ = (
        Index("ix_items_workspace", "workspace_id"),
        Index("ix_items_type", "item_type"),
    )

    def __repr__(self):
        return f"<Item {self.item_type}: {self.title or self.id[:8]}>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "created_by": self.created_by,
            "item_type": self.item_type.value,
            "title": self.title,
            "content": self.content,
            "source_url": self.source_url,
            "file_path": self.file_path,
            "extracted_text": self.extracted_text,
            "position_x": self.position_x,
            "position_y": self.position_y,
            "velocity_x": self.velocity_x,
            "velocity_y": self.velocity_y,
            "mass": self.mass,
            "radius": self.radius,
            "cluster_id": self.cluster_id,
            "embedding": self.embedding.get("vector") if self.embedding else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class File(Base):
    """Uploaded file metadata"""
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    
    # File info
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[int] = mapped_column(nullable=False)  # bytes
    
    # Storage
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(50), default="local")  # local or s3
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Processing status
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Extracted content
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    embedding: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Associated item (if created as an item on canvas)
    item_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("items.id", ondelete="SET NULL"), nullable=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    __table_args__ = (
        Index("ix_files_workspace", "workspace_id"),
        Index("ix_files_uploaded_by", "uploaded_by"),
    )
    
    def __repr__(self):
        return f"<File {self.original_filename}>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "uploaded_by": self.uploaded_by,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "content_type": self.content_type,
            "size": self.size,
            "storage_path": self.storage_path,
            "thumbnail_path": self.thumbnail_path,
            "is_processed": self.is_processed,
            "processing_error": self.processing_error,
            "extracted_text": self.extracted_text,
            "item_id": self.item_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
        }


class Cluster(Base):
    """Semantic cluster of items"""
    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    
    # Cluster metadata
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#4ECDC4")
    
    # Position and size on canvas
    center_x: Mapped[float] = mapped_column(Float, default=0.0)
    center_y: Mapped[float] = mapped_column(Float, default=0.0)
    radius: Mapped[float] = mapped_column(Float, default=200.0)
    
    # Keywords for the cluster (stored as JSON array)
    keywords: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Whether this cluster was auto-generated or manually created
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("ix_clusters_workspace", "workspace_id"),
    )

    def __repr__(self):
        return f"<Cluster {self.name}>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "color": self.color,
            "center_x": self.center_x,
            "center_y": self.center_y,
            "radius": self.radius,
            "keywords": self.keywords.get("words", []) if self.keywords else [],
            "is_auto_generated": self.is_auto_generated,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
