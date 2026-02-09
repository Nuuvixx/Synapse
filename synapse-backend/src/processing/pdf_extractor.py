"""
PDF text extraction using PyMuPDF (fitz)
"""
import fitz
from pathlib import Path
from typing import Optional


def extract_text_from_pdf(file_path: str, max_pages: Optional[int] = None) -> str:
    """
    Extract text from PDF file
    
    Args:
        file_path: Path to PDF file
        max_pages: Maximum number of pages to extract (None = all)
        
    Returns:
        Extracted text content
    """
    pdf_path = Path(file_path)
    
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {file_path}")
    
    text_content = []
    
    try:
        # Open PDF
        doc = fitz.open(pdf_path)
        
        # Determine page range
        num_pages = len(doc)
        pages_to_process = min(num_pages, max_pages) if max_pages else num_pages
        
        # Extract text from each page
        for page_num in range(pages_to_process):
            page = doc[page_num]
            page_text = page.get_text()
            
            if page_text.strip():
                text_content.append(f"--- Page {page_num + 1} ---\n{page_text}")
        
        doc.close()
        
        return "\n\n".join(text_content)
    
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {str(e)}")


def get_pdf_metadata(file_path: str) -> dict:
    """
    Extract PDF metadata
    
    Args:
        file_path: Path to PDF file
        
    Returns:
        Dictionary of metadata
    """
    pdf_path = Path(file_path)
    
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found: {file_path}")
    
    try:
        doc = fitz.open(pdf_path)
        metadata = {
            "page_count": len(doc),
            "title": doc.metadata.get("title", ""),
            "author": doc.metadata.get("author", ""),
            "subject": doc.metadata.get("subject", ""),
            "keywords": doc.metadata.get("keywords", ""),
            "creator": doc.metadata.get("creator", ""),
            "producer": doc.metadata.get("producer", ""),
            "creation_date": doc.metadata.get("creationDate", ""),
            "modification_date": doc.metadata.get("modDate", "")
        }
        doc.close()
        
        return metadata
    
    except Exception as e:
        raise RuntimeError(f"Failed to extract PDF metadata: {str(e)}")
