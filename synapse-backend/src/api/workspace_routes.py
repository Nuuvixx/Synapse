"""
Workspace Routes for Synapse
Handles workspace CRUD and membership operations
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.connection import get_db
from ..database.repositories import WorkspaceRepository, ItemRepository
from ..database.models import WorkspaceRole
from ..auth.jwt_handler import get_current_user


router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


# Request/Response Models
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    gravity_strength: Optional[float] = None
    similarity_threshold: Optional[float] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_id: str
    is_public: bool
    gravity_strength: float
    similarity_threshold: float
    item_count: int
    created_at: datetime
    updated_at: datetime


class WorkspaceListResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_public: bool
    item_count: int
    role: str
    updated_at: datetime


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "viewer"


# Routes
@router.get("/", response_model=List[WorkspaceListResponse])
async def list_workspaces(
    filter: str = "all",  # all, recent, shared, owned
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all workspaces the current user has access to.
    Filter options: all, recent (last 10), shared (not owned), owned (owned by user)
    """
    workspace_repo = WorkspaceRepository(db)
    item_repo = ItemRepository(db)
    
    workspaces = await workspace_repo.get_user_workspaces(current_user["user_id"])
    
    # Apply filter
    if filter == "shared":
        workspaces = [ws for ws in workspaces if ws.owner_id != current_user["user_id"]]
    elif filter == "owned":
        workspaces = [ws for ws in workspaces if ws.owner_id == current_user["user_id"]]
    elif filter == "recent":
        workspaces = sorted(workspaces, key=lambda ws: ws.updated_at, reverse=True)[:10]
    
    result = []
    for ws in workspaces:
        items = await item_repo.get_workspace_items(ws.id)
        
        # Determine user's role in this workspace
        role = "owner" if ws.owner_id == current_user["user_id"] else "member"
        for member in ws.members:
            if member.user_id == current_user["user_id"]:
                role = member.role.value
                break
        
        result.append(WorkspaceListResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            is_public=ws.is_public,
            item_count=len(items),
            role=role,
            updated_at=ws.updated_at
        ))
    
    return result


@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    request: WorkspaceCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new workspace.
    """
    workspace_repo = WorkspaceRepository(db)
    
    workspace = await workspace_repo.create(
        name=request.name,
        owner_id=current_user["user_id"],
        description=request.description,
        is_public=request.is_public
    )
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_public=workspace.is_public,
        gravity_strength=workspace.gravity_strength,
        similarity_threshold=workspace.similarity_threshold,
        item_count=0,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get workspace details.
    """
    workspace_repo = WorkspaceRepository(db)
    item_repo = ItemRepository(db)
    
    workspace = await workspace_repo.get_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    # Check access
    has_access = workspace.is_public or workspace.owner_id == current_user["user_id"]
    if not has_access:
        for member in workspace.members:
            if member.user_id == current_user["user_id"]:
                has_access = True
                break
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    items = await item_repo.get_workspace_items(workspace_id)
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_public=workspace.is_public,
        gravity_strength=workspace.gravity_strength,
        similarity_threshold=workspace.similarity_threshold,
        item_count=len(items),
        created_at=workspace.created_at,
        updated_at=workspace.updated_at
    )


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    request: WorkspaceUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update workspace settings.
    Only the owner can update workspace settings.
    """
    workspace_repo = WorkspaceRepository(db)
    item_repo = ItemRepository(db)
    
    workspace = await workspace_repo.get_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    if workspace.owner_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can update workspace settings"
        )
    
    # Update fields
    update_data = request.model_dump(exclude_none=True)
    if update_data:
        workspace = await workspace_repo.update(workspace_id, **update_data)
    
    items = await item_repo.get_workspace_items(workspace_id)
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_public=workspace.is_public,
        gravity_strength=workspace.gravity_strength,
        similarity_threshold=workspace.similarity_threshold,
        item_count=len(items),
        created_at=workspace.created_at,
        updated_at=workspace.updated_at
    )


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a workspace.
    Only the owner can delete a workspace.
    """
    workspace_repo = WorkspaceRepository(db)
    
    workspace = await workspace_repo.get_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    if workspace.owner_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can delete a workspace"
        )
    
    await workspace_repo.delete(workspace_id)
    
    return {"success": True, "message": "Workspace deleted"}


@router.post("/{workspace_id}/members")
async def add_member(
    workspace_id: str,
    request: AddMemberRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a member to the workspace.
    Only the owner can add members.
    """
    workspace_repo = WorkspaceRepository(db)
    
    workspace = await workspace_repo.get_by_id(workspace_id)
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    
    if workspace.owner_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can add members"
        )
    
    # Map role string to enum
    role_map = {
        "viewer": WorkspaceRole.VIEWER,
        "editor": WorkspaceRole.EDITOR,
        "owner": WorkspaceRole.OWNER
    }
    role = role_map.get(request.role.lower(), WorkspaceRole.VIEWER)
    
    member = await workspace_repo.add_member(workspace_id, request.user_id, role)
    
    return {
        "success": True,
        "member_id": member.id,
        "role": role.value
    }
