"""
Repository Layer for Database Operations
Provides CRUD operations for all models
"""
from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import User, Workspace, WorkspaceMember, Item, ItemType, WorkspaceRole


class UserRepository:
    """Repository for User operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, email: str, name: str, password_hash: Optional[str] = None, **kwargs) -> User:
        """Create a new user"""
        user = User(email=email, name=name, password_hash=password_hash, **kwargs)
        self.session.add(user)
        await self.session.flush()
        return user
    
    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_github_id(self, github_id: str) -> Optional[User]:
        """Get user by GitHub OAuth ID"""
        result = await self.session.execute(
            select(User).where(User.github_id == github_id)
        )
        return result.scalar_one_or_none()
    
    async def update(self, user_id: str, **kwargs) -> Optional[User]:
        """Update user fields"""
        await self.session.execute(
            update(User).where(User.id == user_id).values(**kwargs)
        )
        return await self.get_by_id(user_id)
    
    async def delete(self, user_id: str) -> bool:
        """Delete a user"""
        result = await self.session.execute(
            delete(User).where(User.id == user_id)
        )
        return result.rowcount > 0


class WorkspaceRepository:
    """Repository for Workspace operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, name: str, owner_id: str, **kwargs) -> Workspace:
        """Create a new workspace"""
        workspace = Workspace(name=name, owner_id=owner_id, **kwargs)
        self.session.add(workspace)
        await self.session.flush()
        
        # Add owner as a member with OWNER role
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner_id,
            role=WorkspaceRole.OWNER
        )
        self.session.add(member)
        await self.session.flush()
        
        return workspace
    
    async def get_by_id(self, workspace_id: str) -> Optional[Workspace]:
        """Get workspace by ID with items"""
        result = await self.session.execute(
            select(Workspace)
            .options(selectinload(Workspace.items))
            .where(Workspace.id == workspace_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_workspaces(self, user_id: str) -> List[Workspace]:
        """Get all workspaces a user owns or is a member of"""
        result = await self.session.execute(
            select(Workspace)
            .options(selectinload(Workspace.members))
            .join(WorkspaceMember)
            .where(WorkspaceMember.user_id == user_id)
            .order_by(Workspace.updated_at.desc())
        )
        return list(result.scalars().all())
    
    async def add_member(
        self, workspace_id: str, user_id: str, role: WorkspaceRole = WorkspaceRole.VIEWER
    ) -> WorkspaceMember:
        """Add a member to workspace"""
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=user_id,
            role=role
        )
        self.session.add(member)
        await self.session.flush()
        return member
    
    async def update(self, workspace_id: str, **kwargs) -> Optional[Workspace]:
        """Update workspace fields"""
        await self.session.execute(
            update(Workspace).where(Workspace.id == workspace_id).values(**kwargs)
        )
        return await self.get_by_id(workspace_id)
    
    async def delete(self, workspace_id: str) -> bool:
        """Delete a workspace"""
        result = await self.session.execute(
            delete(Workspace).where(Workspace.id == workspace_id)
        )
        return result.rowcount > 0


class ItemRepository:
    """Repository for Item operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self, 
        workspace_id: str,
        item_type: ItemType,
        content: str,
        created_by: Optional[str] = None,
        **kwargs
    ) -> Item:
        """Create a new item"""
        item = Item(
            workspace_id=workspace_id,
            item_type=item_type,
            content=content,
            created_by=created_by,
            **kwargs
        )
        self.session.add(item)
        await self.session.flush()
        return item
    
    async def get_by_id(self, item_id: str) -> Optional[Item]:
        """Get item by ID"""
        result = await self.session.execute(
            select(Item).where(Item.id == item_id)
        )
        return result.scalar_one_or_none()
    
    async def get_workspace_items(self, workspace_id: str) -> List[Item]:
        """Get all items in a workspace"""
        result = await self.session.execute(
            select(Item)
            .where(Item.workspace_id == workspace_id)
            .order_by(Item.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_items_with_embeddings(self, workspace_id: str) -> List[Item]:
        """Get all items with embeddings for similarity search"""
        result = await self.session.execute(
            select(Item)
            .where(Item.workspace_id == workspace_id)
            .where(Item.embedding.isnot(None))
        )
        return list(result.scalars().all())
    
    async def update(self, item_id: str, **kwargs) -> Optional[Item]:
        """Update item fields"""
        await self.session.execute(
            update(Item).where(Item.id == item_id).values(**kwargs)
        )
        return await self.get_by_id(item_id)
    
    async def update_position(self, item_id: str, x: float, y: float) -> Optional[Item]:
        """Update item position"""
        return await self.update(item_id, position_x=x, position_y=y)
    
    async def update_embedding(self, item_id: str, embedding: List[float]) -> Optional[Item]:
        """Update item embedding"""
        return await self.update(item_id, embedding={"vector": embedding})
    
    async def delete(self, item_id: str) -> bool:
        """Delete an item"""
        result = await self.session.execute(
            delete(Item).where(Item.id == item_id)
        )
        return result.rowcount > 0
    
    async def bulk_update_positions(self, updates: dict[str, dict]) -> None:
        """Bulk update item positions from physics simulation"""
        for item_id, pos in updates.items():
            await self.session.execute(
                update(Item)
                .where(Item.id == item_id)
                .values(
                    position_x=pos.get("x"),
                    position_y=pos.get("y"),
                    velocity_x=pos.get("vx", 0),
                    velocity_y=pos.get("vy", 0)
                )
            )
