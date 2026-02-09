"""
Quick database migration script to add file_id column
Run this with: python add_file_id_column.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Load environment variables
load_dotenv()

async def add_file_id_column():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    print(f"Connecting to database...")
    engine = create_async_engine(database_url)
    
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='items' AND column_name='file_id'
        """))
        
        if result.fetchone():
            print("✓ file_id column already exists!")
        else:
            print("Adding file_id column...")
            await conn.execute(text("""
                ALTER TABLE items 
                ADD COLUMN file_id VARCHAR(36);
            """))
            print("✓ file_id column added successfully!")
    
    await engine.dispose()
    print("\nMigration complete! You can now restart your server.")

if __name__ == "__main__":
    asyncio.run(add_file_id_column())
