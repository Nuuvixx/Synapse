"""
Image embedding generation using CLIP model
"""
from PIL import Image
from pathlib import Path
from typing import List, Optional
import torch
from transformers import CLIPProcessor, CLIPModel
import os


# Global model cache
_model_cache = {}


def get_clip_model(model_name: str = "openai/clip-vit-base-patch32"):
    """
    Get or load CLIP model (cached)
    
    Args:
        model_name: HuggingFace model identifier
        
    Returns:
        Tuple of (model, processor)
    """
    if model_name not in _model_cache:
        model = CLIPModel.from_pretrained(model_name)
        processor = CLIPProcessor.from_pretrained(model_name)
        
        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        
        _model_cache[model_name] = (model, processor, device)
    
    return _model_cache[model_name]


def generate_image_embedding(
    image_path: str,
    model_name: Optional[str] = None
) -> List[float]:
    """
    Generate CLIP embedding for image
    
    Args:
        image_path: Path to image file
        model_name: CLIP model to use (default from env or base model)
        
    Returns:
        512-dimensional embedding vector as list
    """
    img_path = Path(image_path)
    
    if not img_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Get model name from env or use default
    if model_name is None:
        model_name = os.getenv('CLIP_MODEL', 'openai/clip-vit-base-patch32')
    
    try:
        # Load model and processor
        model, processor, device = get_clip_model(model_name)
        
        # Open and process image
        image = Image.open(img_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Process image
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate embeddings
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)
        
        # Normalize and convert to list
        embedding = image_features[0].cpu().numpy().tolist()
        
        return embedding
    
    except Exception as e:
        raise RuntimeError(f"Failed to generate image embedding: {str(e)}")


def generate_text_embedding(
    text: str,
    model_name: Optional[str] = None
) -> List[float]:
    """
    Generate CLIP embedding for text (useful for semantic search)
    
    Args:
        text: Text to embed
        model_name: CLIP model to use
        
    Returns:
        512-dimensional embedding vector as list
    """
    if model_name is None:
        model_name = os.getenv('CLIP_MODEL', 'openai/clip-vit-base-patch32')
    
    try:
        # Load model and processor
        model, processor, device = get_clip_model(model_name)
        
        # Process text
        inputs = processor(text=text, return_tensors="pt", padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate embeddings
        with torch.no_grad():
            text_features = model.get_text_features(**inputs)
        
        # Normalize and convert to list
        embedding = text_features[0].cpu().numpy().tolist()
        
        return embedding
    
    except Exception as e:
        raise RuntimeError(f"Failed to generate text embedding: {str(e)}")
