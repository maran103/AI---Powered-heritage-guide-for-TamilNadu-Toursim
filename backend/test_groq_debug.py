import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

def test_groq():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("✗ Error: GROQ_API_KEY not found in .env")
        return

    print(f"Using API Key: {api_key[:10]}...")
    client = Groq(api_key=api_key)

    print("\n1. Testing basic completion (llama-3.1-8b-instant)...")
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10
        )
        print("✓ Basic completion successful!")
        print(f"  Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"✗ Basic completion failed: {e}")

    print("\n2. Testing vision model (meta-llama/llama-4-scout-17b-16e-instruct)...")
    try:
        # Just a metadata check or simple call
        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print("✓ Vision model access successful!")
    except Exception as e:
        print(f"✗ Vision model access failed: {e}")

    print("\n3. Listing available models...")
    try:
        models = client.models.list()
        print("✓ Successfully retrieved models. Available IDs:")
        for model in models.data:
            print(f"  - {model.id}")
    except Exception as e:
        print(f"✗ Failed to list models: {e}")

if __name__ == "__main__":
    test_groq()
