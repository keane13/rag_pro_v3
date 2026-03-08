from typing import Dict, Any
from opentelemetry import trace as otel_trace

from .vectorstore import get_vectorstore
from .retriever import retrieve
from .reranker import rerank
from src.infrastructure.llm.llm import generate_answer
from src.domain.prompt.prompt import build_prompt
from src.application.inference.latency import timer


def _get_tracer():
    """Lazily get the Phoenix OTel tracer (registered by monitoring.phoenix_setup)."""
    return otel_trace.get_tracer("rag_pro")


def run_rag(question: str, selected_files=None, mode="fast", stream=False) -> Dict[str, Any]:
    """
    Menjalankan pipeline RAG.
    - Phoenix : spans per fase disimpan via OTel (standard)
    """
    import threading
    tracer = _get_tracer()

    # 1. Pipeline metadata initialization
    trace_data = {
        "question": question,
        "answer": "",
        "contexts": [],
        "source_docs": [],
        "metrics": {},
        "system_prompt": "",
    }

    try:
        vectorstore = get_vectorstore()

        # ── Phase 2: Retrieval ───────────────────────────────────────────────
        with tracer.start_as_current_span("retrieval") as span:
            with timer("retrieval_latency", trace_data["metrics"]):
                initial_docs = retrieve(vectorstore, question, selected_files=selected_files)
            span.set_attribute("retrieval.doc_count", len(initial_docs))

        # ── Phase 3: Reranking ───────────────────────────────────────────────
        with tracer.start_as_current_span("rerank") as span:
            with timer("rerank_latency", trace_data["metrics"]):
                ranked_docs = rerank(question, initial_docs)[:5]
            span.set_attribute("rerank.doc_count", len(ranked_docs))

        trace_data["contexts"]    = [d.page_content for d, _ in ranked_docs]
        trace_data["source_docs"] = [d.metadata      for d, _ in ranked_docs]
        context_str = "\n\n".join(trace_data["contexts"])

        # ── Phase 4: Generation ──────────────────────────────────────────────
        with tracer.start_as_current_span("generation") as span:
            if mode == "thinking":
                sys_instruct = (
                    "Anda adalah asisten ahli. Jawablah dalam Bahasa Indonesia yang sangat profesional dan rapi.\n\n"
                    "STRUKTUR JAWABAN WAJIB:\n"
                    "1. Gunakan ## Judul Bagian (Bold Header) untuk memisahkan topik.\n"
                    "2. Gunakan Penomoran Tebal (contoh: **1.**) untuk langkah-langkah atau poin utama.\n"
                    "3. Gunakan Bullet Points untuk daftar detail.\n"
                    "4. Berikan jarak 2 baris (double newline) antar paragraf agar tidak menumpuk.\n"
                    "5. Gunakan **teks tebal** untuk istilah kunci.\n\n"
                    "Berikan jawaban yang sangat detail berdasarkan konteks."
                )
            elif mode == "summarize":
                sys_instruct = (
                    "Berikan rangkuman profesional dalam Bahasa Indonesia.\n"
                    "Gunakan format Markdown: ## Judul, **1.** Poin Utama, dan Bullet Points. "
                    "Pastikan ada jarak antar bagian."
                )
            else:
                sys_instruct = (
                    "Jawablah dalam Bahasa Indonesia berdasarkan konteks.\n"
                    "FORMAT WAJIB: Gunakan ## Header, **Poin Tebal**, dan daftar bullet. "
                    "Pastikan tampilan sangat rapi dan mudah dibaca (gunakan banyak spasi/newline)."
                )

            trace_data["system_prompt"] = sys_instruct
            messages = build_prompt(context_str, question, instruction=sys_instruct)
            span.set_attribute("llm.mode", mode)

            # --- Prepare metadata ---
            total_proc_latency = sum(trace_data["metrics"].values())
            trace_data["metrics"]["total_processing_latency"] = total_proc_latency
            
            # Use Qwen model for thinking mode
            actual_model_key = "qwen-3-32b" if mode == "thinking" else None

            # Estimate Input Tokens
            input_text = sys_instruct + "\n" + context_str + "\n" + question
            input_tokens = len(input_text) // 4
            
            if not stream:
                with timer("llm_latency", trace_data["metrics"]):
                    answer = generate_answer(messages, stream=False, model_key=actual_model_key)
                trace_data["answer"] = answer
                
                # Estimate Output Tokens and Cost (Non-Stream)
                output_tokens = len(answer) // 4
                total_tokens = input_tokens + output_tokens
                # Example blended rate: ~$0.05 per 1M tokens (Llama-3 8B avg)
                total_cost = (total_tokens / 1_000_000) * 0.05
                trace_data["metrics"]["total_tokens"] = total_tokens
                trace_data["metrics"]["total_cost"] = total_cost
                
                return trace_data

            else:
                # Streaming path
                async def stream_wrapper():
                    full_answer = ""
                    generator = generate_answer(messages, stream=True, model_key=actual_model_key)
                    # We have to consume the original generator and yield our own tokens
                    # so we can intercept the final generated text length.
                    for chunk in generator:
                        if chunk.choices[0].delta.content:
                            full_answer += chunk.choices[0].delta.content
                        yield chunk
                    
                    # Estimate Output Tokens and Cost (Stream)
                    output_tokens = len(full_answer) // 4
                    total_tokens = input_tokens + output_tokens
                    total_cost = (total_tokens / 1_000_000) * 0.05
                    trace_data["metrics"]["total_tokens"] = total_tokens
                    trace_data["metrics"]["total_cost"] = total_cost

                return stream_wrapper(), trace_data

    except Exception as e:
        print(f"❌ RAG Pipeline Error: {e}")
        raise e