"""
Image OCR using Tesseract
"""
import pytesseract
from PIL import Image
from pathlib import Path
from typing import Optional
import os


def extract_text_from_image(
    image_path: str,
    lang: str = 'eng',
    tesseract_cmd: Optional[str] = None
) -> str:
    """
    Extract text from image using Tesseract OCR
    
    Args:
        image_path: Path to image file
        lang: Language code (default: 'eng')
        tesseract_cmd: Custom path to tesseract command
        
    Returns:
        Extracted text content
    """
    img_path = Path(image_path)
    
    if not img_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Set tesseract command if provided
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    elif os.getenv('TESSERACT_CMD'):
        pytesseract.pytesseract.tesseract_cmd = os.getenv('TESSERACT_CMD')
    
    try:
        # Open image
        image = Image.open(img_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Perform OCR
        text = pytesseract.image_to_string(image, lang=lang)
        
        return text.strip()
    
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from image: {str(e)}")


def get_image_info(image_path: str) -> dict:
    """
    Get basic image information
    
    Args:
        image_path: Path to image file
        
    Returns:
        Dictionary of image info
    """
    img_path = Path(image_path)
    
    if not img_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    try:
        image = Image.open(img_path)
        
        info = {
            "format": image.format,
            "mode": image.mode,
            "size": image.size,
            "width": image.width,
            "height": image.height
        }
        
        return info
    
    except Exception as e:
        raise RuntimeError(f"Failed to get image info: {str(e)}")
