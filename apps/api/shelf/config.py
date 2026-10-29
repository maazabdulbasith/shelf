import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data"
SHOTS = DATA / "screenshots"
THUMBS = DATA / "thumbs"
REPORTS = ROOT / "eval" / "reports"
GOLDEN = ROOT / "eval" / "golden"

DATABASE_URL = os.getenv("DATABASE_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "")
WATCH_DIR = os.getenv("SHELF_WATCH", r"C:\Users\Dell\Pictures\Screenshots")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_TEXT_MODEL = os.getenv("OLLAMA_TEXT_MODEL", "llama3.2")
OLLAMA_VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "moondream:1.8b")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "")
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")

TEXT_EMBED_MODEL = "BAAI/bge-small-en-v1.5"
TEXT_DIM = 384
CLIP_VISION_MODEL = "Qdrant/clip-ViT-B-32-vision"
CLIP_TEXT_MODEL = "Qdrant/clip-ViT-B-32-text"
CLIP_DIM = 512
RERANK_MODEL = os.getenv("SHELF_RERANK_MODEL", "Xenova/ms-marco-MiniLM-L-6-v2")
INDEX_VERSION = "bge-small-en-v1.5+clip-vit-b-32-v1"

for folder in (DATA, SHOTS, THUMBS, REPORTS):
    folder.mkdir(parents=True, exist_ok=True)
