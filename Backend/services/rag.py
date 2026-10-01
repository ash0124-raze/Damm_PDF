import numpy as np
from pypdf import PdfReader
from google import genai
import time
from google.genai.errors import ServerError
from core.config import settings

def get_ai_client():
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def extract_and_chunk_pdf(file_path: str, chunk_size: int = 500, overlap: int = 50):
    """Extracts text from PDF and splits it into overlapping chunks."""
    reader = PdfReader(file_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    # Split text into chunks
    words = full_text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if len(chunk.strip()) > 50:  # Ignore tiny leftover fragments
            chunks.append(chunk)
            
    return chunks

def get_embeddings(texts: list[str]):
    """Generates vector embeddings for a list of text chunks using Google Gemini."""
    ai_client = get_ai_client()  # <-- Initialized here
    response = ai_client.models.embed_content(
        model="gemini-embedding-2",
        contents=texts,
    )
    # Extract numerical vector values from response objects
    return [np.array(e.values) for e in response.embeddings]

def cosine_similarity(a, b):
    """Calculates mathematical similarity between two vectors."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def find_relevant_chunks(query: str, chunks: list[str], chunk_embeddings: list, top_k: int = 3):
    """Performs vector search to find the most relevant text chunks."""
    ai_client = get_ai_client()  # <-- Initialized here
    query_response = ai_client.models.embed_content(
        model="gemini-embedding-2",
        contents=[query],
    )
    query_vector = np.array(query_response.embeddings[0].values)

    # Score each chunk
    scores = []
    for idx, emb in enumerate(chunk_embeddings):
        score = cosine_similarity(query_vector, emb)
        scores.append((score, idx))

    # Sort by highest similarity score
    scores.sort(key=lambda x: x[0], reverse=True)

    # Return top K matching text chunks
    return [chunks[idx] for _, idx in scores[:top_k]]

def safe_generate(client, model, contents, retries=3, delay=2):
    for attempt in range(retries):
        try:
            return client.models.generate_content(model=model, contents=contents)
        except ServerError as e:
            if attempt == retries - 1:
                raise e
            print(f"Server busy (503), retrying in {delay}s...")
            time.sleep(delay)
            delay *= 2