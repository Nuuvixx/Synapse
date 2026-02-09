"""
Thumbnail generation for images and PDFs
"""
from PIL import Image
import fitz
from pathlib import Path
from typing import Tuple, Optional


def generate_thumbnail(
    file_path: str,
    output_path: str,
    size: Tuple[int, int] = (200, 200),
    quality: int = 85
) -> str:
    """
    Generate thumbnail for image or PDF
    
    Args:
        file_path: Path to source file
        output_path: Path for output thumbnail
        size: Thumbnail size (width, height)
        quality: JPEG quality (1-100)
        
    Returns:
        Path to generated thumbnail
    """
    file = Path(file_path)
    
    if not file.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Determine file type
    ext = file.suffix.lower()
    
    try:
        if ext == '.pdf':
            return _generate_pdf_thumbnail(file_path, output_path, size, quality)
        elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            return _generate_image_thumbnail(file_path, output_path, size, quality)
        else:
            raise ValueError(f"Unsupported file type for thumbnail: {ext}")
    
    except Exception as e:
        raise RuntimeError(f"Failed to generate thumbnail: {str(e)}")


def _generate_image_thumbnail(
    image_path: str,
    output_path: str,
    size: Tuple[int, int],
    quality: int
) -> str:
    """Generate thumbnail for image file"""
    image = Image.open(image_path)
    
    # Convert to RGB if necessary
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGB')
    
    # Generate thumbnail (maintains aspect ratio)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Save thumbnail
    if image.mode == 'RGBA':
        # Save as PNG for transparency
        image.save(output_path, 'PNG', optimize=True)
    else:
        # Save as JPEG
        image.save(output_path, 'JPEG', quality=quality, optimize=True)
    
    return output_path


def _generate_pdf_thumbnail(
    pdf_path: str,
    output_path: str,
    size: Tuple[int, int],
    quality: int
) -> str:
    """Generate thumbnail from first page of PDF"""
    doc = fitz.open(pdf_path)
    
    if len(doc) == 0:
        raise ValueError("PDF has no pages")
    
    # Get first page
    page = doc[0]
    
    # Calculate zoom factor to match target size
    page_rect = page.rect
    zoom_x = size[0] / page_rect.width
    zoom_y = size[1] / page_rect.height
    zoom = min(zoom_x, zoom_y)
    
    # Render page to pixmap
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    
    # Convert to PIL Image
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Save thumbnail
    img.save(output_path, 'JPEG', quality=quality, optimize=True)
    
    doc.close()
    
    return output_path
