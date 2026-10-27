#!/usr/bin/env node
/**
 * archive-tasks.js — move old COMPLETED cards out of a board, into TASK_ARCHIVE.md beside it.
 *
 * Every session reads its side's TASK.md at start-up, and on a long-running project most of
 * that file is closed cards: history, paid for again by every session. This keeps the most
 * recent completed cards on the board ("what just happened" stays in view) and moves the rest
 * to the archive, which nothing reads at start-up. The tracker sync reads the archive as part
 * of its source, so a moved card stays on the board, unchanged.
 *
 * Usage:
 *   node archive-tasks.js --tasks <TASK.md> [--keep N] [--dry-run]
 *
 *   --tasks PATH   the board to trim; the archive is TASK_ARCHIVE.md in the same directory
 *   --keep N       completed cards to keep on the board, newest first (default 10)
 *   --dry-run      list what would move; write nothing
 *
 * What counts as newest: the card's **Completed:** date, latest first. Cards without a date
 * count as the oldest, and equal dates keep their order in the file (the finishing sequence
 * files each closed card at the top of COMPLETED). Only a card whose **Status:** is COMPLETED
 * moves, wherever it sits; open work never does.
 *
 * Safe to re-run: with nothing past the window it changes no byte. Each card moves as the
 * exact text it had. The archive is written before the board, so a run cut off between the
 * two leaves a card in both files, which the sync refuses on its next run instead of
 * deleting anything.
 *
 * Node 18+, no dependencies. Paths are arguments; nothing is derived from where this sits.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// The same card boundary the tracker sync uses: a card starts at a `### …TASK-n: title`
// heading and runs to the next card or `## ` section.
const TASK_HEADING = /^###\s+.*?(TASK-\d+)\s*:\s*(.+?)\s*$/;
const SECTION_HEADING = /^##\s+/;
const FOOTER_LINE = (l) => l.trim() === "" || l.trim() === "---" || /^_Last Updated\b/i.test(l.trim());

function fail(m) {
  console.error(`[archive-tasks] ERROR: ${m}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { keep: 10, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tasks") out.tasks = argv[++i];
    else if (a === "--keep") {
      const v = argv[++i];
      if (!/^\d+$/.test(v || "")) fail(`--keep takes a whole number, got "${v}"`);
      out.keep = Number(v);
    } else if (a === "--dry-run") out.dryRun = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else fail(`unknown argument: ${a}`);
  }
  return out;
}

const STATUS_COMPLETED = /^\*\*Status:\*\*\s*COMPLETED\b/m;
const COMPLETED_DATE = /^\*\*Completed:\*\*\s*(\d{4}-\d{2}-\d{2})/m;

/**
 * Every card in a file, as a line range [start, end). A card ends at the next card or `## `
 * section. The file's last card would swallow the footer (`---`, `_Last Updated:_`), so its
 * range stops where the footer starts. `text` is the card without its trailing blank lines.
 */
function cardsOf(lines) {
  const starts = [];
  lines.forEach((l, i) => { if (TASK_HEADING.test(l)) starts.push(i); });
  return starts.map((s, k) => {
    let end = lines.length;
    for (let i = s + 1; i < lines.length; i++) if (TASK_HEADING.test(lines[i]) || SECTION_HEADING.test(lines[i])) { end = i; break; }
    if (end === lines.length) while (end - 1 > s && FOOTER_LINE(lines[end - 1])) end--;
    const body = lines.slice(s, end);
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    const text = body.join("\n");
    return {
      id: lines[s].match(TASK_HEADING)[1],
      start: s,
      end,
      text,
      done: STATUS_COMPLETED.test(text),
      completed: (text.match(COMPLETED_DATE) || [])[1] || "",
    };
  });
}

function plan(boardText, archiveText, keep) {
  const lines = boardText.split("\n");
  const cards = cardsOf(lines);

  // Only COMPLETED cards are candidates, wherever they sit on the board: real boards file
  // closed cards under headings of their own (`## ✅ COMPLETED`), or leave them in place.
  // Newest first by date; a card with no date is the oldest; ties keep file order.
  const order = cards.filter((c) => c.done).map((c, i) => ({ c, i })).sort((x, y) =>
    x.c.completed === y.c.completed ? x.i - y.i : x.c.completed < y.c.completed ? 1 : -1);
  const moved = order.slice(keep).map((o) => o.c);
  if (!moved.length) return { moved };

  const archived = archiveText ? cardsOf(archiveText.split("\n")) : [];
  const already = new Set(archived.map((c) => c.id));
  const clash = moved.map((c) => c.id).filter((id) => already.has(id));
  if (clash.length) fail(`already in the archive, so they would be two cards for one id:\n  - ${clash.join("\n  - ")}`);

  // The board loses exactly the moved cards' lines; every other line stays as it was. Where a
  // removal leaves two blank lines touching, one goes — only at that seam, never inside a kept
  // card, whose text the tracker compares.
  const drop = new Set();
  for (const c of moved) for (let i = c.start; i < c.end; i++) drop.add(i);
  const out = [];
  let seam = false;
  lines.forEach((l, i) => {
    if (drop.has(i)) { seam = true; return; }
    if (seam && l.trim() === "" && out.length && out[out.length - 1].trim() === "") return;
    seam = false;
    out.push(l);
  });
  const board = out.join("\n");

  const block = moved.map((c) => c.text).join("\n\n");
  let archive;
  const al = archiveText ? archiveText.split("\n") : [];
  const ah = al.findIndex((l) => SECTION_HEADING.test(l) && /COMPLETED/.test(l));
  if (!archiveText) {
    archive = `# Task archive\n\nClosed cards moved off the board by \`archive-tasks.js\`, newest first. Nothing reads this at start-up; the tracker sync reads it as part of the board, so these cards stay mirrored.\n\n## COMPLETED\n\n${block}\n`;
  } else if (ah < 0) {
    archive = archiveText.replace(/\n*$/, "\n\n") + `## COMPLETED\n\n${block}\n`;
  } else {
    const before = al.slice(0, ah + 1).join("\n");
    const rest = al.slice(ah + 1).join("\n").replace(/^\n+/, "");
    archive = `${before}\n\n${block}\n${rest ? "\n" + rest : ""}`.replace(/\n*$/, "\n");
  }
  return { moved, board, archive };
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log("node archive-tasks.js --tasks <TASK.md> [--keep N] [--dry-run]");
  if (!args.tasks) fail("--tasks <TASK.md> is required");
  const tasksFile = path.resolve(args.tasks);
  if (!fs.existsSync(tasksFile)) fail(`board not found: ${tasksFile}`);
  const archiveFile = path.join(path.dirname(tasksFile), "TASK_ARCHIVE.md");
  const archiveText = fs.existsSync(archiveFile) ? fs.readFileSync(archiveFile, "utf8") : "";

  const p = plan(fs.readFileSync(tasksFile, "utf8"), archiveText, args.keep);
  if (!p.moved.length) return console.log(`Nothing to archive: ${args.keep} or fewer completed cards on the board.`);
  console.log(`${args.dryRun ? "Would move" : "Moving"} ${p.moved.length} card(s) to ${path.basename(archiveFile)}, keeping ${args.keep}:`);
  for (const c of p.moved) console.log(`  ${c.id}${c.completed ? `  (completed ${c.completed})` : "  (no date)"}`);
  if (args.dryRun) return;
  writeAtomic(archiveFile, p.archive);
  writeAtomic(tasksFile, p.board);
}

if (require.main === module) main();
module.exports = { plan };
