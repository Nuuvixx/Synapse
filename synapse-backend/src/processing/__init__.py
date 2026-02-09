"""
File processing module
PDF extraction, OCR, embeddings, thumbnails
"""

from .pdf_extractor import extract_text_from_pdf
from .ocr import extract_text_from_image
from .image_embed import generate_image_embedding
from .thumbnail import generate_thumbnail

__all__ = [
    "extract_text_from_pdf",
    "extract_text_from_image",
    "generate_image_embedding",
    "generate_thumbnail"
]
