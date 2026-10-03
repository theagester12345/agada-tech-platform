#!/usr/bin/env sh
#
# scan-questions.sh — collect a reviewer's in-code questions before the review gate.
#
# WHY THIS EXISTS. The human reviews code as a BUILD session writes it and
# annotates it in place with questions. Nothing was ignoring those questions;
# nothing was responsible for finding them. A question typed inside a changed
# hunk appears in `git diff` and gets noticed in passing, while the same question
# twenty lines away in untouched code appears nowhere at all. Incidental
# discovery has no completeness property, so this collects instead of hoping.
#
# USAGE
#   adapters/questions/scan-questions.sh [--marker <token>] [--exempt <path>]... <path>...
#
#   <path>...  the file set THIS session declared — the same list the review gate
#              already makes it write down. It is an argument and is never
#              inferred: deriving it from `git status` would, in a shared
#              checkout, hand this session a peer session's questions, which is
#              the failure the review gate's scoping rule exists to prevent.
#
#   --marker   the token a reviewer types, WITHOUT its comment wrapper. Defaults
#              to AI-Questions. Recorded per project in STACK.md -> Commands,
#              because which token this project uses is a project fact, not a
#              rule — the same convention as the Review and Schema diagram rows.
#
#   --exempt   a path whose matches are ignored, repeatable. Any doc that
#              *defines* the marker necessarily contains it and would otherwise
#              report itself on every run. The defaults below cover the ones
#              this workflow ships; a project adds its own.
#
# ONE COPY, CONFIGURED BY ARGUMENT. Every path and token is passed in — nothing
# is derived from where this file sits. That is what lets one copy serve every
# side instead of being forked per workspace, and it is the rule that a
# `__dirname`-style adapter broke once before.
#
# SCOPE. Reads the whole repository; collects only inside the declared set;
# reports everything else by path and touches none of it. That is verbatim the
# review gate's own rule — scope the findings, not the reading — and it means an
# out-of-scope question is visible to the human immediately rather than to
# nobody.
#
# EXIT  0 = no in-scope markers · 1 = in-scope markers exist · 2 = usage error.
#
# Portable POSIX sh, no dependencies — the same standard as .githooks/*.
#
set -euf

# Split so this file never matches its own scan. The comment syntax around the
# token is not part of it, which is why this is a bare pattern rather than a
# per-language one.
#
# The trailing "s" is OPTIONAL, and that is not tidiness. The marker is typed
# live, mid-read, by a person reviewing streaming output — the same reason the
# match is case-insensitive. Singular is the natural thing to write when leaving
# one question, and on the first real trial run three markers in this repo were
# singular and were silently dropped. A question lost to a one-character slip is
# precisely the failure this whole gate exists to remove, so the pattern accepts
# both. Over-matching is the safe direction here: a false positive gets read and
# waved past, a false negative is invisible.
# The marker is the SINGULAR STEM; the trailing "s" is optional and applied
# below. That is not tidiness. The token is typed live, mid-read, by a person
# reviewing streaming output — singular is the natural thing to write when
# leaving one question, and the source project lost three markers that way
# before it was allowed for. Over-matching is the safe direction: a false
# positive gets read and waved past, a false negative is invisible.
#
# Split so this file never matches its own default.
MARKER_DEFAULT="AI-Q""uestion"
MARKER=""
EXEMPT_EXTRA=""

while [ $# -gt 0 ]; do
  case $1 in
    --marker)
      [ $# -ge 2 ] || { echo "--marker needs a token" >&2; exit 2; }
      MARKER=$2; shift 2 ;;
    --exempt)
      [ $# -ge 2 ] || { echo "--exempt needs a path" >&2; exit 2; }
      EXEMPT_EXTRA="$EXEMPT_EXTRA$2
"; shift 2 ;;
    --) shift; break ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

[ -n "$MARKER" ] || MARKER=$MARKER_DEFAULT
MARKER_RE="${MARKER}s?:"   # stem + optional plural + colon

if [ $# -eq 0 ]; then
  echo "usage: scan-questions.sh [--marker <token>] [--exempt <path>]... <path>..." >&2
  echo "  <path>...  the file set this session declared (files or directories)." >&2
  exit 2
fi

# A blank argument (an unset variable expanded with nothing, a stray "" in a
# caller's list) is never an intentional declaration. Left to fall through,
# it can resolve to the current directory — the repository root when the
# script is invoked from there — which is the opposite of the earlier "." bug:
# not a scope silently narrowed to nothing, but a scope silently WIDENED to
# everything, from an argument nobody meant to pass. Refuse it outright rather
# than let root-arithmetic's own legitimate "this happens to collapse to root"
# case (".." from a repo-root-adjacent directory) absorb it by coincidence.
for arg in "$@"; do
  if [ -z "$arg" ]; then
    echo "usage: scan-questions.sh [--marker <token>] [--exempt <path>]... <path>..." >&2
    echo "  a blank argument was passed — refusing rather than treating it as" >&2
    echo "  the repository root. Declare paths explicitly (use \".\" for the" >&2
    echo "  whole repo)." >&2
    exit 2
  fi
done

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "✖ not inside a git repository." >&2
  exit 2
}
prefix=$(git rev-parse --show-prefix)

# The gate's own documentation necessarily contains the marker it defines, so it
# would otherwise report itself on every run. `engineering/CLAUDE.md` is the
# authored source; each `AGENTS.md` is a Binding emitted from it. The cost is
# stated rather than hidden: a genuine question typed into one of those files is
# not collected — write it in the code it is about.
# A doc that DEFINES the marker necessarily contains it, so it would report
# itself on every run. Exempt by default: this adapter's own files, every
# emitted AGENTS.md Binding, and STACK.md, which is where the project records
# the token. A project adds its own with --exempt.
#
# The cost is stated rather than hidden: a genuine question typed into one of
# these files is not collected — write it in the code it is about.
is_exempt() {
  case $1 in
    adapters/questions/*) return 0 ;;
    AGENTS.md|*/AGENTS.md) return 0 ;;
    STACK.md) return 0 ;;
  esac
  [ -n "$EXEMPT_EXTRA" ] || return 1
  printf '%s' "$EXEMPT_EXTRA" | grep -Fxq -- "$1" && return 0
  return 1
}

# Collapse "." and ".." segments. A candidate path can legitimately contain them
# — `../src/lib` typed from `engineering/` is the natural way to name a sibling —
# and the scan compares paths as fixed strings, so an uncollapsed one matches
# nothing and the whole declared directory falls silently out of scope. A path
# that climbs above the repository root is returned unchanged, so it is reported
# as not found rather than resolving to something surprising.
normalise() {
  n_out=""
  n_ifs=$IFS
  IFS=/
  for n_seg in $1; do
    case $n_seg in
      "" | .)
        continue
        ;;
      ..)
        if [ -z "$n_out" ]; then
          IFS=$n_ifs
          printf '%s\n' "$1"
          return 0
        fi
        n_out=${n_out%/*}
        ;;
      *)
        n_out="$n_out/$n_seg"
        ;;
    esac
  done
  IFS=$n_ifs
  # An empty result means the repository root — `.`, `./`, or the root's own
  # absolute path. Returning "" would be dropped as a blank argument, and the
  # whole repo would fall silently out of scope while the scan exited 0.
  if [ -z "$n_out" ]; then
    printf '%s\n' "."
    return 0
  fi
  printf '%s\n' "${n_out#/}"
}

# Normalise a caller-supplied path to repo-relative, without a leading ./ or a
# trailing /. Paths read relative to the current directory, like any other CLI;
# a repo-relative path typed from a subdirectory is also accepted, because that
# is the form a task card writes its file set in.
resolve() {
  p=$1
  case $p in
    /*)
      p=${p#"$root"}
      p=${p#/}
      ;;
    *)
      if [ -e "$root/$prefix$p" ]; then
        p="$prefix$p"
      elif [ -e "$root/$p" ]; then
        :
      else
        # Neither reading exists. Keep the literal one so the miss is reported
        # below rather than silently resolving to something that does exist.
        p="$prefix$p"
      fi
      ;;
  esac
  normalise "$p"
}

declared=""
missing=""
declared_count=0
for arg in "$@"; do
  d=$(resolve "$arg")
  [ -n "$d" ] || continue
  declared="$declared$d
"
  declared_count=$((declared_count + 1))
  [ -e "$root/$d" ] || missing="$missing$d
"
done

# A hit is in scope when its path is a declared path, or sits under a declared
# directory. Walking the hit's ancestors keeps this to exact fixed-string
# matches, so a declared path is never a pattern by accident.
in_scope() {
  q=$1
  # The repository root as a declared path puts everything in scope. The
  # ancestor walk below can never reach it, because it stops at the first
  # segment ("src" has no parent to pop).
  if printf '%s' "$declared" | grep -Fxq -- "."; then
    return 0
  fi
  while :; do
    if printf '%s' "$declared" | grep -Fxq -- "$q"; then
      return 0
    fi
    parent=${q%/*}
    if [ "$parent" = "$q" ]; then
      return 1
    fi
    q=$parent
  done
}

# Read everything: tracked files, plus untracked ones that are not ignored. A
# file this session created is untracked until it is committed, so a
# tracked-only scan would miss questions in exactly the new code most likely to
# attract them. Ignored paths (node_modules/, dist/) stay out.
hits=$(cd "$root" && git grep -I -n -i --untracked --no-color -E -e "$MARKER_RE" -- . || true)

collected=""
outofscope=""
collected_n=0
outofscope_n=0

oldifs=$IFS
IFS='
'
for hit in $hits; do
  hitpath=${hit%%:*}
  rest=${hit#*:}
  hitline=${rest%%:*}
  hittext=${rest#*:}
  if is_exempt "$hitpath"; then
    continue
  fi
  if in_scope "$hitpath"; then
    # Trim leading whitespace so an indented question lines up with the rest.
    while :; do
      case $hittext in
        " "*) hittext=${hittext#" "} ;;
        "	"*) hittext=${hittext#"	"} ;;
        *) break ;;
      esac
    done
    collected="$collected  $hitpath:$hitline: $hittext
"
    collected_n=$((collected_n + 1))
  else
    outofscope="$outofscope  $hitpath:$hitline
"
    outofscope_n=$((outofscope_n + 1))
  fi
done
IFS=$oldifs

echo "${MARKER}s scan — declared file set: $declared_count path(s)"

if [ -n "$missing" ]; then
  echo ""
  echo "  ! declared path not found in the repository — anything in it cannot be collected:"
  printf '%s' "$missing" | while IFS= read -r m; do
    [ -n "$m" ] && echo "      $m"
  done
fi

echo ""
echo "Collected — in scope, answer these before the review gate:"
if [ "$collected_n" -eq 0 ]; then
  echo "  none found in the declared file set"
else
  printf '%s' "$collected"
fi

echo ""
echo "Out of scope — reported, not collected; do not edit these:"
if [ "$outofscope_n" -eq 0 ]; then
  echo "  none found elsewhere in the repository"
else
  printf '%s' "$outofscope"
fi

echo ""
if [ "$collected_n" -gt 0 ]; then
  echo "$collected_n question(s) to answer before the review gate."
  exit 1
fi
echo "No questions to answer in the declared file set."
exit 0
