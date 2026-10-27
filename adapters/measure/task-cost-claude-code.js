#!/usr/bin/env node
/**
 * task-cost-claude-code.js — what each task actually cost, read from Claude Code's session logs.
 * APPROXIMATE, and it says so in every report.
 *
 * The start-up meter says what a session pays before work begins. This says what the work itself
 * cost, per task, so a workflow change can be judged by what it does to real tasks. It is a
 * Binding: it reads one host's logs (Claude Code writes a JSONL file per session under
 * ~/.claude/projects/<the folder's path, every character but a letter, digit or - turned into ->/). Other hosts would be
 * other files beside this one.
 *
 * Usage:
 *   node task-cost-claude-code.js --project <dir> [--logs <dir>] [--git-dir <dir>]... [--since YYYY-MM-DD] [--json]
 *
 *   --project   the project root; every session started there or in a folder inside it is read
 *   --logs      where the host keeps its logs (default ~/.claude/projects)
 *   --git-dir   a git directory whose history holds the boards; repeatable. Default: the
 *               project's own. In client-repo mode, also pass the review repo, which holds them.
 *   --since     only calls and commits from this date on
 *   --json      the numbers as JSON
 *
 * The attribution rule. A session is not a task: one session often closes several. Each task ends
 * with *approve* and one commit that flips its card to COMPLETED, and the session log records that
 * commit as a tool call. So, within a session, calls up to and including the commit call that
 * closed a card belong to that card; a subagent's calls go to the window their time falls in; calls
 * after the session's last such commit are `open` (not yet approved). Which card a commit closed
 * comes from git, never from the commit message. A commit that closed no card (a review snapshot,
 * the source half of a client-repo approve, a docs-only commit) does not end a window: its calls go
 * on to the next close, and the task counts it under `otherCommits`, so work folded in is visible.
 * Confidence is `high` when the commit call was found in the session and closed one card, `low`
 * when the card was matched by time alone or the window closed several.
 *
 * Read-only: it never writes to the logs or to any repository. Node 18+, no dependencies.
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RULE = "Within a session, calls up to and including the commit that closed a card belong to that card; " +
  "a subagent's calls follow their time; a commit that closed no card does not end a window (counted as other commits); calls after the last close are open.";
// Relative to one input token, as published for Claude models (checked 2026-10-22): a 5-minute
// cache write 1.25×, a 1-hour write 2×, a cache read 0.1×, an output token 5×. Weights, not dollars:
// the ratio holds across models even where the prices differ.
const WEIGHTS = { input: 1, write5m: 1.25, write1h: 2, read: 0.1, output: 5 };
const COLD_GAP_MS = 60 * 60 * 1000;     // past an hour idle, the cache has expired and the context is written again
const MATCH_BEFORE_MS = 30 * 1000;      // a commit's own time sits just after the tool call that ran it
const MATCH_AFTER_MS = 120 * 1000;
const COMMIT_RE = /(^|[\s;&|()])(git(\s+(-C|-c|--git-dir|--work-tree)[= ]?\S+)*|(\S*\/)?wf-git)\s+commit\b/;
const CARD_HEADING = /^###\s+.*?(TASK-\d+)\s*:/;

/** Claude Code's folder name for a project: the absolute path with every character but a letter, digit or `-` turned into `-`. */
const slugFor = (dir) => path.resolve(dir).replace(/[^A-Za-z0-9-]/g, "-");

function readJsonl(file) {
  const out = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a line cut off mid-write is skipped */ }
  }
  return out;
}

/** One log file → its calls, each message counted once (the log repeats a message's record). */
function callsOf(records, sidechain = false) {
  const byId = new Map();
  for (const r of records) {
    const u = r.type === "assistant" && r.message && r.message.usage;
    if (!u) continue;
    const cc = u.cache_creation || {};
    const split = cc.ephemeral_5m_input_tokens !== undefined || cc.ephemeral_1h_input_tokens !== undefined;
    byId.set(r.message.id || `${r.timestamp}`, {
      t: Date.parse(r.timestamp), cwd: r.cwd, model: r.message.model,
      sidechain: sidechain || r.isSidechain === true,
      inp: u.input_tokens || 0, cr: u.cache_read_input_tokens || 0, out: u.output_tokens || 0,
      // Older logs carry no split; their writes are counted as the 5-minute kind.
      cw5m: split ? cc.ephemeral_5m_input_tokens || 0 : u.cache_creation_input_tokens || 0,
      cw1h: split ? cc.ephemeral_1h_input_tokens || 0 : 0,
    });
  }
  return [...byId.values()].sort((a, b) => a.t - b.t);
}

/** The `git commit` / `wf-git commit` tool calls in a session, once each. */
function commitCalls(records) {
  const seen = new Set(), out = [];
  for (const r of records) {
    if (r.type !== "assistant" || !r.message || !Array.isArray(r.message.content)) continue;
    for (const c of r.message.content) {
      const cmd = c && c.type === "tool_use" && c.name === "Bash" && c.input && c.input.command;
      if (!cmd || !COMMIT_RE.test(cmd)) continue;
      const key = `${r.message.id}:${cmd}`;
      if (seen.has(key)) continue;
      seen.add(key); out.push({ t: Date.parse(r.timestamp), cmd });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function git(gitDir, args) {
  try { return execFileSync("git", [`--git-dir=${gitDir}`, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }); }
  catch { return null; }
}

/** Each card's status across a side's board and its archive at one revision. */
function statusesAt(gitDir, rev, dir) {
  const st = new Map();
  for (const f of ["TASK.md", "TASK_ARCHIVE.md"]) {
    const text = rev && git(gitDir, ["show", `${rev}:${dir === "." ? "" : dir + "/"}${f}`]);
    if (!text) continue;
    let id = null;
    for (const l of text.split("\n")) {
      const h = l.match(CARD_HEADING);
      if (h) { id = h[1]; continue; }
      const s = id && l.match(/^\*\*Status:\*\*\s*([A-Z_]+)/);
      if (s) { st.set(id, s[1]); id = null; }
    }
  }
  return st;
}

/**
 * Commits that closed cards: a card whose Status became COMPLETED, read across the board and its
 * archive together, so moving a closed card into the archive is not a close. Ids carry their side
 * (`backend/TASK-063`), because every side numbers its own.
 */
function closedCards(gitDirs, since) {
  const out = [];
  for (const gd of gitDirs) {
    const log = git(gd, ["log", "--format=@@%H %ct %P", "--name-only", ...(since ? [`--since=${since}`] : []), "--", "*TASK.md", "*TASK_ARCHIVE.md"]);
    if (!log) continue;
    for (const block of log.split("@@").filter(Boolean)) {
      const [head, ...files] = block.trim().split("\n");
      const [hash, ct, parent] = head.split(" ");
      const ids = [];
      for (const dir of new Set(files.filter(Boolean).map((f) => path.posix.dirname(f)))) {
        const before = statusesAt(gd, parent, dir), after = statusesAt(gd, hash, dir);
        for (const [id, s] of after) {
          if (s === "COMPLETED" && before.has(id) && before.get(id) !== "COMPLETED") ids.push(dir === "." ? id : `${dir}/${id}`);
        }
      }
      if (ids.length) out.push({ t: Number(ct) * 1000, hash, ids });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Every session started in the project or a folder inside it, with its subagents' calls merged in. */
function sessionsFor(project, logsDir, since) {
  const slug = slugFor(project), root = path.resolve(project), sinceT = since ? Date.parse(since) : 0;
  const inProject = (cwd) => cwd === root || (cwd || "").startsWith(root + path.sep);
  const out = [];
  if (!fs.existsSync(logsDir)) return out;
  for (const d of fs.readdirSync(logsDir)) {
    if (d !== slug && !d.startsWith(slug + "-")) continue;   // a cheap filter; the cwd check below decides
    const dir = path.join(logsDir, d);
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
      const recs = readJsonl(path.join(dir, f));
      if (!recs.some((r) => inProject(r.cwd))) continue;
      let calls = callsOf(recs);
      const subDir = path.join(dir, f.replace(/\.jsonl$/, ""), "subagents");
      if (fs.existsSync(subDir)) {
        for (const s of fs.readdirSync(subDir).filter((s) => s.endsWith(".jsonl"))) calls.push(...callsOf(readJsonl(path.join(subDir, s)), true));
      }
      calls = calls.filter((c) => c.t >= sinceT).sort((a, b) => a.t - b.t);
      out.push({ id: f.replace(/\.jsonl$/, ""), calls, commits: commitCalls(recs).filter((c) => c.t >= sinceT) });
    }
  }
  return out;
}

const zero = () => ({ input: 0, write5m: 0, write1h: 0, read: 0, output: 0 });
const weighted = (k) => Math.round(Object.keys(WEIGHTS).reduce((a, x) => a + k[x] * WEIGHTS[x], 0));

/** Sessions + closing commits → per task, plus `open`. */
function attribute(sessions, closed) {
  // Each closing commit goes to the nearest commit call in time, across every session at once.
  // First-come would hand it to whichever session happened to be read first: parallel sessions
  // commit too (a review snapshot, another task's work), often within the same two minutes.
  const used = new Set(), pairs = [];
  for (const s of sessions) for (const cc of s.commits) for (const k of closed) {
    if (k.t >= cc.t - MATCH_BEFORE_MS && k.t <= cc.t + MATCH_AFTER_MS) pairs.push({ cc, k, d: Math.abs(k.t - cc.t) });
  }
  pairs.sort((a, b) => a.d - b.d);
  for (const p of pairs) if (!used.has(p.k) && !p.cc.match) { used.add(p.k); p.cc.match = p.k; }
  // Only a commit that closed a card ends a window. On real logs most commits close none — review
  // snapshots, the source half of a client-repo approve, docs-only commits — and letting each end a
  // window left over half the cost unattributed (TASK-099: 53% on one project). They are counted.
  for (const s of sessions) {
    s.bounds = s.commits.filter((cc) => cc.match)
      .map((cc) => ({ t: cc.t, ids: cc.match.ids, confidence: cc.match.ids.length === 1 ? "high" : "low" }));
    s.others = s.commits.filter((cc) => !cc.match);
  }
  // A card closed with no commit call found (another terminal, a script): the session whose last
  // call came just before it takes it, at low confidence.
  for (const k of closed.filter((k) => !used.has(k))) {
    let best = null, bestT = -Infinity;
    for (const s of sessions) {
      const last = s.calls.filter((c) => !c.sidechain && c.t <= k.t && c.t >= k.t - MATCH_AFTER_MS).pop();
      if (last && last.t > bestT) { best = s; bestT = last.t; }
    }
    if (best) { used.add(k); best.bounds.push({ t: k.t, ids: k.ids, confidence: "low" }); }
  }
  const tasks = new Map(), open = { calls: 0, tokens: zero(), otherCommits: 0 };
  const add = (b, c) => { b.tokens.input += c.inp; b.tokens.write5m += c.cw5m; b.tokens.write1h += c.cw1h; b.tokens.read += c.cr; b.tokens.output += c.out; b.calls++; };
  for (const s of sessions) {
    s.bounds.sort((a, b) => a.t - b.t);
    for (const o of s.others) {   // each non-closing commit is counted by the window it falls in
      const b = s.bounds.find((x) => x.t >= o.t);
      if (!b) { open.otherCommits++; continue; }
      b.otherCommits = (b.otherCommits || 0) + 1;
    }
    let prevMain = null;
    for (const c of s.calls) {
      const cold = !c.sidechain && prevMain !== null && c.t - prevMain > COLD_GAP_MS;
      if (!c.sidechain) prevMain = c.t;
      const b = s.bounds.find((x) => x.t >= c.t);
      if (!b) { add(open, c); continue; }
      const key = b.ids.join(" + ");
      if (!tasks.has(key)) tasks.set(key, { id: key, confidence: b.confidence, sessions: new Set(), calls: 0, tokens: zero(), ctx: [], coldRestarts: 0, otherCommits: 0, bounds: new Set() });
      const t = tasks.get(key);
      if (!t.bounds.has(b)) { t.bounds.add(b); t.otherCommits += b.otherCommits || 0; }
      if (b.confidence === "low") t.confidence = "low";
      add(t, c); t.sessions.add(s.id);
      if (!c.sidechain) t.ctx.push(c.inp + c.cw5m + c.cw1h + c.cr);
      if (cold) t.coldRestarts++;
    }
  }
  const list = [...tasks.values()].map((t) => ({
    id: t.id, confidence: t.confidence, sessions: t.sessions.size, calls: t.calls, tokens: t.tokens,
    weighted: weighted(t.tokens),
    avgContext: t.ctx.length ? Math.round(t.ctx.reduce((a, b) => a + b, 0) / t.ctx.length) : 0,
    coldRestarts: t.coldRestarts, otherCommits: t.otherCommits,
  })).sort((a, b) => b.weighted - a.weighted);
  return { tasks: list, open };
}

function report(q, project) {
  const k = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));
  const row = (c) => c.map((x, i) => (i === 0 ? String(x).padEnd(28) : String(x).padStart(9))).join(" ");
  const lines = [
    `Task cost — ${project} (Claude Code logs) — APPROXIMATE`,
    `Rule: ${RULE}`,
    `Weighted = input-equivalent tokens: input 1, 5-minute write 1.25, 1-hour write 2, read 0.1, output 5.`,
    "",
    row(["task", "conf", "sessions", "calls", "input", "write5m", "write1h", "read", "output", "weighted", "avg ctx", "cold", "other commits"]),
    ...q.tasks.map((t) => row([t.id, t.confidence, t.sessions, t.calls, k(t.tokens.input), k(t.tokens.write5m), k(t.tokens.write1h), k(t.tokens.read), k(t.tokens.output), k(t.weighted), k(t.avgContext), t.coldRestarts, t.otherCommits])),
    "",
    `open (after the last close, or a session that closed nothing): ${q.open.calls} calls, ${k(weighted(q.open.tokens))} weighted, ${q.open.otherCommits} other commits`,
  ];
  return lines.join("\n");
}

function fail(m) { console.error(`[task-cost] ERROR: ${m}`); process.exit(1); }

function main() {
  const a = process.argv.slice(2), opts = { gitDirs: [], json: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--project") opts.project = a[++i];
    else if (a[i] === "--logs") opts.logs = a[++i];
    else if (a[i] === "--git-dir") opts.gitDirs.push(path.resolve(a[++i]));
    else if (a[i] === "--since") opts.since = a[++i];
    else if (a[i] === "--json") opts.json = true;
    else if (a[i] === "-h" || a[i] === "--help") return console.log("node task-cost-claude-code.js --project <dir> [--logs <dir>] [--git-dir <dir>]... [--since YYYY-MM-DD] [--json]");
    else fail(`unknown argument: ${a[i]}`);
  }
  if (!opts.project || !fs.existsSync(opts.project)) fail("--project <dir> is required and must exist");
  const project = path.resolve(opts.project);
  if (!opts.gitDirs.length) {
    try { opts.gitDirs.push(execFileSync("git", ["-C", project, "rev-parse", "--absolute-git-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); }
    catch { fail(`${project} is not a git repository; pass --git-dir`); }
  }
  const sessions = sessionsFor(project, opts.logs || path.join(os.homedir(), ".claude", "projects"), opts.since);
  if (!sessions.length) fail(`no Claude Code session found for ${project}`);
  const q = { approximate: true, rule: RULE, weights: WEIGHTS, ...attribute(sessions, closedCards(opts.gitDirs, opts.since)) };
  console.log(opts.json ? JSON.stringify(q, null, 2) : report(q, project));
}

if (require.main === module) main();
module.exports = { slugFor, callsOf, commitCalls, closedCards, attribute, sessionsFor };
