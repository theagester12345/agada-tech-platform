// archive-outbox.test.js — the outbox archiver, in a temp project. Never touches a real one.
// Run: node --test adapters/consolidate/archive-outbox.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "archive-outbox.js");

// An outbox as the payload ships it: a header declaring the side's code, one consumed-marker
// per peer, the entries newest first, the commented-out template, and the footer.
function outbox(side, code, markers, entries) {
  return [
    `# Project ${side} — Interface Outbox\n`,
    `This is ${side}'s **outbox**, code **\`${code}\`**.\n`,
    ...Object.entries(markers).map(([dir, id]) => `**Consumed from ${dir}:** up to \`${id}\`  <!-- last id processed -->`),
    `\n---\n\n## Entries (newest first)\n`,
    ...entries,
    `<!-- Template:\n### ${code}-INT-YYYYMMDD-NN — REQUEST | RESPONSE — <title>\n**Status:** NEW | ACK\n-->\n\n---\n\n_Last Updated: 2026-10-16_\n`,
  ].join("\n");
}
const entry = (id, kind, to, re, status = "NEW") =>
  `### ${id} — ${kind} — title of ${id}\n**Status:** ${status}\n**To:** ${to}\n**Re:** ${re}\n**Body:** body of ${id}, with \`code\`.\n`;

// backend asks frontend for two things and tells product one; frontend answers one request.
function project(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "outbox-"));
  const files = {
    backend: outbox("Backend", "BE", { frontend: over.beReadFe || "FE-INT-20261005-01", product: "<none>" }, [
      entry("BE-INT-20261006-01", "NOTICE", "PD", "FEATURE-001"),
      entry("BE-INT-20261004-02", "REQUEST", "FE", "—"),                 // read by FE, never answered
      entry("BE-INT-20261004-01", "REQUEST", "FE", "—"),                 // read and answered by FE-INT-20261005-01
      entry("BE-INT-20261003-01", "REQUEST", "LG", "—", "DELIVERED"),    // a recipient with no outbox
      entry("BE-INT-20261002-01", "REQUEST", "FE", "—", "WITHDRAWN — superseded"),
    ]),
    frontend: outbox("Frontend", "FE", { backend: over.feReadBe || "BE-INT-20261004-02", product: "<none>" }, [
      entry("FE-INT-20261005-01", "RESPONSE", "BE", "BE-INT-20261004-01"),
    ]),
    product: outbox("Product", "PD", { backend: over.pdReadBe || "BE-INT-20261006-01", frontend: "<none>" }, []),
  };
  for (const [side, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(dir, side));
    fs.writeFileSync(path.join(dir, side, "INTERFACE.md"), text);
  }
  return dir;
}
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, "--project", dir, ...args], { encoding: "utf8" });
const ids = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").match(/^### [A-Z]+-INT-\d{8}-\d+/gm) || [] : []).map((h) => h.slice(4));
const read = (dir, side, f = "INTERFACE.md") => path.join(dir, side, f);
const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test("a request moves only once every recipient has read it AND answered it", () => {
  const dir = project();
  try {
    assert.strictEqual(run(dir, "--keep", "0").status, 0);
    const moved = ids(read(dir, "backend", "INTERFACE_ARCHIVE.md"));
    assert.ok(moved.includes("BE-INT-20261004-01"), "read and answered → moves");
    assert.ok(!moved.includes("BE-INT-20261004-02"), "read but unanswered → stays");
    assert.ok(ids(read(dir, "backend")).includes("BE-INT-20261004-02"));
  } finally { done(dir); }
});

test("a request whose own status closes it moves once read — and never if it is unread", () => {
  let dir = project();
  try {
    run(dir, "--keep", "0");
    assert.ok(ids(read(dir, "backend", "INTERFACE_ARCHIVE.md")).includes("BE-INT-20261002-01"));
  } finally { done(dir); }
  dir = project({ feReadBe: "BE-INT-20261001-01" });
  try {
    run(dir, "--keep", "0");
    assert.ok(ids(read(dir, "backend")).includes("BE-INT-20261002-01"), "closed by its status, but unread → stays");
  } finally { done(dir); }
});

test("a recipient with no outbox can never confirm, so the entry stays", () => {
  const dir = project();
  try {
    run(dir, "--keep", "0");
    assert.ok(ids(read(dir, "backend")).includes("BE-INT-20261003-01"));
  } finally { done(dir); }
});

test("a notice moves once its recipient has read it", () => {
  let dir = project();
  try {
    run(dir, "--keep", "0");
    assert.ok(ids(read(dir, "backend", "INTERFACE_ARCHIVE.md")).includes("BE-INT-20261006-01"));
  } finally { done(dir); }
  dir = project({ pdReadBe: "<none>" });
  try {
    run(dir, "--keep", "0");
    assert.ok(ids(read(dir, "backend")).includes("BE-INT-20261006-01"), "unread notice stays");
  } finally { done(dir); }
});

test("a response moves once the side that asked has read it", () => {
  let dir = project();
  try {
    run(dir, "--keep", "0");
    assert.deepStrictEqual(ids(read(dir, "frontend", "INTERFACE_ARCHIVE.md")), ["FE-INT-20261005-01"]);
  } finally { done(dir); }
  dir = project({ beReadFe: "<none>" });
  try {
    run(dir, "--keep", "0");
    assert.deepStrictEqual(ids(read(dir, "frontend")), ["FE-INT-20261005-01"]);
  } finally { done(dir); }
});

test("--keep holds the newest closed entries in view", () => {
  const dir = project();
  try {
    run(dir, "--keep", "1");
    // closed in backend: 20261006-01, 20261004-01, 20261002-01 — the newest stays
    assert.ok(ids(read(dir, "backend")).includes("BE-INT-20261006-01"));
    assert.deepStrictEqual(ids(read(dir, "backend", "INTERFACE_ARCHIVE.md")), ["BE-INT-20261004-01", "BE-INT-20261002-01"]);
  } finally { done(dir); }
});

test("moved entries keep their exact text; header, markers, template and footer stay", () => {
  const dir = project();
  try {
    const before = fs.readFileSync(read(dir, "backend"), "utf8");
    const block = before.slice(before.indexOf("### BE-INT-20261004-01"), before.indexOf("### BE-INT-20261003-01")).trimEnd();
    run(dir, "--keep", "0");
    const after = fs.readFileSync(read(dir, "backend"), "utf8");
    assert.ok(fs.readFileSync(read(dir, "backend", "INTERFACE_ARCHIVE.md"), "utf8").includes(block));
    for (const keep of ["code **`BE`**", "**Consumed from frontend:**", "## Entries (newest first)", "<!-- Template:", "### BE-INT-YYYYMMDD-NN", "_Last Updated: 2026-10-16_"])
      assert.ok(after.includes(keep), keep);
    assert.doesNotMatch(after, /\n\n\n/);
  } finally { done(dir); }
});

test("idempotent: a second run changes no byte anywhere", () => {
  const dir = project();
  try {
    run(dir, "--keep", "0");
    const snap = () => ["backend", "frontend", "product"].flatMap((s) => ["INTERFACE.md", "INTERFACE_ARCHIVE.md"].map((f) => fs.existsSync(read(dir, s, f)) ? fs.readFileSync(read(dir, s, f), "utf8") : ""));
    const a = snap();
    const r = run(dir, "--keep", "0");
    assert.strictEqual(r.status, 0);
    assert.deepStrictEqual(snap(), a);
  } finally { done(dir); }
});

test("a later run files newly archived entries above older ones", () => {
  const dir = project();
  try {
    run(dir, "--keep", "1");
    run(dir, "--keep", "0");
    assert.deepStrictEqual(ids(read(dir, "backend", "INTERFACE_ARCHIVE.md")), ["BE-INT-20261006-01", "BE-INT-20261004-01", "BE-INT-20261002-01"]);
  } finally { done(dir); }
});

test("--dry-run lists what would move and writes nothing", () => {
  const dir = project();
  try {
    const before = fs.readFileSync(read(dir, "backend"), "utf8");
    const r = run(dir, "--keep", "0", "--dry-run");
    assert.strictEqual(r.status, 0);
    assert.match(r.stdout, /BE-INT-20261004-01/);
    assert.strictEqual(fs.readFileSync(read(dir, "backend"), "utf8"), before);
    assert.ok(!fs.existsSync(read(dir, "backend", "INTERFACE_ARCHIVE.md")));
  } finally { done(dir); }
});

test("a closed entry stays while an open entry still names it in Re: — the thread stays readable", () => {
  const dir = project();
  try {
    // An open follow-up in backend that continues the answered request BE-INT-20261004-01.
    const f = read(dir, "backend");
    const s = fs.readFileSync(f, "utf8");
    fs.writeFileSync(f, s.replace("## Entries (newest first)\n", `## Entries (newest first)\n\n${entry("BE-INT-20261007-01", "REQUEST", "FE", "BE-INT-20261004-01")}`));
    run(dir, "--keep", "0");
    assert.ok(ids(f).includes("BE-INT-20261004-01"), "named by an open entry → stays");
    assert.ok(ids(f).includes("BE-INT-20261007-01"), "unread follow-up → stays");
  } finally { done(dir); }
});
