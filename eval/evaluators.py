"""
evaluators.py — Scoring functions for each evaluation dimension.

Each evaluator takes raw API responses + test case expectations
and returns a score between 0.0 and 1.0 with a short explanation.
"""

import json
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EvalResult:
    test_id: str
    category: str
    score: float          # 0.0 – 1.0
    passed: bool
    details: str
    raw_response: dict | None = None


# ── Retrieval Evaluator ──────────────────────────────────────────────────────

def eval_retrieval(test_case: dict, search_fn) -> EvalResult:
    """
    Evaluate search_clauses() quality.

    Checks:
      - Did we get results at all?
      - Do results contain expected keywords?
      - Are results from the correct doc_type?

    Returns a score based on keyword hit rate.
    """
    test_id = test_case["id"]
    query = test_case["query"]
    doc_type = test_case.get("doc_type")
    expected_keywords = test_case["expected_keywords"]

    try:
        raw = search_fn(query=query, top_k=5, doc_type=doc_type)
        results = json.loads(raw) if isinstance(raw, str) else raw
    except Exception as e:
        return EvalResult(
            test_id=test_id, category="retrieval", score=0.0,
            passed=False, details=f"Search failed: {e}"
        )

    if not results:
        return EvalResult(
            test_id=test_id, category="retrieval", score=0.0,
            passed=False, details="No results returned"
        )

    # Combine all result text for keyword matching
    combined_text = " ".join(r.get("text", "") for r in results).lower()

    # Keyword hit rate
    hits = sum(1 for kw in expected_keywords if kw.lower() in combined_text)
    keyword_score = hits / len(expected_keywords) if expected_keywords else 1.0

    # Doc type accuracy (if filter was specified)
    doc_type_score = 1.0
    if doc_type:
        matching = sum(1 for r in results if r.get("doc_type", "").upper() == doc_type.upper())
        doc_type_score = matching / len(results) if results else 0.0

    # Combined score (keyword match weighted more heavily)
    score = 0.7 * keyword_score + 0.3 * doc_type_score

    missed = [kw for kw in expected_keywords if kw.lower() not in combined_text]
    details = (
        f"Results: {len(results)} | "
        f"Keyword hits: {hits}/{len(expected_keywords)} | "
        f"Doc type match: {doc_type_score:.0%}"
    )
    if missed:
        details += f" | Missed keywords: {missed}"

    return EvalResult(
        test_id=test_id, category="retrieval",
        score=round(score, 3), passed=score >= 0.5,
        details=details,
        raw_response={"result_count": len(results), "keyword_hits": hits}
    )


# ── Generation Evaluator ─────────────────────────────────────────────────────

def eval_generation(test_case: dict, response: dict) -> EvalResult:
    """
    Evaluate /generate output.

    Checks:
      - Did we get a document back?
      - Does it contain expected strings (party names, dates, doc title)?
      - How many fields are still missing?
    """
    test_id = test_case["id"]
    expected = test_case.get("expected_in_output", [])

    document = response.get("document", "")
    missing_fields = response.get("missing_fields", [])

    if not document:
        return EvalResult(
            test_id=test_id, category="generation", score=0.0,
            passed=False, details="No document returned"
        )

    # Check expected strings (case-insensitive)
    doc_lower = document.lower()
    hits = sum(1 for s in expected if s.lower() in doc_lower)
    content_score = hits / len(expected) if expected else 1.0

    # Penalize missing fields (more missing = lower score)
    # A few missing is normal; many missing is bad
    field_penalty = min(len(missing_fields) * 0.05, 0.3)

    # Document length check — too short is suspicious
    length_score = 1.0 if len(document) > 200 else 0.5

    score = 0.6 * content_score + 0.2 * (1.0 - field_penalty) + 0.2 * length_score

    missed = [s for s in expected if s.lower() not in doc_lower]
    details = (
        f"Content hits: {hits}/{len(expected)} | "
        f"Missing fields: {len(missing_fields)} | "
        f"Doc length: {len(document)} chars"
    )
    if missed:
        details += f" | Missing content: {missed}"

    return EvalResult(
        test_id=test_id, category="generation",
        score=round(score, 3), passed=score >= 0.5,
        details=details,
        raw_response={"doc_length": len(document), "missing_fields": missing_fields}
    )


# ── Chat Evaluator ───────────────────────────────────────────────────────────

def eval_chat(test_case: dict, response: dict) -> EvalResult:
    """
    Evaluate /chat output.

    Checks:
      - Did we get an answer?
      - Does the answer cover expected topics?
      - Is the answer a reasonable length (not too short)?
    """
    test_id = test_case["id"]
    expected_topics = test_case.get("expected_topics", [])
    must_not_contain = test_case.get("must_not_contain", [])

    answer = response.get("answer", "")

    if not answer:
        return EvalResult(
            test_id=test_id, category="chat", score=0.0,
            passed=False, details="No answer returned"
        )

    answer_lower = answer.lower()

    # Topic coverage
    topic_hits = sum(1 for t in expected_topics if t.lower() in answer_lower)
    topic_score = topic_hits / len(expected_topics) if expected_topics else 1.0

    # Negative checks
    violations = [s for s in must_not_contain if s.lower() in answer_lower]
    violation_penalty = len(violations) * 0.2

    # Length check — very short answers are likely low quality
    length_score = 1.0 if len(answer) > 100 else 0.5 if len(answer) > 50 else 0.2

    score = max(0.0, 0.6 * topic_score + 0.3 * length_score + 0.1 - violation_penalty)

    missed = [t for t in expected_topics if t.lower() not in answer_lower]
    details = (
        f"Topic hits: {topic_hits}/{len(expected_topics)} | "
        f"Answer length: {len(answer)} chars"
    )
    if missed:
        details += f" | Missed topics: {missed}"
    if violations:
        details += f" | Violations: {violations}"

    return EvalResult(
        test_id=test_id, category="chat",
        score=round(score, 3), passed=score >= 0.5,
        details=details
    )


# ── Analyse Evaluator ────────────────────────────────────────────────────────

def eval_analyse(test_case: dict, response: dict) -> EvalResult:
    """
    Evaluate /analyse output.

    Checks:
      - Are expected response fields present?
      - Does the analysis cover expected topics (if specified)?
      - Is the analysis substantive (length check)?
    """
    test_id = test_case["id"]
    expect_fields = test_case.get("expect_fields", [])
    expected_topics = test_case.get("expected_topics", [])

    # Field presence check
    field_hits = sum(1 for f in expect_fields if f in response and response[f])
    field_score = field_hits / len(expect_fields) if expect_fields else 1.0

    analysis = response.get("analysis", "")
    analysis_lower = analysis.lower()

    # Topic coverage
    topic_score = 1.0
    if expected_topics:
        topic_hits = sum(1 for t in expected_topics if t.lower() in analysis_lower)
        topic_score = topic_hits / len(expected_topics)

    # Length check
    length_score = 1.0 if len(analysis) > 100 else 0.5

    score = 0.3 * field_score + 0.5 * topic_score + 0.2 * length_score

    details = (
        f"Fields present: {field_hits}/{len(expect_fields)} | "
        f"Analysis length: {len(analysis)} chars"
    )
    if expected_topics:
        missed = [t for t in expected_topics if t.lower() not in analysis_lower]
        if missed:
            details += f" | Missed topics: {missed}"

    return EvalResult(
        test_id=test_id, category="analyse",
        score=round(score, 3), passed=score >= 0.5,
        details=details
    )


# ── Analyze-Text Evaluator ───────────────────────────────────────────────────

def eval_analyze_text(test_case: dict, response: dict) -> EvalResult:
    """
    Evaluate /analyze-text output.

    Checks:
      - Are expected structured fields present?
      - Is risk_level valid?
      - Is risk_score within expected range?
    """
    test_id = test_case["id"]
    expect_fields = test_case.get("expect_fields", [])
    valid_risk_levels = test_case.get("risk_level_valid", ["low", "medium", "high"])
    expected_min_risk = test_case.get("expected_min_risk_score")

    # Field presence
    field_hits = sum(1 for f in expect_fields if f in response)
    field_score = field_hits / len(expect_fields) if expect_fields else 1.0

    # Risk level validity
    risk_level = response.get("risk_level", "").lower()
    risk_level_ok = risk_level in valid_risk_levels if risk_level else False
    risk_level_score = 1.0 if risk_level_ok else 0.0

    # Risk score range check
    risk_score_score = 1.0
    if expected_min_risk is not None:
        actual_risk = response.get("risk_score", 0)
        if isinstance(actual_risk, (int, float)):
            risk_score_score = 1.0 if actual_risk >= expected_min_risk else 0.3
        else:
            risk_score_score = 0.0

    score = 0.4 * field_score + 0.3 * risk_level_score + 0.3 * risk_score_score

    details = (
        f"Fields: {field_hits}/{len(expect_fields)} | "
        f"Risk level: {risk_level} (valid: {risk_level_ok}) | "
        f"Risk score: {response.get('risk_score', 'N/A')}"
    )
    if expected_min_risk is not None:
        details += f" (expected >= {expected_min_risk})"

    return EvalResult(
        test_id=test_id, category="analyze_text",
        score=round(score, 3), passed=score >= 0.5,
        details=details,
        raw_response={"risk_score": response.get("risk_score"), "risk_level": risk_level}
    )


# ── Conflict Detection Evaluator ─────────────────────────────────────────────

def eval_conflicts(test_case: dict, response: dict) -> EvalResult:
    """
    Evaluate /detect-conflicts output.

    Checks:
      - Did it find conflicts when expected?
      - Does the response mention expected topics?
      - Is the structure valid?
    """
    test_id = test_case["id"]
    expect_conflicts = test_case.get("expect_conflicts", True)
    expected_topics = test_case.get("expected_topics", [])

    total = response.get("total_conflicts", 0)
    conflicts = response.get("conflicts", [])

    # Did it detect conflicts correctly?
    if expect_conflicts:
        detection_score = 1.0 if total > 0 else 0.0
    else:
        detection_score = 1.0 if total == 0 else 0.5

    # Topic coverage in the conflict descriptions
    combined = json.dumps(response).lower()
    topic_hits = sum(1 for t in expected_topics if t.lower() in combined)
    topic_score = topic_hits / len(expected_topics) if expected_topics else 1.0

    # Structure check — conflicts should have required fields
    structure_score = 1.0
    if conflicts:
        required_keys = {"description", "severity"}
        for c in conflicts:
            if not required_keys.issubset(set(c.keys())):
                structure_score -= 0.2
        structure_score = max(0.0, structure_score)

    score = 0.4 * detection_score + 0.4 * topic_score + 0.2 * structure_score

    details = (
        f"Conflicts found: {total} (expected: {'yes' if expect_conflicts else 'no'}) | "
        f"Topic hits: {topic_hits}/{len(expected_topics)} | "
        f"Structure: {structure_score:.0%}"
    )

    return EvalResult(
        test_id=test_id, category="conflict_detection",
        score=round(score, 3), passed=score >= 0.5,
        details=details
    )


# ── Session Continuity Evaluator ─────────────────────────────────────────────

def eval_session_continuity(test_case: dict, responses: list[dict]) -> EvalResult:
    """
    Evaluate multi-turn conversation continuity.

    Checks that later turns show awareness of earlier context
    by looking for expected topics that depend on prior turns.
    """
    test_id = test_case["id"]
    turns = test_case["turns"]

    turn_scores = []
    details_parts = []

    for i, (turn, response) in enumerate(zip(turns, responses)):
        answer = response.get("answer", "").lower()
        expected = turn.get("expected_topics", [])

        if not answer:
            turn_scores.append(0.0)
            details_parts.append(f"Turn {i+1}: no answer")
            continue

        hits = sum(1 for t in expected if t.lower() in answer)
        turn_score = hits / len(expected) if expected else 1.0
        turn_scores.append(turn_score)

        missed = [t for t in expected if t.lower() not in answer]
        dep = turn.get("context_dependency", "")
        detail = f"Turn {i+1}: {hits}/{len(expected)}"
        if missed:
            detail += f" missed={missed}"
        if dep:
            detail += f" (context: {dep})"
        details_parts.append(detail)

    # Later turns weighted more heavily since they test context retention
    if len(turn_scores) >= 3:
        score = 0.2 * turn_scores[0] + 0.3 * turn_scores[1] + 0.5 * turn_scores[2]
    elif len(turn_scores) == 2:
        score = 0.3 * turn_scores[0] + 0.7 * turn_scores[1]
    else:
        score = turn_scores[0] if turn_scores else 0.0

    return EvalResult(
        test_id=test_id, category="session_continuity",
        score=round(score, 3), passed=score >= 0.5,
        details=" | ".join(details_parts)
    )
