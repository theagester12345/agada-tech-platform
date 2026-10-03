/**
 * sync-plane.test.js — regression tests for the TASK.md → tracker renderer.
 *
 * Run:  node --test adapters/plane/sync-plane.test.js
 *
 * ⚠️ NOTHING RUNS THIS AUTOMATICALLY (no CI, no root package.json assumed).
 * Run it by hand after touching sync-plane.js, and wire it into CI the moment
 * one exists. (Pass the FILE, not the directory: `node --test adapters/plane/`
 * resolves the dir as an entry module on newer Node and dies MODULE_NOT_FOUND.)
 *
 * This guards the ONE shared adapter every side invokes. It exists because
 * `mdToHtml`'s list-item regex once silently deleted the first character of
 * every non-checkbox bullet — undetected for months, because nothing asserted
 * on the renderer's output and the corruption is DETERMINISTIC: both sides of
 * the sync's comparison agreed on the mangled text, so the sync reported
 * "unchanged" and the mirror looked healthy while being wrong in hundreds of
 * places. These tests are the guard against that whole class of bug. Assert on
 * tag ordering/pairing, never on tag counts (the broken output was
 * count-balanced while inverted), and brute-force the character space rather
 * than re-checking a remembered list of examples.
 *
 * Requires Node 18+ (node:test). No external dependencies — matches the script.
 */

"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { inlineMd, mdToHtml, htmlToPlain, orphanExternalIds, parseTasks, destructiveWriteRefusal } = require("./sync-plane.js");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Helper: assert inline tags are correctly ORDERED and PAIRED.
//
// Deliberately NOT a count check. Pre-fix output had BALANCED <code> counts
// while being inverted — closing tags emitted before their openers. Counting
// tags would have called that output valid.
// ---------------------------------------------------------------------------
function assertTagsWellFormed(html, tag) {
  const re = new RegExp(`</?${tag}>`, "g");
  let depth = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    depth += m[0][1] === "/" ? -1 : 1;
    assert.ok(
      depth >= 0,
      `closing </${tag}> appeared before its opener (inverted tags) in: ${html}`
    );
    assert.ok(depth <= 1, `nested <${tag}> in: ${html}`);
  }
  assert.strictEqual(depth, 0, `unclosed <${tag}> in: ${html}`);
}

// ---------------------------------------------------------------------------
// The core regression: no character may be eaten.
// ---------------------------------------------------------------------------

test("mdToHtml('- plain text') preserves the leading 'p'", () => {
  // The single cheapest guard against the whole character-eating class.
  assert.strictEqual(mdToHtml("- plain text"), "<ul><li>plain text</li></ul>");
});

test("no bullet form loses its first character", () => {
  const cases = [
    ["plain", "- plain text", "plain text"],
    ["backtick-leading", "- `code` after", "<code>code</code> after"],
    ["bold-leading", "- **Endpoint:** add @GET", "<b>Endpoint:</b> add @GET"],
    ["star bullet", "* star item", "star item"],
    ["deep nested", "    - nested item", "nested item"],
    ["md-link-leading", "- [link](url) trailing", "[link](url) trailing"],
  ];
  for (const [name, src, wantInner] of cases) {
    assert.strictEqual(mdToHtml(src), `<ul><li>${wantInner}</li></ul>`, `form: ${name}`);
  }
});

test("every printable first character survives the renderer", () => {
  // Brute-force the class rather than enumerating forms we happened to think of.
  for (const ch of "abzAZ09`*_[](){}<>&#@!?.,:;\"'|/\\+-=~$%^") {
    const html = mdToHtml(`- ${ch}X trailing`);
    const plain = htmlToPlain(html);
    assert.ok(
      plain.includes("X trailing"),
      `first char ${JSON.stringify(ch)} broke the line: ${html}`
    );
    if (!"`*[".includes(ch)) {
      // Chars with no inline-markdown meaning must appear verbatim.
      const expected = ch === "&" ? "&" : ch === "<" ? "<" : ch === ">" ? ">" : ch;
      assert.ok(
        plain.startsWith(expected),
        `first char ${JSON.stringify(ch)} was eaten: plain=${JSON.stringify(plain)}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Checkbox handling must be UNCHANGED from the pre-fix behaviour.
// ---------------------------------------------------------------------------

test("task checkboxes are consumed as a unit, text preserved", () => {
  for (const state of [" ", "x", "X", "~"]) {
    assert.strictEqual(
      mdToHtml(`- [${state}] criterion one`),
      "<ul><li>criterion one</li></ul>",
      `checkbox state ${JSON.stringify(state)}`
    );
  }
});

test("a checkbox-shaped token is only consumed when it really is one", () => {
  // `[]` is not a checkbox (no state char) — it must survive verbatim.
  assert.strictEqual(mdToHtml("- [] not a checkbox"), "<ul><li>[] not a checkbox</li></ul>");
  // A markdown link is not a checkbox either.
  assert.strictEqual(mdToHtml("- [a](b) x"), "<ul><li>[a](b) x</li></ul>");
});

// ---------------------------------------------------------------------------
// The dense-inline bullet whose corruption produced a permanent phantom diff:
// an eaten backtick made the line's backtick count odd, inverting every later
// inline-code pair and crossing the enclosing <b> span.
// ---------------------------------------------------------------------------

test("a dense inline-code bullet renders with paired, ordered <code> and no stray backtick", () => {
  const line =
    "  - `PaymentService` (`:140`, `:274`) — the `listAll()` calls return the " +
    "**entire unordered `payments` table**. Add a deterministic ORDER BY " +
    "(`created_at DESC, id DESC`).";

  const html = mdToHtml(line);

  // Pre-fix this began "<li>PaymentService<code>" — opener eaten, pairs inverted.
  assert.ok(
    html.startsWith("<ul><li><code>PaymentService</code>"),
    `expected a matched opening <code>, got: ${html.slice(0, 80)}`
  );
  // 12 backticks on the line → 6 balanced pairs → 0 may survive as literals.
  assert.ok(!html.includes("`"), `stray literal backtick left in: ${html}`);
  assertTagsWellFormed(html, "code");
  assertTagsWellFormed(html, "b");
});

test("an odd backtick count cannot invert the tags of a later pair", () => {
  // The mechanism: eating one backtick made the count odd, so every subsequent
  // pair flipped (</code>text<code>) and crossed the enclosing <b> span.
  const html = mdToHtml("- `a` and **bold `b` here**");
  assertTagsWellFormed(html, "code");
  assertTagsWellFormed(html, "b");
  assert.ok(!html.includes("`"), `stray literal backtick in: ${html}`);
});

// ---------------------------------------------------------------------------
// Non-bullet paths must be untouched by the fix.
// ---------------------------------------------------------------------------

test("headings and paragraphs are unaffected", () => {
  assert.strictEqual(mdToHtml("## Heading"), "<h2>Heading</h2>");
  assert.strictEqual(mdToHtml("plain paragraph"), "<p>plain paragraph</p>");
  assert.strictEqual(mdToHtml("**Status:** TODO"), "<p><b>Status:</b> TODO</p>");
});

test("inlineMd escapes HTML before emitting tags", () => {
  assert.strictEqual(inlineMd("a & b < c"), "a &amp; b &lt; c");
  assert.strictEqual(inlineMd("`<script>`"), "<code>&lt;script&gt;</code>");
});

test("htmlToPlain projects both sides identically for valid markup", () => {
  // This is the sync's idempotency contract: our HTML and the tracker's
  // re-normalized HTML must project to the same plain text, or the diff never
  // converges.
  const ours = mdToHtml("- `a` x");
  assert.strictEqual(htmlToPlain(ours), htmlToPlain("<ul><li><code>a</code> x</li></ul>"));
});

test("a list is closed before a following heading or paragraph", () => {
  assert.strictEqual(mdToHtml("- one\n\ntext"), "<ul><li>one</li></ul><p>text</p>");
  assert.strictEqual(mdToHtml("- one\n## H"), "<ul><li>one</li></ul><h2>H</h2>");
});

test("taskIdsFromContent collects heading ids only", () => {
  const { taskIdsFromContent } = require("./sync-plane.js");
  const ids = taskIdsFromContent(
    "# T\n\n### TASK-001: One\n**Status:** TODO\n\nMentions TASK-002 in prose.\n\n### TASK-003: Three\n**Status:** TODO\n"
  );
  assert.deepStrictEqual(ids, ["TASK-001", "TASK-003"]);
});

// ---------------------------------------------------------------------------
// orphanExternalIds — removal propagates (TASK-033).
//
// The failure this guards is deletion hitting the wrong card. Both directions
// are asserted: a card the source still declares must NEVER be returned, and a
// card it has dropped must ALWAYS be. Prefix handling matters — external_ids are
// namespaced per consumer, so comparing a bare TASK id against a prefixed board
// id would mark every card an orphan and delete the whole board.
// ---------------------------------------------------------------------------

test("orphanExternalIds: returns ids on the board but not in the source", () => {
  const orphans = orphanExternalIds(["TASK-001", "TASK-002", "TASK-003"], ["TASK-001", "TASK-003"], "");
  assert.deepStrictEqual(orphans, ["TASK-002"]);
});

test("orphanExternalIds: nothing orphaned when the source declares everything", () => {
  assert.deepStrictEqual(orphanExternalIds(["TASK-001", "TASK-002"], ["TASK-002", "TASK-001"], ""), []);
});

test("orphanExternalIds: a source task not yet on the board is not an orphan", () => {
  assert.deepStrictEqual(orphanExternalIds(["TASK-001"], ["TASK-001", "TASK-009"], ""), []);
});

test("orphanExternalIds: empty board yields no deletions", () => {
  assert.deepStrictEqual(orphanExternalIds([], ["TASK-001"], ""), []);
});

test("orphanExternalIds: prefixed ids compare like-for-like, never bare-vs-prefixed", () => {
  // Regression lock: comparing "WF-TASK-001" against "TASK-001" would orphan
  // every card on a prefixed board and delete all of them in one run.
  // Updated by WFC-20260928-01: the prefix is now an INPUT rather than something inferred
  // from the ids, so this case passes the namespace it was always describing. The intent is
  // unchanged — a prefixed consumer finds its own orphans and no one else's.
  const board = ["WF-TASK-001", "WF-TASK-002"];
  assert.deepStrictEqual(orphanExternalIds(board, ["WF-TASK-001", "WF-TASK-002"], "WF-"), []);
  assert.deepStrictEqual(orphanExternalIds(board, ["WF-TASK-001"], "WF-"), ["WF-TASK-002"]);
  // And the failure the original lock was built for, now stated directly: a BARE source list
  // against a prefixed board deletes nothing, because the bare consumer owns none of it.
  assert.deepStrictEqual(orphanExternalIds(board, ["TASK-001"], ""), []);
});

test("orphanExternalIds: a consumer never proposes deleting another consumer's cards", () => {
  // WFC-20260928-01 (vovo-spaces): several sides mirror into ONE board under the same
  // external_source, distinguished only by key prefix. Scoping the orphan set to the source
  // alone made each side's sync propose deleting every other side's cards — observed as 19
  // DELETEs each way on a two-side project. The zero-task refusal cannot catch it, because
  // each file parses plenty of tasks.
  const board = ["BE-TASK-001", "BE-TASK-002", "FE-TASK-001", "FE-TASK-002"];
  assert.deepStrictEqual(
    orphanExternalIds(board, ["BE-TASK-001", "BE-TASK-002"], "BE-"),
    [],
    "frontend's cards are not backend's to delete"
  );
  assert.deepStrictEqual(
    orphanExternalIds(board, ["BE-TASK-001"], "BE-"),
    ["BE-TASK-002"],
    "and a real orphan in its OWN namespace is still returned"
  );
});

test("orphanExternalIds: an EMPTY prefix excludes every prefixed id", () => {
  // The subtle half: every string starts with "", so a naive startsWith() would make the
  // unprefixed consumer claim the whole board. Membership is an exact <prefix>TASK-<n> match.
  const board = ["TASK-001", "TASK-002", "BE-TASK-001", "FE-TASK-009"];
  assert.deepStrictEqual(
    orphanExternalIds(board, ["TASK-001", "TASK-002"], ""),
    [],
    "prefixed cards belong to other consumers"
  );
  assert.deepStrictEqual(
    orphanExternalIds(board, ["TASK-001"], ""),
    ["TASK-002"],
    "own-namespace orphan still found"
  );
});

test("orphanExternalIds: accepts an iterator (Map.keys()) as well as an array", () => {
  const byExt = new Map([["TASK-001", {}], ["TASK-002", {}]]);
  assert.deepStrictEqual(orphanExternalIds(byExt.keys(), ["TASK-001"], ""), ["TASK-002"]);
});

// ---------------------------------------------------------------------------
// The LAST card is the only one with no following heading to stop at, so it ran
// to EOF and absorbed the file's footer. The Task Synchronization Protocol
// *requires* bumping `_Last Updated:` on every task edit, so the last card's
// rendered body changed on every edit and the mirror rewrote it on every single
// run — quietly breaking the Principle's own idempotency guarantee ("a second
// run with no TASK.md change must report unchanged and write nothing").
//
// Observed in this repo three times in one session as `UPDATE TASK-006` on runs
// that touched nothing in TASK-006. It hid because the create-vs-update rule
// correctly waves through an update on a card you did not just add.
// ---------------------------------------------------------------------------

function withTasksFile(body, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-"));
  const f = path.join(dir, "TASK.md");
  fs.writeFileSync(f, body);
  try { return fn(f); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const TWO_CARDS = `# Board

## TODO

### TASK-001: First
**Status:** TODO  
**Priority:** Normal  
**Category:** Template  
**Depends On:** None

**Description:** first card.

### TASK-002: Last
**Status:** TODO  
**Priority:** Normal  
**Category:** Template  
**Depends On:** None

**Description:** last card, and nothing follows it but the footer.

---

_Last Updated: 2026-09-11 (something)_
`;

test("parseTasks: the last card does not absorb the file footer", () => {
  withTasksFile(TWO_CARDS, (f) => {
    const last = parseTasks(f).find((t) => t.id === "TASK-002");
    const blob = JSON.stringify(last);
    assert.ok(!/_Last Updated/.test(blob), "last card swallowed the _Last Updated footer");
    assert.ok(!/\\n---/.test(blob), "last card swallowed the trailing --- rule");
  });
});

test("parseTasks: bumping only the footer leaves every card byte-identical", () => {
  // This is the idempotency guarantee stated in the mirror Principle, asserted
  // directly: the footer is what the protocol makes you change on every edit.
  const bumped = TWO_CARDS.replace("2026-09-11 (something)", "2026-09-12 (something else)");
  const a = withTasksFile(TWO_CARDS, (f) => JSON.stringify(parseTasks(f)));
  const b = withTasksFile(bumped, (f) => JSON.stringify(parseTasks(f)));
  assert.strictEqual(b, a, "a footer bump changed a parsed card — the mirror will rewrite it every run");
});

test("parseTasks: a card's own trailing content is still kept", () => {
  // CONTROL for the fix: the trim must take the footer, not real body text.
  withTasksFile(TWO_CARDS, (f) => {
    const last = parseTasks(f).find((t) => t.id === "TASK-002");
    assert.ok(/nothing follows it but the footer/.test(JSON.stringify(last)),
      "the trim ate the card's actual description");
  });
});

test("parseTasks: a non-final card is unaffected by the footer trim", () => {
  withTasksFile(TWO_CARDS, (f) => {
    const first = parseTasks(f).find((t) => t.id === "TASK-001");
    assert.ok(/first card/.test(JSON.stringify(first)));
    assert.ok(!/last card/.test(JSON.stringify(first)), "block boundary leaked into the next card");
  });
});

// ---------------------------------------------------------------------------
// The refusal names the resolution that is USUALLY correct.
//
// `byExt` is filtered to our own external_source, so a colliding card is always
// one this workflow created. The overwhelmingly common way to reach this state
// is ordinary: version control is user-gated here, so a session syncs a new card
// and commits TASK.md minutes later — until it commits, the id is "new" relative
// to git HEAD while the board already carries it.
//
// The old message offered "renumber, or --adopt". Renumbering is wrong (the id
// does not collide with anyone else's card, it collides with its own), and
// reaching for --adopt to silence a guard is the habit that makes guards
// useless. Committing the source is what actually resolves it.
// ---------------------------------------------------------------------------

test("destructiveWriteRefusal: names committing the source before --adopt", () => {
  const msg = destructiveWriteRefusal(["TASK-052"]);
  const iCommit = msg.indexOf("commit");
  const iAdopt = msg.indexOf("--adopt");
  assert.ok(iCommit !== -1, "refusal never mentions committing the source");
  assert.ok(iAdopt !== -1, "refusal must still offer --adopt for the hand-stamped case");
  assert.ok(iCommit < iAdopt, "--adopt is listed before committing — the wrong reflex first");
});

test("destructiveWriteRefusal: lists every colliding id", () => {
  const msg = destructiveWriteRefusal(["TASK-052", "TASK-053"]);
  assert.match(msg, /TASK-052/);
  assert.match(msg, /TASK-053/);
});

test("destructiveWriteRefusal: still refuses, and says so", () => {
  // CONTROL: naming a gentler resolution must not soften the refusal itself.
  const msg = destructiveWriteRefusal(["TASK-052"]);
  assert.match(msg, /Refusing destructive write/);
});

test("destructiveWriteRefusal: says the card is one this sync created", () => {
  // The index is scoped to our external_source, so "someone else's card" is not
  // a state this branch can reach. Saying so is what makes "renumber" visibly
  // the wrong answer rather than a coin-flip against --adopt.
  const msg = destructiveWriteRefusal(["TASK-052"]);
  assert.match(msg, /external_source|this sync|this workflow/i);
});
