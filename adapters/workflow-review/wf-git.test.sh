#!/usr/bin/env bash
# Regression suite for wf-git. Runs in a throwaway sandbox: it never touches a real project or a
# real review repo. Ported from vovo-spaces' tests/ (run.sh + run2.sh + setup.sh), adapted to the
# config-driven wrapper: the project and history come from WF_PROJECT / WF_HISTORY_DIR, and the
# opener is `git difftool`. Run after any change to wf-git:  bash wf-git.test.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/wf-git"
SBX="$(mktemp -d)"; trap 'rm -rf "$SBX"' EXIT
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }; ko(){ echo "FAIL $1 :: $2"; fail=$((fail+1)); }
# Commits need an identity; a clean CI box has none. No global config is read otherwise.
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL="$SBX/gitconfig"; : > "$GIT_CONFIG_GLOBAL"
# --open delegates to the shared opener (TASK-089); point at the payload's copy.
export WF_DIFF_OPEN="$HERE/../diff-open/diff-open.sh"
unset DIFF_OPENER DIFF_EDITOR_BIN

# A client checkout with the workflow block, and a history OUTSIDE it. The wrapper is copied to an
# unrelated directory on purpose: nothing may be derived from where the script sits.
setup() {
  S="$1"; rm -rf "$S"; mkdir -p "$S/client" "$S/tool" "$S/tmp" "$S/hist"
  C="$S/client"; H="$S/hist"; R="$H/repo.git"; W="$S/tool/wf-git"
  ( cd "$C" && git init -q && mkdir -p src backend product && echo 'class App {}' > src/App.java \
    && echo readme > README.md && echo tg > backend/TEST_GUIDE.md && echo '.env' > .gitignore \
    && git add -A && git commit -qm init )
  ( cd "$C" && echo 'wf v1' > WORKFLOW.md && echo task > backend/TASK.md && echo n > "product/notes é.md" \
    && echo SECRET=1 > product/.env && mkdir -p frontend && echo f > frontend/TASK.md )
  printf '%s\n' '# ── AI dev workflow — test block' /WORKFLOW.md /backend/TASK.md /backend/TEST_GUIDE.md /product/ /frontend/TASK.md '# ── end AI dev workflow (test)' >> "$C/.git/info/exclude"
  cp "$SRC" "$W"; chmod +x "$W"
  export WF_PROJECT="$C" WF_HISTORY_DIR="$H" TMPDIR="$S/tmp"
  "$W" init >/dev/null
}
heads(){ git --git-dir="$R" rev-parse -q --verify HEAD 2>/dev/null || echo none; }
expect_refused(){ local name="$1"; shift; local before; before=$(heads); "$W" "$@" >/dev/null 2>&1; local rc=$?; [[ $rc -eq 2 && "$(heads)" == "$before" ]] && ok "$name" || ko "$name" "rc=$rc head $before->$(heads)"; }

# ---------------------------------------------------------------- run.sh (source)
setup "$SBX/a"
expect_refused "blank path"            commit x ""
expect_refused "outside path"          commit x /etc
expect_refused "dot = whole checkout"  commit x .
expect_refused "root = whole checkout" commit x "$C"
expect_refused "mixed good+bad path"   commit x backend/TASK.md /etc/passwd
expect_refused "dotdot"                commit x backend/../src
expect_refused "status bad path"       status /x
expect_refused "no pathspec ls"        ls
expect_refused "clean refused"         clean -fdx
expect_refused "push refused"          push

out=$("$W" diff --print WORKFLOW.md 2>&1); [[ $? -eq 0 && "$out" == *"+wf v1"* ]] && ok "diff before first approval" || ko "diff before first approval" "$out"

# A plain `diff` must never open anything: the user reviews on request only (WFC-20261007-08).
# The opener is the user's configured difftool — stubbed here through the global git config.
printf '[diff]\n\ttool = stub\n[difftool "stub"]\n\tcmd = touch "%s/difftool-called"\n' "$S" > "$GIT_CONFIG_GLOBAL"
out=$("$W" diff WORKFLOW.md 2>&1)
[[ ! -e "$S/difftool-called" && "$out" == *"changed: WORKFLOW.md"* ]] && ok "plain diff lists, opens nothing" || ko "plain diff lists, opens nothing" "$out"
out=$("$W" diff --open WORKFLOW.md 2>&1)
[[ -e "$S/difftool-called" ]] && ok "diff --open runs the configured git difftool" || ko "diff --open runs difftool" "$out"
grep -rqsE '\bcode\b +--diff' "$SRC" && ko "no editor named in the base" "found a hardcoded editor command" || ok "no editor named in the base"
# The VS Code-family opener, through the same adapter: the RIGHT side is the real doc, so a
# comment typed in the diff lands in the file.
# The fake logs its LAST argument — always the working file, whatever flags precede it
# (--wait since TASK-095: one diff at a time).
printf '#!/bin/sh\nfor a; do r=$a; done; printf "%%s\\n" "$r" >> "%s/code.log"\n' "$S" > "$S/fake-code"; chmod +x "$S/fake-code"
out=$(DIFF_OPENER=vscode DIFF_EDITOR_BIN="$S/fake-code" "$W" diff --open WORKFLOW.md 2>&1)
right=$(head -1 "$S/code.log" 2>/dev/null)
[[ "$right" == "$C/WORKFLOW.md" ]] && ok "--open via diff-open: the right side is the real working doc" || ko "vscode via diff-open" "$right / $out"
out=$(WF_DIFF_OPEN="$S/nowhere.sh" "$W" diff --open WORKFLOW.md 2>&1); rc=$?
[[ $rc -eq 2 && "$out" == *"diff-open adapter"* ]] && ok "--open without the shared adapter refuses — no second opener" || ko "missing adapter" "rc=$rc $out"
: > "$GIT_CONFIG_GLOBAL"

git --git-dir="$R" --work-tree="$C" add src/App.java   # junk in the shared index
out=$("$W" commit "base" WORKFLOW.md backend/ product/ 2>&1); rc=$?
files=$(git -c core.quotePath=false --git-dir="$R" ls-tree -r --name-only HEAD)
[[ $rc -eq 0 ]] && ok "commit ok" || ko "commit ok" "$out"
[[ "$files" != *src/App.java* ]] && ok "pre-staged client source not committed" || ko "pre-staged" "$files"
[[ "$files" == *"product/notes é.md"* ]] && ok "non-ASCII name committed" || ko "non-ascii" "$files"
[[ "$files" != *product/.env* && "$out" == *"skipped (matches .gitignore"* ]] && ok "gitignored .env skipped" || ko ".env" "$files / $out"
[[ "$files" == *backend/TEST_GUIDE.md* ]] && ok "still-committed excluded doc included" || ko "test_guide" "$files"
[[ "$files" != *README.md* && "$files" != *frontend* ]] && ok "README / other paths not included" || ko "readme" "$files"

out=$("$W" commit x src/ 2>&1); [[ $? -eq 2 && "$out" == *"no workflow docs"* ]] && ok "client source dir has no candidates" || ko "src" "$out"

echo "é edit" >> "$C/product/notes é.md"
out=$("$W" status product/); [[ "$out" == *"notes é.md"* ]] && ok "status shows non-ASCII change" || ko "status nonascii" "$out"
out=$("$W" diff --print product/); [[ "$out" == *"+é edit"* ]] && ok "diff shows non-ASCII change" || ko "diff nonascii" "$out"

rm "$C/WORKFLOW.md"
out=$("$W" status WORKFLOW.md); [[ "$out" == D*WORKFLOW.md* ]] && ok "status shows deletion" || ko "status del" "$out"
"$W" commit "del" WORKFLOW.md >/dev/null; git --git-dir="$R" cat-file -e HEAD:WORKFLOW.md 2>/dev/null && ko "deletion recorded" "still in HEAD" || ok "deletion recorded"
out=$("$W" diff --print --base HEAD~1 WORKFLOW.md); [[ "$out" == *"-wf v1"* ]] && ok "diff vs --base shows deleted content" || ko "base diff" "$out"

# hooks never run
mkdir -p "$R/hooks"; printf '#!/bin/sh\ntouch "%s/HOOK_RAN"\n' "$S" > "$R/hooks/post-commit"; chmod +x "$R/hooks/post-commit"
echo "t2" >> "$C/backend/TASK.md"; "$W" commit "t2" backend/TASK.md >/dev/null
[[ ! -e "$S/HOOK_RAN" ]] && ok "hooks do not run" || ko "hooks" "ran"

# crafted tree with '..' entries cannot touch client files
size=$(wc -c < "$C/src/App.java")
blob=$(echo evil | git --git-dir="$R" hash-object -w --stdin)
t1=$(printf '100644 blob %s\tApp.java\n' "$blob" | git --git-dir="$R" mktree 2>/dev/null)
t2=$(printf '040000 tree %s\t..\n' "$t1" | git --git-dir="$R" mktree 2>/dev/null)
t3=$(printf '040000 tree %s\tbackend\n' "$t2" | git --git-dir="$R" mktree 2>/dev/null)
if [[ -n "$t3" ]]; then
  c=$(git --git-dir="$R" commit-tree "$t3" -m evil)
  "$W" diff --print --base "$c" backend/ >/dev/null 2>&1
fi
[[ "$(wc -c < "$C/src/App.java")" == "$size" ]] && ok "crafted '..' tree cannot truncate client file" || ko "crafted" "size changed"

# block parsing guards
cp "$C/.git/info/exclude" "$S/ex.bak"
sed -i '/^# ── end AI dev workflow/d' "$C/.git/info/exclude"
expect_refused "missing end marker" status backend/
cp "$S/ex.bak" "$C/.git/info/exclude"; sed -i 's|^/product/$|/product/\nTASK.md|' "$C/.git/info/exclude"
expect_refused "unanchored pattern" status backend/
cp "$S/ex.bak" "$C/.git/info/exclude"; sed -i 's|^/product/$|/product/\n/src/*.java|' "$C/.git/info/exclude"
expect_refused "glob pattern" status backend/
cp "$S/ex.bak" "$C/.git/info/exclude"

[[ -z "$(git -C "$C" status --porcelain --ignored=no)" ]] && ok "client repo untouched" || ko "client" "$(git -C "$C" status --porcelain)"

# ---------------------------------------------------------------- run2.sh (source)
setup "$SBX/b"
n0=$(ls -A "$TMPDIR" | wc -l)
"$W" status backend/ >/dev/null 2>&1; "$W" commit base WORKFLOW.md backend/ >/dev/null 2>&1; "$W" diff --print backend/ >/dev/null 2>&1; "$W" log backend/ >/dev/null 2>&1
n1=$(ls -A "$TMPDIR" | wc -l); [[ $n0 -eq $n1 ]] && ok "no temp files leak" || ko "temp leak" "$n0 -> $n1: $(ls -A "$TMPDIR")"
git -C "$C" rm -q --cached backend/TEST_GUIDE.md >/dev/null; git -C "$C" commit -qm untrack
echo x > "$C/backend/EXTRA.md"
sed -i 's|^/backend/TASK.md$|/backend/TASK.md\n/backend/EXTRA.md|' "$C/.git/info/exclude"; git -C "$C" add -f backend/EXTRA.md; git -C "$C" commit -qm extra; rm "$C/backend/EXTRA.md"
out=$("$W" commit gone backend/ 2>&1); rc=$?; [[ $rc -eq 0 ]] && ok "deleted unapproved client-tracked doc does not crash" || ko "deleted unapproved" "rc=$rc $out"
out=$("$W" status backend/ 2>&1); [[ $? -eq 0 ]] && ok "status survives it too" || ko "status deleted" "$out"
# review repo's own excludesFile is ignored
printf 'TASK.md\n' > "$S/gx"; git --git-dir="$R" config core.excludesFile "$S/gx"
echo t2 >> "$C/backend/TASK.md"; out=$("$W" commit t2 backend/TASK.md 2>&1); rc=$?
git --git-dir="$R" show HEAD:backend/TASK.md 2>/dev/null | grep -q t2 && ok "repo excludesFile does not skip docs" || ko "excludesFile" "rc=$rc $out"
git --git-dir="$R" config --unset core.excludesFile
# approved file that later matches .gitignore -> refuse, not freeze
echo 'TASK.md' > "$C/backend/.gitignore"
h=$(git --git-dir="$R" rev-parse HEAD); out=$("$W" commit frz backend/TASK.md 2>&1); rc=$?
[[ $rc -eq 2 && "$out" == *"now matches a .gitignore rule"* && "$(git --git-dir="$R" rev-parse HEAD)" == "$h" ]] && ok "approved-then-gitignored refuses" || ko "freeze" "rc=$rc $out"
rm "$C/backend/.gitignore"
# fsmonitor / pager in repo config never run
printf '#!/bin/sh\ntouch "%s/FSMON_RAN"\n' "$S" > "$S/fsmon.sh"; chmod +x "$S/fsmon.sh"; git --git-dir="$R" config core.fsmonitor "$S/fsmon.sh"
"$W" status backend/ >/dev/null 2>&1; [[ ! -e "$S/FSMON_RAN" ]] && ok "fsmonitor does not run" || ko "fsmonitor" "ran"
git --git-dir="$R" config --unset core.fsmonitor
# log validates paths even with no HEAD (fresh repo)
out=$(WF_HISTORY_DIR="$S/empty" "$W" init >/dev/null 2>&1; WF_HISTORY_DIR="$S/empty" "$W" log /etc/passwd 2>&1); [[ $? -eq 2 ]] && ok "log validates paths before HEAD check" || ko "log" "$out"

# ---------------------------------------------------------------- new in the shared adapter
setup "$SBX/c"
# Config, not location: the same copy serves a second project given only a different WF_PROJECT.
out=$("$W" init 2>&1); [[ $? -eq 0 && "$out" == *"already initialized"* ]] && ok "init is idempotent for the same project" || ko "init idempotent" "$out"
[[ -z "$(git --git-dir="$R" remote)" ]] && ok "the review repo has no remote" || ko "remote" "$(git --git-dir="$R" remote)"
# Two client checkouts with the same directory name would share the default history; the repo
# records its project and refuses another's.
mkdir -p "$SBX/c2/client" && git -C "$SBX/c2/client" init -q
out=$(WF_PROJECT="$SBX/c2/client" "$W" status backend/ 2>&1); rc=$?
[[ $rc -eq 2 && "$out" == *"belongs to"* ]] && ok "a history belonging to another project is refused" || ko "ownership" "rc=$rc $out"
out=$(WF_PROJECT="$SBX/c2/client" "$W" init 2>&1); rc=$?
[[ $rc -eq 2 && "$out" == *"belongs to"* ]] && ok "init refuses another project's history too" || ko "init ownership" "rc=$rc $out"
# The history may never live inside the project: its work tree is the client checkout.
out=$(WF_HISTORY_DIR="$C/.wf" "$W" init 2>&1); rc=$?
[[ $rc -eq 2 && ! -e "$C/.wf" ]] && ok "a history inside the project is refused" || ko "inside" "rc=$rc $out"
# --project / --history-dir flags work without the env.
out=$(env -u WF_PROJECT -u WF_HISTORY_DIR "$W" --project "$C" --history-dir "$H" log 2>&1); [[ $? -eq 0 ]] && ok "flags configure it without env" || ko "flags" "$out"

echo "== $pass passed, $fail failed"
[[ $fail -eq 0 ]]
