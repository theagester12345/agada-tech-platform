// task-cost-claude-code.test.js — the per-task cost reader, on a fake log folder and a tiny git repo
// built in a temp dir. Never reads the real ~/.claude.
// Run: node --test adapters/measure/task-cost-claude-code.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "task-cost-claude-code.js");
const { slugFor } = require(SCRIPT);

// One session, in order:
//   10:00–10:03  four calls (one message repeated, one subagent call), then `git commit` → closes TASK-001
//   12:30        a call after 2.5 h idle (a cold restart), then `git commit` → closes TASK-002
//   12:40        `git commit` that closes no card → it does not end a window; its call goes on to TASK-003
//   12:50–12:59  two calls, no commit call; a commit at 13:00:30 closes TASK-003 → matched by time alone
//   13:10        one more call → open (not yet approved)
const day = "2026-10-01T";
const call = (id, t, u, extra = {}) => ({
  type: "assistant", timestamp: day + t + "Z", cwd: "PROJECT", sessionId: "s1", isSidechain: false,
  message: { id, model: "claude-test", usage: {
    input_tokens: u.inp || 0, cache_read_input_tokens: u.cr || 0, output_tokens: u.out || 0,
    cache_creation_input_tokens: (u.w5 || 0) + (u.w1 || 0),
    cache_creation: { ephemeral_5m_input_tokens: u.w5 || 0, ephemeral_1h_input_tokens: u.w1 || 0 } },
    content: extra.cmd ? [{ type: "tool_use", name: "Bash", input: { command: extra.cmd } }] : [{ type: "text", text: "…" }] },
  ...(extra.sidechain ? { isSidechain: true } : {}),
});
const MAIN = [
  { type: "user", timestamp: day + "09:59:59Z", cwd: "PROJECT", sessionId: "s1", message: { content: "build 001" } },
  call("a1", "10:00:00", { inp: 10, w1: 1000, out: 50 }),
  call("a2", "10:01:00", { inp: 5, cr: 1000, out: 20 }),
  call("a2", "10:01:00", { inp: 5, cr: 1000, out: 20 }),                       // same message twice
  call("a3", "10:03:00", { inp: 1, cr: 1100, out: 5 }, { cmd: "git add -A && git commit -q -m 'x'" }),
  call("b1", "12:30:00", { inp: 2, w1: 1200, out: 30 }),                       // cold restart
  call("b2", "12:31:00", { inp: 1, cr: 1200, out: 5 }, { cmd: "git commit -q -m \"y\"" }),
  call("c1", "12:40:00", { inp: 1, cr: 1300, out: 5 }, { cmd: "git -C . commit -m docs" }),
  call("d1", "12:50:00", { inp: 1, cr: 1400, out: 5 }),
  call("e1", "12:59:00", { inp: 1, cr: 1500, out: 5 }),
  call("f1", "13:10:00", { inp: 1, cr: 1600, out: 5 }),
];
const SUB = [call("s1", "10:02:00", { inp: 3, cr: 500, out: 10 }, { sidechain: true })];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taskcost-"));
  const project = path.join(root, "proj.x");
  fs.mkdirSync(project);
  const git = (args, env = {}) => execFileSync("git", ["-C", project, ...args],
    { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e", ...env } });
  const board = (s1, s2, s3) => `# Board\n\n### TASK-001: one\n**Status:** ${s1}  \n\n### TASK-002: two\n**Status:** ${s2}  \n\n### TASK-003: three\n**Status:** ${s3}  \n`;
  const commit = (t, msg) => { git(["add", "-A"]); git(["commit", "-qm", msg], { GIT_AUTHOR_DATE: day + t + "Z", GIT_COMMITTER_DATE: day + t + "Z" }); };
  git(["init", "-q"]);
  fs.writeFileSync(path.join(project, "TASK.md"), board("IN_PROGRESS", "TODO", "TODO")); commit("09:00:00", "start");
  fs.writeFileSync(path.join(project, "TASK.md"), board("COMPLETED", "IN_PROGRESS", "TODO")); commit("10:03:30", "x");
  fs.writeFileSync(path.join(project, "TASK.md"), board("COMPLETED", "COMPLETED", "IN_PROGRESS")); commit("12:31:20", "y");
  fs.writeFileSync(path.join(project, "README.md"), "docs\n"); commit("12:40:10", "docs");
  fs.writeFileSync(path.join(project, "TASK.md"), board("COMPLETED", "COMPLETED", "COMPLETED")); commit("13:00:30", "z");
  const logs = path.join(root, "projects");
  const sess = path.join(logs, slugFor(project));
  fs.mkdirSync(path.join(sess, "s1", "subagents"), { recursive: true });
  const jsonl = (recs) => recs.map((r) => JSON.stringify(r).replace(/"PROJECT"/g, JSON.stringify(project))).join("\n") + "\n";
  fs.writeFileSync(path.join(sess, "s1.jsonl"), jsonl(MAIN));
  fs.writeFileSync(path.join(sess, "s1", "subagents", "agent-1.jsonl"), jsonl(SUB));
  return { root, project, logs };
}
const snap = (dir) => execFileSync("bash", ["-c", `cd "${dir}" && find . -type f -print0 | sort -z | xargs -0 md5sum | md5sum`]).toString();
function run(f, ...args) {
  const r = spawnSync(process.execPath, [SCRIPT, "--project", f.project, "--logs", f.logs, ...args], { encoding: "utf8" });
  return r;
}
const json = (f) => { const r = run(f, "--json"); assert.strictEqual(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const task = (q, id) => q.tasks.find((t) => t.id === id);

test("the project's log folder is named the way Claude Code names it", () => {
  assert.strictEqual(slugFor("/home/a/work/proj.x"), "-home-a-work-proj-x");
  // Every character that is not a letter, digit or `-` becomes `-` (seen on real logs: a project
  // folder "Budget & Finances" is logged under "...-Budget---Finances").
  assert.strictEqual(slugFor("/home/a/Personal/Budget & Finances"), "-home-a-Personal-Budget---Finances");
});

test("per-task tokens by kind: a repeated message counted once, the subagent's call included", () => {
  const f = fixture();
  try {
    const t = task(json(f), "TASK-001");
    assert.deepStrictEqual(t.tokens, { input: 19, write5m: 0, write1h: 1000, read: 2600, output: 85 });
    assert.strictEqual(t.calls, 4);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("average context and cold restarts are read from the main thread", () => {
  const f = fixture();
  try {
    const q = json(f);
    assert.strictEqual(task(q, "TASK-001").avgContext, 1039);   // (1010 + 1005 + 1101) / 3; the subagent's 503 is not the session's context
    assert.strictEqual(task(q, "TASK-001").coldRestarts, 0);
    assert.strictEqual(task(q, "TASK-002").coldRestarts, 1);    // b1, after 2.5 h idle
    assert.deepStrictEqual(task(q, "TASK-002").tokens, { input: 3, write5m: 0, write1h: 1200, read: 1200, output: 35 });
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("confidence: high from a commit call in the session, low when matched by time alone", () => {
  const f = fixture();
  try {
    const q = json(f);
    assert.strictEqual(task(q, "TASK-001").confidence, "high");
    assert.strictEqual(task(q, "TASK-002").confidence, "high");
    assert.strictEqual(task(q, "TASK-003").confidence, "low");
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("a commit that closed no card does not end a window: its calls go to the next close, and are counted", () => {
  const f = fixture();
  try {
    const q = json(f);
    assert.strictEqual(task(q, "TASK-003").calls, 3);          // c1, d1, e1
    assert.strictEqual(task(q, "TASK-003").otherCommits, 1);   // c1's commit closed nothing
    assert.strictEqual(task(q, "TASK-001").otherCommits, 0);
    assert.strictEqual(q.open.calls, 1);                       // f1, after the last close
    assert.strictEqual(q.approximate, true);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("the report says it is approximate and states the rule", () => {
  const f = fixture();
  try {
    const r = run(f);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /approximate/i);
    assert.match(r.stdout, /TASK-001/);
    assert.match(r.stdout, /up to and including the commit/);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("read-only: the log folder and the git repo are unchanged after a run", () => {
  const f = fixture();
  try {
    const before = [snap(f.logs), snap(f.project)];
    run(f, "--json"); run(f);
    assert.deepStrictEqual([snap(f.logs), snap(f.project)], before);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("two sessions near one closing commit: the nearest commit call takes it, whichever is read first", () => {
  const f = fixture();
  try {
    // A second session, named to be read first, runs an unrelated `git -c … commit` 90 s before
    // the commit that closed TASK-001; the real session's commit call is 30 s before it.
    const sess = path.join(f.logs, slugFor(f.project));
    const decoy = [call("z1", "10:01:30", { inp: 1, cr: 100, out: 1 }, { cmd: "git -c core.hooksPath=/dev/null commit -q -m 'wip snapshot'" })]
      .map((r) => ({ ...r, sessionId: "a0" }));
    fs.writeFileSync(path.join(sess, "a0.jsonl"), decoy.map((r) => JSON.stringify(r).replace(/"PROJECT"/g, JSON.stringify(f.project))).join("\n") + "\n");
    const q = json(f);
    assert.strictEqual(task(q, "TASK-001").confidence, "high");
    assert.strictEqual(task(q, "TASK-001").calls, 4, "TASK-001 keeps the real session's calls");
    assert.strictEqual(q.open.calls, 2, "the decoy's commit closed no card and nothing closes after it, so its call is open (with f1)");
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
