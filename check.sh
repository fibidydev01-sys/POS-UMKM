#!/usr/bin/env bash
# ============================================================
#  check.sh  —  POS UMKM MVP Typecheck + Lint Runner
#  Usage:
#    ./check.sh              # typecheck + lint (default)
#    ./check.sh --typecheck  # typecheck only
#    ./check.sh --lint       # lint only
# ============================================================

set -euo pipefail

OUTDIR="collection"
TIMESTAMP=$(date "+%Y%m%d-%H%M%S")
RUN_TYPE=1
RUN_LINT=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --typecheck)
      RUN_TYPE=1
      RUN_LINT=0
      shift
      ;;
    --lint)
      RUN_TYPE=0
      RUN_LINT=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      echo "Usage: ./check.sh [--typecheck|--lint]" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$OUTDIR"

TYPEFILE="$OUTDIR/typecheck-${TIMESTAMP}.txt"
LINTFILE="$OUTDIR/lint-${TIMESTAMP}.txt"

TYPE_STATUS="SKIPPED"
LINT_STATUS="SKIPPED"

# ── Typecheck ─────────────────────────────────────────────────
if [[ $RUN_TYPE -eq 1 ]]; then
  echo "⏳  Running typecheck..."
  TYPE_STATUS="PASSED"
  if ! pnpm tsc --noEmit > "$TYPEFILE" 2>&1; then
    TYPE_STATUS="FAILED"
  fi
  echo "   Typecheck : $TYPE_STATUS  →  $TYPEFILE"
fi

# ── Lint ──────────────────────────────────────────────────────
if [[ $RUN_LINT -eq 1 ]]; then
  echo "⏳  Running lint..."
  LINT_STATUS="PASSED"
  if ! pnpm eslint --max-warnings=0 src/ > "$LINTFILE" 2>&1; then
    LINT_STATUS="FAILED"
  fi
  echo "   Lint      : $LINT_STATUS  →  $LINTFILE"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
if [[ "$TYPE_STATUS" == "FAILED" || "$LINT_STATUS" == "FAILED" ]]; then
  echo "⚠️   Ada error — cek file output di atas."
else
  echo "✅  Semua check passed!"
fi
echo ""