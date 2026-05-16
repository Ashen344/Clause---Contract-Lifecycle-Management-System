#!/usr/bin/env python3
"""
run_eval.py — End-to-end evaluation runner for the CLM AI system.

Runs all evaluation categories against the live API and produces
a scored report with pass/fail status for each test case.

Usage:
    python eval/run_eval.py                          # run all tests
    python eval/run_eval.py --category retrieval      # run one category
    python eval/run_eval.py --base-url http://host:8000
    python eval/run_eval.py --output eval_report.json # save JSON report
"""

import argparse
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

import requests

# Add project root to path so we can import tools for direct retrieval tests
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "agents"))

from evaluators import (
    EvalResult,
    eval_retrieval,
    eval_generation,
    eval_chat,
    eval_analyse,
    eval_analyze_text,
    eval_conflicts,
    eval_session_continuity,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

DATASET_PATH = Path(__file__).parent / "test_dataset.json"

# Delay between API calls to respect rate limits
API_DELAY_SECONDS = float(os.environ.get("EVAL_API_DELAY", "4"))


def load_dataset() -> dict:
    with open(DATASET_PATH) as f:
        return json.load(f)


def api_call(base_url: str, method: str, endpoint: str, payload: dict = None,
             timeout: int = 120) -> tuple[dict, int]:
    """Make an API call and return (response_json, status_code)."""
    url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
    try:
        if method == "GET":
            resp = requests.get(url, timeout=timeout)
        else:
            resp = requests.post(url, json=payload, timeout=timeout)
        return resp.json(), resp.status_code
    except requests.exceptions.Timeout:
        return {"error": "Request timed out"}, 408
    except Exception as e:
        return {"error": str(e)}, 0


# ── Category runners ─────────────────────────────────────────────────────────

def run_retrieval_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    """Run retrieval tests via direct tool import or API fallback."""
    results = []
    tests = dataset.get("retrieval_tests", [])

    # Try direct import for more accurate retrieval testing
    search_fn = None
    try:
        from tools import search_clauses
        search_fn = search_clauses
        logger.info("Using direct search_clauses() for retrieval tests")
    except Exception:
        logger.info("Direct import failed — using /analyse endpoint as proxy")

    for tc in tests:
        logger.info(f"  [{tc['id']}] {tc['description']}")

        if search_fn:
            result = eval_retrieval(tc, search_fn)
        else:
            # Fallback: use /analyse and check if clauses were found
            payload = {"question": tc["query"]}
            if tc.get("doc_type"):
                payload["doc_type"] = tc["doc_type"].lower()
            resp, status = api_call(base_url, "POST", "/analyse", payload)
            time.sleep(API_DELAY_SECONDS)

            if status != 200:
                result = EvalResult(
                    test_id=tc["id"], category="retrieval", score=0.0,
                    passed=False, details=f"API error: HTTP {status}"
                )
            else:
                # Approximate retrieval eval from analyse response
                clauses_found = resp.get("clauses_found", 0)
                analysis = resp.get("analysis", "").lower()
                kw = tc["expected_keywords"]
                hits = sum(1 for k in kw if k.lower() in analysis)
                score = 0.5 * (min(clauses_found, 5) / 5) + 0.5 * (hits / len(kw) if kw else 1)
                result = EvalResult(
                    test_id=tc["id"], category="retrieval",
                    score=round(score, 3), passed=score >= 0.5,
                    details=f"Clauses found: {clauses_found} | Keyword hits in analysis: {hits}/{len(kw)}"
                )

        results.append(result)

    return results


def run_chat_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("chat_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        payload = {"question": tc["question"]}
        resp, status = api_call(base_url, "POST", "/chat", payload)
        time.sleep(API_DELAY_SECONDS)

        if status != 200:
            results.append(EvalResult(
                test_id=tc["id"], category="chat", score=0.0,
                passed=False, details=f"API error: HTTP {status} — {resp.get('detail', '')}"
            ))
        else:
            results.append(eval_chat(tc, resp))

    return results


def run_analyse_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("analyse_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        payload = {"question": tc["question"]}
        if tc.get("doc_type"):
            payload["doc_type"] = tc["doc_type"]
        if tc.get("document_text"):
            payload["document_text"] = tc["document_text"]

        resp, status = api_call(base_url, "POST", "/analyse", payload)
        time.sleep(API_DELAY_SECONDS)

        if status != 200:
            results.append(EvalResult(
                test_id=tc["id"], category="analyse", score=0.0,
                passed=False, details=f"API error: HTTP {status} — {resp.get('detail', '')}"
            ))
        else:
            results.append(eval_analyse(tc, resp))

    return results


def run_generate_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("generate_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        payload = {"doc_type": tc["doc_type"], "fields": tc["fields"]}
        resp, status = api_call(base_url, "POST", "/generate", payload)
        time.sleep(API_DELAY_SECONDS)

        if status != 200:
            results.append(EvalResult(
                test_id=tc["id"], category="generation", score=0.0,
                passed=False, details=f"API error: HTTP {status} — {resp.get('detail', '')}"
            ))
        else:
            results.append(eval_generation(tc, resp))

    return results


def run_analyze_text_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("analyze_text_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        payload = {"text": tc["text"]}
        resp, status = api_call(base_url, "POST", "/analyze-text", payload)
        time.sleep(API_DELAY_SECONDS)

        if status != 200:
            results.append(EvalResult(
                test_id=tc["id"], category="analyze_text", score=0.0,
                passed=False, details=f"API error: HTTP {status} — {resp.get('detail', '')}"
            ))
        else:
            results.append(eval_analyze_text(tc, resp))

    return results


def run_conflict_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("conflict_detection_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        payload = {"contracts": tc["contracts"]}
        resp, status = api_call(base_url, "POST", "/detect-conflicts", payload)
        time.sleep(API_DELAY_SECONDS)

        if status != 200:
            results.append(EvalResult(
                test_id=tc["id"], category="conflict_detection", score=0.0,
                passed=False, details=f"API error: HTTP {status} — {resp.get('detail', '')}"
            ))
        else:
            results.append(eval_conflicts(tc, resp))

    return results


def run_session_tests(dataset: dict, base_url: str) -> list[EvalResult]:
    results = []
    for tc in dataset.get("session_continuity_tests", []):
        logger.info(f"  [{tc['id']}] {tc['description']}")
        session_id = f"eval-{uuid.uuid4().hex[:12]}"
        turn_responses = []

        for i, turn in enumerate(tc["turns"]):
            payload = {
                "question": turn["question"],
                "session_id": session_id,
            }
            resp, status = api_call(base_url, "POST", "/chat", payload)
            time.sleep(API_DELAY_SECONDS)

            if status != 200:
                turn_responses.append({"answer": "", "error": f"HTTP {status}"})
            else:
                turn_responses.append(resp)

        results.append(eval_session_continuity(tc, turn_responses))

    return results


# ── Report generation ────────────────────────────────────────────────────────

CATEGORY_RUNNERS = {
    "retrieval":           run_retrieval_tests,
    "chat":                run_chat_tests,
    "analyse":             run_analyse_tests,
    "generation":          run_generate_tests,
    "analyze_text":        run_analyze_text_tests,
    "conflict_detection":  run_conflict_tests,
    "session_continuity":  run_session_tests,
}


def generate_report(all_results: list[EvalResult]) -> dict:
    """Aggregate results into a summary report."""
    categories = {}
    for r in all_results:
        if r.category not in categories:
            categories[r.category] = {"passed": 0, "failed": 0, "total_score": 0.0, "tests": []}
        cat = categories[r.category]
        cat["tests"].append({
            "test_id": r.test_id,
            "score": r.score,
            "passed": r.passed,
            "details": r.details,
        })
        if r.passed:
            cat["passed"] += 1
        else:
            cat["failed"] += 1
        cat["total_score"] += r.score

    # Compute averages
    for cat_name, cat in categories.items():
        total_tests = cat["passed"] + cat["failed"]
        cat["avg_score"] = round(cat["total_score"] / total_tests, 3) if total_tests else 0
        cat["pass_rate"] = f"{cat['passed']}/{total_tests}"

    total_pass = sum(c["passed"] for c in categories.values())
    total_fail = sum(c["failed"] for c in categories.values())
    total_tests = total_pass + total_fail
    overall_score = sum(c["total_score"] for c in categories.values()) / total_tests if total_tests else 0

    return {
        "timestamp": datetime.now().isoformat(),
        "overall": {
            "total_tests": total_tests,
            "passed": total_pass,
            "failed": total_fail,
            "overall_score": round(overall_score, 3),
            "grade": _grade(overall_score),
        },
        "categories": categories,
    }


def _grade(score: float) -> str:
    if score >= 0.9:
        return "A"
    elif score >= 0.8:
        return "B"
    elif score >= 0.7:
        return "C"
    elif score >= 0.6:
        return "D"
    return "F"


def print_report(report: dict):
    """Print a human-readable evaluation report."""
    overall = report["overall"]

    print("\n" + "=" * 60)
    print("  CLM AI EVALUATION REPORT")
    print("=" * 60)
    print(f"  Date:           {report['timestamp']}")
    print(f"  Overall Score:  {overall['overall_score']:.1%} (Grade: {overall['grade']})")
    print(f"  Tests:          {overall['passed']}/{overall['total_tests']} passed")
    print("=" * 60)

    for cat_name, cat in report["categories"].items():
        status = "PASS" if cat["failed"] == 0 else "MIXED" if cat["passed"] > 0 else "FAIL"
        print(f"\n--- {cat_name.upper().replace('_', ' ')} [{status}] ---")
        print(f"    Score: {cat['avg_score']:.1%} | Pass rate: {cat['pass_rate']}")

        for test in cat["tests"]:
            icon = "[PASS]" if test["passed"] else "[FAIL]"
            print(f"    {icon} {test['test_id']}: {test['score']:.1%} — {test['details']}")

    print("\n" + "=" * 60)

    if overall["overall_score"] >= 0.8:
        print("  RESULT: System performing well.")
    elif overall["overall_score"] >= 0.6:
        print("  RESULT: System acceptable, some areas need improvement.")
    else:
        print("  RESULT: System needs significant improvement.")

    print("=" * 60 + "\n")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CLM AI Evaluation Runner")
    parser.add_argument("--base-url", default="http://localhost:8000",
                        help="Agent service base URL (default: http://localhost:8000)")
    parser.add_argument("--category", choices=list(CATEGORY_RUNNERS.keys()),
                        help="Run only a specific category")
    parser.add_argument("--output", help="Save JSON report to file")
    parser.add_argument("--delay", type=float, default=None,
                        help="Seconds between API calls (default: 4)")
    args = parser.parse_args()

    global API_DELAY_SECONDS
    if args.delay is not None:
        API_DELAY_SECONDS = args.delay

    dataset = load_dataset()
    logger.info("Loaded %d test categories from %s", len(dataset) - 1, DATASET_PATH)

    # Health check
    logger.info("Checking API health at %s ...", args.base_url)
    resp, status = api_call(args.base_url, "GET", "/health", timeout=10)
    if status != 200:
        logger.error("Health check failed (HTTP %d). Is the agent service running?", status)
        logger.error("Start it with: docker compose up -d")
        sys.exit(1)
    logger.info("API healthy: %s", resp.get("status"))

    # Run evaluations
    all_results: list[EvalResult] = []

    if args.category:
        categories = {args.category: CATEGORY_RUNNERS[args.category]}
    else:
        categories = CATEGORY_RUNNERS

    for cat_name, runner in categories.items():
        logger.info("Running %s tests ...", cat_name)
        results = runner(dataset, args.base_url)
        all_results.extend(results)
        passed = sum(1 for r in results if r.passed)
        logger.info("  %s: %d/%d passed", cat_name, passed, len(results))

    # Generate and print report
    report = generate_report(all_results)
    print_report(report)

    # Save JSON report if requested
    if args.output:
        output_path = Path(args.output)
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        logger.info("Report saved to %s", output_path)

    # Exit code: 0 if overall pass rate >= 60%, 1 otherwise
    if report["overall"]["overall_score"] >= 0.6:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
