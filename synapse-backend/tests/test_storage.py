"""
Tests for file storage backends
"""
import pytest
import tempfile
from pathlib import Path
from src.storage.local import LocalStorage


@pytest.mark.asyncio
async def test_local_storage_upload():
    """Test local storage upload"""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = LocalStorage(upload_dir=tmpdir)
        
        # Create a test file
        test_content = b"Hello, World!"
        test_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        test_file.write(test_content)
        test_file.close()
        
        # Upload
        with open(test_file.name, 'rb') as f:
            storage_path, url = await storage.upload(f, "test.txt")
        
        # Verify file exists
        assert await storage.exists(storage_path)
        
        # Download and verify content
        downloaded = await storage.download(storage_path)
        assert downloaded == test_content
        
        # Cleanup
        await storage.delete(storage_path)
        assert not await storage.exists(storage_path)


@pytest.mark.asyncio
async def test_file_existence():
    """Test file existence check"""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = LocalStorage(upload_dir=tmpdir)
        
        # Non-existent file
        assert not await storage.exists("nonexistent.txt")
