// archive-tasks.test.js — the archiving script, in a temp dir. Never touches a real board.
// Run: node --test adapters/consolidate/archive-tasks.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "archive-tasks.js");
const { sourceTasks } = require(path.join(__dirname, "..", "plane", "sync-plane.js"));

const card = (n, status, date) => `### TASK-${n}: Card ${n}
**Status:** ${status}  
${date ? `**Completed:** ${date}  \n` : ""}**Priority:** Normal  
**Category:** Template  
**Depends On:** None

**Description:** body of card ${n}.
- [x] a criterion, with \`code\` and a [link](./x.md).
`;

// Five completed cards, newest first as the finishing sequence files them, one TODO, one
// IN_PROGRESS, and the footer every TASK.md carries.
const BOARD = [
  "# Board\n\n## TODO\n\n", card("007", "TODO"),
  "\n## IN_PROGRESS\n\n", card("006", "IN_PROGRESS"),
  "\n## COMPLETED\n\n",
  card("005", "COMPLETED", "2026-10-05"), "\n",
  card("004", "COMPLETED", "2026-10-04"), "\n",
  card("003", "COMPLETED", "2026-10-03"), "\n",
  card("002", "COMPLETED", "2026-10-02"), "\n",
  card("001", "COMPLETED"),
  "\n---\n\n_Last Updated: 2026-10-05 (x)_\n",
].join("");

function sandbox(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
  const t = path.join(dir, "TASK.md");
  fs.writeFileSync(t, BOARD);
  try { return fn(t, path.join(dir, "TASK_ARCHIVE.md")); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const ids = (f) => (fs.readFileSync(f, "utf8").match(/^### (TASK-\d+)/gm) || []).map((h) => h.slice(4));
const mirror = (t) => Object.fromEntries(sourceTasks(t).map((x) => [x.id, [x.block.trimEnd(), x.status]]));

test("keeps the N most recent completed cards; moves the rest, newest first", () => {
  sandbox((t, a) => {
    const r = run("--tasks", t, "--keep", "2");
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(ids(t), ["TASK-007", "TASK-006", "TASK-005", "TASK-004"]);
    assert.deepStrictEqual(ids(a), ["TASK-003", "TASK-002", "TASK-001"]);
  });
});

test("open work never moves, whatever the window", () => {
  sandbox((t) => {
    run("--tasks", t, "--keep", "0");
    assert.deepStrictEqual(ids(t), ["TASK-007", "TASK-006"]);
  });
});

test("the sync sees exactly the same cards, byte for byte, before and after", () => {
  sandbox((t) => {
    const before = mirror(t);
    run("--tasks", t, "--keep", "2");
    assert.deepStrictEqual(mirror(t), before);
  });
});

test("the board keeps its sections and its footer", () => {
  sandbox((t) => {
    run("--tasks", t, "--keep", "1");
    const s = fs.readFileSync(t, "utf8");
    for (const h of ["## TODO", "## IN_PROGRESS", "## COMPLETED"]) assert.ok(s.includes(`\n${h}\n`), h);
    assert.match(s, /\n---\n\n_Last Updated: 2026-10-05 \(x\)_\n$/);
    assert.doesNotMatch(s, /\n\n\n/);
  });
});

test("idempotent: a second run moves nothing and changes no byte", () => {
  sandbox((t, a) => {
    run("--tasks", t, "--keep", "2");
    const [bt, ba] = [fs.readFileSync(t, "utf8"), fs.readFileSync(a, "utf8")];
    const r = run("--tasks", t, "--keep", "2");
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /nothing to archive/i);
    assert.strictEqual(fs.readFileSync(t, "utf8"), bt);
    assert.strictEqual(fs.readFileSync(a, "utf8"), ba);
  });
});

test("a later run puts newly archived cards above the older ones", () => {
  sandbox((t, a) => {
    run("--tasks", t, "--keep", "3");
    run("--tasks", t, "--keep", "1");
    assert.deepStrictEqual(ids(a), ["TASK-004", "TASK-003", "TASK-002", "TASK-001"]);
  });
});

test("--dry-run lists what would move and writes nothing", () => {
  sandbox((t, a) => {
    const r = run("--tasks", t, "--keep", "3", "--dry-run");
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /TASK-002/);
    assert.match(r.stdout, /TASK-001/);
    assert.strictEqual(fs.readFileSync(t, "utf8"), BOARD);
    assert.ok(!fs.existsSync(a));
  });
});

test("an id already in the archive is refused, and nothing is written", () => {
  sandbox((t, a) => {
    fs.writeFileSync(a, `# Task archive\n\n## COMPLETED\n\n${card("002", "COMPLETED", "2026-10-02")}`);
    const r = run("--tasks", t, "--keep", "2");
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /TASK-002/);
    assert.strictEqual(fs.readFileSync(t, "utf8"), BOARD);
  });
});

test("--keep defaults to 10 and must be a whole number", () => {
  sandbox((t) => {
    assert.match(run("--tasks", t, "--dry-run").stdout, /nothing to archive/i);
    assert.notStrictEqual(run("--tasks", t, "--keep", "x").status, 0);
  });
});

test("a completed card moves wherever it sits, under any heading; open cards beside it stay", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
  const t = path.join(dir, "TASK.md");
  const board = `# Board\n\n## 📋 TODO\n\n${card("004", "TODO")}\n${card("003", "COMPLETED", "2026-10-01")}\n## ✅ COMPLETED\n\n${card("002", "COMPLETED", "2026-10-09")}\n${card("001", "COMPLETED", "2026-10-02")}`;
  fs.writeFileSync(t, board);
  try {
    const before = mirror(t);
    assert.strictEqual(run("--tasks", t, "--keep", "1").status, 0);
    assert.deepStrictEqual(ids(t), ["TASK-004", "TASK-002"]);
    assert.deepStrictEqual(ids(path.join(dir, "TASK_ARCHIVE.md")), ["TASK-001", "TASK-003"]);
    assert.deepStrictEqual(mirror(t), before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a kept card's own blank lines are never touched", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-"));
  const t = path.join(dir, "TASK.md");
  // A kept card ending in two blank lines and a rule before the next section — the shape
  // that a file-wide blank-line squeeze silently rewrote on a real board.
  const board = `# Board\n\n## COMPLETED\n\n${card("002", "COMPLETED", "2026-10-09")}\n\n---\n## Later\n\n${card("001", "COMPLETED", "2026-10-02")}`;
  fs.writeFileSync(t, board);
  try {
    const before = mirror(t);
    run("--tasks", t, "--keep", "1");
    assert.strictEqual(mirror(t)["TASK-002"][0], before["TASK-002"][0]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
