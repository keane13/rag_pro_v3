from groq import Groq
from src.infrastructure.config.configs import GROQ_API_KEY, OPENROUTER_API_KEY
import base64
from pathlib import Path
from openai import OpenAI

groq_client = Groq(api_key=GROQ_API_KEY)

# FIX: Pindahkan headers ke default_headers saat init client
or_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    default_headers={
        "HTTP-Referer": "https://your-app.com",
        "X-Title": "RAG Pro",
    }
)

# ─────────────────────────────────────────────
# MODEL REGISTRY
# ─────────────────────────────────────────────

TEXT_MODELS = {
    "llama-4-scout": {
        "id": "meta-llama/llama-4-scout-17b-16e-instruct",
        "label": "Llama 4 Scout 17B",
        "description": "Fast & efficient. Great for RAG and summarisation.",
        "context_window": 131072,
        "provider": "groq",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.1-8b-instruct:free",
    },
    "qwen-3-32b": {
        "id": "qwen/qwen3-32b",
        "label": "Qwen3 32B",
        "description": "More capable variant for complex Deep reasoning tasks.",
        "context_window": 131072,
        "provider": "groq",
        "best_for": "text_generation",
        "fallback_id": "qwen/qwen3-4b:free",
    },
    "qwen3-next-80b": {
        "id": "qwen/qwen3-next-80b-a3b-instruct:free",
        "label": "Qwen3 Next 80B",
        "description": "More capable variant for complex Deep reasoning tasks.",
        "context_window": 262144,
        "provider": "openrouter",
        "best_for": "text_generation",
        "fallback_id": "qwen/qwen3-4b:free",
    },
    "llama-3.3-70b": {
        "id": "llama-3.3-70b-versatile",
        "label": "Llama 3.3 70B Versatile",
        "description": "High-quality 70B model, best accuracy for text tasks.",
        "context_window": 128000,
        "provider": "groq",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.3-70b-instruct:free",
    },
    "llama-3.3-70b_instruct": {
        "id": "meta-llama/llama-3.3-70b-instruct:free",
        "label": "Llama 3.3 70B Instruct",
        "description": "High-quality 70B model, best accuracy for text tasks.",
        "context_window": 128000,
        "provider": "openrouter",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.1-8b-instruct:free",
    },
    "llama-3.1-8b": {
        "id": "llama-3.1-8b-instant",
        "label": "Llama 3.1 8B Instant",
        "description": "Ultra-fast, low-latency model for simple queries.",
        "context_window": 128000,
        "provider": "groq",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.1-8b-instruct:free",
    },
    "qwen3-4b": {
        "id": "qwen/qwen3-4b:free",
        "label": "Qwen3 4B",
        "description": "Ultra-fast, low-latency model for simple queries.",
        "context_window": 40960,
        "provider": "openrouter",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.1-8b-instruct:free",
    },
    "kimi-k2-instruct": {
        "id": "moonshotai/kimi-k2-instruct",
        "label": "Kimi K2 Instruct",
        "description": "Mixture of Experts with best capabilities with Coding, Tool Use, Agentic Tasks.",
        "context_window": 32768,
        "provider": "groq",
        "best_for": "text_generation",
        "fallback_id": "meta-llama/llama-3.1-8b-instruct:free",
    },
}

VISION_MODELS = {
    "nemotron-nano-12b": {
        "id": "nvidia/nemotron-nano-12b-v2-vl:free",
        "label": "Nemo Nano Vision",
        "description": "Best balance of speed and vision capability. Recommended.",
        "context_window": 128000,
        "provider": "openrouter",
        "best_for": "vision",
        "recommended": True,
        "fallback_id": "meta-llama/llama-3.2-11b-vision-instruct:free",
    },
}

# Default models
DEFAULT_TEXT_MODEL   = "llama-4-scout"
DEFAULT_VISION_MODEL = "nemotron-nano-12b"


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _get_fallback_id(model_key: str, registry: dict) -> str:
    """Mendapatkan ID model cadangan dari registry."""
    if model_key in registry and "fallback_id" in registry[model_key]:
        return registry[model_key]["fallback_id"]
    return "meta-llama/llama-3.1-8b-instruct:free"


def _image_to_data_url(image_path: str) -> str:
    """Encode a local image as a base64 data URL for the API."""
    path = Path(image_path)
    suffix = path.suffix.lower().lstrip(".")
    mime_map = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp", "bmp": "bmp"}
    mime = mime_map.get(suffix, "jpeg")
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/{mime};base64,{b64}"


# ─────────────────────────────────────────────
# INTERNAL CALL HELPERS
# ─────────────────────────────────────────────

def _call_groq(model_id: str, messages, stream: bool, max_tokens: int = 2000):
    """Panggil Groq API."""
    response = groq_client.chat.completions.create(
        model=model_id,
        messages=messages,
        temperature=0.3,
        max_tokens=max_tokens,
        stream=stream,
    )
    return response if stream else response.choices[0].message.content


def _call_openrouter(model_id: str, messages, stream: bool, max_tokens: int = 2000):
    """Panggil OpenRouter API — headers sudah diset di or_client init."""
    response = or_client.chat.completions.create(
        model=model_id,
        messages=messages,
        temperature=0.3,
        max_tokens=max_tokens,
        stream=stream,
    )
    return response if stream else response.choices[0].message.content


def _is_rate_limit_error(e: Exception) -> bool:
    """Cek apakah error disebabkan rate limit atau overload."""
    msg = str(e).lower()
    return any(k in msg for k in ["429", "rate_limit", "overloaded", "too many requests"])


# ─────────────────────────────────────────────
# TEXT GENERATION
# ─────────────────────────────────────────────

def generate_answer(messages, stream=False, model_key: str | None = None):
    model_key   = model_key or DEFAULT_TEXT_MODEL
    model_info  = TEXT_MODELS.get(model_key, {})
    provider    = model_info.get("provider", "groq")
    model_id    = model_info.get("id", model_key)

    # FIX: Route langsung ke provider yang benar berdasarkan registry
    if provider == "openrouter":
        try:
            return _call_openrouter(model_id, messages, stream)
        except Exception as e:
            if _is_rate_limit_error(e):
                fallback_id = _get_fallback_id(model_key, TEXT_MODELS)
                print(f"⚠️ OpenRouter limit pada {model_id}. Fallback ke {fallback_id}...")
                return _call_openrouter(fallback_id, messages, stream)
            raise e

    else:  # provider == "groq"
        try:
            return _call_groq(model_id, messages, stream)
        except Exception as e:
            if _is_rate_limit_error(e):
                fallback_id = _get_fallback_id(model_key, TEXT_MODELS)
                print(f"⚠️ Groq limit pada {model_id}. Fallback ke OpenRouter {fallback_id}...")
                return _call_openrouter(fallback_id, messages, stream)
            raise e


# ─────────────────────────────────────────────
# VISION GENERATION
# ─────────────────────────────────────────────

def generate_vision_answer(
    prompt: str,
    image_input: str,
    stream: bool = False,
    model_key: str | None = None,
    system_prompt: str | None = None,
) -> str:
    model_key  = model_key or DEFAULT_VISION_MODEL
    model_info = VISION_MODELS.get(model_key, {})
    provider   = model_info.get("provider", "openrouter")
    model_id   = model_info.get("id", model_key)

    # Persiapan konten gambar
    if image_input.startswith("http"):
        image_content = {"type": "image_url", "image_url": {"url": image_input}}
    else:
        data_url      = _image_to_data_url(image_input)
        image_content = {"type": "image_url", "image_url": {"url": data_url}}

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({
        "role": "user",
        "content": [image_content, {"type": "text", "text": prompt}],
    })

    if provider == "openrouter":
        try:
            return _call_openrouter(model_id, messages, stream, max_tokens=1024)
        except Exception as e:
            if _is_rate_limit_error(e):
                fallback_id = _get_fallback_id(model_key, VISION_MODELS)
                print(f"⚠️ OpenRouter Vision limit. Fallback ke {fallback_id}...")
                return _call_openrouter(fallback_id, messages, stream, max_tokens=1024)
            raise e

    else:  # provider == "groq"
        try:
            return _call_groq(model_id, messages, stream, max_tokens=1024)
        except Exception as e:
            if _is_rate_limit_error(e):
                fallback_id = _get_fallback_id(model_key, VISION_MODELS)
                print(f"⚠️ Groq Vision limit. Fallback ke OpenRouter {fallback_id}...")
                return _call_openrouter(fallback_id, messages, stream, max_tokens=1024)
            raise e