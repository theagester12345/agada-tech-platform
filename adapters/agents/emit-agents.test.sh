#!/usr/bin/env bash
# emit-agents.test.sh — the AGENTS.md emitter and the pre-commit hook that runs it, in a sandbox.
# Never touches a real project. Run: bash adapters/agents/emit-agents.test.sh
#
# The property under test (TASK-122): an emitted Binding is recognised by its marker, never by its
# name. An AGENTS.md without the marker is the project's own — never overwritten, never staged.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
E="$HERE/emit-agents.sh"
HOOK="$HERE/../../.githooks/pre-commit"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
ko(){ echo "FAIL $1${2:+ — $2}"; fail=$((fail+1)); }

SBX=$(mktemp -d); trap 'rm -rf "$SBX"' EXIT
P="$SBX/p"; mkdir -p "$P/backend" "$P/supabase/functions"
echo "# spine" > "$P/WORKFLOW.md"
echo "# backend persona" > "$P/backend/CLAUDE.md"

bash "$E" --target "$P" >/dev/null 2>&1
grep -q 'EMITTED Binding' "$P/AGENTS.md" && grep -q 'EMITTED Binding' "$P/backend/AGENTS.md" \
  && ok "a fresh tree emits the root and each side's Binding" || ko "fresh emit"
echo "# spine v2" > "$P/WORKFLOW.md"
bash "$E" --target "$P" --force >/dev/null 2>&1
grep -q 'spine v2' "$P/AGENTS.md" && ok "--force re-emits a marked Binding from its source" || ko "--force on a marked file"
listed=$(bash "$E" --target "$P" --force --list 2>/dev/null | sort | tr '\n' ' ')
[[ "$listed" == "AGENTS.md backend/AGENTS.md " ]] && ok "--list prints the emitted Bindings, one path per line, on stdout" || ko "--list" "$listed"

# The project's own AGENTS.md files: at the root, beside a side's CLAUDE.md, and deeper than either.
printf '# Lovable project rules\nkeep me\n' > "$P/AGENTS.md"
printf '# our backend rules\n' > "$P/backend/AGENTS.md"
printf '# edge function rules\n' > "$P/supabase/functions/AGENTS.md"
before=$(cd "$P" && md5sum AGENTS.md backend/AGENTS.md supabase/functions/AGENTS.md)
out=$(bash "$E" --target "$P" --force 2>&1); rc=$?
after=$(cd "$P" && md5sum AGENTS.md backend/AGENTS.md supabase/functions/AGENTS.md)
[[ "$before" == "$after" ]] && ok "--force leaves every unmarked AGENTS.md byte-identical" || ko "unmarked file overwritten" "$after"
[[ $rc -eq 0 ]] && ok "refusing the project's own file is not an error (the hook must not block its commit)" || ko "exit $rc"
grep -q "refuse AGENTS.md" <<<"$out" && grep -qi "project's own" <<<"$out" \
  && ok "the refusal names the file and says why" || ko "refusal message" "$out"
listed=$(bash "$E" --target "$P" --force --list 2>/dev/null)
[[ -z "$listed" ]] && ok "--list never names a file the project owns" || ko "--list named an unmarked file" "$listed"

# The hook, in a real repo: a commit that stages the project's own AGENTS.md commits it as written,
# and stages no emitted copy over it — nor any unmarked AGENTS.md the commit did not stage.
R="$SBX/r"; mkdir -p "$R/adapters/agents" "$R/.githooks" "$R/backend" "$R/frontend" "$R/docs"
cp "$E" "$R/adapters/agents/"; cp "$HOOK" "$R/.githooks/pre-commit"; chmod +x "$R/.githooks/pre-commit"
echo "# spine" > "$R/WORKFLOW.md"; echo "# be" > "$R/backend/CLAUDE.md"; echo "# fe" > "$R/frontend/CLAUDE.md"
printf '# client rules\n' > "$R/AGENTS.md"; printf '# docs rules\n' > "$R/docs/AGENTS.md"
bash "$R/adapters/agents/emit-agents.sh" --target "$R" >/dev/null 2>&1
G=(git -C "$R" -c user.name=t -c user.email=t@t -c core.hooksPath=.githooks)
"${G[@]}" init -q && "${G[@]}" add -A && "${G[@]}" commit -qm init >/dev/null 2>&1
printf '# client rules\nedited by the client\n' > "$R/AGENTS.md"
printf '# docs rules\nunstaged edit\n' > "$R/docs/AGENTS.md"
echo "# fe v2" > "$R/frontend/CLAUDE.md"
"${G[@]}" add AGENTS.md frontend/CLAUDE.md
if "${G[@]}" commit -qm "client edit" >/dev/null 2>&1; then
  [[ "$("${G[@]}" show HEAD:AGENTS.md)" == "$(printf '# client rules\nedited by the client')" ]] \
    && [[ "$(head -2 "$R/AGENTS.md")" == "$(printf '# client rules\nedited by the client')" ]] \
    && ok "hook: the project's own AGENTS.md is committed exactly as staged, and left as written" \
    || ko "hook replaced the project's AGENTS.md" "$("${G[@]}" show HEAD:AGENTS.md | head -2)"
  "${G[@]}" diff --quiet HEAD -- docs/AGENTS.md && ko "hook staged an unmarked AGENTS.md the commit never staged" \
    || ok "hook: an unmarked AGENTS.md the commit did not stage stays unstaged"
  "${G[@]}" show HEAD:frontend/AGENTS.md | grep -q 'fe v2' \
    && ok "hook: a marked Binding is still re-emitted and staged" || ko "hook did not re-emit frontend/AGENTS.md"
else
  ko "hook blocked a commit of the project's own AGENTS.md"
fi

# Two shapes the first hook version aborted on (TASK-122 review): a commit where the emit names
# nothing (every AGENTS.md is the project's own), and client-repo mode, where each Binding the emit
# names is excluded from the client repo and `git add` of it fails.
hook_repo() {  # $1 = dir; a repo with the adapter and hook, whose root AGENTS.md is its own
  mkdir -p "$1/adapters/agents" "$1/.githooks"
  cp "$E" "$1/adapters/agents/"; cp "$HOOK" "$1/.githooks/pre-commit"; chmod +x "$1/.githooks/pre-commit"
  echo "# spine" > "$1/WORKFLOW.md"; printf '# client rules\n' > "$1/AGENTS.md"
  git -C "$1" init -q
}
H=(-c user.name=t -c user.email=t@t -c core.hooksPath=.githooks)
N="$SBX/none"; hook_repo "$N"
git -C "$N" "${H[@]}" add -A && git -C "$N" "${H[@]}" commit -qm init >/dev/null 2>&1
echo "edit" >> "$N/AGENTS.md"; git -C "$N" add AGENTS.md
git -C "$N" "${H[@]}" commit -qm edit >/dev/null 2>&1 \
  && ok "hook: a commit is not blocked when the emit names no Binding" || ko "hook aborted on an empty emit list"
C="$SBX/client"; hook_repo "$C"; mkdir -p "$C/engineering"; echo "# eng" > "$C/engineering/CLAUDE.md"
git -C "$C" add AGENTS.md && git -C "$C" "${H[@]}" commit -qm client --no-verify >/dev/null 2>&1
printf '/engineering/\n/WORKFLOW.md\n/adapters/\n/.githooks/\n' >> "$C/.git/info/exclude"
bash "$C/adapters/agents/emit-agents.sh" --target "$C" >/dev/null 2>&1
echo "edit" >> "$C/AGENTS.md"; git -C "$C" add AGENTS.md
if git -C "$C" "${H[@]}" commit -qm edit >/dev/null 2>&1; then
  [ -z "$(git -C "$C" ls-files engineering)" ] \
    && ok "hook, client-repo mode: the client's AGENTS.md commits, and no private Binding is staged" \
    || ko "hook staged a private Binding into the client repo"
else
  ko "hook, client-repo mode: blocked a commit of the client's own AGENTS.md"
fi

echo "== $pass passed, $fail failed"
[ "$fail" -eq 0 ]
