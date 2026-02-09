"""
File upload and management API routes
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import os
from pathlib import Path
from datetime import datetime

from ..database.connection import get_db
from ..database.models import File as FileModel, User, Workspace
from ..auth.jwt_handler import get_current_user
from ..storage import LocalStorage, S3Storage, StorageBackend
from ..processing import (
    extract_text_from_pdf,
    extract_text_from_image,
    generate_image_embedding,
    generate_thumbnail
)

router = APIRouter(prefix="/api/files", tags=["files"])

# Initialize storage backend
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
if STORAGE_BACKEND == "s3":
    storage: StorageBackend = S3Storage(
        bucket=os.getenv("S3_BUCKET", "synapse-files"),
        endpoint=os.getenv("S3_ENDPOINT"),
        region=os.getenv("S3_REGION", "us-east-1")
    )
else:
    storage: StorageBackend = LocalStorage(
        upload_dir=os.getenv("UPLOAD_DIR", "data/uploads"),
        base_url=os.getenv("BASE_URL", "http://localhost:8000")
    )


# File size limits
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024  # MB to bytes

# Allowed file types
ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'txt',
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'mp4', 'mov', 'avi',
    'zip', 'tar', 'gz'
}


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    ext = Path(filename).suffix[1:].lower()
    return ext in ALLOWED_EXTENSIONS


async def process_file_content(
    file_id: str,
    storage_path: str,
    content_type: str,
    db: AsyncSession
):
    """
    Background task to process uploaded file
    Extract text, generate embeddings, create thumbnails
    """
    from sqlalchemy import select, update
    
    try:
        # Get absolute path for local storage
        if isinstance(storage, LocalStorage):
            file_path = storage.get_absolute_path(storage_path)
        else:
            # Download from S3 temporarily
            file_data = await storage.download(storage_path)
            file_path = Path(f"/tmp/{file_id}")
            file_path.write_bytes(file_data)
        
        extracted_text = None
        embedding = None
        thumbnail_path = None
        
        # Process based on content type
        if content_type == "application/pdf":
            # Extract text from PDF
            extracted_text = extract_text_from_pdf(str(file_path))
            
            # Generate thumbnail
            thumb_path = str(file_path).replace(storage_path, f"thumbnails/{file_id}.jpg")
            thumbnail_path = generate_thumbnail(str(file_path), thumb_path)
        
        elif content_type.startswith("image/"):
            # OCR for images
            try:
                extracted_text = extract_text_from_image(str(file_path))
            except:
                extracted_text = None  # OCR might fail, that's OK
            
            # Generate embedding
            try:
                embedding_vector = generate_image_embedding(str(file_path))
                embedding = {"vector": embedding_vector}
            except:
                embedding = None
            
            # Generate thumbnail
            thumb_path = str(file_path).replace(storage_path, f"thumbnails/{file_id}.jpg")
            thumbnail_path = generate_thumbnail(str(file_path), thumb_path)
        
        # Update file record
        stmt = (
            update(FileModel)
            .where(FileModel.id == file_id)
            .values(
                extracted_text=extracted_text,
                embedding=embedding,
                thumbnail_path=thumbnail_path,
                is_processed=True,
                processed_at=datetime.utcnow()
            )
        )
        await db.execute(stmt)
        await db.commit()
    
    except Exception as e:
        # Log error to file record
        stmt = (
            update(FileModel)
            .where(FileModel.id == file_id)
            .values(
                processing_error=str(e),
                is_processed=True,
                processed_at=datetime.utcnow()
            )
        )
        await db.execute(stmt)
        await db.commit()


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    workspace_id: str = Form(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a file to the workspace
    """
    from sqlalchemy import select
    
    # Verify file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {MAX_FILE_SIZE // 1024 // 1024}MB)"
        )
    
    # Reset file pointer
    await file.seek(0)
    
    # Verify workspace access
    stmt = select(Workspace).where(
        Workspace.id == workspace_id,
        Workspace.owner_id == current_user["user_id"]
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Upload to storage
    storage_path, public_url = await storage.upload(
        file.file,
        file.filename,
        file.content_type
    )
    
    # Create file record
    file_record = FileModel(
        workspace_id=workspace_id,
        uploaded_by=current_user["user_id"],
        filename=Path(storage_path).name,
        original_filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size=len(file_content),
        storage_path=storage_path,
        storage_backend=STORAGE_BACKEND
    )
    
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)
    
    # Create corresponding Item for canvas display
    from ..database.repositories import ItemRepository
    from ..database.models import ItemType as DBItemType
    import random
    
    # Determine item type based on content type
    if file.content_type and file.content_type.startswith("image/"):
        item_type = DBItemType.IMAGE
    elif file.content_type == "application/pdf":
        item_type = DBItemType.PDF
    else:
        item_type = DBItemType.FILE
    
    # Create item
    item_repo = ItemRepository(db)
    item = await item_repo.create(
        workspace_id=workspace_id,
        item_type=item_type,
        content=f"Uploaded file: {file.filename}",  # Placeholder, will be updated with extracted text
        title=file.filename,
        file_id=file_record.id,
        position_x=random.uniform(-200, 200),
        position_y=random.uniform(-200, 200),
        created_by=current_user["user_id"]
    )
    
    await db.commit()
    await db.refresh(item)
    
    # Schedule background processing
    background_tasks.add_task(
        process_file_content,
        file_record.id,
        storage_path,
        file.content_type,
        db
    )
    
    return {
        "id": file_record.id,
        "filename": file_record.original_filename,
        "size": file_record.size,
        "content_type": file_record.content_type,
        "url": public_url,
        "created_at": file_record.created_at.isoformat(),
        "item": {
            "id": item.id,
            "item_type": item.item_type.value,
            "position_x": item.position_x,
            "position_y": item.position_y,
            "title": item.title
        }
    }


@router.get("/serve/{path:path}")
async def serve_file(path: str):
    """Serve files from local storage"""
    if isinstance(storage, LocalStorage):
        file_path = storage.get_absolute_path(path)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(file_path)
    else:
        # For S3, redirect to signed URL
        url = await storage.get_url(path)
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get file metadata"""
    from sqlalchemy import select
    
    stmt = select(FileModel).where(FileModel.id == file_id)
    result = await db.execute(stmt)
    file_ = result.scalar_one_or_none()
    
    if not file_:
        raise HTTPException(status_code=404, detail="File not found")
    
    # TODO: Check workspace access
    
    return file_.to_dict()


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download file"""
    from sqlalchemy import select
    
    stmt = select(FileModel).where(FileModel.id == file_id)
    result = await db.execute(stmt)
    file_ = result.scalar_one_or_none()
    
    if not file_:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get download URL
    url = await storage.get_url(file_.storage_path)
    
    if isinstance(storage, LocalStorage):
        file_path = storage.get_absolute_path(file_.storage_path)
        return FileResponse(
            file_path,
            filename=file_.original_filename,
            media_type=file_.content_type
        )
    else:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete file"""
    from sqlalchemy import select, delete
    
    stmt = select(FileModel).where(FileModel.id == file_id)
    result = await db.execute(stmt)
    file_ = result.scalar_one_or_none()
    
    if not file_:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete from storage
    await storage.delete(file_.storage_path)
    
    # Delete thumbnail if exists
    if file_.thumbnail_path:
        await storage.delete(file_.thumbnail_path)
    
    # Delete from database
    stmt = delete(FileModel).where(FileModel.id == file_id)
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "File deleted successfully"}


@router.get("/workspace/{workspace_id}")
async def list_workspace_files(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all files in a workspace"""
    from sqlalchemy import select
    
    stmt = select(FileModel).where(FileModel.workspace_id == workspace_id)
    result = await db.execute(stmt)
    files = result.scalars().all()
    
    return [f.to_dict() for f in files]
