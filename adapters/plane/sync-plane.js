#!/usr/bin/env node
/**
 * sync-plane.js — one-way task sync: TASK.md → Plane (REST API v1).
 *
 * THE Plane binding for this workflow. `TASK.md` is the single source of truth;
 * this tool PUSHES task state into a Plane project and NEVER writes back.
 *
 * ONE copy serves every consumer (backend, frontend, and the workflow master
 * itself). Nothing is derived from __dirname — every path is configuration — so
 * this file lives once and is invoked from anywhere. **Do NOT fork it per
 * workspace**; that is what caused two hand-maintained copies to drift.
 *
 * Usage:
 *   node sync-plane.js [--dry-run] [--root DIR] [--tasks PATH] [--env PATH] [--prefix STR] [--adopt]
 *
 *   --dry-run      print the planned diff WITHOUT writing
 *   --root DIR     base dir for relative paths     (default: cwd)
 *   --tasks PATH   the TASK.md to read             (default: $TASKS_FILE or <root>/TASK.md)
 *   --env PATH     env file to load                (default: <root>/.env)
 *   --prefix STR   external_id prefix, e.g. "BE-"  (default: $PLANE_KEY_PREFIX or "")
 *   --adopt        allow UPDATE on an id newly introduced in TASK.md that already
 *                  exists on the board (hand-stamped card adoption). Default: refuse.
 *   -h, --help     show this help
 *
 * Correlation key: Plane's native `external_id` + `external_source` on the issue
 * (external_id = "<prefix>TASK-018", external_source = "tasks-md"). Card titles
 * display the source id (`TASK-XXX: …`) for human navigation. Plane's list
 * endpoint has no external_id filter, so we fetch all issues once and index by
 * external_id client-side. Writes are scoped strictly to issues carrying our
 * external_source. The prefix keeps sides distinct on a shared board.
 *
 * Safety (mirror Principle): duplicate TASK ids in the source file are a parse
 * error. Ids newly introduced vs git HEAD that already exist on the board are
 * refused unless `--adopt` (destructive-write refuse).
 *
 * Modes:
 *   (default)   create-or-update every TASK-XXX as an issue, idempotently.
 *   --dry-run   print the planned diff WITHOUT writing.
 *
 * Config: connection + identity come from the gitignored `.env` (PLANE_URL,
 * PLANE_WORKSPACE, PLANE_PROJECT_ID, PLANE_API_TOKEN, PLANE_KEY_PREFIX).
 * Status/Priority mapping is canonical to the workflow's task format and lives
 * here. `Category` is per-side, so its label mapping is overridable via
 * PLANE_LABEL_MAP (JSON).
 *
 * Requires Node 18+ (native fetch). No external dependencies.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// ---------------------------------------------------------------------------
// Mapping config.
// STATE_MAP / PRIORITY_MAP are canonical (WORKFLOW.md → Canonical Task Format).
// ---------------------------------------------------------------------------

// TASK.md Status → Plane STATE name (resolved to a state id at runtime).
// Plane's "Backlog" state is intentionally NOT a target — it's reserved for the
// owner's manual idea space; no TASK.md status maps to it.
const STATE_MAP = Object.freeze({
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Done",
});

// TASK.md Priority → Plane priority value (Plane priority is a plain string).
const PRIORITY_MAP = Object.freeze({
  Critical: "urgent",
  High: "high",
  Normal: "medium",
  Low: "low",
});

// TASK.md Category → Plane LABEL name. Category is per-side, so this is a
// DEFAULT — override with PLANE_LABEL_MAP='{"Feature":"Feature",...}' in .env.
const DEFAULT_LABEL_MAP = Object.freeze({
  Frontend: "Frontend",
  Backend: "Backend",
  Infrastructure: "Infrastructure",
  Documentation: "Infrastructure",
});

const USAGE = `sync-plane.js — one-way sync: TASK.md → Plane

Usage:
  node sync-plane.js [--dry-run] [--root DIR] [--tasks PATH] [--env PATH] [--prefix STR] [--adopt]

  --dry-run      print the planned diff WITHOUT writing
  --root DIR     base dir for relative paths     (default: cwd)
  --tasks PATH   the TASK.md to read             (default: $TASKS_FILE or <root>/TASK.md)
  --env PATH     env file to load                (default: <root>/.env) — use code-root .env from a doc home
  --prefix STR   external_id prefix, e.g. "BE-"  (default: $PLANE_KEY_PREFIX or "")
  --adopt        allow UPDATE when a newly introduced TASK id already exists on the board

Removal propagates: a task deleted from TASK.md is DELETED from the board on the
next run (scoped to this source's cards). Dry-run lists every deletion first.
  -h, --help     show this help

Required in .env: PLANE_URL, PLANE_WORKSPACE, PLANE_PROJECT_ID, PLANE_API_TOKEN
Optional:         PLANE_KEY_PREFIX, PLANE_EXTERNAL_SOURCE, PLANE_LABEL_MAP, TASKS_FILE`;

// ---------------------------------------------------------------------------
// CLI + config (no __dirname — every path is configuration).
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { dryRun: false, adopt: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--adopt") out.adopt = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--root") out.root = argv[++i];
    else if (a === "--tasks") out.tasks = argv[++i];
    else if (a === "--env") out.env = argv[++i];
    else if (a === "--prefix") out.prefix = argv[++i];
    else fail(`unknown argument: ${a}\n\n${USAGE}`);
  }
  return out;
}

// .env loading (manual parser — avoids a dotenv dependency).
// Real process env always wins over the file.
function loadEnv(envPath) {
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) env[key] = val;
    }
  }
  return env;
}

function resolveLabelMap(env) {
  if (!env.PLANE_LABEL_MAP) return DEFAULT_LABEL_MAP;
  try {
    return Object.freeze({ ...JSON.parse(env.PLANE_LABEL_MAP) });
  } catch (e) {
    fail(`PLANE_LABEL_MAP is not valid JSON: ${e.message}`);
  }
}

function getConfig(args) {
  const root = path.resolve(args.root || process.cwd());
  const envPath = args.env ? path.resolve(root, args.env) : path.join(root, ".env");
  const env = loadEnv(envPath);

  const required = ["PLANE_URL", "PLANE_WORKSPACE", "PLANE_PROJECT_ID", "PLANE_API_TOKEN"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    fail(
      `Missing required env var(s): ${missing.join(", ")}.\n` +
        `Add them to ${envPath} (see .env.example) or export them.`
    );
  }

  const tasksFile = args.tasks
    ? path.resolve(root, args.tasks)
    : env.TASKS_FILE
      ? path.resolve(root, env.TASKS_FILE)
      : path.join(root, "TASK.md");

  return {
    root,
    envPath,
    baseUrl: env.PLANE_URL.replace(/\/+$/, ""),
    workspace: env.PLANE_WORKSPACE,
    projectId: env.PLANE_PROJECT_ID,
    token: env.PLANE_API_TOKEN,
    // The prefix namespaces external_id so sides never collide on a shared board
    // (e.g. "BE-" / "FE-" / "WF-"). Empty is fine on a dedicated board.
    keyPrefix: args.prefix !== undefined ? args.prefix : env.PLANE_KEY_PREFIX || "",
    externalSource: env.PLANE_EXTERNAL_SOURCE || "tasks-md",
    labelMap: resolveLabelMap(env),
    tasksFile,
  };
}

// ---------------------------------------------------------------------------
// TASK.md parser (WORKFLOW.md canonical task format).
// ---------------------------------------------------------------------------

const TASK_HEADING = /^###\s+.*?(TASK-\d+)\s*:\s*(.+?)\s*$/;
const SECTION_HEADING = /^##\s+/;

// The final card is the only one with no following heading to stop at, so its
// block runs to EOF and absorbs the document footer — the `---` rule and the
// `_Last Updated:` line. That matters because the Task Synchronization Protocol
// *requires* bumping that line on every task edit: the last card's rendered
// body therefore changed on every edit, and the mirror rewrote it on every run,
// silently breaking the idempotency the mirror Principle guarantees ("a second
// run with no TASK.md change must report unchanged and write nothing").
//
// Applied ONLY to a block that actually reached EOF, so no mid-file card can be
// affected by it. Stated cost: a final card whose own body deliberately ends in
// a `---` rule loses that rule from the mirrored copy. Cosmetic, and the
// alternative — parsing what a trailing `---` means — is guesswork.
function stripDocFooter(block) {
  const out = block.split("\n");
  while (out.length) {
    const last = out[out.length - 1].trim();
    if (last === "" || last === "---" || /^_Last Updated\b/i.test(last)) {
      out.pop();
      continue;
    }
    break;
  }
  return out.join("\n");
}

function field(block, label) {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)\\s*$`, "im");
  const m = block.match(re);
  return m ? m[1].replace(/\*\*/g, "").trim() : null;
}

function stripTitle(raw) {
  return raw.replace(/\*\*/g, "").replace(/[`*_]/g, "").trim();
}

// The refusal a destructive-write collision produces. A pure function so it can
// be asserted on without a live sync (the require-safe rule, WFC-20260720-02).
//
// WHICH SITUATIONS CAN ACTUALLY REACH IT. The board index is filtered to our own
// `external_source`, so a colliding card is never a stranger's — it is always one
// this workflow created, or one a human deliberately stamped with our correlation
// fields. "Renumber", the old advice, answers neither: the id does not clash with
// somebody else's card, it clashes with its own.
//
// The common case is not an error at all. Commits here are user-gated, so a
// session routinely syncs a new card and commits `TASK.md` later; until it does,
// the id is "new" relative to git HEAD while the board already carries it. Naming
// that first matters because the alternative on offer is `--adopt`, and reaching
// for an override to make a guard stop is precisely how guards stop working.
function destructiveWriteRefusal(collisions) {
  return (
    `Refusing destructive write — id(s) already on the board that this file has just introduced:\n` +
    `  - ${collisions.join("\n  - ")}\n` +
    `\n` +
    `These cards carry this sync's own external_source, so each is either one this\n` +
    `workflow already created, or one stamped by hand with our correlation fields.\n` +
    `\n` +
    `  1. Most likely: the card was synced and TASK.md is not committed yet.\n` +
    `     Commit it — the id is then in git HEAD and this check stops firing.\n` +
    `  2. If the id genuinely belongs to a different task, renumber it in TASK.md.\n` +
    `  3. Only for a card you created by hand and are deliberately adopting: --adopt.\n` +
    `\n` +
    `Do not reach for --adopt to make this stop; it overwrites whatever is there.`
  );
}

function parseTasks(tasksFile) {
  if (!fs.existsSync(tasksFile)) fail(`tasks file not found: ${tasksFile}`);
  const lines = fs.readFileSync(tasksFile, "utf8").split("\n");

  const starts = [];
  lines.forEach((line, i) => {
    if (TASK_HEADING.test(line)) starts.push(i);
  });

  const tasks = [];
  const errors = [];
  for (let s = 0; s < starts.length; s++) {
    const startLine = starts[s];
    let end = lines.length;
    for (let i = startLine + 1; i < lines.length; i++) {
      if (TASK_HEADING.test(lines[i]) || SECTION_HEADING.test(lines[i])) {
        end = i;
        break;
      }
    }
    // end === lines.length means nothing terminated this block, i.e. it is the
    // final card and has swallowed whatever footer the file carries.
    const block =
      end === lines.length
        ? stripDocFooter(lines.slice(startLine, end).join("\n"))
        : lines.slice(startLine, end).join("\n");
    const headMatch = lines[startLine].match(TASK_HEADING);
    const id = headMatch[1];
    const title = stripTitle(headMatch[2]);

    const statusRaw = field(block, "Status");
    const status = statusRaw ? (statusRaw.match(/^[A-Z_]+/) || [null])[0] : null;
    const priorityRaw = field(block, "Priority");
    const priority = priorityRaw ? (priorityRaw.match(/^[A-Za-z]+/) || [null])[0] : null;
    const categoryRaw = field(block, "Category");
    const category = categoryRaw ? (categoryRaw.match(/^[A-Za-z]+/) || [null])[0] : null;
    const dependsOn = field(block, "Depends On");

    const problems = [];
    if (!status) problems.push("missing **Status:**");
    else if (!STATE_MAP[status]) problems.push(`unknown Status "${status}"`);
    if (priority && !PRIORITY_MAP[priority]) problems.push(`unknown Priority "${priority}"`);
    if (problems.length) {
      errors.push(`${id}: ${problems.join("; ")}`);
      continue;
    }

    tasks.push({
      id,
      title,
      status,
      priority: priority || "Normal",
      category: category || null,
      dependsOn: parseDependsOn(dependsOn),
      block,
    });
  }

  if (errors.length) fail(`Malformed task block(s):\n  - ${errors.join("\n  - ")}`);

  // Duplicate ids in the source file → two creates for one id, then silent orphaning.
  const seen = new Map();
  const dups = [];
  for (const t of tasks) {
    if (seen.has(t.id)) dups.push(t.id);
    else seen.set(t.id, true);
  }
  if (dups.length) {
    fail(
      `Duplicate TASK id(s) in source file (parse error — refuse before any write):\n  - ${[...new Set(dups)].join("\n  - ")}`
    );
  }
  return tasks;
}

/** Collect TASK-XXX ids from raw TASK.md text (headings only). */
function taskIdsFromContent(text) {
  const ids = [];
  for (const line of text.split("\n")) {
    const m = line.match(TASK_HEADING);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/**
 * Ids present in the working TASK.md but not in git HEAD of that file.
 * Returns null when git HEAD is unavailable (not a git checkout / file untracked).
 */
function newIdsSinceGitHead(tasksFile, currentIds) {
  try {
    const abs = path.resolve(tasksFile);
    const repo = execFileSync("git", ["-C", path.dirname(abs), "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const rel = path.relative(repo, abs);
    if (rel.startsWith("..")) return null;
    const headText = execFileSync("git", ["-C", repo, "show", `HEAD:${rel}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const headIds = new Set(taskIdsFromContent(headText));
    return currentIds.filter((id) => !headIds.has(id));
  } catch {
    return null;
  }
}

/**
 * Cards this source no longer owns: mirrored ids present on the board but absent
 * from TASK.md. Pure so it is unit-testable without a live sync.
 *
 * `mirroredExtIds` is every external_id carrying OUR external_source, `wantedExtIds` is what
 * TASK.md currently declares, and `keyPrefix` is THIS consumer's namespace.
 *
 * The prefix is not decoration: several sides mirror into one board under the same
 * external_source, distinguished only by it. Scoping the orphan set to the source alone made
 * each side's sync propose deleting every OTHER side's cards — measured as 19 deletions each
 * way on a two-side project, and the zero-task refusal cannot catch it because every file
 * parsed plenty of tasks. So membership in this consumer's namespace is decided first.
 *
 * Membership is an EXACT `<prefix>TASK-<n>` match rather than a startsWith(): every string
 * starts with "", so the unprefixed consumer would otherwise claim the entire board. An empty
 * prefix means "the consumer with no prefix", and it excludes every prefixed id.
 */
function ownNamespace(keyPrefix) {
  const esc = String(keyPrefix || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}TASK-\\d+$`);
}

function orphanExternalIds(mirroredExtIds, wantedExtIds, keyPrefix) {
  const mine = ownNamespace(keyPrefix);
  const wanted = new Set(wantedExtIds);
  return [...mirroredExtIds].filter((ext) => mine.test(ext) && !wanted.has(ext));
}

function parseDependsOn(value) {
  if (!value || /^none$/i.test(value.trim())) return [];
  const ids = value.match(/TASK-\d+/g);
  return ids ? [...new Set(ids)] : [];
}

function buildBody(task) {
  return task.block.split("\n").slice(1).join("\n").trim();
}

// ---------------------------------------------------------------------------
// Markdown → HTML (minimal, dependency-free) for Plane's description_html.
// Plane re-normalizes HTML on save, so for idempotency we compare PLAIN TEXT
// rather than the HTML round-trip.
// ---------------------------------------------------------------------------

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
function mdToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    // The optional task-checkbox must match as ONE pinned unit: allowed state
    // chars are " xX~" and a trailing space is REQUIRED. A wildcard state char
    // (`\[.\]`) would read a short markdown link label ("- [a](b) x") as a
    // checkbox and eat it; independently-optional brackets ("\[?.?\]?") would
    // eat the first character of every non-checkbox bullet. See adapters/plane
    // README + the renderer regression tests.
    const li = line.match(/^\s*[-*]\s+(?:\[[ xX~]\]\s+)?(.*)$/);
    if (h) {
      closeList();
      const lvl = Math.min(h[1].length, 6);
      html += `<h${lvl}>${inlineMd(h[2])}</h${lvl}>`;
    } else if (li) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMd(li[1])}</li>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  closeList();
  return html || "<p></p>";
}

// HTML → plain text. Both our generated HTML and Plane's stored description_html
// go through this, so Plane's re-normalization on save never triggers spurious
// updates. The list endpoint does NOT return description_stripped, so we derive
// plain text from description_html.
function htmlToPlain(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Plane REST API v1 client.
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(cfg) {
  const api = `${cfg.baseUrl}/api/v1/workspaces/${encodeURIComponent(cfg.workspace)}/projects/${encodeURIComponent(cfg.projectId)}`;

  async function request(method, urlPath, body, attempt = 0) {
    const url = urlPath.startsWith("http") ? urlPath : `${api}${urlPath}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": cfg.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Plane rate-limits ~60 req/min → 429. Honor Retry-After, else backoff.
    if (res.status === 429 && attempt < 8) {
      const ra = parseInt(res.headers.get("retry-after") || "0", 10);
      await sleep(ra > 0 ? ra * 1000 : Math.min(2000 * 2 ** attempt, 30000));
      return request(method, urlPath, body, attempt + 1);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const msg =
        (json && (json.error || json.detail || JSON.stringify(json))) || text || res.statusText;
      throw new Error(`${method} ${url} → ${res.status}: ${msg}`);
    }
    return json;
  }

  return {
    raw: request,
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
  };
}

// name → id maps for states + labels.
async function resolveLookups(client) {
  const toMap = (coll) => {
    const m = {};
    const els = coll.results || coll;
    for (const el of Array.isArray(els) ? els : []) m[el.name] = el.id;
    return m;
  };
  const [states, labels] = await Promise.all([client.get("/states/"), client.get("/labels/")]);
  return { state: toMap(states), label: toMap(labels) };
}

// Fetch every issue in the project (cursor pagination).
async function fetchAllIssues(client) {
  const all = [];
  let cursor = null;
  for (;;) {
    const page = await client.get(
      `/issues/?per_page=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    );
    const els = page.results || [];
    all.push(...els);
    if (!page.next_page_results) break;
    cursor = page.next_cursor;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Sync logic.
// ---------------------------------------------------------------------------

function externalId(cfg, taskId) {
  return `${cfg.keyPrefix}${taskId}`;
}

function sameLabels(a, b) {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const DRY = args.dryRun;

  const cfg = getConfig(args);
  const tasks = parseTasks(cfg.tasksFile);
  log(
    `Parsed ${tasks.length} task(s) from ${path.relative(cfg.root, cfg.tasksFile) || cfg.tasksFile} ` +
      `(source="${cfg.externalSource}"${cfg.keyPrefix ? `, prefix "${cfg.keyPrefix}"` : ", no prefix"})`
  );
  log(`Mode: SYNC${DRY ? " (dry-run)" : ""}\n`);

  const client = makeClient(cfg);
  const lookups = await resolveLookups(client);

  for (const name of Object.values(STATE_MAP)) {
    if (!lookups.state[name])
      fail(`Plane project has no state named "${name}". Check STATE_MAP / project states.`);
  }
  const usedLabels = new Set(tasks.map((t) => cfg.labelMap[t.category]).filter(Boolean));
  for (const name of usedLabels) {
    if (!lookups.label[name])
      fail(`Plane project has no label named "${name}". Create it under Project settings → Labels.`);
  }

  const existing = await fetchAllIssues(client);
  const byExt = new Map(); // external_id → issue (only our source)
  for (const it of existing) {
    if (it.external_source === cfg.externalSource && it.external_id) byExt.set(it.external_id, it);
  }

  // Refuse destructive write: an id newly introduced locally that already exists on the board
  // would UPDATE someone else's card. Detection uses git HEAD of TASK.md when available.
  const currentIds = tasks.map((t) => t.id);
  const newlyIntroduced = newIdsSinceGitHead(cfg.tasksFile, currentIds);
  if (newlyIntroduced && newlyIntroduced.length && !args.adopt) {
    const collisions = newlyIntroduced.filter((id) => byExt.has(externalId(cfg, id)));
    if (collisions.length) {
      fail(destructiveWriteRefusal(collisions));
    }
  } else if (newlyIntroduced === null && !args.adopt) {
    log(
      `Note: cannot compare TASK.md to git HEAD — destructive-write refuse for new ids is skipped. Pass --adopt only for deliberate hand-card adoption.`
    );
  }

  let created = 0,
    updated = 0,
    unchanged = 0;
  const idByExt = new Map(); // external_id → plane issue id

  for (const task of tasks) {
    const ext = externalId(cfg, task.id);
    const issue = byExt.get(ext);
    const stateId = lookups.state[STATE_MAP[task.status]];
    const priority = PRIORITY_MAP[task.priority] || "none";
    const labelName = cfg.labelMap[task.category];
    const labelIds = labelName ? [lookups.label[labelName]] : [];
    const html = mdToHtml(buildBody(task));
    const wantText = htmlToPlain(html);
    // The card title carries the source id (WFC-20260808-02). `external_id` is a
    // correlation field trackers do not render, so an id stored only there cannot
    // be quoted, searched, or used to get from the board back to TASK.md.
    //
    // Derived ONCE and used at every site that reads or writes the title. It is
    // tempting to change only the create call, and that is a trap: the update
    // path below compares `issue.name` against this value, so a create that
    // prefixes while the comparison does not would rename the card back to the
    // bare title on the very next sync, forever — a card that flaps on every run
    // rather than an obvious failure.
    //
    // Bare `task.id` ("TASK-037"), not the prefixed `ext` ("ENG-TASK-037"): the
    // bare form is what the source file uses and what a person searches for.
    const cardName = `${task.id}: ${task.title}`;

    if (!issue) {
      if (DRY) {
        log(
          `CREATE  ${ext}  "${cardName}"  [${STATE_MAP[task.status]}, ${priority}${labelName ? ", " + labelName : ""}]`
        );
      } else {
        const created2 = await client.post(`/issues/`, {
          name: cardName,
          state: stateId,
          priority,
          labels: labelIds,
          external_id: ext,
          external_source: cfg.externalSource,
          description_html: html,
        });
        idByExt.set(ext, created2.id);
        log(`CREATED ${ext}  "${cardName}"`);
      }
      created++;
      continue;
    }

    idByExt.set(ext, issue.id);
    const changes = {};
    if (issue.name !== cardName) changes.name = cardName;
    if (issue.state !== stateId) changes.state = stateId;
    if ((issue.priority || "none") !== priority) changes.priority = priority;
    if (!sameLabels(issue.labels, labelIds)) changes.labels = labelIds;
    // description: compare plain text (both sides via htmlToPlain) to dodge churn
    if (htmlToPlain(issue.description_html) !== wantText) changes.description_html = html;

    if (Object.keys(changes).length === 0) {
      unchanged++;
      continue;
    }
    const what = Object.keys(changes)
      .map((k) =>
        k === "state" ? `state→${STATE_MAP[task.status]}` : k === "labels" ? `label→${labelName}` : k
      )
      .join(", ");
    if (DRY) {
      log(`UPDATE  ${ext}  ${what}`);
    } else {
      await client.patch(`/issues/${issue.id}/`, changes);
      log(`UPDATED ${ext}  ${what}`);
    }
    updated++;
  }

  // Removal propagates: a task deleted from TASK.md is deleted from the board.
  // The source is the single source of truth, so a card it no longer declares is
  // not "extra" — it is stale, and leaving it makes the mirror disagree with the
  // source silently. Scoped as ever to OUR external_source: hand-made cards and
  // other consumers' cards are never candidates.
  let deleted = 0;
  const orphans = orphanExternalIds(
    byExt.keys(),
    tasks.map((t) => externalId(cfg, t.id)),
    cfg.keyPrefix
  );
  if (orphans.length) {
    // Zero parsed tasks with orphans to delete is a misconfiguration, never a
    // decision — a wrong --tasks path or an empty file would otherwise wipe the
    // board in one run. Refuse rather than obey it.
    if (tasks.length === 0) {
      fail(
        `Refusing to delete ${orphans.length} card(s): TASK.md parsed ZERO tasks.\n` +
          `That is a wrong --tasks path or an unreadable file, not a request to empty the board.`
      );
    }
    for (const ext of orphans) {
      const issue = byExt.get(ext);
      if (DRY) {
        log(`DELETE  ${ext}  "${issue.name}"  (absent from TASK.md)`);
      } else {
        await client.del(`/issues/${issue.id}/`);
        log(`DELETED ${ext}  "${issue.name}"`);
      }
      deleted++;
    }
  }

  log(
    `\nDone. created=${created} updated=${updated} deleted=${deleted} unchanged=${unchanged}${DRY ? "  (dry-run — no writes performed)" : ""}`
  );
  if (DRY && created + updated + deleted === 0) log("Idempotent: nothing to do.");
}

function log(m) {
  console.log(m);
}
function fail(m) {
  console.error(`[sync-plane] ERROR: ${m}`);
  process.exit(1);
}

// Run the sync ONLY when invoked directly as a CLI, so the unit tests can
// require() the pure rendering/parsing helpers below without firing a live
// sync against the tracker. A shipped, shared adapter must be require-safe.
if (require.main === module) {
  run().catch((e) => fail(e.message || String(e)));
}

module.exports = {
  esc,
  inlineMd,
  mdToHtml,
  htmlToPlain,
  parseDependsOn,
  parseTasks,
  taskIdsFromContent,
  orphanExternalIds,
  ownNamespace,
  destructiveWriteRefusal,
};
