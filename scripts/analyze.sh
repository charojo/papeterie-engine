#!/bin/bash
# Coverage analysis script for Papeterie Engine
# Parses validate.log to extract and display coverage metrics

set -eo pipefail

LOG_FILE="${1:-logs/validate.log}"
BASELINE_LOG="${2:-}"

if [[ ! -f "$LOG_FILE" ]]; then
    echo "Error: Log file not found: $LOG_FILE"
    echo "Usage: $0 [log_file] [baseline_log]"
    exit 1
fi

# Extract backend coverage percentage
extract_backend_coverage() {
    local file="$1"
    grep "^TOTAL" "$file" | awk '{print $NF}' | sed 's/%//'
}

# Extract frontend coverage percentage
extract_frontend_coverage() {
    local file="$1"
    grep "^All files" "$file" | awk -F'|' '{print $2}' | tr -d ' '
}

# Get current coverage
BACKEND_COV=$(extract_backend_coverage "$LOG_FILE")
FRONTEND_COV=$(extract_frontend_coverage "$LOG_FILE")

echo "========================================="
echo "Coverage Analysis Report"
echo "========================================="
echo ""
echo "Current Coverage (from $LOG_FILE):"
echo "  Backend:  ${BACKEND_COV}%"
echo "  Frontend: ${FRONTEND_COV}%"
echo ""

# Calculate total weighted coverage (assuming equal weight)
if [[ -n "$BACKEND_COV" && -n "$FRONTEND_COV" ]]; then
    TOTAL_COV=$(echo "scale=2; ($BACKEND_COV + $FRONTEND_COV) / 2" | bc)
    echo "  Total (avg): ${TOTAL_COV}%"
    echo ""
fi

# Compare with baseline if provided
if [[ -n "$BASELINE_LOG" && -f "$BASELINE_LOG" ]]; then
    BASELINE_BACKEND=$(extract_backend_coverage "$BASELINE_LOG")
    BASELINE_FRONTEND=$(extract_frontend_coverage "$BASELINE_LOG")
    
    echo "Baseline Coverage (from $BASELINE_LOG):"
    echo "  Backend:  ${BASELINE_BACKEND}%"
    echo "  Frontend: ${BASELINE_FRONTEND}%"
    echo ""
    
    if [[ -n "$BASELINE_BACKEND" && -n "$BASELINE_FRONTEND" ]]; then
        BASELINE_TOTAL=$(echo "scale=2; ($BASELINE_BACKEND + $BASELINE_FRONTEND) / 2" | bc)
        echo "  Total (avg): ${BASELINE_TOTAL}%"
        echo ""
        
        # Calculate improvements
        BACKEND_DELTA=$(echo "scale=2; $BACKEND_COV - $BASELINE_BACKEND" | bc)
        FRONTEND_DELTA=$(echo "scale=2; $FRONTEND_COV - $BASELINE_FRONTEND" | bc)
        TOTAL_DELTA=$(echo "scale=2; $TOTAL_COV - $BASELINE_TOTAL" | bc)
        
        echo "Improvement:"
        echo "  Backend:  ${BACKEND_DELTA}% ($(printf '%+.2f' $BACKEND_DELTA))"
        echo "  Frontend: ${FRONTEND_DELTA}% ($(printf '%+.2f' $FRONTEND_DELTA))"
        echo "  Total:    ${TOTAL_DELTA}% ($(printf '%+.2f' $TOTAL_DELTA))"
        echo ""
    fi
fi

echo "========================================="
