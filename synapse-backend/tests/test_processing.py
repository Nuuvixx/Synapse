"""
Tests for file processing modules
"""
import pytest
from pathlib import Path
import tempfile
from PIL import Image
from src.processing.thumbnail import generate_thumbnail


def test_image_thumbnail_generation():
    """Test thumbnail generation for images"""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a test image
        img = Image.new('RGB', (1000, 800), color='red')
        test_image = Path(tmpdir) / "test.jpg"
        img.save(test_image)
        
        # Generate thumbnail
        thumbnail_path = Path(tmpdir) / "thumb.jpg"
        result = generate_thumbnail(str(test_image), str(thumbnail_path))
        
        # Verify thumbnail exists and is smaller
        assert Path(result).exists()
        thumb_img = Image.open(result)
        assert thumb_img.width <= 200
        assert thumb_img.height <= 200
