/**
 * Detects and formats special NEET question types:
 *  - Statement-based (Statement I / Statement II / Assertion / Reason)
 *  - Match-the-column / Match the following (Column I  vs  Column II)
 *  - Multi-statement "which of the following are correct"
 *
 * Returns enhanced HTML where each statement / column row sits in its own
 * visually distinct box (works in both screen + print).
 *
 * NOTE: this file intentionally does NOT touch LaTeX. Question text in the
 * database is already valid, correctly-escaped LaTeX ($...$ / $$...$$,
 * \frac, \mathsf, etc) — MathJax (see useMathJax.ts / MathContent.tsx)
 * renders it as-is. An earlier "preprocessLatex" step here used to run
 * backslash-fixing regexes on the assumption the HTML was double-escaped;
 * it wasn't, so it was dead code, and it's been removed rather than risk
 * it mangling real content in the future.
 */

const BOX_BASE =
  "display:block;border-left:4px solid hsl(var(--primary,222 47% 40%));background:rgba(59,130,246,0.06);padding:8px 12px;margin:8px 0;border-radius:6px;font-size:inherit;line-height:1.55;";

const STEM_BASE =
  "display:block;margin-bottom:10px;font-weight:500;";

const TABLE_WRAP =
  "display:block;overflow-x:auto;margin:8px 0;-webkit-overflow-scrolling:touch;";
const TABLE_BASE =
  "border-collapse:collapse;width:100%;min-width:320px;font-size:inherit;line-height:1.45;";
const TH_BASE =
  "border:1px solid #666;background:#eef2ff;padding:6px 10px;text-align:left;font-weight:600;width:50%;";
const TD_BASE =
  "border:1px solid #666;padding:6px 10px;vertical-align:top;";

/** Normalize bullets / breaks so we can split reliably */
function normalize(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/gi, "<br/>")
    .replace(/\u00a0/g, " ");
}

/**
 * Wrap "Statement I:", "Statement II:", "Assertion (A):", "Reason (R):"
 * each in its own box.
 */
function formatStatementBlocks(html: string): string {
  // Match Statement-N / Assertion / Reason markers.
  const labeledRe =
    /\b(Statement[\s-]*(?:I{1,3}|IV|[1-4])|Assertion(?:\s*\([A-Z]\))?|Reason(?:\s*\([A-Z]\))?)\s*[:.\)\-]/i;

  // Fallback: bare roman-numeral list "I." "II." "III." (≥2 occurrences)
  // Often appears when a question mentions "the following statements:" then I./II./III.
  const bareRomanRe = /(^|[\s>.])(I{1,3}|IV)\s*[\.\)]\s+/g;
  const bareMatches = html.match(bareRomanRe);

  if (!labeledRe.test(html) && (!bareMatches || bareMatches.length < 2)) return html;

  // Split keeping the markers
  const splitRe = labeledRe.test(html)
    ? /(\bStatement[\s-]*(?:I{1,3}|IV|[1-4])\b|\bAssertion(?:\s*\([A-Z]\))?|\bReason(?:\s*\([A-Z]\))?)/i
    : /(?:^|(?<=[\s>.]))((?:I{1,3}|IV)\s*[\.\)])\s+/;
  const parts = html.split(splitRe);

  if (parts.length < 3) return html;

  let stem = parts[0].trim();
  // Strip trailing colon / dash from stem
  stem = stem.replace(/[:\-—]\s*$/, "").trim();

  let out = stem
    ? `<div style="${STEM_BASE}">${stem}</div>`
    : "";

  for (let i = 1; i < parts.length; i += 2) {
    let label = parts[i];
    let body = (parts[i + 1] || "").trim();
    // remove leading colon / dot
    body = body.replace(/^\s*[:.\)\-]\s*/, "");
    if (!label) continue;
    // Normalise bare roman labels like "I." → "Statement I"
    const bareRoman = /^\s*(I{1,3}|IV)\s*[\.\)]?\s*$/i.exec(label);
    if (bareRoman) label = `Statement ${bareRoman[1].toUpperCase()}`;
    out += `<div style="${BOX_BASE}"><b>${label.trim()}:</b> ${body}</div>`;
  }
  return out;
}

/**
 * Match-the-column: detects a run of A/B/C/D items followed by a run of
 * P/Q/R/S (or 1/2/3/4) items and renders them as a two-column table.
 * Works whether or not the question uses the words "Column"/"List".
 */
function formatMatchColumns(html: string): string {
  // Heuristic gate: only try if the stem hints at matching OR the label
  // pattern A..D followed by P..S / 1..4 is visibly present.
  const hasHint = /\b(match|column|list)\b/i.test(html);
  const hasABCD = /(^|[\s>(.])A[\.\)]\s*\S/i.test(html) && /(^|[\s>(.])D[\.\)]\s*\S/i.test(html);
  const hasPQRS = /(^|[\s>(.])P[\.\)]\s*\S/i.test(html) && /(^|[\s>(.])S[\.\)]\s*\S/i.test(html);
  const has1234 =
    /(^|[\s>(.])1[\.\)]\s*\S/.test(html) && /(^|[\s>(.])4[\.\)]\s*\S/.test(html);
  if (!hasABCD || !(hasPQRS || has1234) || !hasHint) return html;

  // Split off the stem: everything before the first "A." / "A)" / "(A)".
  const firstA = html.search(/(^|[\s>(.])A[\.\)]\s*\S/);
  if (firstA < 0) return html;
  // Preserve full stem text (includes any "Match ... Column I with Column II.").
  let stem = html.slice(0, firstA).trim();
  const body = html.slice(firstA);

  // Extract labeled items. Labels: single uppercase A-D letters, or P-S letters,
  // or digits 1-4. Each item's text runs until the next label of ANY family.
  const labelBoundary = /(?<=^|[\s>(.])(A|B|C|D|P|Q|R|S|[1-4])[\.\)]\s+/g;

  type Item = { label: string; text: string };
  const items: Item[] = [];
  const matches: { label: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(labelBoundary.source, "g");
  while ((m = re.exec(body)) !== null) {
    matches.push({ label: m[1], index: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const text = body.slice(cur.end, next ? next.index : body.length).trim();
    if (text) items.push({ label: cur.label.toUpperCase(), text });
  }

  const leftLabels = ["A", "B", "C", "D"];
  const rightLabelsAlpha = ["P", "Q", "R", "S"];
  const rightLabelsNum = ["1", "2", "3", "4"];

  const left = items.filter((it) => leftLabels.includes(it.label));
  let right = items.filter((it) => rightLabelsAlpha.includes(it.label));
  if (right.length < 2) right = items.filter((it) => rightLabelsNum.includes(it.label));

  if (left.length < 2 || right.length < 2) return html;

  const rows = Math.max(left.length, right.length);
  const cell = (it?: Item) =>
    it ? `<b>${it.label}.</b> ${it.text}` : "";

  let table = `<div style="${TABLE_WRAP}"><table style="${TABLE_BASE}"><thead><tr>` +
    `<th style="${TH_BASE}">Column I</th>` +
    `<th style="${TH_BASE}">Column II</th>` +
    `</tr></thead><tbody>`;
  for (let i = 0; i < rows; i++) {
    table += `<tr><td style="${TD_BASE}">${cell(left[i])}</td><td style="${TD_BASE}">${cell(right[i])}</td></tr>`;
  }
  table += `</tbody></table></div>`;

  // Clean up trailing "Choose the correct answer..." style phrases so they
  // don't disappear — keep them in the stem area above the table.
  return (stem ? `<div style="${STEM_BASE}">${stem}</div>` : "") + table;
}

/**
 * Public formatter. Safe to run on every question — returns input unchanged
 * if no special patterns are detected.
 */
export function formatQuestionHtml(html: string | null | undefined): string {
  if (!html) return "";

  const norm = normalize(html);

  // Match-the-column has higher priority (more specific)
  const colFormatted = formatMatchColumns(norm);
  if (colFormatted !== norm) return colFormatted;

  const stmtFormatted = formatStatementBlocks(norm);
  if (stmtFormatted !== norm) return stmtFormatted;

  return norm;
}
