#!/usr/bin/env node
/**
 * archive-outbox.js — move closed entries out of every INTERFACE.md, into INTERFACE_ARCHIVE.md
 * beside each one.
 *
 * Every persona reads every peer's outbox at start-up, and on a long-running project most
 * entries were answered long ago. This moves those, keeping the newest few in view.
 *
 * An entry has two owners — the side that wrote it and the sides it is addressed to — so
 * "closed" is read from BOTH sides, never from the entry's age or its own Status line (real
 * outboxes leave most answered entries at NEW). An entry is closed when:
 *   - every recipient has read it: each recipient's "Consumed from <this side>" marker has
 *     reached its id; and
 *   - for a REQUEST, also: each recipient has posted a RESPONSE naming it in `Re:`, or the
 *     entry's own Status closes it (DELIVERED, ACK, WITHDRAWN, SUPERSEDED, DECLINED, CLOSED).
 * Recipients are the `To:` codes; a RESPONSE with no `To:` goes to the sides its `Re:` ids
 * belong to. A code with no outbox in this project can never confirm, so its entry stays. And
 * an entry that an open entry still names in `Re:` stays, so a live thread reads in one file.
 *
 * Usage:
 *   node archive-outbox.js [--project <dir>] [--keep N] [--dry-run]
 *
 *   --project DIR  the project root; every <dir>/INTERFACE.md one level down is an outbox
 *                  (default: the current directory)
 *   --keep N       closed entries to keep in each outbox, newest first (default 10)
 *   --dry-run      list what would move; write nothing
 *
 * Safe to re-run: with nothing past the window it changes no byte. Each entry moves as the
 * exact text it had, and the archive is written before the outbox. Delivery is not affected:
 * an entry moves only after every recipient's marker has passed it.
 *
 * Node 18+, no dependencies. Paths are arguments; nothing is derived from where this sits.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ENTRY = /^###\s+([A-Z][A-Z0-9]*-INT-\d{8}-\d+)\b(.*)$/;
const HEADING = /^#{2,3}\s/;
const CLOSING_STATUS = /^(DELIVERED|ACK|WITHDRAWN|SUPERSEDED|DECLINED|CLOSED)\b/i;
const FOOTER_LINE = (l) => l.trim() === "" || l.trim() === "---" || /^_Last Updated\b/i.test(l.trim());

function fail(m) {
  console.error(`[archive-outbox] ERROR: ${m}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { project: process.cwd(), keep: 10, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") out.project = argv[++i];
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

/** Ids sort by date, then by their number within the day. */
function idKey(id) {
  const m = id.match(/-INT-(\d{8})-(\d+)$/);
  return m ? Number(m[1]) * 1e4 + Number(m[2]) : -1;
}
const codeOf = (id) => id.split("-INT-")[0];
const field = (text, label) => ((text.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`, "m")) || [])[1] || "").trim();
const idsIn = (s) => s.match(/[A-Z][A-Z0-9]*-INT-\d{8}-\d+/g) || [];
const codesIn = (s) => (s.match(/\b[A-Z][A-Z0-9]*\b/g) || []);

/**
 * The entries of one outbox, as line ranges. An entry ends at the next heading or at an
 * HTML comment (the commented-out template); the file's last entry stops before the footer.
 */
function entriesOf(lines) {
  const out = [];
  lines.forEach((l, s) => {
    const m = l.match(ENTRY);
    if (!m) return;
    let end = lines.length;
    for (let i = s + 1; i < lines.length; i++) if (HEADING.test(lines[i]) || /^<!--/.test(lines[i])) { end = i; break; }
    if (end === lines.length) while (end - 1 > s && FOOTER_LINE(lines[end - 1])) end--;
    const body = lines.slice(s, end);
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    const text = body.join("\n");
    out.push({ id: m[1], kind: (m[2].match(/\b(REQUEST|RESPONSE|NOTICE)\b/) || [])[1] || "", start: s, end, text });
  });
  return out;
}

function loadOutboxes(project) {
  const boxes = [];
  for (const d of fs.readdirSync(project, { withFileTypes: true })) {
    const f = path.join(project, d.name, "INTERFACE.md");
    if (!d.isDirectory() || !fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    const lines = text.split("\n");
    const code = (text.match(/code \*\*`([A-Z][A-Z0-9]*)`\*\*/) || [])[1];
    const markers = {};
    for (const m of text.matchAll(/^\*\*Consumed from ([^:*]+):\*\*\s*up to `([^`]*)`/gm)) markers[m[1].trim()] = m[2].trim();
    boxes.push({ dir: d.name, file: f, text, lines, code, markers, entries: entriesOf(lines) });
  }
  return boxes;
}

/** Which entries are closed, per the rule in the header. Pure over the loaded outboxes. */
function closedIds(boxes) {
  const byCode = new Map(boxes.filter((b) => b.code).map((b) => [b.code, b]));
  // Every RESPONSE in the project, by the ids it answers, and by which side answered.
  const answered = new Map();
  for (const b of boxes) for (const e of b.entries) {
    if (e.kind !== "RESPONSE") continue;
    for (const id of idsIn(field(e.text, "Re"))) {
      if (!answered.has(id)) answered.set(id, new Set());
      answered.get(id).add(b.code);
    }
  }
  const closed = new Set();
  for (const b of boxes) for (const e of b.entries) {
    const toField = field(e.text, "To");
    let to = codesIn(toField).filter((c) => c !== b.code);
    if (!to.length && e.kind === "RESPONSE") to = [...new Set(idsIn(field(e.text, "Re")).map(codeOf))].filter((c) => c !== b.code);
    if (!to.length) continue;
    const read = to.every((c) => {
      const peer = byCode.get(c);
      const mark = peer && peer.markers[b.dir];
      return mark && idKey(mark) >= idKey(e.id);
    });
    if (!read) continue;
    if (e.kind === "REQUEST") {
      const byStatus = CLOSING_STATUS.test(field(e.text, "Status"));
      const byReply = to.every((c) => (answered.get(e.id) || new Set()).has(c));
      if (!byStatus && !byReply) continue;
    }
    closed.add(e.id);
  }
  // An entry an open one still names in `Re:` stays, so a live thread can be read in one file.
  for (const b of boxes) for (const e of b.entries) {
    if (closed.has(e.id)) continue;
    for (const id of idsIn(field(e.text, "Re"))) closed.delete(id);
  }
  return closed;
}

function plan(box, closed, keep, archiveText) {
  const done = box.entries.filter((e) => closed.has(e.id)).sort((x, y) => idKey(y.id) - idKey(x.id));
  const moved = done.slice(keep);
  if (!moved.length) return { moved };

  const already = new Set(archiveText ? entriesOf(archiveText.split("\n")).map((e) => e.id) : []);
  const clash = moved.map((e) => e.id).filter((id) => already.has(id));
  if (clash.length) fail(`${box.dir}: already in the archive, so they would be two entries for one id:\n  - ${clash.join("\n  - ")}`);

  // The outbox loses exactly the moved entries' lines. Where a removal leaves two blank lines
  // touching, one goes — only at that seam, never inside an entry that stays.
  const drop = new Set();
  for (const e of moved) for (let i = e.start; i < e.end; i++) drop.add(i);
  const out = [];
  let seam = false;
  box.lines.forEach((l, i) => {
    if (drop.has(i)) { seam = true; return; }
    if (seam && l.trim() === "" && out.length && out[out.length - 1].trim() === "") return;
    seam = false;
    out.push(l);
  });

  const block = moved.map((e) => e.text).join("\n\n");
  let archive;
  const al = archiveText ? archiveText.split("\n") : [];
  const ah = al.findIndex((l) => /^##\s+Entries\b/.test(l));
  if (!archiveText) {
    archive = `# ${box.dir} — outbox archive\n\nClosed entries moved out of \`INTERFACE.md\` by \`archive-outbox.js\`, newest first: every recipient had read each one, and every request had its answer. Nothing reads this at start-up.\n\n## Entries (newest first)\n\n${block}\n`;
  } else if (ah < 0) {
    archive = archiveText.replace(/\n*$/, "\n\n") + `## Entries (newest first)\n\n${block}\n`;
  } else {
    const before = al.slice(0, ah + 1).join("\n");
    const rest = al.slice(ah + 1).join("\n").replace(/^\n+/, "");
    archive = `${before}\n\n${block}\n${rest ? "\n" + rest : ""}`.replace(/\n*$/, "\n");
  }
  return { moved, outbox: out.join("\n"), archive };
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log("node archive-outbox.js [--project <dir>] [--keep N] [--dry-run]");
  const project = path.resolve(args.project);
  if (!fs.existsSync(project)) fail(`project not found: ${project}`);
  const boxes = loadOutboxes(project);
  if (!boxes.length) return console.log("No outboxes found (no <dir>/INTERFACE.md).");

  // Decide everything from the outboxes as they are now, before any file changes.
  const closed = closedIds(boxes);
  const plans = boxes.map((b) => {
    const af = path.join(project, b.dir, "INTERFACE_ARCHIVE.md");
    return { b, af, p: plan(b, closed, args.keep, fs.existsSync(af) ? fs.readFileSync(af, "utf8") : "") };
  });
  let total = 0;
  for (const { b, p } of plans) {
    if (!p.moved.length) continue;
    total += p.moved.length;
    console.log(`${b.dir}: ${args.dryRun ? "would move" : "moving"} ${p.moved.length} closed entr${p.moved.length === 1 ? "y" : "ies"}, keeping ${args.keep}:`);
    for (const e of p.moved) console.log(`  ${e.id}  ${e.kind}`);
  }
  if (!total) return console.log(`Nothing to archive: ${args.keep} or fewer closed entries in each outbox.`);
  if (args.dryRun) return;
  for (const { b, af, p } of plans) {
    if (!p.moved.length) continue;
    writeAtomic(af, p.archive);
    writeAtomic(b.file, p.outbox);
  }
}

if (require.main === module) main();
module.exports = { closedIds, entriesOf, idKey };
