"""
Script to backfill embeddings for existing items.
Uses the configured EmbeddingService (OpenAI or Ollama).
"""
import sys
import os
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add src to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.models import Item
from src.services.embedding_service import EmbeddingService
from src.database.connection import DATABASE_URL
from dotenv import load_dotenv

load_dotenv()

async def backfill():
    print("🔄 Starting embedding backfill...")
    
    # Initialize Embedding Service that forces Ollama if OpenAI key is missing
    # (Same logic as main.py)
    embedding_service = None
    openai_key = os.getenv("OPENAI_API_KEY")
    
    try:
        if openai_key:
            embedding_service = EmbeddingService(api_key=openai_key, provider="openai")
            print("✅ Using OpenAI Embeddings")
        else:
            embedding_service = EmbeddingService(provider="ollama")
            print("✅ Using Ollama Embeddings")
    except Exception as e:
        print(f"❌ Failed to initialize embedding service: {e}")
        return

    # Database connection
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get all items
        result = await session.execute(select(Item))
        items = result.scalars().all()
        print(f"Found {len(items)} items to process")
        
        count = 0
        for item in items:
            if not item.content:
                continue
                
            # Check if embedding exists (optional, or force overwrite)
            # if item.embedding:
            #     continue
            
            try:
                print(f"Processing item: {item.title or item.id[:8]}...")
                embedding = await embedding_service.embed_text(item.content)
                item.embedding = embedding
                count += 1
            except Exception as e:
                print(f"Failed to embed item {item.id}: {e}")
        
        if count > 0:
            await session.commit()
            print(f"✅ Successfully updated {count} items with embeddings!")
        else:
            print("No items needed updating.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(backfill())
