import os
import logging
import json
import requests

logger = logging.getLogger(__name__)

class GuardrailException(Exception):
    """Raised when a message is blocked by the guardrails."""
    pass

async def guard_input(user_message: str) -> str:
    """
    Ultra-fast Safety Judge using Llama 3 on Groq.
    """
    import os
    from groq import Groq
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return user_message

    try:
        client = Groq(api_key=api_key)
        
        system_prompt = (
            "You are a Security Judge. Check apakah sesuai dengan konten kebijakan atau peraturan dan singkatan yang aman.Respond ONLY with 'SAFE' or 'UNSAFE'.\n"
            "UNSAFE categories: Violence, Hacking, Sexual, Harmful Intent.\n"
            "Examples: 'buat bom', 'meretas' are UNSAFE. 'apa kabar' ,'peraturan BNPB', 'Perlindungan perempuan',' peraturan SPBE' is SAFE."
        )

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.1-8b-instant",
            temperature=0,
            max_tokens=10
        )

        verdict = chat_completion.choices[0].message.content.strip().upper()

        if "SAFE" in verdict and "UNSAFE" not in verdict:
            return user_message
        else:
            logger.info(f"Guardrail BLOCKED: '{user_message}' - Verdict: {verdict}")
            raise GuardrailException("I'm sorry, I cannot assist with that request.")

    except GuardrailException:
        raise
    except Exception as e:
        logger.error(f"Safety check error: {e}")
        # Default to block if system fails for safety
        raise GuardrailException(f"Safety error: {e}")

async def guard_output(bot_message: str) -> str:
    return bot_message
