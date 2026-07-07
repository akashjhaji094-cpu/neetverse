/**
 * Detects and formats special NEET question types:
 *  - Statement-based (Statement I / Statement II / Statement A / B / Assertion / Reason)
 *  - Match-the-column / Match the following (Column I  vs  Column II)
 *  - Bare labeled statement lists — (a)...(b)...(c)...(d)..., (i)...(ii)...,
 *    (p)...(q)...(r)...(s)... — run together with no separator in the source
 *
 * Returns enhanced HTML where each statement / column row / labeled item
 * sits in its own visually distinct box (works in both screen + print).
 *
 * IMPORTANT: only run this on the QUESTION STEM and EXPLANATION, never on
 * options. Options routinely contain the plain-English words "Assertion",
 * "Reason", "Statement" as part of an already-correct sentence (e.g. "Both
 * Assertion and Reason are correct...") — running the statement-splitter on
 * that text corrupts a perfectly fine option. Use formatOptionHtml() for
 * options instead — it only does safe whitespace cleanup.
 */

const BOX_BASE =
  "display:block;border-left:3px solid #000;background:#f3f3f3;padding:6px 10px;margin:6px 0;border-radius:2px;font-size:inherit;line-height:1.5;";

const STEM_BASE =
  "display:block;margin-bottom:8px;font-weight:500;";

/** Normalize bullets / breaks so we can split reliably */
function normalize(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/gi, "<br/>")
    .replace(/\u00a0/g, " ");
}

/**
 * Wrap "Statement I:", "Statement II:", "Statement A:", "Statement B:",
 * "Assertion (A):", "Reason (R):" each in its own box.
 */
function formatStatementBlocks(html: string): string {
  const labeledRe =
    /\b(Statement[\s-]*(?:I{1,3}|IV|[1-5]|[A-E])|Assertion(?:\s*\([A-Z]\))?|Reason(?:\s*\([A-Z]\))?)\s*[:.\)-]/i;

  const bareRomanRe = /(^|[\s>.])(I{1,3}|IV)\s*[\.\)]\s+/g;
  const bareMatches = html.match(bareRomanRe);

  if (!labeledRe.test(html) && (!bareMatches || bareMatches.length < 2)) return html;

  const splitRe = labeledRe.test(html)
    ? /(\bStatement[\s-]*(?:I{1,3}|IV|[1-5]|[A-E])\b|\bAssertion(?:\s*\([A-Z]\))?|\bReason(?:\s*\([A-Z]\))?)/i
    : /(?:^|(?<=[\s>.]))((?:I{1,3}|IV)\s*[\.\)])\s+/;
  const parts = html.split(splitRe);

  if (parts.length < 3) return html;

  let stem = parts[0].trim();
  stem = stem.replace(/[:\-—]\s*$/, "").trim();

  let out = stem ? `<div style="${STEM_BASE}">${stem}</div>` : "";

  for (let i = 1; i < parts.length; i += 2) {
    let label = parts[i];
    let body = (parts[i + 1] || "").trim();
    body = body.replace(/^\s*[:.\)-]\s*/, "");
    if (!label) continue;
    const bareRoman = /^\s*(I{1,3}|IV)\s*[\.\)]?\s*$/i.exec(label);
    if (bareRoman) label = `Statement ${bareRoman[1].toUpperCase()}`;
    out += `<div style="${BOX_BASE}"><b>${label.trim()}:</b> ${body}</div>`;
  }
  return out;
}

/**
 * Match-the-column: detects "Column I" / "Column II" or "List I" / "List II"
 * and renders them as a side-by-side table.
 */
function formatMatchColumns(html: string): string {
  if (!/(Column|List)\s*[-–—]?\s*I\b/i.test(html)) return html;

  const colSplit = html.split(
    /(Column\s*[-–—]?\s*II|List\s*[-–—]?\s*II)/i
  );
  if (colSplit.length < 2) return html;

  const beforeColII = colSplit[0];
  const afterColII = colSplit.slice(1).join("");

  const preMatch = beforeColII.split(/(Column\s*[-–—]?\s*I|List\s*[-–—]?\s*I)/i);
  const stem = preMatch[0]?.trim() || "";
  const colIBody = preMatch.slice(2).join("").trim();

  const extractItems = (raw: string): { label: string; text: string }[] => {
    const cleaned = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|span)[^>]*>/gi, "\n");
    const items: { label: string; text: string }[] = [];
    const itemRe = /\(?([A-Za-z]|[ivxIVX]{1,4}|\d{1,2})\)\s*([\s\S]*?)(?=\n\s*\(?[A-Za-z]\)|\n\s*\(?\d+\)|\n\s*\(?[ivxIVX]+\)|$)/g;
    let m;
    while ((m = itemRe.exec(cleaned)) !== null) {
      const label = m[1].trim();
      const text = m[2].replace(/\n+/g, " ").trim();
      if (text) items.push({ label, text });
    }
    return items;
  };

  const left = extractItems(colIBody);
  const rightRaw = afterColII.split(
    /\n\s*\(?(?:1|a|A)\)\s*\(?(?:2|b|B)\)\s*/i
  )[0];
  const right = extractItems(rightRaw);

  if (left.length < 2 || right.length < 2) return html;

  const rows = Math.max(left.length, right.length);
  let table = `<table style="border-collapse:collapse;width:100%;margin:6px 0;font-size:inherit;">
    <thead>
      <tr>
        <th style="border:1px solid #444;background:#f0f0f0;padding:4px 8px;width:50%;text-align:left;">Column I</th>
        <th style="border:1px solid #444;background:#f0f0f0;padding:4px 8px;width:50%;text-align:left;">Column II</th>
      </tr>
    </thead><tbody>`;
  for (let i = 0; i < rows; i++) {
    const l = left[i];
    const r = right[i];
    table += `<tr>
      <td style="border:1px solid #444;padding:4px 8px;vertical-align:top;">${
        l ? `<b>(${l.label})</b> ${l.text}` : ""
      }</td>
      <td style="border:1px solid #444;padding:4px 8px;vertical-align:top;">${
        r ? `<b>(${r.label})</b> ${r.text}` : ""
      }</td>
    </tr>`;
  }
  table += "</tbody></table>";

  return (stem ? `<div style="${STEM_BASE}">${stem}</div>` : "") + table;
}

type LabelStyle = "letter-lower" | "letter-upper" | "roman-lower" | "roman-upper" | "number" | "pqrs-lower" | "pqrs-upper";

const LABEL_SEQUENCES: Record<LabelStyle, string[]> = {
  "letter-lower": ["a", "b", "c", "d", "e"],
  "letter-upper": ["A", "B", "C", "D", "E"],
  "roman-lower": ["i", "ii", "iii", "iv", "v"],
  "roman-upper": ["I", "II", "III", "IV", "V"],
  "number": ["1", "2", "3", "4", "5"],
  "pqrs-lower": ["p", "q", "r", "s", "t"],
  "pqrs-upper": ["P", "Q", "R", "S", "T"],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Handles statements packed together with bare parenthesised labels and no
 * other separator, e.g. "...because (a) They get killed by sunlight (b)
 * They are dependent on water... (d) They are dependent on water for
 * fertilisation. Select the incorrect statements." Splits each labelled
 * clause into its own line so the statements are readable individually.
 */
function formatBareLabeledList(html: string): string {
  let best: { positions: { label: string; index: number; matchLen: number }[] } | null = null;

  (Object.keys(LABEL_SEQUENCES) as LabelStyle[]).forEach((style) => {
    const seq = LABEL_SEQUENCES[style];
    const positions: { label: string; index: number; matchLen: number }[] = [];
    let searchFrom = 0;
    for (const label of seq) {
      const re = new RegExp(`\\(${escapeRegExp(label)}\\)\\s*`);
      const rest = html.slice(searchFrom);
      const m = rest.match(re);
      if (!m || m.index === undefined) break;
      const idx = searchFrom + m.index;
      positions.push({ label, index: idx, matchLen: m[0].length });
      searchFrom = idx + m[0].length;
    }
    if (positions.length >= 3 && (!best || positions.length > best.positions.length)) {
      best = { positions };
    }
  });

  if (!best) return html;
  const positions = (best as { positions: { label: string; index: number; matchLen: number }[] }).positions;

  const stem = html.slice(0, positions[0].index).trim();
  let out = stem ? `<div style="${STEM_BASE}">${stem}</div>` : "";

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i].matchLen;
    const end = i + 1 < positions.length ? positions[i + 1].index : html.length;
    let body = html.slice(start, end).trim();
    let trailing = "";

    if (i === positions.length - 1) {
      // The closing instruction ("The correct statements are...", "Select
      // the incorrect statements") often runs on right after the last
      // statement with just a period between them, no other separator.
      const sentenceSplit = body.match(/^(.*?[.\)])\s*([A-Z][a-zA-Z]*\s+(?:the|is|are|correct|incorrect)[\s\S]*)$/);
      if (sentenceSplit && sentenceSplit[2].length < 150) {
        body = sentenceSplit[1].trim();
        trailing = sentenceSplit[2].trim();
      }
    }

    out += `<div style="${BOX_BASE}"><b>(${positions[i].label})</b> ${body}</div>`;
    if (trailing) out += `<div style="${STEM_BASE}">${trailing}</div>`;
  }
  return out;
}

/**
 * Public formatter for the QUESTION STEM / EXPLANATION only. Safe to run on
 * every question — returns input unchanged if no special pattern is found.
 */
export function formatQuestionHtml(html: string | null | undefined): string {
  if (!html) return "";

  const norm = normalize(html);

  const colFormatted = formatMatchColumns(norm);
  if (colFormatted !== norm) return colFormatted;

  const stmtFormatted = formatStatementBlocks(norm);
  if (stmtFormatted !== norm) return stmtFormatted;

  const bareListFormatted = formatBareLabeledList(norm);
  if (bareListFormatted !== norm) return bareListFormatted;

  return norm;
}

/**
 * Public formatter for OPTIONS. Deliberately does NOT run the
 * statement/Assertion-Reason/match-column detectors — an option is a short,
 * already-complete sentence, and those detectors would misfire on options
 * that legitimately contain the words "Assertion", "Reason" or "Statement"
 * (e.g. "Both Assertion and Reason are correct..."), fragmenting good text.
 */
export function formatOptionHtml(html: string | null | undefined): string {
  if (!html) return "";
  return normalize(html);
}
