#!/usr/bin/env bash
# diff-open.sh — open the diffs of a task's own files, for the user's review at the finishing sequence's stop.
#
# Several sessions can share one working tree, so `git diff` mixes their work and a reviewer
# cannot tell which files belong to which task. The finishing sequence (WORKFLOW.md → Task Synchronization
# Protocol) lists THIS task's declared files and, only when the user asks, opens their diffs —
# through this script, so every project and every opener behaves the same way.
#
# Usage:
#   diff-open.sh [--project <dir>] [--opener difftool|vscode] [--editor-bin <bin>]
#                [--base <rev> | --base-dir <dir>] [--all-at-once] <file>...
#
#   --project     the checkout (default: the git top level of the current directory)
#   --opener      difftool (default; portable — `git difftool`, one file at a time, any editor)
#                 or vscode (`<bin> --wait --diff <base> <file>`, also one at a time)
#                 default: $DIFF_OPENER, else difftool
#   --editor-bin  the VS Code-family binary (code, cursor, codium, …)
#                 default: $DIFF_EDITOR_BIN, else code
#   --base <rev>  the left side's revision (default HEAD); any revision works, a
#                 `git stash create` snapshot included.
#   --base-dir    a directory holding the base copies at the same relative paths; a file
#                 absent there is new. adapters/workflow-review/wf-git passes its last-approved
#                 versions this way.
#   --all-at-once vscode only: open every diff as tabs at once, without waiting. An explicit
#                 request — one at a time is the default because all at once floods the editor.
#   <file>        paths relative to the project root
#
# The RIGHT side is always the real working file, never a copy: a comment typed into the diff
# lands in the code, where the questions gate's scanner finds it. The left side is a read-only
# copy of the base. A new file diffs against empty; a deleted file is listed, never opened.
# Nothing is staged and nothing is committed. Nothing is derived from where this script sits —
# one shared copy serves every project.
#
# ONE AT A TIME, AND IT WAITS (TASK-095): each diff opens, the user reviews and closes it, then
# the next opens; the script returns when the last one closes and says "collect or approve?", so
# the agent asks instead of the user having to remember the word. A whole review can take longer
# than a host lets a foreground command run, so STACK.md → Diff opener says how this host runs it
# (in the background, reacting when it exits).
set -euo pipefail

die() { echo "diff-open: $*" >&2; exit 2; }

PROJECT=""; OPENER="${DIFF_OPENER:-difftool}"; EDITOR_BIN="${DIFF_EDITOR_BIN:-code}"
BASE="HEAD"; BASE_DIR=""; ALL_AT_ONCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)    [[ $# -ge 2 ]] || die "--project needs a directory"; PROJECT="$2"; shift 2 ;;
    --opener)     [[ $# -ge 2 ]] || die "--opener needs difftool or vscode"; OPENER="$2"; shift 2 ;;
    --editor-bin) [[ $# -ge 2 ]] || die "--editor-bin needs a binary"; EDITOR_BIN="$2"; shift 2 ;;
    --base)       [[ $# -ge 2 ]] || die "--base needs a revision"; BASE="$2"; shift 2 ;;
    --base-dir)   [[ $# -ge 2 ]] || die "--base-dir needs a directory"; BASE_DIR="$2"; shift 2 ;;
    --all-at-once) ALL_AT_ONCE=1; shift ;;
    -h|--help)    sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --)           shift; break ;;
    -*)           die "unknown option: $1" ;;
    *)            break ;;
  esac
done
case "$OPENER" in difftool|vscode) ;; *) die "unknown opener '$OPENER' — use difftool or vscode" ;; esac
[[ $ALL_AT_ONCE -eq 0 || "$OPENER" == vscode ]] || die "--all-at-once applies to the vscode opener only; difftool opens one diff at a time"
[[ $# -gt 0 ]] || die "name the files to open (this task's declared files)"

if [[ -z "$PROJECT" ]]; then
  PROJECT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git checkout — pass --project"
fi
PROJECT="$(cd "$PROJECT" 2>/dev/null && pwd -P)" || die "project not found: $PROJECT"
if [[ -n "$BASE_DIR" ]]; then
  BASE_DIR="$(cd "$BASE_DIR" 2>/dev/null && pwd -P)" || die "base dir not found: $BASE_DIR"
else
  git -C "$PROJECT" rev-parse --verify --quiet "$BASE^{commit}" >/dev/null || die "unknown revision: $BASE"
fi

# Validate every path before opening anything.
FILES=()
for f in "$@"; do
  [[ -n "$f" ]] || die "blank path"
  if [[ "$f" == /* ]]; then
    [[ "$f" == "$PROJECT/"* ]] || die "path outside the project: $f"
    f="${f#"$PROJECT"/}"
  fi
  case "/$f/" in */../*|*/./*) die "'.' and '..' path segments are not allowed: $f" ;; esac
  FILES+=("$f")
done

# The base copies are kept after exit on purpose: an editor opened non-blocking reads them later.
# Day-old ones (copies of possibly private docs) are pruned instead.
find "${TMPDIR:-/tmp}" -maxdepth 1 -name 'diff-open.*' -type d -mmin +1440 -exec rm -rf {} + 2>/dev/null || true
TMP="$(mktemp -d "${TMPDIR:-/tmp}/diff-open.XXXXXX")"

opened=0
for f in "${FILES[@]}"; do
  base="$TMP/base/$f"; mkdir -p "$(dirname "$base")"
  in_base=0
  if [[ -n "$BASE_DIR" ]]; then
    # The caller's copy already is the read-only base (wf-git's last-approved version).
    if [[ -f "$BASE_DIR/$f" ]]; then base="$BASE_DIR/$f"; in_base=1; else : > "$base"; fi
  elif git -C "$PROJECT" cat-file -e "$BASE:$f" 2>/dev/null; then
    git -C "$PROJECT" show "$BASE:$f" > "$base"; in_base=1
  else
    : > "$base"
  fi
  work="$PROJECT/$f"
  if [[ ! -e "$work" ]]; then
    if [[ $in_base -eq 1 ]]; then echo "deleted: $f"; else echo "missing: $f (not in the base or the working tree)"; fi
    continue
  fi
  if cmp -s "$base" "$work"; then echo "unchanged: $f"; continue; fi
  [[ $in_base -eq 1 ]] && echo "opening: $f" || echo "opening: $f (new — against empty)"
  opened=$((opened + 1))
  if [[ "$OPENER" == vscode && $ALL_AT_ONCE -eq 1 ]]; then
    # Explicitly requested: every diff as a tab at once, without waiting.
    "$EDITOR_BIN" --diff "$base" "$work" || echo "diff-open: '$EDITOR_BIN --diff' failed for $f" >&2
  elif [[ "$OPENER" == vscode ]]; then
    # One at a time: --wait blocks until this diff is closed, then the loop opens the next.
    "$EDITOR_BIN" --wait --diff "$base" "$work" || echo "diff-open: '$EDITOR_BIN --wait --diff' failed for $f" >&2
  else
    # Portable: the user's own configured difftool, one file at a time. Run outside the project
    # (-C "$TMP") so no repo config is consulted; hooks stay off.
    git -C "$TMP" -c core.hooksPath=/dev/null difftool --no-prompt --no-index -- "$base" "$work" || true
  fi
done
echo "$opened diff(s) opened against ${BASE_DIR:-$BASE}"
# The review is over only when every diff has been closed, which is true here unless they were
# opened all at once. Then the next move is the user's: collect their questions, or approve.
if [[ $opened -gt 0 && $ALL_AT_ONCE -eq 0 ]]; then
  echo "All diffs closed — collect or approve?"
fi
