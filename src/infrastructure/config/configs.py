import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WEAVIATE_URL = os.getenv("WEAVIATE_URL")
WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DOCS_PATH = os.path.join(BASE_DIR, "data", "docs")

# Database Config
# Use PostgreSQL when POSTGRES_USER is explicitly set in the environment,
# otherwise fall back to a local SQLite file so the app runs without a DB server.
_POSTGRES_USER = os.getenv("POSTGRES_USER")

if _POSTGRES_USER:
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "rag_chat")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URL = f"postgresql://{_POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
else:
    # Local development fallback – no PostgreSQL required
    _SQLITE_PATH = os.path.join(BASE_DIR, "chat_history.db")
    DATABASE_URL = f"sqlite:///{_SQLITE_PATH}"
