#!/usr/bin/env bash
# emit-skills.test.sh — the skills emitter, in a sandbox. Never touches a real project.
# Run: bash adapters/skills/emit-skills.test.sh
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
E="$HERE/emit-skills.sh"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
ko(){ echo "FAIL $1${2:+ — $2}"; fail=$((fail+1)); }

SBX=$(mktemp -d); trap 'rm -rf "$SBX"' EXIT
P="$SBX/p"; mkdir -p "$P/skills/demo" "$P/skills/other"
cat > "$P/skills/demo/SKILL.md" <<'MD'
---
name: demo
description: 'Use when demonstrating: a trigger.'
---

# Demo

See [the spine](../../WORKFLOW.md#a-section) and [a sibling](./notes.md).
MD
printf -- '---\nname: other\ndescription: '"'"'Use for the other thing.'"'"'\n---\n\n# Other\n' > "$P/skills/other/SKILL.md"
touch "$P/WORKFLOW.md"

bash "$E" --target "$P" >/dev/null 2>&1
D="$P/.claude/skills/demo/SKILL.md"
[[ -f "$D" && -f "$P/.claude/skills/other/SKILL.md" ]] && ok "one SKILL.md per source, under .claude/skills/<name>/" || ko "emitted files" "$(find "$P/.claude" 2>/dev/null)"
[[ "$(head -4 "$D")" == "$(head -4 "$P/skills/demo/SKILL.md")" ]] && ok "frontmatter first and unchanged (the host reads name + description from it)" || ko "frontmatter" "$(head -5 "$D")"
grep -q 'Generated from skills/demo/SKILL.md' "$D" && ok "says it is generated, and from which source" || ko "generated note"
grep -q '](../../../WORKFLOW.md#a-section)' "$D" && ok "a link to the project root still resolves from one level deeper" || ko "root link" "$(grep WORKFLOW "$D")"
grep -q '](./notes.md)' "$D" && ok "a link inside the skill's own folder is left alone" || ko "sibling link"
[[ -e "$(dirname "$D")/$(grep -o '](../../../WORKFLOW.md' "$D" | sed 's/](//')" ]] && ok "the rewritten link points at a real file" || ko "link target"

before=$(cat "$D"); echo "hand edit" >> "$D"
bash "$E" --target "$P" >/dev/null 2>&1
grep -q 'hand edit' "$D" && ok "without --force an existing copy is kept" || ko "no-force overwrite"
bash "$E" --target "$P" --force >/dev/null 2>&1
[[ "$(cat "$D")" == "$before" ]] && ok "--force regenerates it from the source" || ko "--force"
bash "$E" --target "$P" --force >/dev/null 2>&1
[[ "$(cat "$D")" == "$before" ]] && ok "idempotent: a second --force changes nothing" || ko "idempotent"

rm -r "$P/skills/other"
bash "$E" --target "$P" --force >/dev/null 2>&1
[[ ! -e "$P/.claude/skills/other" ]] && ok "--force removes a generated copy whose source is gone" || ko "stale copy kept"
mkdir -p "$P/.claude/skills/mine"; echo "# my own skill" > "$P/.claude/skills/mine/SKILL.md"
bash "$E" --target "$P" --force >/dev/null 2>&1
[[ -f "$P/.claude/skills/mine/SKILL.md" ]] && ok "a skill the project wrote itself is never touched" || ko "foreign skill removed"

printf -- '---\nname: Bad Name\ndescription: x\n---\n' > "$P/skills/demo/SKILL.md"
bash "$E" --target "$P" --force >/dev/null 2>&1 && ko "a name the standard forbids is accepted" || ok "a name the standard forbids is refused"
printf -- '---\nname: wrong\ndescription: x\n---\n' > "$P/skills/demo/SKILL.md"
bash "$E" --target "$P" --force >/dev/null 2>&1 && ko "name ≠ folder accepted" || ok "a name that differs from its folder is refused"
printf -- '# no frontmatter\n' > "$P/skills/demo/SKILL.md"
bash "$E" --target "$P" --force >/dev/null 2>&1 && ko "missing frontmatter accepted" || ok "a source without name/description frontmatter is refused"

E2="$SBX/empty"; mkdir -p "$E2"
bash "$E" --target "$E2" >/dev/null 2>&1 && [[ ! -e "$E2/.claude" ]] && ok "no skills/ → nothing written, exit 0" || ko "empty project"

echo "== $pass passed, $fail failed"
[[ $fail -eq 0 ]]
