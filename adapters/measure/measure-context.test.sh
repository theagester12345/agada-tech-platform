#!/usr/bin/env bash
#
# measure-context.test.sh — tests for the start-up meter.
#
# Every check prints a line whether it passes or fails; the run ends in a summary, and an
# EXIT trap says so if it stops before one (a harness that vanishes looks like a pass).
#
# Run: bash template/adapters/measure/measure-context.test.sh
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
METER="$HERE/measure-context.sh"
passes=0; failures=0; SUMMARY=0
trap 'rc=$?; [ "$SUMMARY" = 1 ] || echo "✖ measure-context.test.sh exited before its summary (status $rc) — a harness bug, not a result" >&2' EXIT
ok() { passes=$((passes+1)); echo "  PASS  $1"; }
no() { failures=$((failures+1)); echo "  FAIL  $1"; }
check() { if [ "$1" -eq 0 ]; then ok "$2"; else no "$2"; fi; }
TAB=$'\t'

T=$(mktemp -d); trap 'rc=$?; rm -rf "$T"; [ "$SUMMARY" = 1 ] || echo "✖ measure-context.test.sh exited before its summary (status $rc) — a harness bug, not a result" >&2' EXIT

# A small project. backend's Initialization names files four ways: a link, a bare code span
# relative to the persona, a root-relative code span, and a glob over peer outboxes.
mkdir -p "$T/backend" "$T/frontend" "$T/product"
printf '%02000d' 0 > "$T/WORKFLOW.md"           # 2000 bytes — the largest file
printf '%0200d' 0 > "$T/backend/CLAUDE.md"      # 200
printf '%0100d' 0 > "$T/backend/TASK.md"        # 100
printf '%040d'  0 > "$T/backend/INTERFACE.md"   # own outbox — excluded
printf '%080d'  0 > "$T/frontend/INTERFACE.md"  # peer outbox — included
printf '%060d'  0 > "$T/product/FEATURES.md"    # root-relative
printf '%0300d' 0 > "$T/backend/NOT_READ.md"    # named only OUTSIDE Initialization
cat > "$T/backend/ARCHITECT.md" <<'EOF'
# ARCHITECT — backend

See `NOT_READ.md` for background.

## Initialization (Required)

1. **READ** all of [`../WORKFLOW.md`](../WORKFLOW.md) — the spine.
2. **READ** all of `CLAUDE.md` (technical reference).
3. **READ** all of `TASK.md`.
4. **Where this project has a `product/` workspace, READ** `product/FEATURES.md`.
5. **READ** every other `../*/INTERFACE.md` present in the project.
6. Reply: "online".

## Role

Mentions `NOT_READ.md` again, outside the Initialization section.
EOF
cat > "$T/frontend/ARCHITECT.md" <<'EOF'
# ARCHITECT — frontend

## Initialization (Required)

1. **READ** all of [`../WORKFLOW.md`](../WORKFLOW.md).
2. Reply.
EOF

echo "▶ the init set is parsed from the persona's own Initialization section"
LIST=$(bash "$METER" --project "$T" --persona backend --list 2>&1)
want=$(printf '%s\n' WORKFLOW.md backend/ARCHITECT.md backend/CLAUDE.md backend/TASK.md product/FEATURES.md frontend/INTERFACE.md | sort)
got=$(printf '%s\n' "$LIST" | sort)
[ "$got" = "$want" ]; check $? "backend resolves to exactly its six files (link, bare, root-relative, peer glob, itself)"
printf '%s\n' "$LIST" | grep -q 'NOT_READ.md'; check $((1-$?)) "a file named only outside Initialization is not counted"
printf '%s\n' "$LIST" | grep -qx 'backend/INTERFACE.md'; check $((1-$?)) "its own outbox is not counted as a peer's"

echo "▶ the estimate is bytes divided by the ratio, per persona"
TSV=$(bash "$METER" --project "$T" --tsv --ratio 4 2>&1)
# backend: 2000+200+100+60+80 + its ARCHITECT.md bytes
ab=$(wc -c < "$T/backend/ARCHITECT.md")
be=$(( (2000+200+100+60+80+ab) / 4 ))
printf "%s\n" "$TSV" | grep -qx "backend$TAB$be"; check $? "backend total = bytes / 4 ($be; got: $(printf "%s" "$TSV" | tr "\n\t" ", "))"
af=$(wc -c < "$T/frontend/ARCHITECT.md")
fe=$(( (2000+af) / 4 ))
printf '%s\n' "$TSV" | grep -qx "frontend$TAB$fe"; check $? "frontend total = bytes / 4 ($fe)"

echo "▶ the default report lists files largest first"
REP=$(bash "$METER" --project "$T" --persona backend --ratio 4 2>&1)
first=$(printf '%s\n' "$REP" | grep -E '^ +[0-9]+ ' | head -1)
case "$first" in *WORKFLOW.md*) ok "WORKFLOW.md (the largest) is listed first";; *) no "largest-first order (first line: $first)";; esac

echo "▶ exact mode needs a key and says so"
OUT=$(env -u ANTHROPIC_API_KEY bash "$METER" --project "$T" --exact 2>&1); rc=$?
[ "$rc" -ne 0 ]; check $? "exact mode without a key exits non-zero"
case "$OUT" in *ANTHROPIC_API_KEY*) ok "and names the variable it needs";; *) no "exact mode's refusal does not name the variable";; esac

echo "▶ a project with no personas is an error, not an empty success"
E=$(mktemp -d); OUT=$(bash "$METER" --project "$E" --tsv 2>&1); rc=$?; rm -rf "$E"
[ "$rc" -ne 0 ]; check $? "no ARCHITECT.md anywhere exits non-zero"

SUMMARY=1
echo
echo "== $passes passed, $failures failed"
[ "$failures" -eq 0 ]
