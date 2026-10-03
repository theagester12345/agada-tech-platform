#!/usr/bin/env bash
#
# emit-agents.sh — compile the AGENTS.md tree from authored sources.
#
# Authored (edit these):  WORKFLOW.md, <workspace>/CLAUDE.md
# Emitted (Binding):      AGENTS.md,   <workspace>/AGENTS.md
#
# Same altitude as the source — see WORKFLOW.md → Instruction precedence.
# Never invent project rules here; only add the standard Binding/init preamble
# and copy the authored source.
#
set -euo pipefail

TARGET="$PWD"
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET=$(cd "$2" && pwd); shift 2;;
    --force)  FORCE=1; shift;;
    -h|--help)
      echo "Usage: emit-agents.sh [--target DIR] [--force]"
      echo "  Regenerate AGENTS.md from WORKFLOW.md and each workspace CLAUDE.md."
      exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

# $1 = dest relpath, $2 = source relpath
write_emitted() {
  local dest_rel=$1 src_rel=$2
  local dest="$TARGET/$dest_rel" src="$TARGET/$src_rel"
  [ -f "$src" ] || return 0
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    echo "  skip $dest_rel (exists; pass --force to overwrite)"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"

  local src_link wf_link dest_dir
  dest_dir=$(dirname "$dest_rel")
  case "$dest_dir" in
    .)
      src_link="$src_rel"
      wf_link="WORKFLOW.md"
      ;;
    *)
      wf_link="../WORKFLOW.md"
      if [ "$(dirname "$src_rel")" = "$dest_dir" ]; then
        src_link="$(basename "$src_rel")"
      else
        src_link="../$src_rel"
      fi
      ;;
  esac

  {
    printf '%s\n' \
      "> ⚙️ **EMITTED Binding** — source: [\`$src_rel\`]($src_link). Same altitude as that source — see [\`WORKFLOW.md\` → Instruction precedence]($wf_link#instruction-precedence)." \
      ">" \
      "> **Do not hand-edit.** Change the source. Re-emit is automatic on \`git commit\` (pre-commit); mid-session run \`adapters/agents/emit-agents.sh --force\`." \
      ""
    if [ "$dest_dir" != "." ] && [ -f "$TARGET/$dest_dir/ARCHITECT.md" ]; then
      printf '%s\n' \
        "## Start here" \
        "" \
        "**Before doing work in this workspace, read [\`ARCHITECT.md\`](./ARCHITECT.md) and execute its _Initialization (Required)_ section.** This file supplies automatically discovered workspace rules; \`ARCHITECT.md\` supplies the active persona, mode declaration, and required context-loading sequence." \
        ""
    fi
    cat "$src"
  } > "$dest"
  echo "  emit $dest_rel ← $src_rel"
}

echo "▶ emit AGENTS.md tree → $TARGET"

if [ -f "$TARGET/WORKFLOW.md" ]; then
  write_emitted "AGENTS.md" "WORKFLOW.md"
else
  echo "  ! no WORKFLOW.md — skip root AGENTS.md" >&2
fi

shopt -s nullglob
for claude in "$TARGET"/*/CLAUDE.md; do
  [ -f "$claude" ] || continue
  ws=$(basename "$(dirname "$claude")")
  write_emitted "$ws/AGENTS.md" "$ws/CLAUDE.md"
done

echo "✔ emit done"
