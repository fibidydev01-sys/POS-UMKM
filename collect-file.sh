#!/usr/bin/env bash
# ============================================================
#  collect-file.sh  —  POS UMKM MVP Source Collector
#  Usage:
#    ./collect-file.sh                  # interactive mode
#    ./collect-file.sh --module root
#    ./collect-file.sh --module aktivasi
#    ./collect-file.sh --module dashboard
#    ./collect-file.sh --module kasir
#    ./collect-file.sh --module menu
#    ./collect-file.sh --module riwayat
#    ./collect-file.sh --module pengaturan
#    ./collect-file.sh --module all
# ============================================================

set -euo pipefail

OUTDIR="collection"
TIMESTAMP=$(date "+%Y%m%d-%H%M%S")
MODULE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --module)
      MODULE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

# ── Interactive picker ────────────────────────────────────────
if [[ -z "$MODULE" ]]; then
  echo ""
  echo "┌─────────────────────────────────────┐"
  echo "│   POS UMKM — Source Collector       │"
  echo "├─────────────────────────────────────┤"
  echo "│  Pilih module yang ingin di-collect  │"
  echo "├─────┬───────────────────────────────┤"
  echo "│  0  │  all         (semua file)      │"
  echo "│  1  │  root        (shared/core)     │"
  echo "│  2  │  aktivasi                      │"
  echo "│  3  │  dashboard                     │"
  echo "│  4  │  kasir                         │"
  echo "│  5  │  menu                          │"
  echo "│  6  │  riwayat                       │"
  echo "│  7  │  pengaturan                    │"
  echo "└─────┴───────────────────────────────┘"
  echo ""
  read -rp "  Pilih [0-7]: " PICK

  case "$PICK" in
    0) MODULE="all"        ;;
    1) MODULE="root"       ;;
    2) MODULE="aktivasi"   ;;
    3) MODULE="dashboard"  ;;
    4) MODULE="kasir"      ;;
    5) MODULE="menu"       ;;
    6) MODULE="riwayat"    ;;
    7) MODULE="pengaturan" ;;
    *)
      echo ""
      echo "❌  Pilihan tidak valid: '$PICK'"
      exit 1
      ;;
  esac
  echo ""
fi

# ── Validate module ───────────────────────────────────────────
VALID_MODULES="root aktivasi dashboard kasir menu riwayat pengaturan all"
if ! echo "$VALID_MODULES" | grep -qw "$MODULE"; then
  echo "❌  Module tidak dikenal: '$MODULE'"
  echo "    Pilihan: $VALID_MODULES"
  exit 1
fi

OUTFILE="$OUTDIR/COLLECT-${TIMESTAMP}.txt"
mkdir -p "$OUTDIR"

# ── Scope definitions ────────────────────────────────────────

declare -A SCOPE

SCOPE[root]="
  src/app/page.tsx
  src/app/layout.tsx
  src/app/globals.css
  src/app/api
  src/proxy.ts
  src/lib/config
  src/lib/supabase
  src/lib/utils.ts
  src/lib/utils
  src/lib/db/config.ts
  src/lib/db/transaksi.ts
  src/lib/db/users.ts
  src/components/shared
"

SCOPE[aktivasi]="
  src/app/aktivasi
  src/components/aktivasi
  src/hooks/use-current-user.ts
  src/lib/db/users.ts
  src/lib/utils/umkm-id.ts
"

SCOPE[dashboard]="
  src/app/dashboard
  src/components/dashboard
  src/hooks/use-dashboard-data.ts
  src/lib/db/omzet-banding.ts
  src/lib/db/transaksi.ts
"

SCOPE[kasir]="
  src/app/kasir
  src/components/kasir
  src/hooks/use-kasir-data.ts
  src/lib/cart
  src/store/cart-store.ts
  src/lib/db/transaksi.ts
  src/lib/db/diskon-preset.ts
  src/lib/db/promo-rule.ts
"

SCOPE[menu]="
  src/app/menu
  src/components/menu
  src/hooks/use-menu-manager.ts
  src/lib/db/menu.ts
"

SCOPE[riwayat]="
  src/app/riwayat
  src/components/riwayat
  src/hooks/use-riwayat.ts
  src/lib/db/transaksi.ts
"

SCOPE[pengaturan]="
  src/app/pengaturan
  src/components/pengaturan
  src/lib/db/diskon-preset.ts
  src/lib/db/promo-rule.ts
  src/lib/export
"

SCOPE[all]="
  src/app
  src/components
  src/hooks
  src/lib
  src/store
  src/proxy.ts
"

# ── Helpers ───────────────────────────────────────────────────
is_text_file() {
  local ext="${1##*.}"
  case "$ext" in
    ts|tsx|js|jsx|css|json|md|sql|sh|mjs|cjs|yaml|yml|toml|txt) return 0 ;;
    *) return 1 ;;
  esac
}

should_skip() {
  local f="$1"
  local base
  base=$(basename "$f")
  [[ "$f" == *"/node_modules/"* ]] && return 0
  [[ "$f" == *"/.next/"* ]]        && return 0
  [[ "$f" == *"/out/"* ]]          && return 0
  [[ "$f" == *"/build/"* ]]        && return 0
  [[ "$f" == *"/.git/"* ]]         && return 0
  [[ "$base" == "favicon.ico" ]]   && return 0
  [[ "$base" == *.test.* ]]        && return 0
  [[ "$base" == *.spec.* ]]        && return 0
  return 1
}

is_ui_dir() {
  [[ "$1" == *"/components/ui/"* || "$1" == *"/components/ui" ]] && return 0
  return 1
}

collect_path() {
  local root="$1"
  local buf="$2"

  if [[ -f "$root" ]]; then
    should_skip "$root"  && return
    is_ui_dir "$root"    && return
    is_text_file "$root" || return
    echo "$root" >> "$buf"
    return
  fi

  if [[ -d "$root" ]]; then
    while IFS= read -r -d '' f; do
      should_skip "$f"  && continue
      is_ui_dir "$f"    && continue
      is_text_file "$f" || continue
      echo "$f" >> "$buf"
    done < <(find "$root" -type f -print0 | sort -z)
  fi
}

# ── Build file list ───────────────────────────────────────────
LISTFILE=$(mktemp)
trap 'rm -f "$LISTFILE"' EXIT

for p in ${SCOPE[$MODULE]}; do
  p="${p#"${p%%[! ]*}"}"
  [[ -z "$p" ]] && continue
  collect_path "$p" "$LISTFILE"
done

sort -u "$LISTFILE" -o "$LISTFILE"
TOTAL=$(wc -l < "$LISTFILE" | tr -d ' ')

# ── Write output ──────────────────────────────────────────────
MODULE_UPPER=$(echo "$MODULE" | tr '[:lower:]' '[:upper:]')

{
  echo "################################################################"
  echo "##  POS UMKM MVP — SOURCE COLLECTION"
  echo "##  Generated  : $(date '+%Y-%m-%d %H:%M:%S')"
  echo "##  Module     : $MODULE_UPPER"
  echo "##  Selection  : $TOTAL"
  echo "##  Skipped    : src/components/ui/, favicon.ico"
  echo "################################################################"
  echo ""
} > "$OUTFILE"

FOUND=0
MISSING=0
PREV_GROUP=""

while IFS= read -r filepath; do
  [[ -z "$filepath" ]] && continue

  if [[ ! -f "$filepath" ]]; then
    ((MISSING++)) || true
    continue
  fi

  GROUP=$(dirname "$filepath")
  if [[ "$GROUP" != "$PREV_GROUP" ]]; then
    {
      echo ""
      echo "################################################################"
      echo "##  $GROUP/"
      echo "################################################################"
      echo ""
    } >> "$OUTFILE"
    PREV_GROUP="$GROUP"
  fi

  LINECOUNT=$(wc -l < "$filepath" | tr -d ' ')
  {
    echo "================================================"
    echo "FILE: $filepath"
    echo "Lines: $LINECOUNT"
    echo "================================================"
    echo ""
    cat "$filepath"
    echo ""
    echo ""
  } >> "$OUTFILE"

  ((FOUND++)) || true

done < "$LISTFILE"

{
  echo "################################################################"
  echo "##  SUMMARY"
  echo "################################################################"
  echo "Found     : $FOUND / $TOTAL"
  echo "Missing   : $MISSING"
  echo "Coverage  : $(( TOTAL > 0 ? FOUND * 100 / TOTAL : 0 ))%"
} >> "$OUTFILE"

echo "✅  Done!"
echo "   Module  : $MODULE_UPPER"
echo "   Files   : $FOUND collected, $MISSING missing"
echo "   Output  : $OUTFILE"
echo ""