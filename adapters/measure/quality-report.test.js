// quality-report.test.js — the quality report, on a fixture board and archive in a temp dir.
// Run: node --test adapters/measure/quality-report.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "quality-report.js");
const { sourceTasks } = require(path.join(__dirname, "..", "plane", "sync-plane.js"));

const card = (n, status, extra = "") => `### TASK-${n}: Card ${n}
**Status:** ${status}
**Priority:** Normal
**Category:** Template
**Depends On:** None
${extra}
**Description:** body of card ${n}.
- [x] a criterion.
`;

// The board holds open work and recent closed cards; the archive holds older ones. Every
// signal has a card on each side of the split, so a report that reads only TASK.md fails.
const BOARD = [
  "# Board\n\n## TODO\n\n",
  card("010", "TODO", "**Source:** fixes TASK-001  \n"),                        // escape from an archived card
  "\n## IN_PROGRESS\n\n",
  card("009", "IN_PROGRESS", "**Review:** PENDING (high)  \n**Questions:** PENDING  \n"),
  "\n## COMPLETED\n\n",
  card("008", "COMPLETED", "**Source:** fixes TASK-005, FEATURE-002  \n**Questions:** collected 3  \n**Review:** self-review (high) — 2 material / 1 advisory, 3 rounds  \n"),
  "\n",
  card("007", "COMPLETED", "**Source:** TASK-006  \n**Actor:** `human`  \n**Review:** human approval of the verification  \n"), // a verification task, not an escape
  "\n",
  card("006", "COMPLETED", "**Questions:** none  \n**Review:** fallback (medium) — none, 1 round  \n"),
  "\n---\n\n_Last Updated: 2026-10-18 (x)_\n",
].join("");

const ARCHIVE = [
  "# Task archive\n\n## COMPLETED\n\n",
  card("005", "COMPLETED", "**Questions:** collected 1  \n**Review:** self-review (medium) — 0 material / 4 advisory, 1 round  \n"),
  "\n",
  card("004", "COMPLETED", "**Source:** fixes TASK-099  \n**Review:** self-review (medium)  \n"),   // old stamp, no tail; names a card nobody has
  "\n",
  card("003", "COMPLETED", "**Source:** fixes TASK-010  \n"),                    // names an OPEN card: not an escape
  "\n",
  card("001", "COMPLETED", "**Review:** self-review (high) — 1 material / 0 advisory, 2 rounds  \n"),
].join("");

function sandbox(fn, { archive = ARCHIVE } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-"));
  const t = path.join(dir, "TASK.md");
  fs.writeFileSync(t, BOARD);
  if (archive !== null) fs.writeFileSync(path.join(dir, "TASK_ARCHIVE.md"), archive);
  try { return fn(t, dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const json = (t) => {
  const r = run("--tasks", t, "--json");
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

test("reads the board and its archive as one: every card the sync sees, the report sees", () => {
  sandbox((t) => {
    const q = json(t);
    const seen = q.cards.map((c) => c.id).sort();
    const synced = sourceTasks(t).map((x) => x.id).sort();
    assert.deepStrictEqual(seen, synced);
    assert.strictEqual(q.closed, 7, "seven COMPLETED cards across the two files");
  });
});

test("review findings: material and advisory summed over cards that recorded the tail", () => {
  sandbox((t) => {
    const r = json(t).review;
    assert.deepStrictEqual(
      { recorded: r.recorded, material: r.material, advisory: r.advisory },
      { recorded: 4, material: 3, advisory: 5 },
      "TASK-008 (2/1), TASK-006 (none), TASK-005 (0/4), TASK-001 (1/0); TASK-004's old stamp and TASK-007's human approval are not recorded",
    );
    assert.strictEqual(r.materialPerTask, 0.75);
  });
});

test("`none` is a real result: zero findings, and the card counts as recorded", () => {
  sandbox((t) => {
    const c = json(t).cards.find((x) => x.id === "TASK-006");
    assert.deepStrictEqual(c.review, { material: 0, advisory: 0, rounds: 1 });
  });
});

test("review rounds: total, per task, and which cards took more than one", () => {
  sandbox((t) => {
    const r = json(t).review;
    assert.strictEqual(r.rounds, 7);
    assert.strictEqual(r.roundsPerTask, 1.75);
    assert.deepStrictEqual(r.multiRound, ["TASK-008", "TASK-001"]);
  });
});

test("questions: `collected n` counts n, `none` counts zero, PENDING and absent are not recorded", () => {
  sandbox((t) => {
    const q = json(t).questions;
    assert.deepStrictEqual({ recorded: q.recorded, total: q.total }, { recorded: 3, total: 4 });
  });
});

test("escapes: a card whose Source says `fixes` a closed card, wherever either one sits", () => {
  sandbox((t) => {
    const e = json(t).escapes;
    // In file order of the fixing card: the board, then the archive.
    assert.deepStrictEqual(e.list, [
      { escaped: "TASK-001", fixedBy: "TASK-010" },
      { escaped: "TASK-005", fixedBy: "TASK-008" },
    ]);
    assert.strictEqual(e.escapedCards, 2);
  });
});

test("a plain `Source: TASK-n` (a verification task) is not an escape", () => {
  sandbox((t) => {
    assert.ok(!json(t).escapes.list.some((x) => x.escaped === "TASK-006"));
  });
});

test("`fixes` naming an open card or an unknown id is reported, never counted", () => {
  sandbox((t) => {
    const e = json(t).escapes;
    assert.deepStrictEqual(e.notCounted, [
      { fixedBy: "TASK-004", names: "TASK-099", why: "not on the board or in the archive" },
      { fixedBy: "TASK-003", names: "TASK-010", why: "not closed" },
    ]);
  });
});

test("no archive is fine: the board alone is the source", () => {
  sandbox((t) => {
    const q = json(t);
    assert.strictEqual(q.closed, 3);
    assert.strictEqual(q.review.recorded, 2);
  }, { archive: null });
});

test("a board with no cards is an error, not an empty report", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quality-"));
  const t = path.join(dir, "TASK.md");
  fs.writeFileSync(t, "# Board\n\n## TODO\n");
  try {
    const r = run("--tasks", t);
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /no cards/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the default report names each signal and its coverage", () => {
  sandbox((t) => {
    const r = run("--tasks", t);
    assert.strictEqual(r.status, 0, r.stderr);
    for (const want of [/7 closed cards/, /Review findings\s+3 material \/ 5 advisory/, /recorded on 4 of 7/,
      /Review rounds\s+7 over 4 cards/, /Questions\s+4 over 3 cards/, /Escapes\s+2 of 7 closed cards/,
      /TASK-005 ← fixed by TASK-008/]) assert.match(r.stdout, want);
  });
});
