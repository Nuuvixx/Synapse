"""
Local filesystem storage implementation
"""
import os
import uuid
import aiofiles
from pathlib import Path
from typing import BinaryIO, Optional
from .base import StorageBackend


class LocalStorage(StorageBackend):
    """Local filesystem storage backend"""
    
    def __init__(self, upload_dir: str = "data/uploads", base_url: str = "http://localhost:8000"):
        """
        Initialize local storage
        
        Args:
            upload_dir: Base directory for uploads
            base_url: Base URL for serving files
        """
        self.upload_dir = Path(upload_dir)
        self.base_url = base_url.rstrip('/')
        
        # Create directories if they don't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / "thumbnails").mkdir(exist_ok=True)
    
    def _get_unique_filename(self, original_filename: str) -> str:
        """Generate unique filename preserving extension"""
        ext = Path(original_filename).suffix
        unique_id = str(uuid.uuid4())
        return f"{unique_id}{ext}"
    
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str,
        content_type: Optional[str] = None
    ) -> tuple[str, str]:
        """Upload file to local filesystem"""
        unique_filename = self._get_unique_filename(filename)
        file_path = self.upload_dir / unique_filename
        
        # Write file asynchronously
        async with aiofiles.open(file_path, 'wb') as f:
            content = file.read()
            await f.write(content)
        
        storage_path = str(file_path.relative_to(self.upload_dir))
        public_url = f"{self.base_url}/api/files/serve/{storage_path}"
        
        return storage_path, public_url
    
    async def download(self, path: str) -> bytes:
        """Download file from local filesystem"""
        file_path = self.upload_dir / path
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        
        async with aiofiles.open(file_path, 'rb') as f:
            return await f.read()
    
    async def delete(self, path: str) -> bool:
        """Delete file from local filesystem"""
        file_path = self.upload_dir / path
        
        if file_path.exists():
            file_path.unlink()
            return True
        
        return False
    
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Get public URL for file (no expiration for local)"""
        return f"{self.base_url}/api/files/serve/{path}"
    
    async def exists(self, path: str) -> bool:
        """Check if file exists"""
        file_path = self.upload_dir / path
        return file_path.exists()
    
    def get_absolute_path(self, path: str) -> Path:
        """Get absolute filesystem path"""
        return self.upload_dir / path
