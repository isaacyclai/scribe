import asyncio
import sys
from datetime import datetime
from dotenv import load_dotenv
from db_async import execute, close_pool

load_dotenv()

async def cleanup(start_date_str, end_date_str):
    start_date = datetime.strptime(start_date_str, '%d-%m-%Y').date()
    end_date = datetime.strptime(end_date_str, '%d-%m-%Y').date()

    # 1. Get Session IDs for the date range
    session_query = """
    SELECT id, date 
    FROM sessions 
    WHERE date >= $1 AND date <= $2
    """
    sessions = await execute(session_query, start_date, end_date, fetch=True)
    session_ids = [str(row['id']) for row in sessions]
    
    if not sessions:
        print(f"No sessions found in range {start_date_str} to {end_date_str}.")
        return

    print(f"Cleaning duplicates in {len(sessions)} sessions...")
    
    # 2. De-duplicate using a single SQL command
    # We identify duplicates by (session_id, section_title, section_type)
    # We keep the one with the oldest created_at (or just pick one if timestamps are identical)
    
    cleanup_query = """
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY session_id, section_title, section_type 
                   ORDER BY created_at ASC, id ASC
               ) as rnum
        FROM sections
        WHERE session_id = ANY($1::uuid[])
    )
    DELETE FROM sections
    WHERE id IN (
        SELECT id FROM duplicates WHERE rnum > 1
    );
    """
    
    print("Executing cleanup query...")
    status = await execute(cleanup_query, session_ids)
    
    print(f"Cleanup complete. DB Status: {status}")
    await close_pool()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run cleanup_duplicates.py START_DATE [END_DATE]")
        print("Example: uv run cleanup_duplicates.py 22-09-2025")
        sys.exit(1)
        
    start = sys.argv[1]
    end = sys.argv[2] if len(sys.argv) > 2 else start
    
    asyncio.run(cleanup(start, end))
