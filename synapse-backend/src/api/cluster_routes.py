"""
Cluster API Routes
Endpoints for managing semantic clusters
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from ..database.connection import get_db
from ..database.models import Cluster, Item, Workspace
from ..services.clustering_service import ClusteringService, generate_cluster_name_with_llm
from ..auth.jwt_handler import get_current_user


router = APIRouter(prefix="/api/clusters", tags=["clusters"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ClusterCreate(BaseModel):
    """Schema for creating a cluster manually"""
    name: str = Field(..., min_length=1, max_length=255)
    color: Optional[str] = Field(default="#4ECDC4", pattern=r"^#[0-9A-Fa-f]{6}$")
    center_x: float = 0.0
    center_y: float = 0.0
    radius: float = 200.0
    item_ids: List[str] = Field(default_factory=list)


class ClusterUpdate(BaseModel):
    """Schema for updating a cluster"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    center_x: Optional[float] = None
    center_y: Optional[float] = None
    radius: Optional[float] = None


class ClusterResponse(BaseModel):
    """Response schema for cluster"""
    id: str
    workspace_id: str
    name: str
    color: str
    center_x: float
    center_y: float
    radius: float
    keywords: List[str]
    is_auto_generated: bool
    item_ids: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ComputeClustersRequest(BaseModel):
    """Request to compute clusters for a workspace"""
    algorithm: str = Field(default="dbscan", pattern=r"^(dbscan|kmeans)$")
    eps: float = Field(default=0.5, ge=0.1, le=2.0)
    min_samples: int = Field(default=2, ge=2, le=10)
    n_clusters: Optional[int] = Field(default=None, ge=2, le=20)
    use_llm_naming: bool = Field(default=False)


# ============================================================================
# Helper Functions
# ============================================================================

async def get_workspace_or_403(
    workspace_id: str,
    user_id: str,
    db: AsyncSession
) -> Workspace:
    """Get workspace and verify user has access"""
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Check if user is owner or member
    if workspace.owner_id != user_id:
        # TODO: Check membership table
        pass
    
    return workspace


async def get_items_with_embeddings(
    workspace_id: str,
    db: AsyncSession
) -> tuple[List[dict], List[List[float]]]:
    """Get all items with embeddings from a workspace"""
    result = await db.execute(
        select(Item).where(
            Item.workspace_id == workspace_id,
            Item.embedding.isnot(None)
        )
    )
    items = result.scalars().all()
    
    item_dicts = []
    embeddings = []
    
    for item in items:
        if item.embedding and "vector" in item.embedding:
            item_dicts.append(item.to_dict())
            embeddings.append(item.embedding["vector"])
    
    return item_dicts, embeddings


# ============================================================================
# Routes
# ============================================================================

@router.get("/workspace/{workspace_id}", response_model=List[ClusterResponse])
async def get_workspace_clusters(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all clusters in a workspace"""
    await get_workspace_or_403(workspace_id, current_user["user_id"], db)
    
    # Get clusters
    result = await db.execute(
        select(Cluster).where(Cluster.workspace_id == workspace_id)
    )
    clusters = result.scalars().all()
    
    # Get item IDs for each cluster
    responses = []
    for cluster in clusters:
        items_result = await db.execute(
            select(Item.id).where(Item.cluster_id == cluster.id)
        )
        item_ids = [row[0] for row in items_result.fetchall()]
        
        response = ClusterResponse(
            id=cluster.id,
            workspace_id=cluster.workspace_id,
            name=cluster.name,
            color=cluster.color,
            center_x=cluster.center_x,
            center_y=cluster.center_y,
            radius=cluster.radius,
            keywords=cluster.keywords.get("words", []) if cluster.keywords else [],
            is_auto_generated=cluster.is_auto_generated,
            item_ids=item_ids,
            created_at=cluster.created_at.isoformat() if cluster.created_at else None,
            updated_at=cluster.updated_at.isoformat() if cluster.updated_at else None,
        )
        responses.append(response)
    
    return responses


@router.post("/workspace/{workspace_id}/compute", response_model=List[ClusterResponse])
async def compute_clusters(
    workspace_id: str,
    request: ComputeClustersRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Compute semantic clusters for a workspace"""
    await get_workspace_or_403(workspace_id, current_user["user_id"], db)
    
    # Get items with embeddings
    items, embeddings = await get_items_with_embeddings(workspace_id, db)
    
    if len(items) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 items with embeddings to compute clusters"
        )
    
    # Delete existing auto-generated clusters
    await db.execute(
        delete(Cluster).where(
            Cluster.workspace_id == workspace_id,
            Cluster.is_auto_generated == True
        )
    )
    
    # Clear existing cluster assignments
    await db.execute(
        update(Item).where(Item.workspace_id == workspace_id).values(cluster_id=None)
    )
    
    # Compute clusters
    service = ClusteringService(
        algorithm=request.algorithm,
        eps=request.eps,
        min_samples=request.min_samples,
        n_clusters=request.n_clusters
    )
    
    computed_clusters = service.compute_clusters(items, embeddings)
    
    # Save clusters to database
    responses = []
    for computed in computed_clusters:
        # Generate LLM name if requested
        cluster_name = computed.name
        if request.use_llm_naming:
            cluster_items = [
                item for item in items
                if item["id"] in computed.item_ids
            ]
            cluster_name = await generate_cluster_name_with_llm(cluster_items)
        
        # Create cluster in DB
        cluster = Cluster(
            workspace_id=workspace_id,
            name=cluster_name,
            color=computed.color,
            center_x=computed.center_x,
            center_y=computed.center_y,
            radius=computed.radius,
            keywords={"words": computed.keywords},
            is_auto_generated=True
        )
        db.add(cluster)
        await db.flush()  # Get the ID
        
        # Update items with cluster assignment
        await db.execute(
            update(Item).where(
                Item.id.in_(computed.item_ids)
            ).values(cluster_id=cluster.id)
        )
        
        response = ClusterResponse(
            id=cluster.id,
            workspace_id=workspace_id,
            name=cluster_name,
            color=computed.color,
            center_x=computed.center_x,
            center_y=computed.center_y,
            radius=computed.radius,
            keywords=computed.keywords,
            is_auto_generated=True,
            item_ids=computed.item_ids,
            created_at=cluster.created_at.isoformat() if cluster.created_at else None,
            updated_at=cluster.updated_at.isoformat() if cluster.updated_at else None,
        )
        responses.append(response)
    
    await db.commit()
    
    return responses


@router.post("/workspace/{workspace_id}", response_model=ClusterResponse)
async def create_cluster(
    workspace_id: str,
    request: ClusterCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a manual cluster"""
    await get_workspace_or_403(workspace_id, current_user["user_id"], db)
    
    cluster = Cluster(
        workspace_id=workspace_id,
        name=request.name,
        color=request.color,
        center_x=request.center_x,
        center_y=request.center_y,
        radius=request.radius,
        is_auto_generated=False
    )
    db.add(cluster)
    await db.flush()
    
    # Assign items to cluster
    if request.item_ids:
        await db.execute(
            update(Item).where(
                Item.id.in_(request.item_ids),
                Item.workspace_id == workspace_id
            ).values(cluster_id=cluster.id)
        )
    
    await db.commit()
    
    return ClusterResponse(
        id=cluster.id,
        workspace_id=workspace_id,
        name=cluster.name,
        color=cluster.color,
        center_x=cluster.center_x,
        center_y=cluster.center_y,
        radius=cluster.radius,
        keywords=[],
        is_auto_generated=False,
        item_ids=request.item_ids,
    )


@router.patch("/{cluster_id}", response_model=ClusterResponse)
async def update_cluster(
    cluster_id: str,
    request: ClusterUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a cluster"""
    result = await db.execute(
        select(Cluster).where(Cluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    await get_workspace_or_403(cluster.workspace_id, current_user["user_id"], db)
    
    # Update fields
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cluster, field, value)
    
    await db.commit()
    await db.refresh(cluster)
    
    # Get item IDs
    items_result = await db.execute(
        select(Item.id).where(Item.cluster_id == cluster_id)
    )
    item_ids = [row[0] for row in items_result.fetchall()]
    
    return ClusterResponse(
        id=cluster.id,
        workspace_id=cluster.workspace_id,
        name=cluster.name,
        color=cluster.color,
        center_x=cluster.center_x,
        center_y=cluster.center_y,
        radius=cluster.radius,
        keywords=cluster.keywords.get("words", []) if cluster.keywords else [],
        is_auto_generated=cluster.is_auto_generated,
        item_ids=item_ids,
        created_at=cluster.created_at.isoformat() if cluster.created_at else None,
        updated_at=cluster.updated_at.isoformat() if cluster.updated_at else None,
    )


@router.delete("/{cluster_id}")
async def delete_cluster(
    cluster_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a cluster"""
    result = await db.execute(
        select(Cluster).where(Cluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    await get_workspace_or_403(cluster.workspace_id, current_user["user_id"], db)
    
    # Clear cluster assignments from items
    await db.execute(
        update(Item).where(Item.cluster_id == cluster_id).values(cluster_id=None)
    )
    
    # Delete cluster
    await db.delete(cluster)
    await db.commit()
    
    return {"status": "deleted", "id": cluster_id}


@router.post("/{cluster_id}/items/{item_id}")
async def add_item_to_cluster(
    cluster_id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add an item to a cluster"""
    # Verify cluster exists
    result = await db.execute(
        select(Cluster).where(Cluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    await get_workspace_or_403(cluster.workspace_id, current_user["user_id"], db)
    
    # Update item
    await db.execute(
        update(Item).where(
            Item.id == item_id,
            Item.workspace_id == cluster.workspace_id
        ).values(cluster_id=cluster_id)
    )
    
    await db.commit()
    
    return {"status": "added", "item_id": item_id, "cluster_id": cluster_id}


@router.delete("/{cluster_id}/items/{item_id}")
async def remove_item_from_cluster(
    cluster_id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove an item from a cluster"""
    # Verify cluster exists
    result = await db.execute(
        select(Cluster).where(Cluster.id == cluster_id)
    )
    cluster = result.scalar_one_or_none()
    
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    await get_workspace_or_403(cluster.workspace_id, current_user["user_id"], db)
    
    # Remove item from cluster
    await db.execute(
        update(Item).where(
            Item.id == item_id,
            Item.cluster_id == cluster_id
        ).values(cluster_id=None)
    )
    
    await db.commit()
    
    return {"status": "removed", "item_id": item_id, "cluster_id": cluster_id}
