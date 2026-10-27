#!/usr/bin/env bash
# Tests for diff-open.sh, in a throwaway sandbox (never touches a real project).
# A fake editor binary and a stub difftool record what they were asked to open.
# Run after any change to diff-open.sh:  bash diff-open.test.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SBX="$(mktemp -d)"; trap 'rm -rf "$SBX"' EXIT
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }; ko(){ echo "FAIL $1 :: $2"; fail=$((fail+1)); }
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL="$SBX/gitconfig"; : > "$GIT_CONFIG_GLOBAL"
export TMPDIR="$SBX/tmp"; mkdir -p "$TMPDIR"
unset DIFF_OPENER DIFF_EDITOR_BIN

# The script is copied somewhere unrelated: nothing may be derived from where it sits.
mkdir -p "$SBX/tool"; cp "$HERE/diff-open.sh" "$SBX/tool/diff-open.sh"; D="$SBX/tool/diff-open.sh"

P="$SBX/proj"; mkdir -p "$P/src"
( cd "$P" && git init -q && echo 'a v1' > src/a.txt && echo b > b.txt && echo c > c.txt && git add -A && git commit -qm one )
REV1=$(git -C "$P" rev-parse HEAD)
( cd "$P" && echo 'a v2' > src/a.txt && git commit -qam two )
echo 'a v3 working' > "$P/src/a.txt"     # modified since HEAD
echo 'brand new' > "$P/new.txt"          # untracked, new
rm "$P/c.txt"                            # deleted
INDEX_BEFORE=$(git -C "$P" ls-files -s | md5sum); HEAD_BEFORE=$(git -C "$P" rev-parse HEAD)

# fake VS Code-family binary: records each invocation's arguments, one line each
cat > "$SBX/fake-code" <<EOF
#!/bin/sh
( IFS='|'; printf '%s\n' "\$*" ) >> "$SBX/code.log"
EOF
# the base and the working file are always the LAST two arguments, whatever flags precede them
base_of(){ awk -F'|' '{print $(NF-1)}'; }
right_of(){ awk -F'|' '{print $NF}'; }
chmod +x "$SBX/fake-code"

# ---------------------------------------------------------------- vscode opener
out=$(bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" src/a.txt new.txt c.txt b.txt 2>&1); rc=$?
[[ $rc -eq 0 ]] && ok "vscode run exits 0" || ko "vscode exit" "rc=$rc $out"
n=$(wc -l < "$SBX/code.log" 2>/dev/null || echo 0)
[[ "$n" -eq 2 ]] && ok "one diff tab per changed file (2), none for unchanged or deleted" || ko "tab count" "$n: $(cat "$SBX/code.log" 2>/dev/null)"
line_a=$(grep "|$P/src/a.txt$" "$SBX/code.log" || true)
[[ "$line_a" == --wait\|--diff\|* ]] && ok "invoked as <bin> --wait --diff <base> <file> — one at a time, blocking" || ko "--wait --diff form" "$line_a"
base_a=$(printf '%s' "$line_a" | base_of)
[[ -f "$base_a" && "$(cat "$base_a")" == "a v2" ]] && ok "left side is the base (HEAD) version" || ko "base content" "$base_a: $(cat "$base_a" 2>/dev/null)"
right_a=$(printf '%s' "$line_a" | right_of)
[[ "$right_a" == "$P/src/a.txt" ]] && ok "right side is the real working file" || ko "right side" "$right_a"
echo "typed in the diff" >> "$right_a"
grep -q "typed in the diff" "$P/src/a.txt" && ok "a write to the right side lands in the real file" || ko "write-through" "not in $P/src/a.txt"
line_n=$(grep "|$P/new.txt$" "$SBX/code.log" || true)
base_n=$(printf '%s' "$line_n" | base_of)
[[ -n "$line_n" && -f "$base_n" && ! -s "$base_n" ]] && ok "a new file diffs against empty" || ko "new file" "$line_n"
[[ "$out" == *"deleted: c.txt"* ]] && ok "a deleted file is listed, not opened" || ko "deleted" "$out"
[[ "$out" != *"b.txt"* || "$out" == *"unchanged: b.txt"* ]] && ok "an unchanged file opens nothing" || ko "unchanged" "$out"

# ---------------------------------------------------------------- --base <rev> (a revision, or a snapshot)
: > "$SBX/code.log"
bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" --base "$REV1" src/a.txt >/dev/null 2>&1
base_r=$(head -1 "$SBX/code.log" | base_of)
[[ "$(cat "$base_r" 2>/dev/null)" == "a v1" ]] && ok "--base <rev> diffs against that revision" || ko "--base rev" "$(cat "$base_r" 2>/dev/null)"
SNAP=$(git -C "$P" stash create)   # a snapshot is a revision too
: > "$SBX/code.log"
echo "review fix" >> "$P/src/a.txt"
bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" --base "$SNAP" src/a.txt >/dev/null 2>&1
base_s=$(head -1 "$SBX/code.log" | base_of)
grep -q "typed in the diff" "$base_s" 2>/dev/null && ! grep -q "review fix" "$base_s" \
  && ok "a 'git stash create' snapshot works as the base: snapshot → now shows only what changed since" || ko "snapshot base" "$(cat "$base_s" 2>/dev/null)"

# ---------------------------------------------------------------- --base-dir (what wf-git passes)
mkdir -p "$SBX/approved/src"; echo "approved a" > "$SBX/approved/src/a.txt"
: > "$SBX/code.log"
bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" --base-dir "$SBX/approved" src/a.txt new.txt >/dev/null 2>&1
grep -q "|$SBX/approved/src/a.txt|$P/src/a.txt$" "$SBX/code.log" && ok "--base-dir uses the copy laid out there as the left side" || ko "--base-dir" "$(cat "$SBX/code.log")"
base_nd=$(grep "|$P/new.txt" "$SBX/code.log" | base_of)
[[ -n "$base_nd" && ! -s "$base_nd" ]] && ok "--base-dir: a file absent from the dir is new (empty base)" || ko "--base-dir new" "$base_nd"

# ---------------------------------------------------------------- difftool opener (portable default)
cat > "$GIT_CONFIG_GLOBAL" <<EOF
[diff]
	tool = stub
[difftool "stub"]
	cmd = echo \"\$LOCAL|\$REMOTE\" >> $SBX/difftool.log
EOF
out=$(bash "$D" --project "$P" src/a.txt new.txt b.txt 2>&1)
n=$(wc -l < "$SBX/difftool.log" 2>/dev/null || echo 0)
[[ "$n" -eq 2 ]] && ok "difftool is the default and opens one changed file at a time (2 calls)" || ko "difftool calls" "$n: $out"
right_d=$(grep "new.txt" "$SBX/difftool.log" | cut -d'|' -f2)
[[ "$right_d" == "$P/new.txt" ]] && ok "difftool's right side is the real working file" || ko "difftool right" "$right_d"
: > "$GIT_CONFIG_GLOBAL"

# ---------------------------------------------------------------- one at a time (TASK-095)
# Opening every diff as tabs at once flooded the editor. Both modes now open one diff, wait for it
# to close, then open the next; all at once is an explicit flag, never a mode a project drifts into.
[[ "$(grep -c '^--wait|--diff|' "$SBX/code.log" 2>/dev/null || echo 0)" -ge 1 && "$(grep -vc '^--wait|' "$SBX/code.log" || true)" -eq 0 ]] \
  && ok "vscode mode: every call waits (--wait), so diffs open one at a time" || ko "sequential" "$(cat "$SBX/code.log")"
: > "$SBX/code.log"
out=$(bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" --all-at-once src/a.txt new.txt 2>&1)
[[ "$(wc -l < "$SBX/code.log")" -eq 2 && "$(grep -c '^--wait' "$SBX/code.log" || true)" -eq 0 && "$(grep -c '^--diff|' "$SBX/code.log")" -eq 2 ]] \
  && ok "--all-at-once restores the non-blocking tabs, as an explicit request" || ko "--all-at-once" "$(cat "$SBX/code.log")"
[[ "$out" != *"collect or approve"* ]] && ok "--all-at-once does not claim the review is over (the tabs are still open)" || ko "all-at-once prompt" "$out"
out=$(bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" src/a.txt 2>&1)
[[ "$out" == *"collect or approve?"* ]] && ok "when the last diff closes, it says: collect or approve?" || ko "prompt" "$out"
out=$(bash "$D" --project "$P" --opener vscode --editor-bin "$SBX/fake-code" b.txt 2>&1)
[[ "$out" != *"collect or approve"* ]] && ok "with nothing opened, there is nothing to answer" || ko "prompt when none" "$out"

# ---------------------------------------------------------------- env defaults, refusals, side effects
: > "$SBX/code.log"
DIFF_OPENER=vscode DIFF_EDITOR_BIN="$SBX/fake-code" bash "$D" --project "$P" new.txt >/dev/null 2>&1
grep -q "new.txt" "$SBX/code.log" && ok "DIFF_OPENER / DIFF_EDITOR_BIN configure it without flags" || ko "env config" "$(cat "$SBX/code.log")"
bash "$D" --project "$P" ../outside.txt >/dev/null 2>&1; [[ $? -eq 2 ]] && ok "a '..' path is refused" || ko "dotdot" "not refused"
bash "$D" --project "$P" /etc/passwd >/dev/null 2>&1; [[ $? -eq 2 ]] && ok "a path outside the project is refused" || ko "outside" "not refused"
bash "$D" --project "$P" --opener nope new.txt >/dev/null 2>&1; [[ $? -eq 2 ]] && ok "an unknown opener is refused" || ko "opener" "not refused"
[[ "$(git -C "$P" ls-files -s | md5sum)" == "$INDEX_BEFORE" && "$(git -C "$P" rev-parse HEAD)" == "$HEAD_BEFORE" ]] \
  && ok "nothing staged, nothing committed" || ko "side effects" "index or HEAD moved"

echo "== $pass passed, $fail failed"
[[ $fail -eq 0 ]]
