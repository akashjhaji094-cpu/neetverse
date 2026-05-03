/**
 * Detects and formats special NEET question types:
 *  - Statement-based (Statement I / Statement II / Assertion / Reason)
 *  - Match-the-column / Match the following (Column I  vs  Column II)
 *  - Multi-statement "which of the following are correct"
 *
 * Returns enhanced HTML where each statement / column row sits in its own
 * visually distinct box (works in both screen + print).
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
 * Wrap "Statement I:", "Statement II:", "Assertion (A):", "Reason (R):"
 * each in its own box.
 */
function formatStatementBlocks(html: string): string {
  // Match Statement-N / Assertion / Reason markers.
  const labeledRe =
    /\b(Statement[\s-]*(?:I{1,3}|IV|[1-4])|Assertion(?:\s*\([A-Z]\))?|Reason(?:\s*\([A-Z]\))?)\s*[:.\)-]/i;

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
    body = body.replace(/^\s*[:.\)-]\s*/, "");
    if (!label) continue;
    // Normalise bare roman labels like "I." → "Statement I"
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

  // Try to extract pairs like "(A) something" / "(P) something"
  // Generic approach: pull all "(X) ...." up to next "(Y)" within Column blocks.
  const colSplit = html.split(
    /(Column\s*[-–—]?\s*II|List\s*[-–—]?\s*II)/i
  );
  if (colSplit.length < 2) return html;

  const beforeColII = colSplit[0];
  const afterColII = colSplit.slice(1).join("");

  // Pre-stem (text before "Column I")
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
  // afterColII may contain options too. Take only up to first "(1)"/"(a) (b) (c) (d)" option block
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
