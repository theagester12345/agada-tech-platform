#!/usr/bin/env bash
#
# emit-skills.sh — copy the workflow's on-demand procedures to where a host loads skills.
#
# Some procedures in the workflow are needed only by some tasks (the UI mock gate, the
# verification split, workflow updates). Read at every start-up they cost every session
# their full length; as skills, a host loads only each one's one-line description at
# start-up and the body when a task needs it. The spine keeps each rule and its trigger.
#
# Authored (edit these):  skills/<name>/SKILL.md   — one source, in the open skill format
# Emitted (Binding):      .claude/skills/<name>/SKILL.md   — Claude Code's location
#
# Only the location is host-specific; the format is a shared standard. Another host is
# another target here, never a second authored copy. A host without skills still reaches
# each body through the spine's link to skills/<name>/SKILL.md.
#
# Each copy keeps the source's frontmatter as-is, says it is generated, and has its links to
# the project root rewritten one level deeper. Without --force an existing copy is kept;
# with --force every copy is regenerated, and a generated copy whose source is gone is
# removed. A skill the project wrote itself (no generated note) is never touched.
#
set -euo pipefail

TARGET="$PWD"
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET=$(cd "$2" && pwd); shift 2;;
    --force)  FORCE=1; shift;;
    -h|--help)
      echo "Usage: emit-skills.sh [--target DIR] [--force]"
      echo "  Write .claude/skills/<name>/SKILL.md from each skills/<name>/SKILL.md."
      exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

NOTE_PREFIX="<!-- Generated from skills/"
OUT="$TARGET/.claude/skills"
status=0

# The standard's name rule: lowercase letters, digits and hyphens, at most 64 characters.
valid_name() { [[ "$1" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ "${#1}" -le 64 ]; }

emit_one() {  # $1 = skill folder name
  local name=$1 src="$TARGET/skills/$1/SKILL.md" dest="$OUT/$1/SKILL.md" fm_name
  if [ "$(head -1 "$src")" != "---" ]; then
    echo "✖ skills/$name/SKILL.md: no frontmatter (it must open with name and description)" >&2; return 1
  fi
  fm_name=$(awk 'NR>1 && /^---$/{exit} NR>1 && /^name:/{sub(/^name:[ \t]*/,""); print}' "$src")
  if ! valid_name "$fm_name"; then
    echo "✖ skills/$name/SKILL.md: name '$fm_name' — lowercase letters, digits and hyphens only" >&2; return 1
  fi
  if [ "$fm_name" != "$name" ]; then
    echo "✖ skills/$name/SKILL.md: name '$fm_name' must match its folder '$name'" >&2; return 1
  fi
  if ! awk 'NR>1 && /^---$/{exit} /^description:[ \t]*[^ \t]/{f=1} END{exit !f}' "$src"; then
    echo "✖ skills/$name/SKILL.md: no description — the host loads it to decide when to use the skill" >&2; return 1
  fi
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    echo "  skip .claude/skills/$name/SKILL.md (exists; pass --force to overwrite)"; return 0
  fi
  mkdir -p "$(dirname "$dest")"
  # Frontmatter unchanged; the note right after it; root links rewritten one level deeper,
  # because the copy sits at .claude/skills/<name>/ instead of skills/<name>/.
  awk -v note="$NOTE_PREFIX$name/SKILL.md by adapters/skills/emit-skills.sh — edit the source, not this file. -->" '
    NR==1 { print; next }
    !done && /^---$/ { print; print ""; print note; done=1; next }
    { if (done) gsub(/\]\(\.\.\/\.\.\//, "](../../../"); print }
  ' "$src" > "$dest.tmp"
  mv "$dest.tmp" "$dest"
  echo "  wrote .claude/skills/$name/SKILL.md"
}

if [ -d "$TARGET/skills" ]; then
  for d in "$TARGET"/skills/*/; do
    [ -f "$d/SKILL.md" ] || continue
    emit_one "$(basename "$d")" || status=1
  done
fi

# A generated copy whose source is gone would keep loading a procedure nobody maintains.
if [ "$FORCE" -eq 1 ] && [ -d "$OUT" ]; then
  for d in "$OUT"/*/; do
    [ -d "$d" ] || continue
    n=$(basename "$d")
    [ -f "$TARGET/skills/$n/SKILL.md" ] && continue
    grep -q "^$NOTE_PREFIX" "$d/SKILL.md" 2>/dev/null || continue
    rm -r "$d"; echo "  removed .claude/skills/$n (its source is gone)"
  done
fi

exit "$status"
