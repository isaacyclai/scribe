import os
import re
import json
import sys
from openai import OpenAI
from dotenv import load_dotenv
from db import execute_query

load_dotenv()

def get_ai_client():
    return OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv('GROQ_API_KEY')
    )


def generate_member_summary(member_id):
    member = execute_query(
        'SELECT name FROM members WHERE id = %s',
        (member_id,),
        fetch=True
    )
    if not member:
        print(f"Member {member_id} not found")
        return None
    
    member_name = member[0]['name']
    
    activity = execute_query(
        '''SELECT s.section_title, s.section_type, m.acronym as ministry,
                  ss.designation, sess.date
           FROM section_speakers ss
           JOIN sections s ON ss.section_id = s.id
           JOIN sessions sess ON s.session_id = sess.id
           LEFT JOIN ministries m ON s.ministry_id = m.id
           WHERE ss.member_id = %s
           ORDER BY sess.date DESC
           LIMIT 20''',
        (member_id,),
        fetch=True
    )
    
    if not activity:
        print(f"No activity found for member {member_name}")
        return None
    
    recent_designation = activity[0]['designation'] or "MP"
    
    activity_lines = []
    for a in activity:
        ministry_tag = f"[{a['ministry']}] " if a['ministry'] else ""
        activity_lines.append(f"- {a['date']}: {ministry_tag}{a['section_title'][:80]}")
    
    context = "\n".join(activity_lines)
    
    prompt = f"""Based on this parliamentary activity for {member_name} ({recent_designation}), write a brief 2-paragraph profile summarizing:
                1. Their role and focus areas
                2. Key topics they have addressed recently

                Recent Activity:
                {context}

                Write in third person, suitable for a public profile page. The summary must be in markdown format.
                
                DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt."""

    client = get_ai_client()
    try:
        response = client.chat.completions.create(
            model='llama-3.1-8b-instant',
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content.strip()
        # Normalize whitespace (spaces, tabs, non-breaking spaces)
        content = re.sub(r'[ \t\xa0]+', ' ', content)
        summary = content
        
        # Upsert member summary
        execute_query(
            '''INSERT INTO member_summaries (member_id, summary, last_updated)
               VALUES (%s, %s, NOW())
               ON CONFLICT (member_id) DO UPDATE SET summary = EXCLUDED.summary, last_updated = NOW()''',
            (member_id, summary)
        )
        
        import time
        time.sleep(2.1) # Respect 30 RPM limit for Groq
        return summary
    except Exception as e:
        print(f"Error generating member summary: {e}")
        import time
        time.sleep(2.1) # Still delay on error
        return None


def summarize_all_members():
    """Generate summaries for all members."""
    members = execute_query('SELECT id FROM members', fetch=True)
    for member in members:
        generate_member_summary(member['id'])

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python summarizer.py members      - Generate all member summaries")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == 'members':
        summarize_all_members()
    elif cmd == 'all':
        summarize_all_members()
    else:
        print(f"Unknown command: {cmd}")
