"""
Authentication Routes for Synapse
Handles user registration, login, and OAuth flows
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from ..database.connection import get_db
from ..database.repositories import UserRepository, WorkspaceRepository
from ..auth.jwt_handler import JWTHandler, get_current_user
from ..auth.oauth import OAuthHandler


router = APIRouter(prefix="/auth", tags=["Authentication"])


# Request/Response Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    created_at: datetime


# Routes
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.
    Creates a default workspace for the user.
    """
    user_repo = UserRepository(db)
    workspace_repo = WorkspaceRepository(db)
    
    # Check if email already exists
    existing = await user_repo.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password and create user
    password_hash = JWTHandler.hash_password(request.password)
    user = await user_repo.create(
        email=request.email,
        name=request.name,
        password_hash=password_hash,
        is_verified=True  # Skip email verification for now
    )
    
    # Create default workspace
    await workspace_repo.create(
        name=f"{request.name}'s Workspace",
        owner_id=user.id,
        description="My first Synapse workspace"
    )
    
    # Generate tokens
    tokens = JWTHandler.create_tokens(user.id, user.email)
    
    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url
        }
    }


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Login with email and password.
    Returns access and refresh tokens.
    """
    user_repo = UserRepository(db)
    
    # Find user
    user = await user_repo.get_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not user.password_hash or not JWTHandler.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Update last login
    await user_repo.update(user.id, last_login=datetime.utcnow())
    
    # Generate tokens
    tokens = JWTHandler.create_tokens(user.id, user.email)
    
    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url
        }
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """
    Refresh access token using refresh token.
    """
    # Decode refresh token
    payload = JWTHandler.decode_token(request.refresh_token)
    
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    user_id = payload.get("sub")
    
    # Get user
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Generate new tokens
    tokens = JWTHandler.create_tokens(user.id, user.email)
    
    return {
        **tokens,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current authenticated user's information.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["user_id"])
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at
    )


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/me", response_model=UserResponse)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user's profile (name, avatar).
    """
    user_repo = UserRepository(db)
    
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    user = await user_repo.update(current_user["user_id"], **update_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at
    )


@router.put("/password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change current user's password.
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(current_user["user_id"])
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not user.password_hash or not JWTHandler.verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Hash and set new password
    new_hash = JWTHandler.hash_password(request.new_password)
    await user_repo.update(user.id, password_hash=new_hash)
    
    return {"success": True, "message": "Password changed successfully"}


# OAuth Routes
@router.get("/github")
async def github_auth():
    """
    Get GitHub OAuth authorization URL.
    """
    return {"auth_url": OAuthHandler.get_github_auth_url()}


@router.post("/github/callback", response_model=TokenResponse)
async def github_callback(request: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Handle GitHub OAuth callback.
    Creates user if not exists, then returns tokens.
    """
    try:
        # Exchange code for user info
        oauth_data = await OAuthHandler.exchange_github_code(request.code)
        
        user_repo = UserRepository(db)
        workspace_repo = WorkspaceRepository(db)
        
        # Check if user exists by GitHub ID
        user = await user_repo.get_by_github_id(oauth_data["provider_id"])
        
        if not user:
            # Check by email
            user = await user_repo.get_by_email(oauth_data["email"])
            
            if user:
                # Link GitHub to existing account
                await user_repo.update(
                    user.id,
                    github_id=oauth_data["provider_id"],
                    avatar_url=oauth_data["avatar_url"]
                )
            else:
                # Create new user
                user = await user_repo.create(
                    email=oauth_data["email"],
                    name=oauth_data["name"],
                    github_id=oauth_data["provider_id"],
                    avatar_url=oauth_data["avatar_url"],
                    is_verified=True
                )
                
                # Create default workspace
                await workspace_repo.create(
                    name=f"{oauth_data['name']}'s Workspace",
                    owner_id=user.id
                )
        
        # Update last login
        await user_repo.update(user.id, last_login=datetime.utcnow())
        
        # Generate tokens
        tokens = JWTHandler.create_tokens(user.id, user.email)
        
        return {
            **tokens,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar_url": user.avatar_url
            }
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/google")
async def google_auth():
    """
    Get Google OAuth authorization URL.
    """
    return {"auth_url": OAuthHandler.get_google_auth_url()}


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(request: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Handle Google OAuth callback.
    """
    try:
        oauth_data = await OAuthHandler.exchange_google_code(request.code)
        
        user_repo = UserRepository(db)
        workspace_repo = WorkspaceRepository(db)
        
        # Check by email (Google always provides email)
        user = await user_repo.get_by_email(oauth_data["email"])
        
        if not user:
            # Create new user
            user = await user_repo.create(
                email=oauth_data["email"],
                name=oauth_data["name"],
                google_id=oauth_data["provider_id"],
                avatar_url=oauth_data["avatar_url"],
                is_verified=True
            )
            
            # Create default workspace
            await workspace_repo.create(
                name=f"{oauth_data['name']}'s Workspace",
                owner_id=user.id
            )
        else:
            # Link Google to existing account if not already
            if not user.google_id:
                await user_repo.update(
                    user.id,
                    google_id=oauth_data["provider_id"]
                )
        
        # Update last login
        await user_repo.update(user.id, last_login=datetime.utcnow())
        
        # Generate tokens
        tokens = JWTHandler.create_tokens(user.id, user.email)
        
        return {
            **tokens,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar_url": user.avatar_url
            }
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
