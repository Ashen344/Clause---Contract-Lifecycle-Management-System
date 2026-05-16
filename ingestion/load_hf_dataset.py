"""
Load a Hugging Face dataset into the CLM knowledge base.

Usage (inside the worker container):
    python load_hf_dataset.py
"""

import os
import sys
import time
import logging
import hashlib
from datasets import load_dataset
from ingest import (
    _get_gemini_client, ensure_index, es, INDEX_NAME,
    _already_indexed, _delete_old_chunks,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DOC_TYPE = os.environ.get("HF_DOC_TYPE", "legal-reference")
CUSTOMER = os.environ.get("HF_CUSTOMER", "Sri Lanka Legal")
DATASET_NAME = "Nishan726/sri-lankan-legal-conversations"

EMBED_BATCH_SIZE = 50
PAUSE_BETWEEN_BATCHES = 65
MAX_RETRIES = 5
SKIP_BATCHES = int(os.environ.get("SKIP_BATCHES", "0"))


def _conversation_to_text(row: dict) -> str:
    parts = []
    category = row.get("category", "unknown")
    parts.append(f"Category: {category}\n")

    for turn in row.get("conversations", []):
        role = turn.get("role", "unknown").capitalize()
        content = turn.get("content", "")
        parts.append(f"{role}: {content}")

    return "\n\n".join(parts)


def main():
    logger.info("Loading dataset: %s", DATASET_NAME)
    ds = load_dataset(DATASET_NAME)

    client = _get_gemini_client()
    ensure_index()

    all_rows = []
    for split in ds:
        all_rows.extend(ds[split])
    logger.info("Total conversations: %d", len(all_rows))

    chunks = []
    for row in all_rows:
        text = _conversation_to_text(row)
        if len(text.strip()) < 50:
            continue
        chunks.append(text)

    logger.info("Chunks to index: %d (skipping LLM filter — dataset is pre-curated)", len(chunks))

    if not chunks:
        logger.warning("No chunks to index.")
        sys.exit(0)

    source_name = "hf_sri_lankan_legal_conversations"
    content_hash = hashlib.sha256("".join(chunks).encode()).hexdigest()

    if _already_indexed(source_name, content_hash):
        logger.info("Dataset already indexed with same content. Skipping.")
        sys.exit(0)

    if SKIP_BATCHES == 0:
        _delete_old_chunks(source_name)

    from elasticsearch.helpers import bulk

    actions = []
    total_batches = (len(chunks) + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE

    for batch_idx, batch_start in enumerate(range(0, len(chunks), EMBED_BATCH_SIZE)):
        if batch_idx < SKIP_BATCHES:
            continue
        batch = chunks[batch_start: batch_start + EMBED_BATCH_SIZE]
        logger.info("Embedding batch %d/%d (%d chunks)",
                     batch_idx + 1, total_batches, len(batch))

        result = None
        for attempt in range(MAX_RETRIES):
            try:
                result = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                )
                break
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    wait = 60 * (attempt + 1)
                    logger.warning("Rate limited, waiting %ds (attempt %d/%d)",
                                   wait, attempt + 1, MAX_RETRIES)
                    time.sleep(wait)
                else:
                    raise

        if result is None:
            logger.error("Failed to embed batch %d after %d retries, skipping",
                         batch_idx + 1, MAX_RETRIES)
            continue

        for offset, (chunk, emb) in enumerate(zip(batch, result.embeddings)):
            actions.append({
                "_index": INDEX_NAME,
                "_source": {
                    "text": chunk,
                    "vector": emb.values,
                    "metadata": {
                        "source": source_name,
                        "doc_type": DOC_TYPE,
                        "customer": CUSTOMER,
                        "chunk_id": batch_start + offset,
                        "file_type": "dataset",
                        "content_hash": content_hash,
                    },
                },
            })

        if batch_idx < total_batches - 1:
            logger.info("Pausing %ds for rate limit...", PAUSE_BETWEEN_BATCHES)
            time.sleep(PAUSE_BETWEEN_BATCHES)

    success, errors = bulk(es, actions, raise_on_error=False)
    if errors:
        logger.error("Bulk indexing had %d error(s)", len(errors))
    logger.info("Indexed %d chunks from %s", success, DATASET_NAME)


if __name__ == "__main__":
    main()
