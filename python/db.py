# python/db.py
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def execute_query(query, params=None, fetch=False):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, params)
    
    result = None
    if fetch:
        result = cur.fetchall()
    
    conn.commit()
    cur.close()
    conn.close()
    return result

def find_or_create_member(name):
    result = execute_query(
        'SELECT id FROM members WHERE name = %s',
        (name,),
        fetch=True
    )
    
    if result:
        return result[0]['id']
    
    result = execute_query(
        'INSERT INTO members (name) VALUES (%s) RETURNING id',
        (name,),
        fetch=True
    )
    return result[0]['id']

def find_or_create_topic(title, category='General'):
    result = execute_query(
        'SELECT id FROM topics WHERE title = %s',
        (title,),
        fetch=True
    )
    
    if result:
        return result[0]['id']
    
    result = execute_query(
        'INSERT INTO topics (title, category) VALUES (%s, %s) RETURNING id',
        (title, category),
        fetch=True
    )
    return result[0]['id']

if __name__ == '__main__':
    try:
        result = execute_query('SELECT NOW()', fetch=True)
        print('Connected to Supabase')
        print(f'Current time: {result[0]["now"]}')
    except Exception as e:
        print(f'Connection failed: {e}')