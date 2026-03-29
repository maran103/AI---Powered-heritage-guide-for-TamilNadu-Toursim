"""Quick test to see what the AI model generates for Tamil storytelling mode"""
import os, sys, re
sys.path.insert(0, '.')
from prompt import heritage_prompt
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

prompt = heritage_prompt(
    user_msg="tell me about madurai temples",
    location="Latitude: 13.0827, Longitude: 80.2707",
    language="ta",
    storytelling=True
)

print("PROMPT (first 500 chars):")
print(prompt[:500])
print("---")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
response = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[
        {"role": "system", "content": prompt},
        {"role": "user", "content": "tell me about madurai temples"}
    ],
    temperature=0.6,
    max_tokens=500
)

ai_text = response.choices[0].message.content
print("\nAI RESPONSE (first 800 chars):")
print(ai_text[:800])

tamil_chars = len(re.findall(r'[\u0B80-\u0BFF]', ai_text))
english_chars = len(re.findall(r'[a-zA-Z]', ai_text))
print(f"\nTamil chars: {tamil_chars}, English chars: {english_chars}")
print(f"Language: {'TAMIL' if tamil_chars > english_chars else 'ENGLISH'}")
