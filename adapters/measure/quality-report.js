#!/usr/bin/env node
/**
 * quality-report.js — how well the work went, read from what the cards already record.
 *
 * The start-up meter says what a change costs in tokens. This says whether quality held, so a
 * change can be judged on both. It reads four signals from a side's board and its archive:
 *
 *   review findings   material and advisory findings per reviewed task (the `Review:` tail)
 *   review rounds     reviewer runs per task, and which tasks needed more than one
 *   questions         reviewer questions per task (the `Questions:` field)
 *   escapes           closed cards a later card says it `fixes` (in its `Source:`)
 *
 * Usage:
 *   node quality-report.js --tasks <TASK.md> [--json]
 *
 *   --tasks PATH   the board; TASK_ARCHIVE.md in the same directory is read with it, so
 *                  archiving cards never changes the report
 *   --json         the numbers as JSON, for scripts and trends
 *
 * Cards from before the `Review:` tail existed are not backfilled, so every signal says how
 * many closed cards recorded it. A low number there means "too early to tell", not "fine".
 *
 * Node 18+, no dependencies. Paths are arguments; nothing is derived from where this sits.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// The same card boundary the tracker sync uses: a card starts at a `### …TASK-n: title`
// heading and runs to the next card or `## ` section. Kept here rather than loaded from the
// sync, so one adapter never depends on where another sits; the tests check both agree.
const TASK_HEADING = /^###\s+.*?(TASK-\d+)\s*:\s*(.+?)\s*$/;
const SECTION_HEADING = /^##\s+/;

const field = (text, name) => (text.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*?)\\s*$`, "m")) || [])[1];

// `Review: <reviewer> (<tier>) — <n> material / <m> advisory, <r> rounds`, or `— none, 1 round`.
const REVIEW_TAIL = /[—–-]\s*(?:none|(\d+)\s+material\s*\/\s*(\d+)\s+advisory)\s*,\s*(\d+)\s+rounds?\b/i;

function fail(m) {
  console.error(`[quality-report] ERROR: ${m}`);
  process.exit(1);
}

function cardsOf(text) {
  const lines = text.split("\n");
  const starts = [];
  lines.forEach((l, i) => { if (TASK_HEADING.test(l)) starts.push(i); });
  return starts.map((s) => {
    let end = lines.length;
    for (let i = s + 1; i < lines.length; i++) if (TASK_HEADING.test(lines[i]) || SECTION_HEADING.test(lines[i])) { end = i; break; }
    const body = lines.slice(s, end).join("\n");
    const review = (field(body, "Review") || "").match(REVIEW_TAIL);
    const questions = (field(body, "Questions") || "").replace(/`/g, "");
    const collected = questions.match(/^collected\s+(\d+)/i);
    const asked = /^none\b/i.test(questions) ? 0 : collected ? Number(collected[1]) : null;
    const fixes = [...(field(body, "Source") || "").matchAll(/\bfixes\s+(TASK-\d+)/gi)].map((m) => m[1].toUpperCase());
    return {
      id: lines[s].match(TASK_HEADING)[1],
      closed: /^COMPLETED\b/.test(field(body, "Status") || ""),
      review: review ? { material: Number(review[1] || 0), advisory: Number(review[2] || 0), rounds: Number(review[3]) } : null,
      questions: asked,
      fixes,
    };
  });
}

const per = (n, d) => (d ? Math.round((n / d) * 100) / 100 : 0);

function analyse(boardText, archiveText) {
  const cards = [...cardsOf(boardText), ...cardsOf(archiveText || "")];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const closed = cards.filter((c) => c.closed);

  const reviewed = closed.filter((c) => c.review);
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  const review = {
    recorded: reviewed.length,
    material: sum(reviewed, (c) => c.review.material),
    advisory: sum(reviewed, (c) => c.review.advisory),
    rounds: sum(reviewed, (c) => c.review.rounds),
    multiRound: reviewed.filter((c) => c.review.rounds > 1).map((c) => c.id),
  };
  review.materialPerTask = per(review.material, review.recorded);
  review.roundsPerTask = per(review.rounds, review.recorded);

  const asked = closed.filter((c) => c.questions !== null);
  const questions = { recorded: asked.length, total: sum(asked, (c) => c.questions) };
  questions.perTask = per(questions.total, questions.recorded);

  // An escape is a defect found after its card closed. The fixing card may be in any state —
  // the bug exists once it is filed — but the card it names must be closed, or the defect was
  // caught before "done" and is not an escape.
  const list = [], notCounted = [];
  for (const c of cards) for (const id of c.fixes) {
    const target = byId.get(id);
    if (!target) notCounted.push({ fixedBy: c.id, names: id, why: "not on the board or in the archive" });
    else if (!target.closed) notCounted.push({ fixedBy: c.id, names: id, why: "not closed" });
    else list.push({ escaped: id, fixedBy: c.id });
  }
  const escapedCards = new Set(list.map((e) => e.escaped)).size;
  const escapes = { list, notCounted, escapedCards, perClosedCard: per(escapedCards, closed.length) };

  return { cards, closed: closed.length, review, questions, escapes };
}

function format(q, files) {
  const cov = (n) => `recorded on ${n} of ${q.closed}`;
  const out = [
    `Quality report — ${files}: ${q.closed} closed cards`,
    "",
    `Review findings   ${q.review.material} material / ${q.review.advisory} advisory over ${q.review.recorded} cards (${q.review.materialPerTask} material per task); ${cov(q.review.recorded)}`,
    `Review rounds     ${q.review.rounds} over ${q.review.recorded} cards (${q.review.roundsPerTask} per task); more than one: ${q.review.multiRound.join(", ") || "none"}`,
    `Questions         ${q.questions.total} over ${q.questions.recorded} cards (${q.questions.perTask} per task); ${cov(q.questions.recorded)}`,
    `Escapes           ${q.escapes.escapedCards} of ${q.closed} closed cards (${Math.round(q.escapes.perClosedCard * 100)}%)`,
    ...q.escapes.list.map((e) => `  ${e.escaped} ← fixed by ${e.fixedBy}`),
    ...q.escapes.notCounted.map((e) => `  not counted: ${e.fixedBy} fixes ${e.names} — ${e.why}`),
  ];
  return out.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  let tasks, asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tasks") tasks = argv[++i];
    else if (argv[i] === "--json") asJson = true;
    else if (argv[i] === "-h" || argv[i] === "--help") return console.log("node quality-report.js --tasks <TASK.md> [--json]");
    else fail(`unknown argument: ${argv[i]}`);
  }
  if (!tasks) fail("--tasks <TASK.md> is required");
  const tasksFile = path.resolve(tasks);
  if (!fs.existsSync(tasksFile)) fail(`board not found: ${tasksFile}`);
  const archiveFile = path.join(path.dirname(tasksFile), "TASK_ARCHIVE.md");
  const hasArchive = fs.existsSync(archiveFile);

  const q = analyse(fs.readFileSync(tasksFile, "utf8"), hasArchive ? fs.readFileSync(archiveFile, "utf8") : "");
  // Zero cards is a wrong path or an unreadable file, never a clean bill of health.
  if (!q.cards.length) fail(`no cards found in ${tasksFile}${hasArchive ? " or its archive" : ""}`);
  console.log(asJson ? JSON.stringify(q, null, 2) : format(q, hasArchive ? "TASK.md + TASK_ARCHIVE.md" : "TASK.md"));
}

if (require.main === module) main();
module.exports = { analyse };
