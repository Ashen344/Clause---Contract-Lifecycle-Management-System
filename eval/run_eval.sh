#!/bin/bash
# run_eval.sh — Run the CLM AI evaluation suite.
#
# Usage:
#   ./eval/run_eval.sh                           # all tests
#   ./eval/run_eval.sh --category chat           # one category
#   ./eval/run_eval.sh --output report.json      # save report
#
# Categories: retrieval, chat, analyse, generation, analyze_text,
#             conflict_detection, session_continuity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BASE_URL="${BASE_URL:-http://localhost:8000}"

echo "==========================================="
echo "  CLM AI Evaluation Suite"
echo "==========================================="
echo "  API:  $BASE_URL"
echo "  Date: $(date -Iseconds)"
echo "==========================================="

# Check API is reachable
if ! curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo ""
    echo "[ERROR] Cannot reach $BASE_URL/health"
    echo "        Start services with: docker compose up -d"
    exit 1
fi

# Install requests if missing (needed by the Python runner)
python3 -c "import requests" 2>/dev/null || pip install requests -q

# Run evaluation
python3 "$SCRIPT_DIR/run_eval.py" --base-url "$BASE_URL" "$@"
