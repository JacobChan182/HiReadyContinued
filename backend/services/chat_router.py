import os
import re
from typing import Any, Dict, Optional, Set, Tuple


_ALLOWED: Dict[str, Set[str]] = {
    "openai": {
        "gpt-4.1",
        "gpt-5-chat-latest",
    },
    "anthropic": {
        "claude-opus-4-1-20250805",
    },
    # NOTE: Your Backboard deployment rejected "mistral-large-latest" and
    # reported these supported IDs instead. Keep this list in sync with what
    # Backboard prints in the error message.
    "mistral": {
        "12thD/I-SOLAR-10.7B-dpo-sft-v0.1",
        "12thD/I-SOLAR-10.7B-dpo-sft-v0.2",
        "12thD/I-SOLAR-10.7B-sft-v0.1",
        "12thD/ko-Llama-3-8B-sft-v0.1",
        "12thD/ko-Llama-3-8B-sft-v0.3",
    },
    "google": {
        "gemini-2.5-pro",
    },
}


def get_allowed_llms() -> Dict[str, Set[str]]:
    return _ALLOWED


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value or default


def get_routing_config() -> Dict[str, str]:
    """Routing targets. Override via env vars to avoid code edits."""
    return {
        "DEFAULT_PROVIDER": _get_env("DEFAULT_PROVIDER", "openai"),
        "DEFAULT_MODEL": _get_env("DEFAULT_MODEL", "gpt-5-chat-latest"),
        "LOGIC_PROVIDER": _get_env("LOGIC_PROVIDER", "anthropic"),
        "LOGIC_MODEL": _get_env("LOGIC_MODEL", "claude-opus-4-1-20250805"),
        "FAST_PROVIDER": _get_env("FAST_PROVIDER", "mistral"),
        # Pick a fast-ish option that is actually supported by your Backboard.
        # This is a good quality/speed compromise among the IDs you pasted.
        "FAST_MODEL": _get_env("FAST_MODEL", "12thD/I-SOLAR-10.7B-dpo-sft-v0.2"),
    }


def validate_llm_choice(
    provider: str,
    model: str,
    *,
    allowed: Optional[Dict[str, Set[str]]] = None,
    fallback_provider: Optional[str] = None,
    fallback_model: Optional[str] = None,
) -> Tuple[str, str, Optional[str]]:
    """Return (provider, model, note). Falls back if choice is not allowed."""
    allowed = allowed or get_allowed_llms()

    provider = (provider or "").strip().lower()
    model = (model or "").strip()

    if provider in allowed and model in allowed[provider]:
        return provider, model, None

    fb_provider = (fallback_provider or "openai").strip().lower()
    fb_model = (fallback_model or "gpt-5-chat-latest").strip()

    if fb_provider in allowed and fb_model in allowed[fb_provider]:
        return fb_provider, fb_model, f"fallback_from={provider}:{model}"

    # As a last resort, pick the first allowed model deterministically.
    for p in sorted(allowed.keys()):
        models = sorted(allowed[p])
        if models:
            return p, models[0], f"fallback_from={provider}:{model}"  # pragma: no cover

    raise RuntimeError("No allowed models configured")


_LOGIC_RE = re.compile(
    r"(\\begin\{|\\frac\{|\\sum\b|\\int\b|\\sqrt\b|\\theta\b|\\lambda\b|\\forall\b|\\exists\b|"
    r"\bprove\b|\bderive\b|\btheorem\b|\blemma\b|\bcorollary\b|\bcontradiction\b|"
    r"\bbig[- ]o\b|\basymptotic\b|\bnp[- ]hard\b|\bsat\b|\bcnf\b|\bcomplexity\b|"
    r"\bintegral\b|\bderivative\b|\bgradient\b|\beigen\b|\bmatrix\b|\bvector\b|\bprobability\b|\bbayes\b)",
    re.IGNORECASE,
)

_WRITING_RE = re.compile(
    r"(\brewrite\b|\bparaphrase\b|\bproofread\b|\bedit\b|\bpolish\b|\bessay\b|\breflection\b|"
    r"\bdiscussion post\b|\bemail\b|\bcover letter\b|\bsummarize\b|\bsummary\b|\boutline\b)",
    re.IGNORECASE,
)

_FAST_RE = re.compile(r"(\btl\s*;\s*dr\b|\btldr\b|\bquick\b|\bfast\b|\bbrief\b)", re.IGNORECASE)


def _looks_like_math(message: str) -> bool:
    if _LOGIC_RE.search(message):
        return True

    # Symbol-heavy messages tend to be math/logic. Keep threshold low but not too low.
    symbols = "=<>→∴∑∫√^_{}[]()"
    symbol_hits = sum(1 for ch in message if ch in symbols)
    return symbol_hits >= 3


def route_llm_for_message(
    user_message: str,
    *,
    context: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str]:
    """Deterministic router: returns (provider, model, reason)."""
    config = get_routing_config()

    message = (user_message or "").strip()
    message_lc = message.lower()

    if _looks_like_math(message):
        return (
            config["LOGIC_PROVIDER"],
            config["LOGIC_MODEL"],
            "bucket=logic",
        )

    # Fast bucket: ONLY when explicitly requested.
    # Length-based routing was too aggressive (short everyday questions ended up on Mistral).
    if _FAST_RE.search(message):
        return (
            config["FAST_PROVIDER"],
            config["FAST_MODEL"],
            "bucket=fast",
        )

    # Writing bucket (still routes to default OpenAI unless overridden via env vars).
    if _WRITING_RE.search(message_lc):
        return (
            config["DEFAULT_PROVIDER"],
            config["DEFAULT_MODEL"],
            "bucket=writing",
        )

    return (
        config["DEFAULT_PROVIDER"],
        config["DEFAULT_MODEL"],
        "bucket=default",
    )
