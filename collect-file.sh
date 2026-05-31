#!/bin/bash
# ================================================================
# collect-files.sh — POS UMKM MVP File Collector
# Run from: d:/BOILERPLATE/pos-umkm-mvp
# Output  : collection/COLLECT-<timestamp>.txt
#           collection/typecheck-<timestamp>.txt
#           collection/lint-<timestamp>.txt
# Skip    : src/components/ui/, favicon.ico
# ================================================================

SRC="./src"
OUT="collection"
mkdir -p "$OUT"

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║           FILE COLLECTOR — POS UMKM MVP              ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}║  LAYERS                                              ║${RESET}"
echo -e "${BOLD}║  1.${RESET}  ${CYAN}src/app/${RESET}                                   ${BOLD}║${RESET}"
echo -e "${BOLD}║  2.${RESET}  ${CYAN}src/components/dashboard/${RESET}                  ${BOLD}║${RESET}"
echo -e "${BOLD}║  3.${RESET}  ${CYAN}src/components/kasir/${RESET}                      ${BOLD}║${RESET}"
echo -e "${BOLD}║  4.${RESET}  ${CYAN}src/components/menu/${RESET}                       ${BOLD}║${RESET}"
echo -e "${BOLD}║  5.${RESET}  ${CYAN}src/components/pengaturan/${RESET}                 ${BOLD}║${RESET}"
echo -e "${BOLD}║  6.${RESET}  ${CYAN}src/components/shared/${RESET}                     ${BOLD}║${RESET}"
echo -e "${BOLD}║  7.${RESET}  ${CYAN}src/lib/cart/${RESET}                              ${BOLD}║${RESET}"
echo -e "${BOLD}║  8.${RESET}  ${CYAN}src/lib/db/${RESET}                                ${BOLD}║${RESET}"
echo -e "${BOLD}║  9.${RESET}  ${CYAN}src/lib/export/${RESET}                            ${BOLD}║${RESET}"
echo -e "${BOLD}║  10.${RESET} ${CYAN}src/lib/supabase/${RESET}                          ${BOLD}║${RESET}"
echo -e "${BOLD}║  11.${RESET} ${CYAN}src/lib/utils/ ${YELLOW}+ src/lib/utils.ts${RESET}        ${BOLD}║${RESET}"
echo -e "${BOLD}║  12.${RESET} ${CYAN}src/lib/config/${RESET}                            ${BOLD}║${RESET}"
echo -e "${BOLD}║  13.${RESET} ${CYAN}src/proxy.ts${RESET}                               ${BOLD}║${RESET}"
echo -e "${BOLD}║                                                      ║${RESET}"
echo -e "${BOLD}║  88.${RESET} ${GREEN}ALL COMPONENTS (2–6)${RESET}                       ${BOLD}║${RESET}"
echo -e "${BOLD}║  77.${RESET} ${GREEN}ALL LIB (7–12)${RESET}                             ${BOLD}║${RESET}"
echo -e "${BOLD}║  99.${RESET} ${GREEN}ALL LAYERS (everything)${RESET}                    ${BOLD}║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "${YELLOW}Pilih layer (contoh: 1 atau 1 3 5 atau 99):${RESET} "
read -r INPUT

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
FILE="$OUT/COLLECT-${TIMESTAMP}.txt"
TC_FILE="$OUT/typecheck-${TIMESTAMP}.txt"
LINT_FILE="$OUT/lint-${TIMESTAMP}.txt"
FOUND=0; MISSING=0; TOTAL=0

# ── typecheck + lint dulu sebelum collect ────────────────────────
echo ""
echo -e "${BOLD}▶ Running typecheck...${RESET}"
pnpm run typecheck 2>&1 | tee "$TC_FILE"
TC_EXIT=${PIPESTATUS[0]}
if [ $TC_EXIT -eq 0 ]; then
  echo -e "  ${GREEN}✓ Typecheck PASSED${RESET}"
else
  echo -e "  ${RED}✗ Typecheck FAILED — lihat $TC_FILE${RESET}"
fi

echo ""
echo -e "${BOLD}▶ Running lint...${RESET}"
pnpm run lint 2>&1 | tee "$LINT_FILE"
LINT_EXIT=${PIPESTATUS[0]}
if [ $LINT_EXIT -eq 0 ]; then
  echo -e "  ${GREEN}✓ Lint PASSED${RESET}"
else
  echo -e "  ${RED}✗ Lint FAILED — lihat $LINT_FILE${RESET}"
fi

echo ""
echo -e "${BOLD}▶ Collecting source files...${RESET}"

{
echo "################################################################"
echo "##  POS UMKM MVP — SOURCE COLLECTION"
echo "##  Generated  : $(date '+%Y-%m-%d %H:%M:%S')"
echo "##  Selection  : $INPUT"
echo "##  Typecheck  : $([ $TC_EXIT -eq 0 ] && echo PASSED || echo FAILED)"
echo "##  Lint       : $([ $LINT_EXIT -eq 0 ] && echo PASSED || echo FAILED)"
echo "##  Skipped    : src/components/ui/, favicon.ico"
echo "################################################################"
echo ""
} > "$FILE"

# ── helper: collect single file ──────────────────────────────────
cf() {
    local f="$1"
    TOTAL=$((TOTAL + 1))
    {
    echo ""
    echo "================================================"
    echo "FILE: ${f#./}"
    } >> "$FILE"
    if [ -f "$f" ]; then
        local lines; lines=$(wc -l < "$f" 2>/dev/null || echo "0")
        echo -e "  ${GREEN}✓${RESET} ${f#./} (${lines} lines)"
        FOUND=$((FOUND + 1))
        {
        echo "Lines: $lines"
        echo "================================================"
        echo ""
        cat "$f"
        printf "\n\n"
        } >> "$FILE"
    else
        echo -e "  ${RED}✗${RESET} MISSING: ${f#./}"
        MISSING=$((MISSING + 1))
        {
        echo "STATUS: *** FILE NOT FOUND ***"
        echo "================================================"
        echo ""
        } >> "$FILE"
    fi
}

# ── helper: section header ────────────────────────────────────────
sec() {
    local label="$1"
    echo -e "\n${BOLD}▶ $label${RESET}"
    {
    echo ""
    echo "################################################################"
    echo "##  $label"
    echo "################################################################"
    echo ""
    } >> "$FILE"
}

# ── layer definitions ─────────────────────────────────────────────
run_layer() {
    case "$1" in
        1)
            sec "src/app/"
            cf "$SRC/app/globals.css"
            cf "$SRC/app/layout.tsx"
            cf "$SRC/app/page.tsx"
            cf "$SRC/app/aktivasi/page.tsx"
            cf "$SRC/app/api/aktivasi/route.ts"
            cf "$SRC/app/dashboard/page.tsx"
            cf "$SRC/app/kasir/page.tsx"
            cf "$SRC/app/menu/page.tsx"
            cf "$SRC/app/pengaturan/page.tsx"
            cf "$SRC/app/pengaturan/diskon/page.tsx"
            cf "$SRC/app/pengaturan/promo/page.tsx"
            cf "$SRC/app/riwayat/page.tsx"
            ;;
        2)
            sec "src/components/dashboard/"
            cf "$SRC/components/dashboard/chart-omzet.tsx"
            cf "$SRC/components/dashboard/stat-card.tsx"
            cf "$SRC/components/dashboard/top-diskon.tsx"
            ;;
        3)
            sec "src/components/kasir/"
            cf "$SRC/components/kasir/diskon-input.tsx"
            cf "$SRC/components/kasir/keranjang-panel.tsx"
            cf "$SRC/components/kasir/menu-grid.tsx"
            cf "$SRC/components/kasir/struk-print.tsx"
            ;;
        4)
            sec "src/components/menu/"
            cf "$SRC/components/menu/form-menu-item.tsx"
            cf "$SRC/components/menu/kategori-list.tsx"
            cf "$SRC/components/menu/menu-item-card.tsx"
            ;;
        5)
            sec "src/components/pengaturan/"
            cf "$SRC/components/pengaturan/form-diskon-preset.tsx"
            cf "$SRC/components/pengaturan/form-promo-rule.tsx"
            ;;
        6)
            sec "src/components/shared/"
            cf "$SRC/components/shared/alert-backup.tsx"
            cf "$SRC/components/shared/bottom-nav.tsx"
            cf "$SRC/components/shared/empty-state.tsx"
            ;;
        7)
            sec "src/lib/cart/"
            cf "$SRC/lib/cart/promo-engine.ts"
            ;;
        8)
            sec "src/lib/db/"
            cf "$SRC/lib/db/config.ts"
            cf "$SRC/lib/db/diskon-preset.ts"
            cf "$SRC/lib/db/menu.ts"
            cf "$SRC/lib/db/promo-rule.ts"
            cf "$SRC/lib/db/transaksi.ts"
            cf "$SRC/lib/db/users.ts"
            ;;
        9)
            sec "src/lib/export/"
            cf "$SRC/lib/export/excel.ts"
            cf "$SRC/lib/export/import.ts"
            ;;
        10)
            sec "src/lib/supabase/"
            cf "$SRC/lib/supabase/client.ts"
            cf "$SRC/lib/supabase/server.ts"
            ;;
        11)
            sec "src/lib/utils/ + src/lib/utils.ts"
            cf "$SRC/lib/utils/currency.ts"
            cf "$SRC/lib/utils/date.ts"
            cf "$SRC/lib/utils/umkm-id.ts"
            cf "$SRC/lib/utils.ts"
            ;;
        12)
            sec "src/lib/config/"
            cf "$SRC/lib/config/features.ts"
            ;;
        13)
            sec "src/proxy.ts"
            cf "$SRC/proxy.ts"
            ;;
        *)
            echo -e "  ${RED}⚠ Pilihan tidak valid: $1${RESET}"
            ;;
    esac
}

# ── dispatch ──────────────────────────────────────────────────────
if echo "$INPUT" | grep -qw "99"; then
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13; do run_layer $i; done
elif echo "$INPUT" | grep -qw "88"; then
    for i in 2 3 4 5 6; do run_layer $i; done
elif echo "$INPUT" | grep -qw "77"; then
    for i in 7 8 9 10 11 12; do run_layer $i; done
else
    for i in $INPUT; do run_layer "$i"; done
fi

# ── summary ───────────────────────────────────────────────────────
pct=0; [ $TOTAL -gt 0 ] && pct=$(( FOUND * 100 / TOTAL ))

echo ""
echo -e "${BOLD}════════════════════════════════════${RESET}"
echo -e "  ${GREEN}✓ Found   : $FOUND / $TOTAL${RESET}"
echo -e "  ${RED}✗ Missing : $MISSING${RESET}"
echo -e "  Coverage  : $pct%"
echo -e "${BOLD}────────────────────────────────────${RESET}"
echo -e "  Typecheck : $([ $TC_EXIT -eq 0 ] && echo -e "${GREEN}PASSED${RESET}" || echo -e "${RED}FAILED${RESET}")"
echo -e "  Lint      : $([ $LINT_EXIT -eq 0 ] && echo -e "${GREEN}PASSED${RESET}" || echo -e "${RED}FAILED${RESET}")"
echo -e "${BOLD}════════════════════════════════════${RESET}"
echo -e "  Collect : ${CYAN}$FILE${RESET}"
echo -e "  TC      : ${CYAN}$TC_FILE${RESET}"
echo -e "  Lint    : ${CYAN}$LINT_FILE${RESET}"
echo ""

{
echo ""
echo "################################################################"
echo "##  SUMMARY"
echo "################################################################"
echo "Found     : $FOUND / $TOTAL"
echo "Missing   : $MISSING"
echo "Coverage  : $pct%"
echo "Typecheck : $([ $TC_EXIT -eq 0 ] && echo PASSED || echo FAILED)"
echo "Lint      : $([ $LINT_EXIT -eq 0 ] && echo PASSED || echo FAILED)"
} >> "$FILE"