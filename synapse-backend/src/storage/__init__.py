"""
Storage module for file uploads
Provides pluggable storage backends (local, S3/MinIO)
"""

from .base import StorageBackend
from .local import LocalStorage
from .s3 import S3Storage

__all__ = ["StorageBackend", "LocalStorage", "S3Storage"]
