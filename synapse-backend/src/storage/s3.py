"""
S3/MinIO storage implementation
"""
import boto3
from botocore.exceptions import ClientError
from typing import BinaryIO, Optional
from .base import StorageBackend
import os


class S3Storage(StorageBackend):
    """S3/MinIO storage backend"""
    
    def __init__(
        self,
        bucket: str,
        endpoint: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: str = "us-east-1"
    ):
        """
        Initialize S3 storage
        
        Args:
            bucket: S3 bucket name
            endpoint: S3 endpoint (for MinIO or custom S3)
            access_key: AWS access key
            secret_key: AWS secret key
            region: AWS region
        """
        self.bucket = bucket
        
        # Initialize boto3 client
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key or os.getenv('S3_ACCESS_KEY'),
            aws_secret_access_key=secret_key or os.getenv('S3_SECRET_KEY'),
            region_name=region
        )
    
    async def upload(
        self, 
        file: BinaryIO, 
        filename: str,
        content_type: Optional[str] = None
    ) -> tuple[str, str]:
        """Upload file to S3"""
        import uuid
        from pathlib import Path
        
        # Generate unique key
        ext = Path(filename).suffix
        unique_key = f"{uuid.uuid4()}{ext}"
        
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type
        
        # Upload to S3
        self.s3_client.upload_fileobj(
            file,
            self.bucket,
            unique_key,
            ExtraArgs=extra_args
        )
        
        # Generate URL
        url = self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': unique_key},
            ExpiresIn=3600
        )
        
        return unique_key, url
    
    async def download(self, path: str) -> bytes:
        """Download file from S3"""
        import io
        
        buffer = io.BytesIO()
        self.s3_client.download_fileobj(self.bucket, path, buffer)
        buffer.seek(0)
        return buffer.read()
    
    async def delete(self, path: str) -> bool:
        """Delete file from S3"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=path)
            return True
        except ClientError:
            return False
    
    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Get signed URL for S3 object"""
        url = self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': path},
            ExpiresIn=expires_in
        )
        return url
    
    async def exists(self, path: str) -> bool:
        """Check if file exists in S3"""
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=path)
            return True
        except ClientError:
            return False
