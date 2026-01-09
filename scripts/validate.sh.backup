#!/bin/bash
set -eo pipefail

# Store the project root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Default modes
LIVE_MODE=false
E2E_MODE="full"  # full (default), exclusive (--e2e only), skip (internal)
PARALLEL_MODE=false

show_help() {
    echo "Usage: ./scripts/validate.sh [options]"
    echo ""
    echo "Options:"
    echo "  --help      Show this help message"
    echo "  --e2e       Run ONLY E2E tests (auto-starts servers, skips unit tests)."
    echo "  --live      Include LIVE API tests in backend checks."
    echo "  --parallel  Run backend tests in parallel (experimental)."
    echo ""
    echo "Default (no flags):"
    echo "  Runs Linters, Unit tests (Backend & Frontend), and FULL E2E tests."
}

for arg in "$@"; do
    case $arg in
        --help) show_help; exit 0 ;;
        --live) LIVE_MODE=true ;;
        --e2e) E2E_MODE="exclusive" ;;
        --parallel) PARALLEL_MODE=true ;;
        *) echo "Unknown option: $arg"; show_help; exit 1 ;;
    esac
done

# Ensure logs directory exists
mkdir -p logs

TOTAL_START=$(date +%s)
echo "Starting Verification at $(date)" | tee logs/validate.log

# ==========================================
# Phase 1: Auto-fix (Skipped if E2E_MODE=exclusive)
# ==========================================
if [ "$E2E_MODE" != "exclusive" ]; then
    FIX_START=$(date +%s)
    echo "Running Auto-fixes..." | tee -a logs/validate.log

    echo "Fixing Backend..."
    uv run ruff check --fix .
    uv run ruff format .

    echo "Fixing Frontend..."
    pushd src/web > /dev/null
    npm run lint -- --fix || true
    popd > /dev/null

    FIX_END=$(date +%s)
    FIX_DURATION=$((FIX_END - FIX_START))
    echo "TIMING_METRIC: AutoFix=${FIX_DURATION}s" >> logs/validate.log
    echo "Auto-fixes complete." | tee -a logs/validate.log
else
    echo "Skipping Auto-fixes (E2E Exclusive Mode)" | tee -a logs/validate.log
fi

# ==========================================
# Phase 2: Backend & Static Tests (Skipped if E2E_MODE=exclusive)
# ==========================================
BACKEND_EXIT_CODE=0
if [ "$E2E_MODE" != "exclusive" ]; then
    echo "" | tee -a logs/validate.log
    echo "Phase: Backend & Static Validation" | tee -a logs/validate.log
    BACKEND_START=$(date +%s)
    
    # Construct Pytest Command for Backend
    BACKEND_ARGS="tests/  --ignore=tests/validation/test_frontend_unit.py --ignore=tests/validation/test_e2e_wrapper.py"
    
    # Markers
    if [ "$LIVE_MODE" = false ]; then
        BACKEND_ARGS="$BACKEND_ARGS -m \"not live\""
    fi

    # Parallel
    if [ "$PARALLEL_MODE" = true ]; then
         BACKEND_ARGS="$BACKEND_ARGS -n auto"
    fi

    echo "Command: uv run pytest $BACKEND_ARGS --cov=src --cov-report=term-missing" | tee -a logs/validate.log
    eval "uv run pytest $BACKEND_ARGS --cov=src --cov-report=term-missing" | tee -a logs/validate.log
    BACKEND_EXIT_CODE=${PIPESTATUS[0]}
    
    BACKEND_END=$(date +%s)
    BACKEND_DURATION=$((BACKEND_END - BACKEND_START))
    echo "TIMING_METRIC: Backend=${BACKEND_DURATION}s" >> logs/validate.log
fi

# ==========================================
# Phase 3: Frontend Validation (Skipped if E2E_MODE=exclusive)
# ==========================================
FRONTEND_EXIT_CODE=0
if [ "$E2E_MODE" != "exclusive" ]; then
    echo "" | tee -a logs/validate.log
    echo "Phase: Frontend Validation" | tee -a logs/validate.log
    FRONTEND_START=$(date +%s)
    
    # Run the frontend wrapper test
    # We don't need coverage here as it's parsed from logs separately
    # Use -s to stream stdout (so users see the npm test output in real-time)
    uv run pytest -s tests/validation/test_frontend_unit.py | tee -a logs/validate.log
    FRONTEND_EXIT_CODE=${PIPESTATUS[0]}

    FRONTEND_END=$(date +%s)
    FRONTEND_DURATION=$((FRONTEND_END - FRONTEND_START))
    echo "TIMING_METRIC: Frontend=${FRONTEND_DURATION}s" >> logs/validate.log
fi

# ==========================================
# Phase 4: E2E Tests
# ==========================================
E2E_EXIT_CODE=0
if [ "$E2E_MODE" != "skip" ]; then
    echo "" | tee -a logs/validate.log
    echo "Phase: E2E Tests (Scope: $E2E_MODE)" | tee -a logs/validate.log
    E2E_START=$(date +%s)
    
    # Set Scope Env Var (always full now)
    export E2E_SCOPE="full"

    # Use -s to stream Playwright output
    uv run pytest -s tests/validation/test_e2e_wrapper.py | tee -a logs/validate.log
    E2E_EXIT_CODE=${PIPESTATUS[0]}

    E2E_END=$(date +%s)
    E2E_DURATION=$((E2E_END - E2E_START))
    echo "TIMING_METRIC: E2E=${E2E_DURATION}s" >> logs/validate.log
fi

# ==========================================
# Final Status
# ==========================================
OVERALL_EXIT=0
if [ $BACKEND_EXIT_CODE -ne 0 ] || [ $FRONTEND_EXIT_CODE -ne 0 ] || [ $E2E_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT=1
    echo "❌ Validation Failed!" | tee -a logs/validate.log
else
    echo "✅ Validation Passed!" | tee -a logs/validate.log
fi

# Append detailed logs from wrappers so analyze.sh can find them
# ... (rest of the file remains similar for appending logs)

# Append detailed logs from wrappers so analyze.sh can find them
echo "" >> logs/validate.log
echo "--- Detailed Reports ---" >> logs/validate.log

# Note: frontend_unit.log is already streamed via -s so we don't append it again.
# static_analysis.log is NOT streamed (captured by pytest wrappers), so we MUST append it.

if [ -f "logs/static_analysis.log" ]; then
    echo "Appending Static Analysis logs..."
    cat logs/static_analysis.log >> logs/validate.log
fi

# Run analysis
echo "" | tee -a logs/validate.log
echo "Running Validation Analysis..." | tee -a logs/validate.log

TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))
echo "TIMING_METRIC: Total=${TOTAL_DURATION}s" >> logs/validate.log

./scripts/analyze.sh logs/validate.log | tee -a logs/validate.log

exit $OVERALL_EXIT

