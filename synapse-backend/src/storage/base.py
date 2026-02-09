"""
Abstract base class for storage backends
"""
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional
from pathlib import Path


class StorageBackend(ABC):
    """Abstract storage interface"""
    
    @abstractmethod
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str,
        content_type: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Upload a file to storage
        
        Args:
            file: File-like object to upload
            filename: Destination filename
            content_type: MIME type of the file
            
        Returns:
            Tuple of (storage_path, public_url)
        """
        pass
    
    @abstractmethod
    async def download(self, path: str) -> bytes:
        """
        Download file from storage
        
        Args:
            path: Storage path of the file
            
        Returns:
            File content as bytes
        """
        pass
    
    @abstractmethod
    async def delete(self, path: str) -> bool:
        """
        Delete file from storage
        
        Args:
            path: Storage path of the file
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """
        Get public/signed URL for file
        
        Args:
            path: Storage path of the file
            expires_in: URL expiration time in seconds
            
        Returns:
            Public or signed URL
        """
        pass
    
    @abstractmethod
    async def exists(self, path: str) -> bool:
        """
        Check if file exists
        
        Args:
            path: Storage path of the file
            
        Returns:
            True if file exists
        """
        pass
