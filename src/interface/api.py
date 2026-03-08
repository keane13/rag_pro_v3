import os
# --- Arize Phoenix: SET ENV VAR FIRST before ANY imports ---
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["PHOENIX_WORKING_DIR"] = os.path.join(_PROJECT_ROOT, "src", "infrastructure", "phoenix_data")
os.makedirs(os.environ["PHOENIX_WORKING_DIR"], exist_ok=True)

from fastapi import FastAPI, UploadFile, File, HTTPException
# --- Arize Phoenix: INITIALISE ---
from src.infrastructure.monitoring.phoenix_setup import setup_phoenix
setup_phoenix()

import asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
from src.application.rag.pipeline import run_rag
from src.infrastructure.config.configs import DOCS_PATH
import json
import os
import shutil
import uuid
from typing import List, Optional
import datetime
import time
from src.infrastructure.database import init_db, SessionLocal, ChatSession as DBChatSession, ChatMessage as DBChatMessage, User as DBUser
from sqlalchemy.orm import Session
import bcrypt

# --- Document Indexing ---
from src.application.rag.loader import load_single_document, IMAGE_EXTENSIONS, WORD_EXTENSIONS
from src.application.rag.splitter import split_docs
from src.application.rag.vectorstore import get_weaviate_client, get_embeddings
from langchain_weaviate.vectorstores import WeaviateVectorStore
try:
    from weaviate.classes.query import Filter
except ImportError:
    Filter = None

ALLOWED_EXTENSIONS = {'.pdf', '.txt'} | WORD_EXTENSIONS | IMAGE_EXTENSIONS

# --- LLM Module ---
from src.infrastructure.llm.llm  import (
    generate_answer, generate_vision_answer,
    TEXT_MODELS, VISION_MODELS,
    DEFAULT_TEXT_MODEL, DEFAULT_VISION_MODEL,
)



# --- NeMo Guardrails ---
from src.domain.security.guard import guard_input, guard_output, GuardrailException

app = FastAPI(title="RAG Pro API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs(DOCS_PATH, exist_ok=True)

# Initialize Database
init_db()

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    mode: str = "fast"
    selected_files: Optional[List[str]] = None

class ChatSession(BaseModel):
    id: str
    title: str
    timestamp: str
    messages: List[dict]

class TextGenerateRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    model_key: Optional[str] = None      # key from TEXT_MODELS or raw model ID
    max_tokens: int = 512
    temperature: float = 0.3

class VisionRequest(BaseModel):
    prompt: str
    image_url: str                        # public https:// URL
    system_prompt: Optional[str] = None
    model_key: Optional[str] = None      # key from VISION_MODELS or raw model ID

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

# --- Phoenix Monitoring Redirect ---

@app.get("/monitoring", tags=["Monitoring"])
def phoenix_dashboard():
    """Redirect to Arize Phoenix local dashboard (http://localhost:6006)."""
    return RedirectResponse(url="http://localhost:6006")

# ─────────────────────────────────────────────
# Auth Routes
# ─────────────────────────────────────────────

@app.post("/register", tags=["Auth"])
def register(user: UserRegister):
    db: Session = SessionLocal()
    try:
        existing_user = db.query(DBUser).filter(DBUser.username == user.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
            
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = DBUser(username=user.username, password_hash=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "User registered successfully", "id": new_user.id}
    finally:
        db.close()

@app.post("/login", tags=["Auth"])
def login(user: UserLogin):
    db: Session = SessionLocal()
    try:
        db_user = db.query(DBUser).filter(DBUser.username == user.username).first()
        if not db_user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
            
        if not bcrypt.checkpw(user.password.encode('utf-8'), db_user.password_hash.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        return {"message": "Login successful", "id": db_user.id, "username": db_user.username}
    finally:
        db.close()


# ─────────────────────────────────────────────
# LLM Model Routes
# ─────────────────────────────────────────────

@app.get("/llm/models", tags=["LLM"])
def list_all_models():
    """List all available LLM models (text + vision)."""
    return {
        "text_models":   TEXT_MODELS,
        "vision_models": VISION_MODELS,
        "defaults": {
            "text":   DEFAULT_TEXT_MODEL,
            "vision": DEFAULT_VISION_MODEL,
        },
    }

@app.get("/llm/models/text", tags=["LLM"])
def list_text_models():
    """List models optimised for text generation."""
    return {"models": TEXT_MODELS, "default": DEFAULT_TEXT_MODEL}

@app.get("/llm/models/vision", tags=["LLM"])
def list_vision_models():
    """List models with vision (image understanding) capabilities."""
    return {"models": VISION_MODELS, "default": DEFAULT_VISION_MODEL}

@app.post("/llm/generate", tags=["LLM"])
async def llm_generate(request: TextGenerateRequest):
    """
    Generate a text completion using the selected LLM.
    Accepts a `model_key` from GET /llm/models/text.
    """
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})
    messages.append({"role": "user", "content": request.prompt})

    try:
        answer = generate_answer(
            messages=messages,
            stream=False,
            model_key=request.model_key,
        )
        return {"answer": answer, "model_key": request.model_key or DEFAULT_TEXT_MODEL}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/vision", tags=["LLM"])
async def llm_vision(request: VisionRequest):
    """
    Ask a question about an image using a vision-capable LLM.
    `image_url` must be a public https:// URL.
    Accepts a `model_key` from GET /llm/models/vision.
    """
    try:
        answer = generate_vision_answer(
            prompt=request.prompt,
            image_input=request.image_url,
            stream=False,
            model_key=request.model_key,
            system_prompt=request.system_prompt,
        )
        return {"answer": answer, "model_key": request.model_key or DEFAULT_VISION_MODEL}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/files")
def list_files():
    print(f"DEBUG: Listing files from {DOCS_PATH}")
    files = []
    if os.path.exists(DOCS_PATH):
        files = [f for f in os.listdir(DOCS_PATH) if os.path.isfile(os.path.join(DOCS_PATH, f))]
    print(f"DEBUG: Found {len(files)} files")
    return {"files": files}
@app.delete("/files/{filename}", tags=["Documents"])
async def delete_file(filename: str):
    """Delete a file from storage and its associated chunks from Weaviate."""
    file_path = os.path.join(DOCS_PATH, filename)
    
    # 1. Delete from storage
    if os.path.exists(file_path):
        os.remove(file_path)
    else:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Delete from Weaviate
    try:
        client = get_weaviate_client()
        if Filter:
            collection = client.collections.get("DocumentChunk1")
            collection.data.delete_many(
                where=Filter.by_property("source").equal(filename)
            )
        return {"message": f"Successfully deleted {filename} and its indexed content."}
    except Exception as e:
        print(f"❌ Error deleting {filename} from Weaviate: {e}")
        return {"message": f"Deleted local file {filename}, but failed to clear vector store: {e}"}

@app.post("/files/{filename}/summarize", tags=["Documents"])
async def summarize_file(filename: str):
    """Generate a summary for a specific document."""
    file_path = os.path.join(DOCS_PATH, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        doc = load_single_document(file_path)
        if not doc:
            raise HTTPException(status_code=400, detail="Could not extract text from document")
            
        summary_prompt = (
            "You are an expert document analyst and summarizer. "
            "Please provide a polished, well-structured summary of the document below in Markdown format. "
            "IMPORTANT: Use the SAME LANGUAGE as the document (e.g., if the document is in Indonesian, write the summary in Indonesian; if in English, write in English).\n\n"
            "Guidelines:\n"
            "1. Start with a brief overview (Abstract/Executive Summary).\n"
            "2. Use bullet points for key findings or main sections.\n"
            "3. Use bold text for important terms or figures.\n"
            "4. Ensure the tone is professional and the writing is clear and 'dirapikan' (polished).\n\n"
            f"DOCUMENT CONTENT ({filename}):\n"
            "--------------------\n"
            f"{doc.page_content[:12000]}"
        )
        
        summary = generate_answer(
            messages=[{"role": "user", "content": summary_prompt}],
            model_key=DEFAULT_TEXT_MODEL
        )
        
        return {"filename": filename, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _index_file(file_path: str) -> int:
    """Extract, split, and upsert a single file into Weaviate. Returns chunk count."""
    doc = load_single_document(file_path)
    if not doc:
        return 0
    chunks = split_docs([doc])
    if not chunks:
        return 0
    WeaviateVectorStore.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        client=get_weaviate_client(),
        index_name="DocumentChunk_final",
        batch_size=100,
    )
    return len(chunks)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and immediately index it into the Weaviate vector store."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    file_path = os.path.join(DOCS_PATH, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        chunks_indexed = _index_file(file_path)
    except Exception as e:
        print(f"❌ Indexing error for {file.filename}: {e}")
        chunks_indexed = 0

    if chunks_indexed == 0:
        return {
            "filename": file.filename,
            "file_type": ext.lstrip("."),
            "chunks_indexed": 0,
            "message": "File saved but no text could be extracted for indexing.",
        }

    return {
        "filename": file.filename,
        "file_type": ext.lstrip("."),
        "chunks_indexed": chunks_indexed,
        "message": f"File uploaded and indexed successfully ({chunks_indexed} chunks).",
    }


@app.post("/index")
async def reindex_all():
    """Manually trigger a full re-index of all documents in the docs folder."""
    from rag.loader import load_documents
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    docs = load_documents(DOCS_PATH)
    if not docs:
        return {"message": "No documents found to index.", "chunks_indexed": 0}

    chunks = split_docs(docs)
    WeaviateVectorStore.from_documents(
        documents=chunks,
        embedding=get_embeddings(),
        client=get_weaviate_client(),
        index_name="DocumentChunk_final",
        batch_size=100,
    )
    return {"message": f"Re-indexed {len(docs)} documents into {len(chunks)} chunks.", "chunks_indexed": len(chunks)}

# --- Chat History ---

@app.get("/history")
def list_history():
    db = SessionLocal()
    try:
        sessions = db.query(DBChatSession).order_by(DBChatSession.timestamp.desc()).all()
        return [
            {
                "id": s.id,
                "title": s.title,
                "timestamp": str(s.timestamp)
            } for s in sessions
        ]
    finally:
        db.close()

@app.get("/history/{session_id}")
def get_session(session_id: str):
    db = SessionLocal()
    try:
        session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages = [
            {
                "role": m.role, 
                "content": m.content, 
                "timestamp": str(m.timestamp),
                "sources": json.loads(m.sources) if m.sources else None
            }
            for m in session.messages
        ]
        
        return {
            "id": session.id,
            "title": session.title,
            "timestamp": str(session.timestamp),
            "messages": messages
        }
    finally:
        db.close()

@app.delete("/history/{session_id}")
def delete_session(session_id: str):
    db = SessionLocal()
    try:
        session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
        if session:
            db.delete(session)
            db.commit()
            return {"message": "Deleted"}
        raise HTTPException(status_code=404, detail="Session not found")
    finally:
        db.close()

def save_message(session_id, role, content, sources=None):
    db = SessionLocal()
    try:
        session = db.query(DBChatSession).filter(DBChatSession.id == session_id).first()
        if not session:
            session = DBChatSession(id=session_id, title="New Chat")
            db.add(session)
            db.commit()
            db.refresh(session)
        
        if role == "user" and len(session.messages) == 0:
            session.title = content[:30] + "..." if len(content) > 30 else content
            session.timestamp = datetime.datetime.utcnow()
        
        sources_json = json.dumps(sources) if sources else None
        message = DBChatMessage(session_id=session_id, role=role, content=content, sources=sources_json)
        db.add(message)
        session.timestamp = datetime.datetime.utcnow()
        db.commit()
    finally:
        db.close()

# --- Chat Endpoint ---

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    question = request.question
    session_id = request.session_id
    mode = request.mode
    selected_files = request.selected_files

    if not session_id:
        session_id = str(uuid.uuid4())

    # === NeMo Guardrails: input safety check ===
    try:
        question = await guard_input(question)
    except GuardrailException as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save User Message
    save_message(session_id, "user", question)

    start_time = time.time()
    answer_stream, context_data = run_rag(question, selected_files=selected_files, mode=mode, stream=True)
    # Pipeline latency = Retrieval + Rerank (pre-generation)
    proc_latency = round(time.time() - start_time, 4)

    async def event_generator():
        # Yield Session ID first so frontend knows
        yield f"event: session_id\ndata: {session_id}\n\n"

        # Yield context + immediate pipeline latency
        metrics_init = {"latency": proc_latency, "status": "processing_complete"}
        yield f"event: context\ndata: {json.dumps(context_data)}\n\n"
        yield f"event: metrics\ndata: {json.dumps(metrics_init)}\n\n"

        full_answer = ""
        # answer_stream is now an async generator
        async for chunk in answer_stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_answer += content
                yield f"event: token\ndata: {json.dumps(content)}\n\n"
                # Artificial pacing for better readability
                await asyncio.sleep(0.012)

        total_latency = round(time.time() - start_time, 4)

        # === Emit final metrics ===
        final_metrics = {"latency": total_latency, "proc_latency": proc_latency}
        yield f"event: metrics\ndata: {json.dumps(final_metrics)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

        # Save Assistant Message with sources
        # Format sources for saving
        save_sources = []
        if context_data:
            ctx_list = context_data.get("contexts", [])
            meta_list = context_data.get("source_docs", [])
            for i, content in enumerate(ctx_list):
                full_path = meta_list[i].get("source", "Unknown") if i < len(meta_list) else "Unknown"
                filename = os.path.basename(full_path)
                save_sources.append({"filename": filename, "content": content})

        save_message(session_id, "assistant", full_answer, sources=save_sources)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ─────────────────────────────────────────────
# Dashboard & Monitoring
# ─────────────────────────────────────────────

@app.get("/dashboard/metrics", tags=["Monitoring"])
def get_dashboard_metrics():
    import os
    import math
    import pandas as pd
    from phoenix.client import Client

    def safe_float(val, default=0.0):
        try:
            f = float(val)
            return default if (math.isnan(f) or math.isinf(f)) else f
        except:
            return default

    metrics = {
        "avg_retrieval_latency": 0.0,
        "avg_rerank_latency": 0.0,
        "avg_generation_latency": 0.0,
        "avg_bert_score": 0.0,
        "ragas_score": 0.0,
        "total_documents": 0,
        "total_cost": 0.0,
        "debug_status": "Starting..."
    }

    if 'DOCS_PATH' in globals() and os.path.exists(DOCS_PATH):
        metrics["total_documents"] = len([
            f for f in os.listdir(DOCS_PATH)
            if os.path.isfile(os.path.join(DOCS_PATH, f))
        ])

    try:
        api_key = os.getenv("PHOENIX_API_KEY")
        if not api_key:
            metrics["debug_status"] = "ERROR: PHOENIX_API_KEY is not set."
            return metrics

        client = Client(
            base_url="https://app.phoenix.arize.com/s/simon-keane13",
            api_key=api_key,
        )

        df = client.spans.get_spans_dataframe(
            project_identifier="rag_pro",
            limit=5000,
        )

        if df is None or df.empty:
            metrics["debug_status"] = "SUCCESS: Connected but DataFrame is EMPTY."
            return metrics

        metrics["debug_status"] = f"SUCCESS: Fetched {len(df)} spans."

        # ── Duration ──────────────────────────────────────────────────────────
        if 'latency_ms' in df.columns:
            df['duration_sec'] = pd.to_numeric(df['latency_ms'], errors='coerce') / 1000.0
        else:
            df['start_time']   = pd.to_datetime(df['start_time'], errors='coerce')
            df['end_time']     = pd.to_datetime(df['end_time'],   errors='coerce')
            df['duration_sec'] = (df['end_time'] - df['start_time']).dt.total_seconds()

        # ── Retrieval & Rerank (use their own spans) ──────────────────────────
        retrieval_df = df[df['name'].str.lower() == 'retrieval']
        if not retrieval_df.empty:
            metrics["avg_retrieval_latency"] = safe_float(
                retrieval_df['duration_sec'].dropna().mean()
            )

        rerank_df = df[df['name'].str.lower() == 'rerank']
        if not rerank_df.empty:
            metrics["avg_rerank_latency"] = safe_float(
                rerank_df['duration_sec'].dropna().mean()
            )

        # ── Generation: use "Completions" (actual LLM call), NOT "generation" ─
        # "generation" span is always 0ms due to streaming closing the span early
        completions_df = df[df['name'] == 'Completions']
        if not completions_df.empty:
            metrics["avg_generation_latency"] = safe_float(
                completions_df['duration_sec'].dropna().mean()
            )

        # ── Cost: token count from Completions spans ──────────────────────────
        for cost_col in [
            'attributes.llm.usage.total_cost',
            'attributes.llm.token.count.completion',
            'attributes.llm.token.count.total',
        ]:
            if cost_col in df.columns:
                val = completions_df[cost_col].dropna().astype(float).sum()
                metrics["total_cost"] = safe_float(val)
                if metrics["total_cost"] > 0:
                    break

        # ── RAGAS Score ───────────────────────────────────────────────────────
        # RAGAS is NOT automatically captured — it only appears if you explicitly
        # run ragas.evaluate() and log scores back as span attributes or annotations.
        # Check all annotation/eval columns that might exist:
        ragas_col = 'attributes.eval.ragas.f1_score'
        if ragas_col in df.columns:
            val = df[ragas_col].dropna().astype(float).mean()
            metrics["avg_bert_score"] = safe_float(val)

        if metrics["avg_bert_score"] == 0.0:
            import json
            eval_path = os.path.join(DOCS_PATH, "..", "hasil_eval.json")
            if not os.path.exists(eval_path):
                BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                eval_path = os.path.join(BASE_DIR, "data", "hasil_eval.json")
            if os.path.exists(eval_path):
                try:
                    with open(eval_path, "r") as f:
                        eval_data = json.load(f)
                        metrics["avg_bert_score"] = safe_float(eval_data.get("summary_metrics", {}).get("overall_rag_score", 0.0))
                except Exception:
                    pass

    except Exception as e:
        import traceback
        metrics["debug_status"] = f"ERROR: {type(e).__name__}: {str(e)}"

    return metrics

@app.get("/dashboard/debug", tags=["Monitoring"])
def get_debug_spans():
    """Temporary debug endpoint - shows raw Phoenix span data."""
    import os
    import pandas as pd
    from phoenix.client import Client

    try:
        client = Client(
            base_url="https://app.phoenix.arize.com/s/simon-keane13",
            api_key=os.getenv("PHOENIX_API_KEY"),
        )

        df = client.spans.get_spans_dataframe(
            project_identifier="rag_pro",
            limit=20,
        )

        if df is None or df.empty:
            return {"error": "Empty dataframe"}

        # Show ALL columns and sample rows for the span types we care about
        target_spans = df[df['name'].str.lower().isin(['retrieval', 'rerank', 'generation'])]

        return {
            "total_spans_fetched": len(df),
            "all_column_names": list(df.columns),
            "target_span_count": len(target_spans),
            "target_spans_raw": target_spans.to_dict(orient='records'),  # full raw rows
            "all_span_names": df['name'].unique().tolist(),
        }

    except Exception as e:
        import traceback
        return {"error": str(e), "trace": traceback.format_exc()}
    
@app.get("/dashboard/debug2", tags=["Monitoring"])
def get_debug2():
    import os
    try:
        api_key = os.getenv("PHOENIX_API_KEY")
        return {
            "api_key_set": bool(api_key),
            "api_key_preview": api_key[:8] + "..." if api_key else None,
        }
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/dashboard/debug3", tags=["Monitoring"])
def get_debug3():
    import os
    from phoenix.client import Client
    try:
        client = Client(
            base_url="https://app.phoenix.arize.com/s/simon-keane13",
            api_key=os.getenv("PHOENIX_API_KEY"),
        )
        return {"client_created": True}
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/dashboard/debug4", tags=["Monitoring"])
def get_debug4():
    import os
    from phoenix.client import Client
    try:
        client = Client(
            base_url="https://app.phoenix.arize.com/s/simon-keane13",
            api_key=os.getenv("PHOENIX_API_KEY"),
        )
        df = client.spans.get_spans_dataframe(
            project_identifier="rag_pro",
            limit=5,
        )
        return {
            "df_type": str(type(df)),
            "df_shape": list(df.shape) if df is not None else None,
            "columns": list(df.columns) if df is not None else None,
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
