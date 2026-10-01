import os
from dotenv import load_dotenv

load_dotenv()

from services.rag import extract_and_chunk_pdf, get_embeddings, find_relevant_chunks
from google import genai

client = genai.Client()

def test_pipeline():
    print("🤖 Testing Gemini API Connection...")
    
    # Updated to use the active model ID
    test_res = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Say 'System operational!' if you can read this."
    )
    print(f"API Test Response: {test_res.text.strip()}\n")

    print("🔢 Testing Gemini Vector Embeddings...")
    sample_texts = ["DammPDF is a full-stack document utility tool.", "FastAPI handles the backend execution."]
    embeddings = get_embeddings(sample_texts)
    print(f"Generated {len(embeddings)} embedding vectors successfully!")
    print(f"Vector dimension size: {len(embeddings[0])}\n")

    print("🚀 All base checks passed! Your RAG environment is ready.")

if __name__ == "__main__":
    test_pipeline()