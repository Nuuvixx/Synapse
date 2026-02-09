"""
Add file_id column to items table

This migration adds a file_id column to link items to uploaded files.
Run this SQL manually if you have existing data.
"""

# SQLite
ALTER_SQLITE = """
ALTER TABLE items ADD COLUMN file_id VARCHAR(36);
"""

# PostgreSQL  
ALTER_POSTGRESQL = """
ALTER TABLE items 
ADD COLUMN file_id VARCHAR(36),
ADD CONSTRAINT fk_items_file_id 
    FOREIGN KEY (file_id) 
    REFERENCES files(id) 
    ON DELETE SET NULL;
"""

# If using SQLAlchemy with Alembic, this would be in an alembic migration file
# For now, users can run this SQL manually or recreate the database

print("Migration SQL generated. Apply to your database.")
print("\nFor SQLite:")
print(ALTER_SQLITE)
print("\nFor PostgreSQL:")
print(ALTER_POSTGRESQL)
print("\nOr simply drop and recreate the database for development:")
print("  1. Stop the backend server")
print("  2. Delete synapse.db (SQLite) or drop the database (PostgreSQL)")
print("  3. Restart the server - it will recreate tables with new schema")
