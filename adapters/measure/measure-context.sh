#!/usr/bin/env bash
#
# measure-context.sh — what each persona pays, in tokens, just to start a session.
#
# A persona's start-up set is whatever its own ARCHITECT.md → Initialization tells it to read,
# plus that ARCHITECT.md. The list is PARSED from there, never kept a second time here: a copy
# would drift the first time someone edits an init step (one source, referenced).
#
# Usage:
#   measure-context.sh [--project <dir>] [--persona <ws>] [--list | --tsv]
#                      [--ratio <bytes-per-token>] [--exact] [--calibrate]
#
#   (default)    per persona: the total, then each file largest first
#   --list       the files one persona reads at start-up, one per line (needs --persona)
#   --tsv        "persona<TAB>tokens" per persona — for scripts and the master's baseline test
#   --ratio      bytes per token for the estimate (default $MEASURE_RATIO, else 3.7)
#   --exact      count with Anthropic's token-counting API instead of estimating. Needs
#                ANTHROPIC_API_KEY in the environment (read by name, never printed) and node.
#                Free, but rate-limited per account tier.
#   --calibrate  with a key: compare the estimate against the exact count on this project and
#                print the bytes-per-token ratio to use — record it in this adapter's README.
#
# The estimate is free, instant and identical on every run, which is what a trend needs.
# The exact count is what to quote when the number itself matters.
set -euo pipefail

PROJECT="."; PERSONA=""; MODE="report"; RATIO="${MEASURE_RATIO:-3.7}"; EXACT=0; CALIBRATE=0
MODEL="${MEASURE_MODEL:-claude-sonnet-5-5}"

die() { echo "measure-context: $*" >&2; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --project)   [ $# -ge 2 ] || die "--project needs a directory"; PROJECT="$2"; shift 2 ;;
    --persona)   [ $# -ge 2 ] || die "--persona needs a workspace"; PERSONA="$2"; shift 2 ;;
    --list)      MODE="list"; shift ;;
    --tsv)       MODE="tsv"; shift ;;
    --ratio)     [ $# -ge 2 ] || die "--ratio needs a number"; RATIO="$2"; shift 2 ;;
    --exact)     EXACT=1; shift ;;
    --calibrate) CALIBRATE=1; shift ;;
    -h|--help)   sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)           die "unknown option: $1" ;;
  esac
done
ROOT=$(cd "$PROJECT" 2>/dev/null && pwd) || die "not a directory: $PROJECT"
[ "$MODE" != list ] || [ -n "$PERSONA" ] || die "--list needs --persona <ws>"
if [ "$EXACT" = 1 ] || [ "$CALIBRATE" = 1 ]; then
  [ -n "${ANTHROPIC_API_KEY:-}" ] || die "--exact and --calibrate need ANTHROPIC_API_KEY in the environment"
  command -v node >/dev/null || die "--exact and --calibrate need node"
fi

# Personas are the workspaces that carry an ARCHITECT.md.
personas() {
  local d
  # `if`, not `[ … ] && …`: a trailing false test would make the function fail, and under
  # `set -e` the script would exit silently whenever the last directory is not a persona.
  for d in "$ROOT"/*/; do if [ -f "$d/ARCHITECT.md" ]; then basename "$d"; fi; done | sort
}

# The files a persona's Initialization names, as paths relative to the project root.
init_set() {
  local ws=$1 dir="$ROOT/$1" cand f rel
  {
    echo "$ws/ARCHITECT.md"
    # Only the Initialization section counts: a file mentioned elsewhere in the persona doc is
    # background, not something every session reads.
    awk '/^## Initialization/{f=1;next} /^## /{f=0} f' "$dir/ARCHITECT.md" \
      | grep -oE '\]\([^)#[:space:]]+|`[^`[:space:]]+\.md`' \
      | sed -E 's/^\]\(//; s/^`//; s/`$//' \
      | while IFS= read -r cand; do
          cand="${cand#./}"
          if [[ "$cand" == *'*'* ]]; then
            # A glob over peers ("every other ../*/INTERFACE.md"): never the persona's own file.
            for f in $(cd "$dir" && compgen -G "$cand" || true); do
              rel=$(realpath --relative-to="$ROOT" "$dir/$f")
              [[ "$rel" == "$ws/"* ]] || echo "$rel"
            done
          elif [[ "$cand" == ../* ]] && [ -f "$dir/$cand" ]; then
            realpath --relative-to="$ROOT" "$dir/$cand"
          elif [ -f "$dir/$cand" ]; then
            echo "$ws/$cand"
          elif [ -f "$ROOT/$cand" ]; then
            echo "$cand"                       # root-relative, e.g. product/FEATURES.md
          fi                                   # absent: a conditional workspace this project lacks
        done
  } | awk '!seen[$0]++'
}

bytes() { wc -c < "$ROOT/$1" | tr -d ' '; }
est()   { awk -v b="$1" -v r="$RATIO" 'BEGIN{ printf "%d", b / r }'; }

# Exact count of a set of files sent as one user message (the closest thing to "what the
# session read"). The key is read from the environment by node and never echoed.
exact_count() {
  ( cd "$ROOT" && cat "$@" ) | MEASURE_MODEL="$MODEL" node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", async () => {
      const r = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                   "content-type": "application/json" },
        body: JSON.stringify({ model: process.env.MEASURE_MODEL,
                               messages: [{ role: "user", content: s || " " }] }) });
      if (!r.ok) { console.error("measure-context: count_tokens HTTP " + r.status); process.exit(3); }
      console.log((await r.json()).input_tokens);
    });'
}

LIST_PERSONAS=$( [ -n "$PERSONA" ] && echo "$PERSONA" || personas )
[ -n "$LIST_PERSONAS" ] || die "no persona found under $ROOT (no */ARCHITECT.md)"

for ws in $LIST_PERSONAS; do
  [ -f "$ROOT/$ws/ARCHITECT.md" ] || die "no $ws/ARCHITECT.md under $ROOT"
  mapfile -t files < <(init_set "$ws")
  if [ "$MODE" = list ]; then printf '%s\n' "${files[@]}"; continue; fi
  total_b=0; for f in "${files[@]}"; do total_b=$((total_b + $(bytes "$f"))); done
  if [ "$EXACT" = 1 ] || [ "$CALIBRATE" = 1 ]; then total=$(exact_count "${files[@]}"); else total=$(est "$total_b"); fi
  if [ "$CALIBRATE" = 1 ]; then
    awk -v p="$ws" -v b="$total_b" -v t="$total" 'BEGIN{ printf "%s\t%d bytes\t%d tokens\t%.2f bytes/token\n", p, b, t, b/t }'
    continue
  fi
  if [ "$MODE" = tsv ]; then printf '%s\t%s\n' "$ws" "$total"; continue; fi
  label=$([ "$EXACT" = 1 ] && echo "exact" || echo "est. @ $RATIO bytes/token")
  printf '%s  ~%s tokens  (%s)\n' "$ws" "$total" "$label"
  for f in "${files[@]}"; do printf '%8s  %s\n' "$(est "$(bytes "$f")")" "$f"; done | sort -rn
done
