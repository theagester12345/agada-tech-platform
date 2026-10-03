#!/usr/bin/env bash
#
# emit-index.sh — regenerate the auto file index inside each workspace CLAUDE.md.
#
# BINDING, not a source. Everything between <!-- INDEX:START --> and
# <!-- INDEX:END --> is machine-written and every run overwrites it. Curated,
# annotated entries belong ABOVE the markers, where they are yours and survive
# regeneration.
#
# It lists the DOCS in a workspace's doc home — never code paths. Code location is
# declared per side in STACK.md and can run to thousands of files; this exists so an
# agent can see which docs are present without listing directories.
#
# Usage: bash adapters/index/emit-index.sh [--target DIR]
#   --target DIR   project root to operate on (default: current directory)
#
# Run it BEFORE adapters/agents/emit-agents.sh: AGENTS.md is compiled from CLAUDE.md,
# so emitting agents first bakes in a stale index.
set -eu

TARGET="."
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="${2:?--target needs a directory}"; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "emit-index: unknown argument: $1" >&2; exit 1 ;;
  esac
done

cd "$TARGET"

written=0
for claude in */CLAUDE.md; do
  [ -f "$claude" ] || continue
  # Only rewrite files that opt in by carrying BOTH markers. A file with one marker
  # is malformed, and rewriting it would swallow everything after the opening one.
  grep -q '<!-- INDEX:START -->' "$claude" || continue
  if ! grep -q '<!-- INDEX:END -->' "$claude"; then
    echo "emit-index: $claude has INDEX:START but no INDEX:END — skipped" >&2
    continue
  fi

  dir=$(dirname "$claude")
  # AGENTS.md is excluded: it is a Binding compiled FROM CLAUDE.md, and it is written
  # AFTER this runs — listing it would make the index alternate between two states
  # instead of settling.
  listing=$(find "$dir" -maxdepth 2 -type f -name '*.md' \
    ! -name 'AGENTS.md' | sed "s|^$dir/||" | LC_ALL=C sort)

  tmp=$(mktemp)
  awk -v listing="$listing" '
    /<!-- INDEX:START -->/ {
      print; inblock = 1
      n = split(listing, a, "\n")
      for (i = 1; i <= n; i++) if (a[i] != "") printf("- [`%s`](./%s)\n", a[i], a[i])
      next
    }
    /<!-- INDEX:END -->/ { inblock = 0; print; next }
    !inblock { print }
  ' "$claude" > "$tmp"

  if cmp -s "$tmp" "$claude"; then
    rm -f "$tmp"
  else
    mv "$tmp" "$claude"
    written=$((written + 1))
    echo "  ✔ index updated: $claude"
  fi
done

[ "$written" -eq 0 ] && echo "  · index already current"
exit 0
