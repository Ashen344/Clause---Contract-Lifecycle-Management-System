"""
tools.py — Callable tools available to both agents.

Each function is registered with the function-calling interface.
The model decides which tool to call and with what arguments;
the agent loop executes it and feeds the result back.
"""

import os
import re
import json
import time
import logging
import hashlib
import threading
from pathlib import Path

from elasticsearch import Elasticsearch
from redis import Redis
from google import genai

logger = logging.getLogger(__name__)

# ── Gemini Rate Limiter ───────────────────────────────────────────────────

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL_LITE = os.environ.get("GEMINI_MODEL_LITE", "gemini-2.5-flash")
GEMINI_MODEL_HEAVY = os.environ.get("GEMINI_MODEL_HEAVY", "gemini-2.5-pro")

# Default free-tier-accurate per-model limits. Override per-model via
# GEMINI_MODEL_LIMITS="model:rpm:rpd,model:rpm:rpd". Unknown models fall
# back to GEMINI_RPM / GEMINI_RPD.
_DEFAULT_MODEL_LIMITS = {
    "gemini-2.5-pro":        (5,  25),
    "gemini-2.5-flash":      (10, 250),
    "gemini-2.5-flash-lite": (15, 1000),
    "gemini-2.0-flash":      (15, 1500),
}


def _parse_model_limits():
    limits = dict(_DEFAULT_MODEL_LIMITS)
    override = os.environ.get("GEMINI_MODEL_LIMITS", "").strip()
    if override:
        for entry in override.split(","):
            entry = entry.strip()
            if not entry:
                continue
            try:
                name, rpm, rpd = entry.split(":")
                limits[name.strip()] = (int(rpm), int(rpd))
            except ValueError:
                logger.warning("Ignoring bad GEMINI_MODEL_LIMITS entry: %r", entry)
    return limits


MODEL_LIMITS = _parse_model_limits()
DEFAULT_RPM = int(os.environ.get("GEMINI_RPM", "10"))
DEFAULT_RPD = int(os.environ.get("GEMINI_RPD", "250"))
# Kept for backward compatibility.
GEMINI_MAX_REQUESTS_PER_MINUTE = DEFAULT_RPM
GEMINI_MAX_REQUESTS_PER_DAY = DEFAULT_RPD

# ── Local model (Ollama) config ──────────────────────────────────────────
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b-instruct")
LOCAL_MODEL_ENABLED = os.environ.get("LOCAL_MODEL_ENABLED", "false").lower() in ("true", "1", "yes")

# ── Anthropic Claude config ──────────────────────────────────────────────
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
ANTHROPIC_ENABLED = os.environ.get("ANTHROPIC_ENABLED", "true").lower() in ("true", "1", "yes")
# Tasks routed to Claude (drafting / architect generation).
CLAUDE_CAPABLE_TASKS = {"generate-draft", "architect"}

# Task-to-model mapping: pick the right model weight for each task type
TASK_MODELS = {
    "chat":             GEMINI_MODEL_LITE,   # simple Q&A
    "analyze-text":     GEMINI_MODEL,        # structured analysis
    "generate-draft":   GEMINI_MODEL_HEAVY,  # full contract generation
    "detect-conflicts": GEMINI_MODEL_HEAVY,  # cross-contract reasoning
    "architect":        GEMINI_MODEL_HEAVY,  # agent: document generation
    "analyst":          GEMINI_MODEL,        # agent: clause analysis
    "intake":           GEMINI_MODEL_LITE,   # smart intake field extraction
}

# Tasks that are lightweight enough to run on the local model.
# These get routed to Ollama when LOCAL_MODEL_ENABLED is true.
# "ask-gemini-helper" is intentionally absent — it must always reach Gemini.
LOCAL_CAPABLE_TASKS = {"chat", "analyze-text", "analyst", "intake"}


# Atomic admit-or-deny: per-model RPM (sliding 60s window) + RPD (daily counter).
_ACQUIRE_LUA = """
local now = tonumber(ARGV[1])
local rpm_limit = tonumber(ARGV[2])
local rpd_limit = tonumber(ARGV[3])
local uid = ARGV[4]

local daily = tonumber(redis.call('GET', KEYS[2]) or '0')
if daily >= rpd_limit then
  local ttl = redis.call('TTL', KEYS[2])
  if ttl < 0 then ttl = 86400 end
  return {0, ttl, 'daily', daily}
end

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60)
local count = tonumber(redis.call('ZCARD', KEYS[1]) or '0')
if count >= rpm_limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local wait = 60
  if oldest and #oldest >= 2 then
    wait = math.ceil(60 - (now - tonumber(oldest[2])))
    if wait < 1 then wait = 1 end
  end
  return {0, wait, 'rpm', count}
end

redis.call('ZADD', KEYS[1], now, uid)
redis.call('EXPIRE', KEYS[1], 120)
local new_daily = redis.call('INCR', KEYS[2])
if new_daily == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
return {1, 0, 'ok', new_daily}
"""


class GeminiRateLimiter:
    """Per-model, Redis-backed rate limiter with in-memory fallback.

    Tracks RPM (sliding 60s window) and RPD (24h counter) per model so the
    cap matches Gemini's per-model free-tier quotas and is shared across
    every process sharing the same Redis + API key.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._mem_windows: dict[str, list[float]] = {}
        self._mem_daily: dict[str, tuple[int, float]] = {}
        self._script_sha: str | None = None
        self._redis_ok: bool | None = None

    def _limits_for(self, model: str) -> tuple[int, int]:
        return MODEL_LIMITS.get(model, (DEFAULT_RPM, DEFAULT_RPD))

    def _try_redis(self, model: str, rpm: int, rpd: int):
        try:
            r = get_redis()
            if self._script_sha is None:
                self._script_sha = r.script_load(_ACQUIRE_LUA)
            res = r.evalsha(
                self._script_sha, 2,
                f"gemini:rpm:{model}", f"gemini:rpd:{model}",
                str(time.time()), str(rpm), str(rpd),
                f"{os.getpid()}:{time.time_ns()}",
            )
            self._redis_ok = True
            reason = res[2] if isinstance(res[2], str) else res[2].decode()
            return int(res[0]), int(res[1]), reason, int(res[3])
        except Exception as e:
            if self._redis_ok is not False:
                logger.warning("Rate limiter falling back to in-memory (redis error: %s)", e)
            self._redis_ok = False
            return None

    def _mem_acquire(self, model: str, rpm: int, rpd: int):
        with self._lock:
            now = time.time()
            count, day_start = self._mem_daily.get(model, (0, now))
            if now - day_start > 86400:
                count, day_start = 0, now
            if count >= rpd:
                return 0, max(1, int(86400 - (now - day_start))), "daily", count
            window = [t for t in self._mem_windows.get(model, []) if now - t < 60]
            if len(window) >= rpm:
                return 0, max(1, int(60 - (now - window[0]))), "rpm", len(window)
            window.append(now)
            self._mem_windows[model] = window
            self._mem_daily[model] = (count + 1, day_start)
            return 1, 0, "ok", count + 1

    def try_acquire(self, model: str) -> tuple[bool, int, str]:
        """One-shot attempt. Returns (admitted, wait_seconds, reason)."""
        rpm, rpd = self._limits_for(model)
        res = self._try_redis(model, rpm, rpd) or self._mem_acquire(model, rpm, rpd)
        ok, wait, reason, _ = res
        return bool(ok), int(wait), reason

    def acquire(self, model: str | None = None, max_wait: float = 30.0):
        """Block until admitted. Raises if wait would exceed max_wait or daily cap hit."""
        model = model or GEMINI_MODEL
        start = time.time()
        while True:
            admitted, wait, reason = self.try_acquire(model)
            if admitted:
                return
            if reason == "daily":
                raise RuntimeError(
                    f"Gemini daily limit reached for {model}. Retry in ~{wait}s."
                )
            elapsed = time.time() - start
            if elapsed + wait > max_wait:
                raise RuntimeError(
                    f"Gemini RPM limit for {model}; would need to wait {wait}s."
                )
            time.sleep(min(wait, 5) + 0.1)

    @property
    def usage(self) -> dict:
        out: dict[str, dict] = {}
        now = time.time()
        r = None
        try:
            r = get_redis()
            r.ping()
        except Exception:
            r = None
        for model, (rpm, rpd) in MODEL_LIMITS.items():
            if r is not None:
                try:
                    r.zremrangebyscore(f"gemini:rpm:{model}", "-inf", now - 60)
                    minute = int(r.zcard(f"gemini:rpm:{model}") or 0)
                    daily = int(r.get(f"gemini:rpd:{model}") or 0)
                except Exception:
                    minute = daily = 0
            else:
                window = [t for t in self._mem_windows.get(model, []) if now - t < 60]
                minute = len(window)
                daily, _ = self._mem_daily.get(model, (0, now))
            out[model] = {
                "requests_this_minute": minute,
                "requests_today": daily,
                "rpm_limit": rpm,
                "daily_limit": rpd,
            }
        return out


_rate_limiter = GeminiRateLimiter()


def get_rate_limiter() -> GeminiRateLimiter:
    return _rate_limiter


# Parse Gemini's retry_delay hint from an API error (gRPC RetryInfo).
_RETRY_DELAY_RE = re.compile(r"retry[_-]?delay['\"]?\s*:\s*['\"]?(\d+)s", re.IGNORECASE)


def parse_retry_delay(error_str: str) -> float | None:
    m = _RETRY_DELAY_RE.search(error_str)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


# ── Local model (Ollama) client ──────────────────────────────────────────

import requests as http_requests

_ollama_available: bool | None = None  # cached probe result


def check_ollama_health() -> bool:
    """Check if Ollama is reachable and the model is loaded."""
    global _ollama_available
    try:
        resp = http_requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        if resp.status_code != 200:
            _ollama_available = False
            return False
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        # Accept both "gemma3:4b" and "gemma3:4b-..." variants
        base_name = OLLAMA_MODEL.split(":")[0] if ":" in OLLAMA_MODEL else OLLAMA_MODEL
        _ollama_available = any(base_name in m for m in models)
        if not _ollama_available:
            logger.warning("Ollama running but model '%s' not found. Available: %s",
                           OLLAMA_MODEL, models)
        return _ollama_available
    except Exception as e:
        logger.debug("Ollama health check failed: %s", e)
        _ollama_available = False
        return False


def pull_ollama_model() -> bool:
    """Pull the configured model into Ollama. Called at startup if model is missing."""
    try:
        logger.info("Pulling Ollama model '%s' — this may take a few minutes on first run...",
                     OLLAMA_MODEL)
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/pull",
            json={"name": OLLAMA_MODEL, "stream": False},
            timeout=600,
        )
        if resp.status_code == 200:
            logger.info("Ollama model '%s' pulled successfully", OLLAMA_MODEL)
            return True
        logger.error("Failed to pull model: HTTP %d", resp.status_code)
        return False
    except Exception as e:
        logger.error("Failed to pull Ollama model: %s", e)
        return False


def is_ollama_available() -> bool:
    """Return cached Ollama availability. Re-probes if not yet checked."""
    if _ollama_available is None:
        return check_ollama_health()
    return _ollama_available


def generate_text_local(messages: list[dict], max_tokens: int = 1024,
                        temperature: float = 0.3) -> str:
    """Generate text using the local Ollama model.

    Args:
        messages: List of {"role": "system"|"user"|"assistant", "content": str}.
        max_tokens: Max output tokens.
        temperature: Sampling temperature.

    Returns:
        Generated text string.

    Raises:
        RuntimeError: If Ollama is unreachable or returns an error.
    """
    # Convert messages to Ollama chat format
    ollama_messages = []
    for msg in messages:
        role = msg["role"]
        if role == "tool":
            role = "user"
        elif role == "model":
            role = "assistant"
        ollama_messages.append({"role": role, "content": msg["content"]})

    payload = {
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "stream": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": temperature,
        },
    }

    try:
        resp = http_requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=2220,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        content = data.get("message", {}).get("content", "")
        logger.info("generate_text_local model=%s tokens=%d len=%d",
                     OLLAMA_MODEL,
                     data.get("eval_count", 0),
                     len(content))
        return content

    except http_requests.exceptions.Timeout:
        raise RuntimeError("Ollama request timed out (120s)")
    except http_requests.exceptions.ConnectionError:
        raise RuntimeError(f"Cannot connect to Ollama at {OLLAMA_URL}")


# ── Config ─────────────────────────────────────────────────────────────────

ES_URL     = os.environ.get("ES_URL",     "http://localhost:9200")
INDEX_NAME = os.environ.get("INDEX_NAME", "clm_knowledge_base")
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
TEMPLATES_DIR = Path(__file__).parent / "templates"

# ── Lazy client singletons ─────────────────────────────────────────────────

_es = None
_redis = None
_gemini = None
_anthropic = None


def _load_gemini_key() -> str:
    for path in ["/run/secrets/gemini_api_key",
                 str(Path(__file__).parent.parent / "injest" / "secrets" / "gemini_api_key.txt"),
                 str(Path(__file__).parent / "secrets" / "gemini_api_key.txt")]:
        if os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("Gemini API key not found")
    return key


def get_es() -> Elasticsearch:
    global _es
    if _es is None:
        kwargs = {"request_timeout": 3}
        elastic_password_path = "/run/secrets/elastic_password"
        try:
            if os.path.exists(elastic_password_path):
                with open(elastic_password_path) as f:
                    password = f.read().strip()
                kwargs["basic_auth"] = ("elastic", password)
        except PermissionError:
            logger.debug("Cannot read %s, relying on credentials in ES_URL", elastic_password_path)
        _es = Elasticsearch(ES_URL, **kwargs)
    return _es


_es_up: bool | None = None
_es_checked_at: float = 0.0
_ES_RECHECK_INTERVAL = 60.0


def _is_es_available() -> bool:
    global _es_up, _es_checked_at
    now = time.time()
    if _es_up is not None and (now - _es_checked_at) < _ES_RECHECK_INTERVAL:
        return _es_up
    try:
        get_es().cluster.health(timeout="1s")
        _es_up = True
    except Exception:
        _es_up = False
    _es_checked_at = now
    return _es_up


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis(
            host=REDIS_HOST,
            port=int(REDIS_PORT),
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
    return _redis


def get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=_load_gemini_key())
    return _gemini


def _load_anthropic_key() -> str:
    for path in ["/run/secrets/anthropic_api_key",
                 str(Path(__file__).parent.parent / "injest" / "secrets" / "anthropic_api_key.txt"),
                 str(Path(__file__).parent / "secrets" / "anthropic_api_key.txt")]:
        if os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("Anthropic API key not found")
    return key


def get_anthropic():
    global _anthropic
    if _anthropic is None:
        from anthropic import Anthropic
        _anthropic = Anthropic(api_key=_load_anthropic_key())
    return _anthropic


def generate_text_claude(messages: list[dict], max_tokens: int = 4096,
                        temperature: float = 0.3) -> str:
    """Generate text using Anthropic Claude.

    Messages follow the same shape as generate_text: role in
    {"system", "user", "assistant"}. System messages are collapsed into
    Claude's `system` parameter.
    """
    client = get_anthropic()

    system_parts: list[str] = []
    claude_messages: list[dict] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "system":
            if content:
                system_parts.append(content)
        elif role == "tool":
            claude_messages.append({"role": "user", "content": f"[TOOL_RESULT]\n{content}\n[/TOOL_RESULT]"})
        elif role == "user":
            claude_messages.append({"role": "user", "content": content})
        elif role in ("assistant", "model"):
            claude_messages.append({"role": "assistant", "content": content})

    kwargs = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": claude_messages,
    }
    if system_parts:
        kwargs["system"] = "\n\n".join(system_parts)

    response = client.messages.create(**kwargs)
    # Concatenate any text blocks in the response.
    return "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    )


def generate_text(messages: list[dict], max_tokens: int = 2048, temperature: float = 0.3, task: str = None) -> str:
    """Generate text, routing to local model or Gemini based on task type.

    Routing logic:
      - If LOCAL_MODEL_ENABLED and task is in LOCAL_CAPABLE_TASKS and Ollama
        is healthy → use local model (saves API tokens).
      - Otherwise → use Gemini (with rate limiting and caching).

    Args:
        messages: List of {"role": "user"|"model", "content": str} dicts.
                  First message with role "system" is extracted as system_instruction.
        max_tokens: Max output tokens.
        temperature: Sampling temperature.
        task: Task type key (e.g. "chat", "architect", "detect-conflicts").
              Used to select the appropriate Gemini model from TASK_MODELS.

    Returns:
        Generated text string.
    """
    # ── Try Claude for drafting / architect tasks ───────────────────────
    use_claude = ANTHROPIC_ENABLED and task in CLAUDE_CAPABLE_TASKS
    if use_claude:
        try:
            logger.info(f"generate_text routing to CLAUDE ({ANTHROPIC_MODEL}) for task={task}")
            return generate_text_claude(messages, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            logger.warning(f"Claude call failed, falling back to Gemini: {e}")
            # Fall through to Gemini

    # ── Try local model for lightweight tasks ────────────────────────────
    use_local = (
        LOCAL_MODEL_ENABLED
        and task in LOCAL_CAPABLE_TASKS
        and is_ollama_available()
    )

    if use_local:
        try:
            logger.info(f"generate_text routing to LOCAL model ({OLLAMA_MODEL}) for task={task}")
            return generate_text_local(messages, max_tokens=max_tokens, temperature=temperature)
        except Exception as e:
            logger.warning(f"Local model failed, falling back to Gemini: {e}")
            # Fall through to Gemini

    # ── Gemini path ──────────────────────────────────────────────────────
    model = TASK_MODELS.get(task, GEMINI_MODEL) if task else GEMINI_MODEL
    logger.info(f"generate_text using model={model} for task={task or 'default'}")

    # Check cache for identical prompts (only for low-temperature / deterministic calls)
    if temperature <= 0.3:
        content_for_hash = json.dumps(messages, sort_keys=True) + f"|{max_tokens}|{temperature}|{model}"
        gen_cache_key = f"gen:{hashlib.md5(content_for_hash.encode()).hexdigest()}"
        cached = cache_get(gen_cache_key)
        if cached:
            logger.info("generate_text cache hit")
            return cached
    else:
        gen_cache_key = None

    try:
        _rate_limiter.acquire(model)
    except RuntimeError as e:
        # Local limiter says this model is exhausted. Fall back to Ollama
        # for any task when possible; otherwise propagate.
        if (LOCAL_MODEL_ENABLED and not use_local
                and is_ollama_available() and task != "ask-gemini-helper"):
            logger.warning(
                f"Gemini {model} locally rate-limited ({e}); "
                f"falling back to Ollama for task={task}"
            )
            return generate_text_local(
                messages, max_tokens=max_tokens, temperature=temperature
            )
        raise

    client = get_gemini()

    # Extract system instruction if present
    system_instruction = None
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_instruction = msg["content"]
        elif msg["role"] == "tool":
            chat_messages.append({"role": "user", "parts": [{"text": f"[TOOL_RESULT]\n{msg['content']}\n[/TOOL_RESULT]"}]})
        elif msg["role"] == "user":
            chat_messages.append({"role": "user", "parts": [{"text": msg["content"]}]})
        elif msg["role"] in ("assistant", "model"):
            chat_messages.append({"role": "model", "parts": [{"text": msg["content"]}]})

    # Gemini 2.5 models use thinking tokens that count against
    # max_output_tokens.  Set a thinking budget so the visible answer
    # isn't starved, and bump total tokens to accommodate both.
    is_thinking_model = "2.5" in model
    if is_thinking_model:
        thinking_budget = 1024
        total_tokens = max_tokens + thinking_budget
    else:
        total_tokens = max_tokens

    config = {
        "max_output_tokens": total_tokens,
        "temperature": temperature,
    }
    if is_thinking_model:
        config["thinking_config"] = {"thinking_budget": thinking_budget}
    if system_instruction:
        config["system_instruction"] = system_instruction

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=chat_messages,
                config=config,
            )
            # Extract all text parts from the response (Gemini 2.5 may
            # split output across multiple parts, e.g. thinking + answer)
            parts = (response.candidates[0].content.parts
                     if response.candidates and response.candidates[0].content
                     else [])
            text_parts = [p.text for p in parts if p.text and not getattr(p, "thought", False)]
            result_text = "\n".join(text_parts) if text_parts else (response.text or "")
            finish = (response.candidates[0].finish_reason
                      if response.candidates else None)
            logger.info(f"generate_text model={model} finish={finish} "
                        f"parts={len(parts)} text_len={len(result_text)}")
            if gen_cache_key:
                cache_set(gen_cache_key, result_text, ttl=1800)
            return result_text
        except Exception as e:
            error_str = str(e)
            is_quota = "RESOURCE_EXHAUSTED" in error_str or "429" in error_str
            is_daily_exhausted = ("PerDay" in error_str
                                  and "RESOURCE_EXHAUSTED" in error_str)
            # Quota errors: fall back immediately — retrying just adds latency.
            # Transient errors (503): retry with backoff.
            retryable = (not is_quota and
                         ("503" in error_str or "UNAVAILABLE" in error_str))
            if attempt < max_retries - 1 and retryable:
                hinted = parse_retry_delay(error_str)
                wait_time = hinted if hinted is not None else (2 ** attempt) * 4
                wait_time = min(max(wait_time, 1.0), 30.0)
                logger.warning(
                    f"Gemini {model} 503 (attempt {attempt + 1}/{max_retries}), "
                    f"waiting {wait_time:.0f}s"
                )
                time.sleep(wait_time)
            else:
                # Fallback priority: Ollama → Claude → raise
                if (is_quota and LOCAL_MODEL_ENABLED and not use_local
                        and is_ollama_available() and task != "ask-gemini-helper"):
                    logger.warning(
                        f"Gemini {model} exhausted; falling back to local Ollama for task={task}"
                    )
                    return generate_text_local(
                        messages, max_tokens=max_tokens, temperature=temperature
                    )
                if (is_quota and ANTHROPIC_ENABLED and task != "ask-gemini-helper"):
                    logger.warning(
                        f"Gemini {model} quota exhausted; falling back to Claude ({ANTHROPIC_MODEL}) for task={task}"
                    )
                    return generate_text_claude(
                        messages, max_tokens=max_tokens, temperature=temperature
                    )
                raise


TEMPLATE_FILES = {
    "nda": "nda.txt",
    "msa": "msa.txt",
    "sow": "sow.txt",
    "sla": "sla.txt",
}


# ── Shared JSON parser ─────────────────────────────────────────────────────

def parse_tool_call(text: str) -> dict | None:
    """Extract tool call JSON from model output using balanced-brace parsing.

    Uses brace-depth counting instead of regex so nested JSON in argument
    values is handled correctly.  Returns a parsed dict with "name" and
    "arguments" keys, or None if no valid tool call is found.
    """
    start = 0
    while True:
        # Find the next opening brace
        idx = text.find("{", start)
        if idx == -1:
            break

        # Walk forward counting brace depth to find the matching close
        depth = 0
        end = -1
        for i in range(idx, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        if end == -1:
            # Unmatched brace — no point continuing
            break

        candidate = text[idx:end]
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict) and "name" in obj and "arguments" in obj:
                return obj
        except (json.JSONDecodeError, ValueError):
            pass

        # Advance past this opening brace and try the next one
        start = idx + 1

    return None


# ── Tool 1: search_clauses ─────────────────────────────────────────────────

def search_clauses(query: str, top_k: int = 5, doc_type: str = None) -> str:
    """
    Embed the query with Gemini and run a kNN search on Elasticsearch.
    Returns the top_k most relevant clause chunks as a JSON string.

    Args:
        query:    Natural-language question or clause topic.
        top_k:    Number of results to return (default 5).
        doc_type: Optional filter — e.g. "SLA", "MSA", "NDA".
    """
    if not _is_es_available():
        return "[]"

    cache_key = f"search:{hashlib.md5(f'{query}{top_k}{doc_type}'.encode()).hexdigest()}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Embed the query
    result = get_gemini().models.embed_content(
        model="gemini-embedding-001",
        contents=query
    )
    query_vector = result.embeddings[0].values

    # Build kNN query
    knn_query = {
        "knn": {
            "field": "content_vector",
            "query_vector": query_vector,
            "k": top_k,
            "num_candidates": top_k * 5
        }
    }

    # Optional doc_type filter
    if doc_type:
        knn_query["knn"]["filter"] = {
            "term": {"metadata.doc_type": doc_type.upper()}
        }

    response = get_es().search(index=INDEX_NAME, body=knn_query)
    hits = response["hits"]["hits"]

    results = [
        {
            "text":      h["_source"].get("actual_content", ""),
            "score":     round(h["_score"], 4),
            "source":    h["_source"]["metadata"].get("file_name", ""),
            "doc_type":  h["_source"]["metadata"].get("doc_type", ""),
            "customer":  h["_source"].get("uploader_id", ""),
        }
        for h in hits
    ]

    output = json.dumps(results, indent=2)
    cache_set(cache_key, output, ttl=3600)
    return output


# ── Tool 2: render_template ────────────────────────────────────────────────

def render_template(doc_type: str, fields: dict) -> str:
    """
    Fill a contract template with the provided field values.
    Missing fields are left as {placeholder} so the model can flag them.

    Args:
        doc_type: One of nda, msa, sow, sla (case-insensitive).
        fields:   Dict of placeholder → value pairs.
    Returns:
        Rendered contract text.
    """
    doc_type = doc_type.lower()
    if doc_type not in TEMPLATE_FILES:
        return f"Error: unknown doc_type '{doc_type}'. Choose from: {', '.join(TEMPLATE_FILES)}"

    template_path = TEMPLATES_DIR / TEMPLATE_FILES[doc_type]
    if not template_path.exists():
        return f"Error: template file not found at {template_path}"

    template = template_path.read_text()

    # Replace known fields
    for key, value in fields.items():
        template = template.replace(f"{{{key}}}", str(value))

    return template


# ── Tool 3: cache_get / cache_set ─────────────────────────────────────────

def cache_get(key: str) -> str | None:
    """Retrieve a cached value from Redis. Returns None if not found."""
    try:
        return get_redis().get(key)
    except Exception:
        logger.warning("Cache get error for key %r", key, exc_info=True)
        return None


def cache_set(key: str, value: str, ttl: int = 3600) -> None:
    """Store a value in Redis with a TTL (seconds)."""
    try:
        get_redis().setex(key, ttl, value)
    except Exception:
        logger.warning("Cache set error for key %r", key, exc_info=True)


# ── Tool: ask_gemini ──────────────────────────────────────────────────────

def ask_gemini(question: str, context: str = "") -> str:
    """Delegate a question to Gemini and return the answer as a string.

    Called by the Ollama driver loop when the local model is not confident.
    Always routes to Gemini (task key not in LOCAL_CAPABLE_TASKS).
    """
    user_content = question
    if context:
        user_content = f"Context:\n{context}\n\nQuestion:\n{question}"

    messages = [
        {
            "role": "system",
            "content": (
                "You are helping a smaller local model complete a contract analysis task. "
                "Answer concisely and factually."
            ),
        },
        {"role": "user", "content": user_content},
    ]
    return generate_text(messages, max_tokens=800, temperature=0.3, task="ask-gemini-helper")


# ── Tool schemas for Gemini function calling ───────────────────────────────
# These are passed to the model so it knows what tools are available
# and what arguments each one expects.

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "ask_gemini",
            "description": (
                "Ask Gemini (a larger model) a question when the local model "
                "cannot answer with confidence. Provide the question and optionally "
                "relevant excerpts from the contract as context."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question to ask Gemini"
                    },
                    "context": {
                        "type": "string",
                        "description": "Optional relevant excerpts from the contract"
                    }
                },
                "required": ["question"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_clauses",
            "description": (
                "Search the contract knowledge base for relevant clauses or passages. "
                "Use this to retrieve clause examples, definitions, and precedents "
                "before generating or analysing a document."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural-language clause topic or question"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default 5)",
                        "default": 5
                    },
                    "doc_type": {
                        "type": "string",
                        "description": "Optional filter: SLA, MSA, NDA, SOW",
                        "enum": ["SLA", "MSA", "NDA", "SOW"]
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_template",
            "description": (
                "Fill a predefined contract template (NDA, MSA, SOW, SLA) with "
                "specific field values provided by the user or extracted from context. "
                "Use this as the final step to produce the contract document."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_type": {
                        "type": "string",
                        "description": "Contract type: nda, msa, sow, or sla",
                        "enum": ["nda", "msa", "sow", "sla"]
                    },
                    "fields": {
                        "type": "object",
                        "description": (
                            "Key-value pairs matching template placeholders. "
                            "Example: {\"party_a\": \"Acme Corp\", \"effective_date\": \"2024-01-01\"}"
                        )
                    }
                },
                "required": ["doc_type", "fields"]
            }
        }
    }
]
