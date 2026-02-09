"""
API Routes for Synapse Backend
RESTful endpoints for item management and workspace operations
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
import os
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.item import Item, ItemCreate, ItemUpdate, ItemType, SimilarityResult, Cluster
from ..services.embedding_service import EmbeddingService
from ..services.vector_store import VectorStore
from ..services.physics_engine import PhysicsEngine, PhysicsBody
from ..auth.jwt_handler import get_current_user
from ..database.connection import get_db


router = APIRouter()

# In-memory storage (replace with database in production)
items_db: dict[str, Item] = {}
clusters_db: dict[str, Cluster] = {}

# Services
embedding_service: Optional[EmbeddingService] = None
vector_store: Optional[VectorStore] = None
physics_engine: Optional[PhysicsEngine] = None


def init_services(embed_svc: EmbeddingService, vec_store: VectorStore, phys_eng: PhysicsEngine):
    """Initialize services"""
    global embedding_service, vector_store, physics_engine
    embedding_service = embed_svc
    vector_store = vec_store
    physics_engine = phys_eng


@router.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Synapse API",
        "version": "0.1.0"
    }


@router.post("/items", response_model=Item)
async def create_item(
    item_create: ItemCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new item in the workspace.
    
    The item will be:
    1. Embedded using OpenAI
    2. Stored in vector database
    3. Positioned based on semantic similarity
    4. Added to physics simulation
    """
    try:
        from ..database.repositories import ItemRepository, WorkspaceRepository
        from ..database.models import ItemType as DBItemType
        
        # Verify workspace exists and user has access
        workspace_repo = WorkspaceRepository(db)
        workspace = await workspace_repo.get_by_id(item_create.workspace_id)
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Generate embedding
        if embedding_service:
            embedding = await embedding_service.embed_text(item_create.content)
        else:
            embedding = []
        
        # Determine position
        if item_create.position_x is not None and item_create.position_y is not None:
            pos_x = item_create.position_x
            pos_y = item_create.position_y
        else:
            # Random position near center
            import random
            pos_x = random.uniform(-200, 200)
            pos_y = random.uniform(-200, 200)
        
        # Create item in database
        item_repo = ItemRepository(db)
        db_item = await item_repo.create(
            workspace_id=item_create.workspace_id,
            item_type=DBItemType(item_create.item_type.value),
            content=item_create.content,
            title=item_create.title,
            source_url=item_create.source_url,
            position_x=pos_x,
            position_y=pos_y,
            created_by=current_user["user_id"]
        )
        
        # Update embedding
        if embedding:
            await item_repo.update_embedding(db_item.id, embedding)
        
        await db.commit()
        await db.refresh(db_item)
        
        # Convert to response model
        item = Item(
            id=db_item.id,
            content=db_item.content,
            item_type=ItemType(db_item.item_type.value),
            embedding=embedding,
            position_x=db_item.position_x,
            position_y=db_item.position_y,
            cluster_id=db_item.cluster_id,
            title=db_item.title,
            source_url=db_item.source_url,
            created_at=db_item.created_at,
            updated_at=db_item.updated_at,
            created_by=db_item.created_by
        )
        
        # Store in vector database
        if vector_store and embedding:
            await vector_store.upsert_item(
                item_id=item.id,
                embedding=embedding,
                metadata={
                    "content": item.content[:1000],
                    "item_type": item.item_type.value,
                    "title": item.title or "",
                    "cluster_id": item.cluster_id or "",
                    "created_at": item.created_at.isoformat()
                }
            )
        
        # Add to physics simulation
        if physics_engine and embedding:
            from ..services.physics_engine import PhysicsBody
            body = PhysicsBody(
                id=item.id,
                x=pos_x,
                y=pos_y,
                embedding=embedding,
                cluster_id=item.cluster_id,
                radius=40.0 if item.item_type != ItemType.IMAGE else 60.0
            )
            physics_engine.add_body(body)
        
        return item
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create item: {str(e)}")


@router.get("/items", response_model=List[Item])
async def get_items(
    workspace_id: Optional[str] = None,
    cluster_id: Optional[str] = None,
    item_type: Optional[ItemType] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get items from database, optionally filtered by workspace, cluster, or type"""
    from ..database.repositories import ItemRepository
    
    item_repo = ItemRepository(db)
    
    if workspace_id:
        # Get items for specific workspace
        db_items = await item_repo.get_workspace_items(workspace_id)
    else:
        # This shouldn't typically happen, but we can return empty list
        db_items = []
    
    # Convert to response models
    items = []
    for db_item in db_items:
        item = Item(
            id=db_item.id,
            content=db_item.content,
            item_type=ItemType(db_item.item_type.value),
            embedding=db_item.embedding if hasattr(db_item, 'embedding') else [],
            position_x=db_item.position_x,
            position_y=db_item.position_y,
            cluster_id=db_item.cluster_id,
            title=db_item.title,
            source_url=db_item.source_url,
            created_at=db_item.created_at,
            updated_at=db_item.updated_at
        )
        items.append(item)
    
    # Apply filters
    if cluster_id:
        items = [i for i in items if i.cluster_id == cluster_id]
    
    if item_type:
        items = [i for i in items if i.item_type == item_type]
    
    return items[:limit]



@router.get("/items/{item_id}", response_model=Item)
async def get_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single item by ID from database"""
    from ..database.repositories import ItemRepository
    
    item_repo = ItemRepository(db)
    db_item = await item_repo.get_by_id(item_id)
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return Item(
        id=db_item.id,
        content=db_item.content,
        item_type=ItemType(db_item.item_type.value),
        embedding=db_item.embedding if hasattr(db_item, 'embedding') else [],
        position_x=db_item.position_x,
        position_y=db_item.position_y,
        cluster_id=db_item.cluster_id,
        title=db_item.title,
        source_url=db_item.source_url,
        created_at=db_item.created_at,
        updated_at=db_item.updated_at
    )


@router.put("/items/{item_id}", response_model=Item)
async def update_item(
    item_id: str,
    item_update: ItemUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an item in database"""
    from ..database.repositories import ItemRepository
    
    item_repo = ItemRepository(db)
    db_item = await item_repo.get_by_id(item_id)
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Prepare update data
    update_data = {}
    
    if item_update.content is not None:
        update_data['content'] = item_update.content
        # Re-embed if content changed
        if embedding_service:
            embedding = await embedding_service.embed_text(item_update.content)
            await item_repo.update_embedding(item_id, embedding)
    
    if item_update.position_x is not None:
        update_data['position_x'] = item_update.position_x
    
    if item_update.position_y is not None:
        update_data['position_y'] = item_update.position_y
    
    if item_update.cluster_id is not None:
        update_data['cluster_id'] = item_update.cluster_id
    
    # Update in database
    if update_data:
        updated_item = await item_repo.update(item_id, **update_data)
        await db.commit()
        await db.refresh(updated_item)
        db_item = updated_item
    
    return Item(
        id=db_item.id,
        content=db_item.content,
        item_type=ItemType(db_item.item_type.value),
        embedding=db_item.embedding if hasattr(db_item, 'embedding') else [],
        position_x=db_item.position_x,
        position_y=db_item.position_y,
        cluster_id=db_item.cluster_id,
        title=db_item.title,
        source_url=db_item.source_url,
        created_at=db_item.created_at,
        updated_at=db_item.updated_at
    )


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an item from database"""
    from ..database.repositories import ItemRepository
    
    item_repo = ItemRepository(db)
    db_item = await item_repo.get_by_id(item_id)
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Delete from database
    await item_repo.delete(item_id)
    await db.commit()
    
    # Remove from vector store
    if vector_store:
        await vector_store.delete_item(item_id)
    
    # Remove from physics
    if physics_engine:
        physics_engine.remove_body(item_id)
    
    return {"success": True, "message": "Item deleted"}


@router.post("/items/{item_id}/similar", response_model=List[SimilarityResult])
async def find_similar_items(item_id: str, top_k: int = 10):
    """Find items similar to the given item"""
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = items_db[item_id]
    
    if not item.embedding:
        raise HTTPException(status_code=400, detail="Item has no embedding")
    
    # Query vector store
    if vector_store:
        similar = await vector_store.query_similar(
            item.embedding,
            top_k=top_k + 1  # +1 to account for the item itself
        )
        
        results = []
        for sim in similar:
            if sim["id"] != item_id and sim["id"] in items_db:
                results.append(SimilarityResult(
                    item_id=sim["id"],
                    similarity_score=sim["score"],
                    item=items_db[sim["id"]]
                ))
        
        return results[:top_k]
    
    return []


@router.post("/search")
async def search_items(query: str, top_k: int = 10):
    """Search items by semantic similarity to query"""
    try:
        # Embed query
        query_embedding = await embedding_service.embed_text(query)
        
        # Search vector store
        if vector_store:
            results = await vector_store.query_similar(query_embedding, top_k=top_k)
            
            return [
                {
                    "item_id": r["id"],
                    "score": r["score"],
                    "metadata": r["metadata"]
                }
                for r in results
                if r["id"] in items_db
            ]
        
        return []
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/clusters", response_model=List[Cluster])
async def get_clusters():
    """Get all clusters"""
    return list(clusters_db.values())


@router.post("/clusters", response_model=Cluster)
async def create_cluster(name: str, description: Optional[str] = None):
    """Create a new cluster"""
    cluster = Cluster(
        name=name,
        description=description
    )
    clusters_db[cluster.id] = cluster
    return cluster


@router.get("/physics/state")
async def get_physics_state():
    """Get current physics simulation state"""
    if not physics_engine:
        return {"bodies": []}
    
    bodies = []
    for body_id, body in physics_engine.bodies.items():
        bodies.append({
            "id": body_id,
            "x": body.x,
            "y": body.y,
            "vx": body.vx,
            "vy": body.vy,
            "cluster_id": body.cluster_id
        })
    
    return {"bodies": bodies}


@router.get("/items/{item_id}/neighbors")
async def get_item_neighbors(
    item_id: str,
    max_distance: float = 500.0,
    min_similarity: float = 0.6
):
    """Get nearest neighbors for tether effect"""
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if not physics_engine:
        return {"neighbors": []}
    
    neighbors = physics_engine.get_nearest_neighbors(
        item_id, max_distance, min_similarity
    )
    
    return {"neighbors": neighbors}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file (PDF, image, etc.)"""
    try:
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1]
        file_id = str(uuid.uuid4())
        file_path = f"uploads/{file_id}{file_ext}"
        
        # Ensure uploads directory exists
        os.makedirs("uploads", exist_ok=True)
        
        # Save file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        return {
            "file_id": file_id,
            "filename": file.filename,
            "file_path": file_path,
            "size": len(content)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
