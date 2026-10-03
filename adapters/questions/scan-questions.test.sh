#!/usr/bin/env sh
#
# scan-questions.test.sh — tests for the AI-questions gate.
#
# Every claim is paired with a CONTROL that fails against the pre-change
# behaviour. This project has three times shipped a check that could not fail
# (SESSION_LOG.md 2026-08-04, 2026-08-10, 2026-09-03), so a claim without a
# control is not treated as covered here.
#
# Every check prints a line whether it passes or fails: an empty stdout is not a
# result (SESSION_LOG.md 2026-08-10, "a checker that throws is not a checker that
# passes").
#
# Run: sh template/adapters/questions/scan-questions.test.sh
#
set -uf

HERE=$(cd "$(dirname "$0")" && pwd)
SCANNER="$HERE/scan-questions.sh"
HOOK="$HERE/../../.githooks/pre-commit"

# Split so this file does not match the scan it is testing.
M="AI-Q""uestions:"

passes=0
failures=0

ok() {
  passes=$((passes + 1))
  echo "  PASS  $1"
}
no() {
  failures=$((failures + 1))
  echo "  FAIL  $1"
}
check() {
  # $1 = 0/1 truth, $2 = description
  if [ "$1" -eq 0 ]; then ok "$2"; else no "$2"; fi
}
contains() {
  printf '%s\n' "$1" | grep -Fq -- "$2"
}
section_collected() {
  printf '%s\n' "$1" | sed -n '/^Collected/,/^Out of scope/p'
}
section_outofscope() {
  printf '%s\n' "$1" | sed -n '/^Out of scope/,$p'
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

# A fresh fixture repository. $1 = name.
new_repo() {
  r="$TMP/$1"
  mkdir -p "$r/scripts" "$r/.githooks"
  cp "$SCANNER" "$r/scripts/scan-questions.sh"
  cp "$HOOK" "$r/.githooks/pre-commit"
  chmod +x "$r/scripts/scan-questions.sh" "$r/.githooks/pre-commit"
  (
    cd "$r" || exit 1
    git init -q
    git config core.hooksPath .githooks
    git config user.email t@example.com
    git config user.name Test
  )
  printf '%s\n' "$r"
}
commit_all() {
  # --no-verify: fixtures deliberately contain markers, and the hook under test
  # would refuse to commit them. Without this the fixture silently stays
  # uncommitted and every claim about "a committed file" tests something else.
  (cd "$1" && git add -A && git commit -q --no-verify -m "${2:-fixture}")
}
scan() {
  # $1 = repo, rest = declared paths. Sets SCAN_OUT and SCAN_RC.
  r=$1
  shift
  SCAN_OUT=$(cd "$r" && sh scripts/scan-questions.sh "$@" 2>&1)
  SCAN_RC=$?
}

echo "AI-questions gate — tests"
echo ""

# ---------------------------------------------------------------------------
echo "1. A marker in an unchanged region of a declared file is collected"
# ---------------------------------------------------------------------------
r=$(new_repo unchanged-region)
mkdir -p "$r/src"
{
  echo "// line 1"
  echo "// $M why is this a Set and not an array?"
  echo "export const a = 1;"
  echo "export const b = 2;"
  echo "export const c = 3;"
} > "$r/src/declared.js"
commit_all "$r" "declared file with a marker, committed"
# CONTROL for the fixture itself: the file must really be in HEAD, or "a marker
# in an unchanged region of a committed file" is testing something else. This
# fixture was silently uncommitted once already — the hook refused it.
in_head=$(cd "$r" && git ls-tree -r --name-only HEAD 2>/dev/null | grep -Fx "src/declared.js" || true)
check "$( [ -n "$in_head" ] && echo 0 || echo 1 )" \
  "CONTROL the fixture file is committed, so the claim below is about committed code"
# Change a DIFFERENT region, so `git diff` is non-empty and does not contain the
# marker — the exact situation that produced the original miss.
printf 'export const d = 4;\n' >> "$r/src/declared.js"

scan "$r" src/declared.js
if contains "$(section_collected "$SCAN_OUT")" "src/declared.js:2"; then
  ok "collected src/declared.js:2 from an untouched region"
else
  no "collected src/declared.js:2 from an untouched region"
  printf '%s\n' "$SCAN_OUT" | sed 's/^/        /'
fi

# CONTROL: the pre-change behaviour — a diff-scoped scan — misses it.
diffhits=$(cd "$r" && git diff -U0 -- src/declared.js | grep -i -- "$M" || true)
check "$( [ -z "$diffhits" ] && echo 0 || echo 1 )" \
  "CONTROL a diff-scoped scan finds nothing (this is the defect being fixed)"
# CONTROL: and the diff is genuinely non-empty, or the control above is vacuous.
diffsize=$(cd "$r" && git diff -U0 -- src/declared.js | wc -l)
check "$( [ "$diffsize" -gt 0 ] && echo 0 || echo 1 )" \
  "CONTROL the diff is non-empty, so the control above is not vacuous"

# ---------------------------------------------------------------------------
echo ""
echo "2. A marker outside the declared set is reported, not collected, not edited"
# ---------------------------------------------------------------------------
r=$(new_repo out-of-scope)
mkdir -p "$r/src"
printf '// %s should this be shared?\nexport const x = 1;\n' "$M" > "$r/src/other.ts"
printf 'export const y = 2;\n' > "$r/src/declared.js"
commit_all "$r"
before=$(cksum < "$r/src/other.ts")

scan "$r" src/declared.js
check "$( contains "$(section_outofscope "$SCAN_OUT")" "src/other.ts:1" && echo 0 || echo 1 )" \
  "src/other.ts:1 appears under Out of scope"
check "$( contains "$(section_collected "$SCAN_OUT")" "src/other.ts" && echo 1 || echo 0 )" \
  "src/other.ts does NOT appear under Collected"
check "$( contains "$SCAN_OUT" "should this be shared?" && echo 1 || echo 0 )" \
  "the out-of-scope question's text is not printed — path and line only"
after=$(cksum < "$r/src/other.ts")
check "$( [ "$before" = "$after" ] && echo 0 || echo 1 )" \
  "the out-of-scope file is byte-identical afterwards"
check "$( [ "$SCAN_RC" -eq 0 ] && echo 0 || echo 1 )" \
  "an out-of-scope marker alone exits 0 — it does not block this session's gate"

# CONTROL: declaring that same file moves it into Collected, so the partition is
# doing work rather than everything falling out of scope by default.
scan "$r" src/other.ts
check "$( contains "$(section_collected "$SCAN_OUT")" "src/other.ts:1" && echo 0 || echo 1 )" \
  "CONTROL declaring the same file collects it instead"

# ---------------------------------------------------------------------------
echo ""
echo "3. A marker in a file no session touched is still reported"
# ---------------------------------------------------------------------------
r=$(new_repo untouched)
mkdir -p "$r/src" "$r/docs"
printf '# notes\n\n<!-- %s is this still true? -->\n' "$M" > "$r/docs/untouched.md"
printf 'export const y = 2;\n' > "$r/src/declared.js"
commit_all "$r"
# Nothing modifies docs/untouched.md at any point in this fixture.
scan "$r" src/declared.js
check "$( contains "$(section_outofscope "$SCAN_OUT")" "docs/untouched.md:3" && echo 0 || echo 1 )" \
  "docs/untouched.md:3 is reported despite no session touching it"

# CONTROL: the pre-change behaviour sees nothing there at all.
worktree_diff=$(cd "$r" && git status --porcelain)
check "$( [ -z "$worktree_diff" ] && echo 0 || echo 1 )" \
  "CONTROL the working tree is clean, so no diff-based scan could have found it"

# ---------------------------------------------------------------------------
echo ""
echo "4. One grep, every file type"
# ---------------------------------------------------------------------------
r=$(new_repo filetypes)
mkdir -p "$r/mix"
for ext in js jsx ts jsonc sh md; do
  printf 'x\n// %s question in a .%s file\n' "$M" "$ext" > "$r/mix/f.$ext"
done
printf 'no marker here\n' > "$r/mix/clean.txt"
commit_all "$r"
scan "$r" mix
allfound=0
for ext in js jsx ts jsonc sh md; do
  if ! contains "$(section_collected "$SCAN_OUT")" "mix/f.$ext:2"; then
    allfound=1
    echo "        missing: mix/f.$ext"
  fi
done
check "$allfound" "markers found in .js .jsx .ts .jsonc .sh .md with no per-language cases"
# One collect returns every marker across every declared file as a single set,
# rather than a batch per file — the fragmentation the card's D4 rejects.
collected_lines=$(section_collected "$SCAN_OUT" | grep -c "mix/f\." || true)
check "$( [ "$collected_lines" -eq 6 ] && echo 0 || echo 1 )" \
  "all 6 arrive in one run as one set (got $collected_lines)"
# CONTROL: a file without a marker in the same directory is not reported, so the
# check is matching the marker rather than listing files.
check "$( contains "$SCAN_OUT" "mix/clean.txt" && echo 1 || echo 0 )" \
  "CONTROL a marker-free file in the same directory is not reported"

# ---------------------------------------------------------------------------
echo ""
echo "5. No markers anywhere: an explicit result for both sections, exit 0"
# ---------------------------------------------------------------------------
r=$(new_repo clean)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/declared.js"
commit_all "$r"
scan "$r" src/declared.js
check "$( contains "$SCAN_OUT" "none found in the declared file set" && echo 0 || echo 1 )" \
  "Collected prints an explicit 'none found' rather than nothing"
check "$( contains "$SCAN_OUT" "none found elsewhere in the repository" && echo 0 || echo 1 )" \
  "Out of scope prints an explicit 'none found' rather than nothing"
check "$( [ "$SCAN_RC" -eq 0 ] && echo 0 || echo 1 )" "exit 0"

# CONTROL: the same fixture with one marker added exits non-zero, so the exit 0
# above is a result and not the script's only possible answer.
printf '// %s added\n' "$M" >> "$r/src/declared.js"
scan "$r" src/declared.js
check "$( [ "$SCAN_RC" -ne 0 ] && echo 0 || echo 1 )" \
  "CONTROL adding one in-scope marker makes the same command exit non-zero"

# ---------------------------------------------------------------------------
echo ""
echo "6. Casing"
# ---------------------------------------------------------------------------
r=$(new_repo casing)
mkdir -p "$r/src"
{
  printf '// %s mixed case, plural\n' "$M"
  printf '// ai-q''uestions: lower case\n'
  printf '// AI-Q''UESTIONS: upper case\n'
  printf '// AI-Q''uestion: singular\n'
  printf '// AI-Q''UESTION: singular, upper case\n'
  printf '// ai-q''uestion: singular, lower case\n'
  printf '// AI-A''nswer: a different token entirely\n'
} > "$r/src/declared.js"
commit_all "$r"
scan "$r" src/declared.js
# Lines 4-6 are the regression: the marker is typed live by a person, and
# singular is the natural spelling for one question. Three real markers in this
# repo were singular and were silently dropped, while the suite's own control
# asserted that they should be — a test written from the same wrong mental model
# as the code (SESSION_LOG.md 2026-08-26).
for ln in 1 2 3 4 5 6; do
  check "$( contains "$(section_collected "$SCAN_OUT")" "src/declared.js:$ln" && echo 0 || echo 1 )" \
    "line $ln collected (singular and plural, any casing)"
done
# CONTROL: the pattern is not simply matching everything — a different token on
# line 7 is left alone. Without this, accepting singular could have been
# implemented by matching far too much and nothing would have complained.
check "$( contains "$SCAN_OUT" "src/declared.js:7" && echo 1 || echo 0 )" \
  "CONTROL a different token on line 7 is not matched"
# CONTROL: the colon is still required, so prose about questions is not a marker.
printf '// these are the ai-q''uestions I had\n' >> "$r/src/declared.js"
scan "$r" src/declared.js
check "$( contains "$SCAN_OUT" "src/declared.js:8" && echo 1 || echo 0 )" \
  "CONTROL the same words without a colon are prose, not a marker"

# ---------------------------------------------------------------------------
echo ""
echo "7. Untracked files are read"
# ---------------------------------------------------------------------------
# A file this session created is untracked until it is committed. Two of the
# three real questions found on this repo when the scanner was first run lived in
# untracked files, so a tracked-only scan would have missed them.
r=$(new_repo untracked)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/declared.js"
commit_all "$r"
printf '// %s brand new file\n' "$M" > "$r/src/fresh.js"
scan "$r" src
check "$( contains "$(section_collected "$SCAN_OUT")" "src/fresh.js:1" && echo 0 || echo 1 )" \
  "a marker in an untracked declared file is collected"
# CONTROL: a tracked-only grep — the card's literal wording — misses it.
tracked_only=$(cd "$r" && git grep -Fin -e "$M" -- . || true)
check "$( printf '%s' "$tracked_only" | grep -Fq "src/fresh.js" && echo 1 || echo 0 )" \
  "CONTROL a tracked-only grep does not see it"
# CONTROL: an ignored path stays out, so 'read everything' is not literally everything.
printf 'node_modules/\n' > "$r/.gitignore"
mkdir -p "$r/node_modules/pkg"
printf '// %s in a dependency\n' "$M" > "$r/node_modules/pkg/index.js"
scan "$r" src
check "$( contains "$SCAN_OUT" "node_modules" && echo 1 || echo 0 )" \
  "CONTROL an ignored path is not scanned"

# ---------------------------------------------------------------------------
echo ""
echo "8. A declared path that does not exist is called out"
# ---------------------------------------------------------------------------
r=$(new_repo missing-path)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/declared.js"
commit_all "$r"
scan "$r" src/declared.js src/typo.js
check "$( contains "$SCAN_OUT" "declared path not found" && echo 0 || echo 1 )" \
  "a mistyped declared path is reported rather than silently collecting nothing"
check "$( contains "$SCAN_OUT" "src/typo.js" && echo 0 || echo 1 )" \
  "the mistyped path itself is named"
# CONTROL: a path that does exist produces no such warning.
scan "$r" src/declared.js
check "$( contains "$SCAN_OUT" "declared path not found" && echo 1 || echo 0 )" \
  "CONTROL an existing declared path produces no warning"

# ---------------------------------------------------------------------------
echo ""
echo "8b. The repository root as a declared path"
# ---------------------------------------------------------------------------
# Regression: "." normalised to the empty string, was dropped as a blank
# argument, and the whole repo fell out of scope while the scan exited 0 — a
# silent false pass on the most natural "show me everything" invocation.
r=$(new_repo dot-root)
mkdir -p "$r/src" "$r/docs"
printf '// %s one\n' "$M" > "$r/src/a.js"
printf '<!-- %s two -->\n' "$M" > "$r/docs/b.md"
commit_all "$r"
scan "$r" .
check "$( contains "$(section_collected "$SCAN_OUT")" "src/a.js:1" && echo 0 || echo 1 )" \
  "declaring . collects src/a.js"
check "$( contains "$(section_collected "$SCAN_OUT")" "docs/b.md:1" && echo 0 || echo 1 )" \
  "declaring . collects docs/b.md"
check "$( contains "$SCAN_OUT" "none found elsewhere in the repository" && echo 0 || echo 1 )" \
  "nothing is left out of scope"
check "$( [ "$SCAN_RC" -ne 0 ] && echo 0 || echo 1 )" \
  "and it exits non-zero rather than falsely passing"
check "$( contains "$SCAN_OUT" "declared file set: 1 path" && echo 0 || echo 1 )" \
  "the root counts as one declared path, not zero"
# ./ and the absolute root are the same declaration.
scan "$r" ./
check "$( contains "$(section_collected "$SCAN_OUT")" "src/a.js:1" && echo 0 || echo 1 )" \
  "./ resolves to the root too"
scan "$r" "$r"
check "$( contains "$(section_collected "$SCAN_OUT")" "src/a.js:1" && echo 0 || echo 1 )" \
  "the absolute path of the root resolves to the root too"
# CONTROL: a narrower declaration in the same fixture still leaves the other
# file out of scope, so "everything in scope" is the root's doing, not the
# default.
scan "$r" src
check "$( contains "$(section_outofscope "$SCAN_OUT")" "docs/b.md:1" && echo 0 || echo 1 )" \
  "CONTROL declaring only src leaves docs/b.md out of scope"

# ---------------------------------------------------------------------------
echo ""
echo "8c. A blank argument is refused, not silently treated as the repository root"
# ---------------------------------------------------------------------------
# Review-gate finding (Lane B): normalise() collapsed ANY empty result to ".",
# not only the three documented root spellings. A caller passing an unset
# variable ("" as one of several arguments) got the whole repo silently
# declared in scope instead of an error — the mirror-image of the earlier "."
# bug: that one silently NARROWED scope to nothing, this one silently WIDENS
# it to everything, from an argument nobody meant to pass.
r=$(new_repo blank-arg)
mkdir -p "$r/src" "$r/docs"
printf '// %s should not be reachable via a blank arg\n' "$M" > "$r/docs/secret.md"
commit_all "$r"
blank_out=$(cd "$r" && sh scripts/scan-questions.sh "" 2>&1); blank_rc=$?
check "$( [ "$blank_rc" -eq 2 ] && echo 0 || echo 1 )" \
  "a lone blank argument exits 2 (usage error), not 0"
check "$( contains "$blank_out" "blank argument" && echo 0 || echo 1 )" \
  "the refusal explains why, rather than silently doing something"
check "$( contains "$blank_out" "declared file set" && echo 1 || echo 0 )" \
  "it never gets as far as printing a declared-file-set summary"
# The same must hold when the blank is mixed into an otherwise-real list — the
# actual shape of the bug (a caller's file-set builder emitting one blank
# among several real paths), not just a lone "".
mixed_out=$(cd "$r" && sh scripts/scan-questions.sh src "" docs/secret.md 2>&1); mixed_rc=$?
check "$( [ "$mixed_rc" -eq 2 ] && echo 0 || echo 1 )" \
  "a blank mixed into a real list is refused too, not absorbed into scope"
# CONTROL: a real "." declaration still means the whole repo, so the fix did
# not overcorrect into refusing legitimate root declarations too.
scan "$r" .
check "$( contains "$(section_collected "$SCAN_OUT")" "docs/secret.md:1" && echo 0 || echo 1 )" \
  "CONTROL a literal . still declares the whole repo"
# CONTROL: path arithmetic that legitimately collapses to root from a
# subdirectory still resolves, so the fix targets the blank case specifically
# rather than refusing anything normalise() cannot immediately name.
climb_out=$(cd "$r/src" && sh ../scripts/scan-questions.sh .. 2>&1); climb_rc=$?
check "$( contains "$(section_collected "$climb_out")" "docs/secret.md:1" && echo 0 || echo 1 )" \
  "CONTROL '..' from a subdirectory that reaches root still resolves to root"
check "$( [ "$climb_rc" -ne 2 ] && echo 0 || echo 1 )" \
  "CONTROL and it does not exit 2 the way a blank argument does"

# ---------------------------------------------------------------------------
echo ""
echo "10b. The hook's refusal message survives a staged path containing a space"
# ---------------------------------------------------------------------------
# Review-gate finding (Lane B): the refusal message printed `$qbad` unquoted,
# so shell word-splitting tore a path like "src/my file.js:2" into two
# printed lines at the space, independent of whether the commit was correctly
# blocked (it was — this is a message-quality bug, not a blocking-logic one,
# but D7 exists specifically because the message has to teach, not just block).
r=$(new_repo hook-space)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/my file.js"
commit_all "$r" "base"
printf '// %s should this be a Map?\n' "$M" >> "$r/src/my file.js"
(cd "$r" && git add -- "src/my file.js")
space_out=$(cd "$r" && git commit -m "with a space in the path" 2>&1); space_rc=$?
check "$( [ "$space_rc" -ne 0 ] && echo 0 || echo 1 )" \
  "the commit is still correctly refused"
check "$( contains "$space_out" "src/my file.js:2" && echo 0 || echo 1 )" \
  "the path and line print on one unbroken line, space intact"
# A torn message splits at the space onto two lines: "    src/my" alone, then
# "file.js:2" alone. Check for that EXACT pair of lines — checking only for
# the substring "    src/my" is not a control, because it is also a substring
# of the correct, intact line "    src/my file.js:2".
torn=$(printf '%s\n' "$space_out" | grep -Fxq "    src/my" && printf '%s\n' "$space_out" | grep -Fxq "file.js:2" && echo 1 || echo 0)
check "$torn" "the path is not torn across two separate lines at the space"
# CONTROL: the detector above actually recognises torn output when it occurs —
# manufacture the pre-fix shape directly, so a bug in the detector itself
# (rather than in the fix) cannot make this pass for the wrong reason.
manufactured=$(printf '    src/my\nfile.js:2\n')
torn_control=$(printf '%s\n' "$manufactured" | grep -Fxq "    src/my" && printf '%s\n' "$manufactured" | grep -Fxq "file.js:2" && echo 1 || echo 0)
check "$( [ "$torn_control" -eq 1 ] && echo 0 || echo 1 )" \
  "CONTROL the tear-detector recognises manufactured torn output"

# ---------------------------------------------------------------------------
echo ""
echo "9. Usage"
# ---------------------------------------------------------------------------
r=$(new_repo usage)
printf 'x\n' > "$r/a.js"
commit_all "$r"
usage_out=$(cd "$r" && sh scripts/scan-questions.sh 2>&1); usage_rc=$?
check "$( [ "$usage_rc" -eq 2 ] && echo 0 || echo 1 )" \
  "no arguments exits 2 — the file set is never inferred"
check "$( contains "$usage_out" "usage:" && echo 0 || echo 1 )" "usage is printed"

# ---------------------------------------------------------------------------
echo ""
echo "10. The pre-commit hook refuses a staged marker"
# ---------------------------------------------------------------------------
r=$(new_repo hook)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/a.js"
commit_all "$r" "base"
printf '// %s should this be a Map?\n' "$M" >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
hook_out=$(cd "$r" && git commit -m "with a marker" 2>&1); hook_rc=$?
check "$( [ "$hook_rc" -ne 0 ] && echo 0 || echo 1 )" "the commit is refused"
check "$( contains "$hook_out" "unanswered review question" && echo 0 || echo 1 )" \
  "the refusal names the reason"
check "$( contains "$hook_out" "src/a.js" && echo 0 || echo 1 )" "the refusal names the file"
check "$( contains "$hook_out" "src/a.js:2" && echo 0 || echo 1 )" \
  "the refusal names the line the marker landed on"
check "$( contains "$hook_out" "your own unanswered questions" && echo 0 || echo 1 )" \
  "the refusal names the 'yours, unanswered' situation and its fix"
check "$( contains "$hook_out" "peer session's in-flight review" && echo 0 || echo 1 )" \
  "the refusal names the 'a peer's review' situation and its fix"

# CONTROL: the line number is computed, not a constant. Same marker, line 41.
r=$(new_repo hook-lineno)
mkdir -p "$r/src"
i=1
while [ "$i" -le 40 ]; do printf 'const l%s = %s;\n' "$i" "$i" >> "$r/src/a.js"; i=$((i + 1)); done
commit_all "$r" "base"
printf '// %s deep in the file\n' "$M" >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
lineno_out=$(cd "$r" && git commit -m "deep" 2>&1) || true
check "$( contains "$lineno_out" "src/a.js:41" && echo 0 || echo 1 )" \
  "CONTROL a marker on line 41 is reported as line 41, not line 1"
check "$( contains "$lineno_out" "src/a.js:1" && echo 1 || echo 0 )" \
  "CONTROL and line 1 is not reported"

# CONTROL: a marker already in HEAD in the SAME file being modified does not get
# re-reported — only additions count, not the file's whole content.
r=$(new_repo hook-additions-only)
mkdir -p "$r/src"
printf '// %s an old question\nconst a = 1;\n' "$M" > "$r/src/a.js"
(cd "$r" && git add -A && git commit -q --no-verify -m "base with marker")
printf 'const b = 2;\n' >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
(cd "$r" && git commit -q -m "unrelated edit to the same file" >/dev/null 2>&1); samefile_rc=$?
check "$( [ "$samefile_rc" -eq 0 ] && echo 0 || echo 1 )" \
  "CONTROL editing a file whose pre-existing marker is untouched still commits"

# Lower case, same refusal.
r=$(new_repo hook-lower)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/a.js"
commit_all "$r" "base"
printf '// ai-q''uestions: lower case\n' >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
(cd "$r" && git commit -q -m "lower" >/dev/null 2>&1); lower_rc=$?
check "$( [ "$lower_rc" -ne 0 ] && echo 0 || echo 1 )" "a lower-case marker is refused too"

# Singular, same refusal — the hook must not diverge from the scan on which
# spellings count, or a question the scan collects sails past the backstop.
r=$(new_repo hook-singular)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/a.js"
commit_all "$r" "base"
printf '// AI-Q''UESTION: singular\n' >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
sing_out=$(cd "$r" && git commit -m "singular" 2>&1); sing_rc=$?
check "$( [ "$sing_rc" -ne 0 ] && echo 0 || echo 1 )" "a singular marker is refused too"
check "$( contains "$sing_out" "src/a.js:2" && echo 0 || echo 1 )" \
  "and the singular one is located on the right line"

# Removing the marker makes the SAME commit succeed.
r=$(new_repo hook-clean)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/a.js"
commit_all "$r" "base"
printf '// %s should this be a Map?\n' "$M" >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
(cd "$r" && git commit -q -m "blocked" >/dev/null 2>&1) || true
# Answer it: drop the marker line, keep the edit.
printf 'export const y = 2;\nexport const z = 3;\n' > "$r/src/a.js"
(cd "$r" && git add src/a.js)
(cd "$r" && git commit -q -m "answered" >/dev/null 2>&1); clean_rc=$?
check "$( [ "$clean_rc" -eq 0 ] && echo 0 || echo 1 )" \
  "removing the marker lets the same commit through"

# CONTROL: --no-verify commits it, proving the refusal comes from this hook and
# not from anything else in git.
r=$(new_repo hook-control)
mkdir -p "$r/src"
printf 'export const y = 2;\n' > "$r/src/a.js"
commit_all "$r" "base"
printf '// %s control\n' "$M" >> "$r/src/a.js"
(cd "$r" && git add src/a.js)
(cd "$r" && git commit -q --no-verify -m "bypass" >/dev/null 2>&1); bypass_rc=$?
check "$( [ "$bypass_rc" -eq 0 ] && echo 0 || echo 1 )" \
  "CONTROL --no-verify still commits, so the block is this hook's doing"

# CONTROL: a marker already in HEAD but not in the staged additions does not
# block an unrelated commit.
r=$(new_repo hook-preexisting)
mkdir -p "$r/src"
printf '// %s old question\n' "$M" > "$r/src/old.js"
(cd "$r" && git add -A && git commit -q --no-verify -m "pre-existing marker")
printf 'export const n = 1;\n' > "$r/src/new.js"
(cd "$r" && git add src/new.js)
(cd "$r" && git commit -q -m "unrelated" >/dev/null 2>&1); unrelated_rc=$?
check "$( [ "$unrelated_rc" -eq 0 ] && echo 0 || echo 1 )" \
  "CONTROL a marker already in history does not block an unrelated commit"

# ---------------------------------------------------------------------------
echo ""
echo "11. Docs that define the marker are exempt, and the exemption is narrow"
# ---------------------------------------------------------------------------
# Two layers, tested separately: the defaults this adapter ships (its own files,
# every emitted AGENTS.md, STACK.md) and the --exempt a project adds for its own
# docs. The default list used to name one project's doc path; that was the thing
# generalised when this adapter was absorbed, so it is what these assert.
r=$(new_repo exempt)
mkdir -p "$r/engineering" "$r/src"
printf '# stack\n\nThe marker is `%s`.\n' "$M" > "$r/STACK.md"
printf '# binding\n\nThe marker is `%s`.\n' "$M" > "$r/engineering/AGENTS.md"
printf '# docs\n\nThe marker is `%s`.\n' "$M" > "$r/engineering/CLAUDE.md"
printf 'export const y = 2;\n' > "$r/src/a.js"
(cd "$r" && git add -A && git commit -q --no-verify -m "docs")

scan "$r" src STACK.md engineering
check "$( contains "$SCAN_OUT" "STACK.md" && echo 1 || echo 0 )" \
  "STACK.md, where the token is recorded, does not report itself"
check "$( contains "$SCAN_OUT" "engineering/AGENTS.md" && echo 1 || echo 0 )" \
  "an emitted AGENTS.md Binding does not report itself"
# CONTROL: the authored source is NOT exempt by default — a project that keeps
# the marker in its own docs must say so, rather than a doc path being guessed.
check "$( contains "$SCAN_OUT" "engineering/CLAUDE.md" && echo 0 || echo 1 )" \
  "CONTROL a project doc is NOT exempt by default"
SCAN_OUT=$(cd "$r" && sh scripts/scan-questions.sh --exempt engineering/CLAUDE.md src engineering 2>&1)
check "$( contains "$SCAN_OUT" "engineering/CLAUDE.md" && echo 1 || echo 0 )" \
  "--exempt silences the project's own doc"
# CONTROL: --exempt is an exact path, not a prefix or a pattern.
printf '// %s not exempt\n' "$M" > "$r/engineering/NOTES.md"
SCAN_OUT=$(cd "$r" && sh scripts/scan-questions.sh --exempt engineering/CLAUDE.md engineering 2>&1)
check "$( contains "$(section_collected "$SCAN_OUT")" "engineering/NOTES.md" && echo 0 || echo 1 )" \
  "CONTROL a neighbour in the same directory is still collected"

# ---------------------------------------------------------------------------
echo ""
echo "11b. --marker overrides the default token"
# ---------------------------------------------------------------------------
r=$(new_repo marker)
mkdir -p "$r/src"
printf '// REVIEW-Q'': a project that chose its own token\n' > "$r/src/a.js"
printf '// %s the default token\n' "$M" > "$r/src/b.js"
commit_all "$r"
SCAN_OUT=$(cd "$r" && sh scripts/scan-questions.sh --marker "REVIEW-Q" src 2>&1); rc=$?
check "$( contains "$(section_collected "$SCAN_OUT")" "src/a.js:1" && echo 0 || echo 1 )" \
  "a custom token is collected"
check "$( [ "$rc" -eq 1 ] && echo 0 || echo 1 )" \
  "a custom token still exits 1 when in-scope markers remain"
# CONTROL: choosing a token means the default stops matching — no silent union.
check "$( contains "$(section_collected "$SCAN_OUT")" "src/b.js" && echo 1 || echo 0 )" \
  "CONTROL the default token is NOT also matched once --marker is given"

# ---------------------------------------------------------------------------
echo "12. Declared paths are read relative to the current directory"
# ---------------------------------------------------------------------------
r=$(new_repo subdir)
mkdir -p "$r/src/lib" "$r/engineering"
printf '// %s from a subdirectory\n' "$M" > "$r/src/lib/a.js"
commit_all "$r"
sub_out=$(cd "$r/engineering" && sh ../scripts/scan-questions.sh ../src/lib 2>&1)
check "$( contains "$(section_collected "$sub_out")" "src/lib/a.js:1" && echo 0 || echo 1 )" \
  "a relative path from a subdirectory resolves"
# The repo-relative form a task card writes is accepted from a subdirectory too.
sub_out=$(cd "$r/engineering" && sh ../scripts/scan-questions.sh src/lib 2>&1)
check "$( contains "$(section_collected "$sub_out")" "src/lib/a.js:1" && echo 0 || echo 1 )" \
  "the repo-relative form also resolves"
# CONTROL: a path that is neither is reported missing rather than quietly matched.
sub_out=$(cd "$r/engineering" && sh ../scripts/scan-questions.sh nowhere/at/all 2>&1)
check "$( contains "$sub_out" "declared path not found" && echo 0 || echo 1 )" \
  "CONTROL a path under neither reading is reported as missing"

# ---------------------------------------------------------------------------
echo ""
echo "-------------------------------------------"
echo "passed: $passes   failed: $failures"
if [ "$failures" -ne 0 ]; then
  exit 1
fi
exit 0
