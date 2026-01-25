from google import genai
import os
import json
from dotenv import load_dotenv

load_dotenv()

def process_section(content, title):
    client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
    prompt = f"""
                Analyze this Singapore Parliament question section and return ONLY valid JSON:

                Title: {title}
                Content: {content}

                Return JSON with:
                - "summary": A summary of the main question and key points from the answer
                - "topics": An array of main topics discussed (e.g., "Public Housing", "Healthcare")
                - "tags": An array of relevant tags/keywords

                Example:
                {{"summary": "MP asks about BTO waiting times. Minister explains current measures to reduce delays.", "topics": ["Public Housing"], "tags": ["HDB", "BTO", "Housing Delays"]}}
                """
    
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=[
                {'parts': [{'text': prompt}]}
            ]
        )
        text = response.text.strip()
        
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        
        return json.loads(text.strip())
    
    except Exception as e:
        print(f"Error processing with Gemini: {e}")
        return {
            'summary': content[:200] + '...',
            'topics': ['Uncategorized'],
            'tags': []
        }

# Test
if __name__ == '__main__':
    test_content = "Mr Speaker, I rise to ask about housing policies and BTO delays."
    result = process_section(test_content, "Public Housing Question")
    print(json.dumps(result, indent=2))