/**
 * Deterministic (NO AI) LaTeX / MathJax clean-up for user-typed content.
 *
 * Every place where a human types a question or an explanation runs the text
 * through `sanitizeLatex` before preview and before saving, so the HTML that
 * finally reaches MathJax is always in the one dialect the app renders:
 * `$...$` inline and `$$...$$` display, single backslashes, no code fences.
 */

export interface LatexIssue {
  message: string;
  fixed: boolean;
}

export interface SanitizeResult {
  html: string;
  issues: LatexIssue[];
}

const GREEK_AND_CMDS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "nu", "pi",
  "rho", "sigma", "tau", "phi", "omega", "Delta", "Omega", "Sigma", "Gamma",
  "frac", "sqrt", "times", "cdot", "pm", "mp", "rightarrow", "leftarrow", "to",
  "int", "sum", "infty", "approx", "neq", "leq", "geq", "ce", "text", "vec", "hat",
  "circ", "degree", "log", "ln", "sin", "cos", "tan", "partial", "over",
];

/** Count `$` that are not escaped as `\$`. */
function countDollars(s: string): number {
  return (s.match(/(^|[^\\])\$/g) || []).length;
}

export function sanitizeLatex(input: string | null | undefined): SanitizeResult {
  const issues: LatexIssue[] = [];
  let s = String(input ?? "");
  if (!s.trim()) return { html: "", issues };

  const push = (message: string) => issues.push({ message, fixed: true });

  // 1. Markdown code fences pasted from ChatGPT / Google results.
  if (/```/.test(s)) {
    s = s.replace(/```(?:html|latex|markdown)?/gi, "");
    push("Code fences (```) removed");
  }

  // 2. \( ... \) and \[ ... \] → $ ... $ / $$ ... $$
  if (/\\\(|\\\[/.test(s)) {
    s = s.replace(/\\\((.+?)\\\)/gs, (_m, inner) => `$${String(inner).trim()}$`);
    s = s.replace(/\\\[(.+?)\\\]/gs, (_m, inner) => `$$${String(inner).trim()}$$`);
    push("\\( \\) and \\[ \\] delimiters converted to $ … $");
  }

  // 3. Double-escaped commands (\\frac) that come from JSON copy-paste.
  const doubled = new RegExp(`\\\\\\\\(${GREEK_AND_CMDS.join("|")})\\b`, "g");
  if (doubled.test(s)) {
    s = s.replace(doubled, "\\$1");
    push("Double backslashes (\\\\frac) fixed to single");
  }

  // 4. Stray `\\` used as a line break outside math → real line break.
  s = s.replace(/([^\\$])\\\\(\s*\n|\s*$)/g, "$1\n");

  // 5. Bare LaTeX commands sitting outside any math delimiter, e.g. `\frac{a}{b}`
  //    typed without $ around it. Wrap the smallest safe span in $ … $.
  if (countDollars(s) === 0) {
    const bare = new RegExp(`\\\\(?:${GREEK_AND_CMDS.join("|")})\\b(?:\\{[^{}]*\\}){0,3}`, "g");
    if (bare.test(s)) {
      s = s.replace(bare, (m) => `$${m}$`);
      push("Math commands without $ … $ were wrapped automatically");
    }
  }

  // 6. Markdown emphasis → HTML (MathJax-safe, and the app renders raw HTML).
  s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // 7. Superscript / subscript shorthand typed outside math: x^2 → $x^{2}$
  s = s.replace(/(^|[\s(>])([A-Za-z0-9)\]]+)\^(-?\d+)(?![^$]*\$)/g, (m, pre, base, exp) =>
    countDollars(s) === 0 ? `${pre}$${base}^{${exp}}$` : m
  );

  // 8. Unbalanced `$` — MathJax's most common breakage. Drop the last stray one.
  if (countDollars(s) % 2 !== 0) {
    const idx = s.lastIndexOf("$");
    if (idx >= 0) s = s.slice(0, idx) + s.slice(idx + 1);
    issues.push({ message: "Unbalanced $ found — the extra one was removed", fixed: true });
  }

  // 9. Empty math `$$` pairs left behind.
  s = s.replace(/\$\s*\$/g, "");

  // 10. Plain newlines → <br> so the preview matches the final render, but only
  //     when the author didn't already write HTML block tags.
  if (!/<(p|div|br|table|ul|ol)\b/i.test(s)) {
    s = s.replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>");
  }

  return { html: s.trim(), issues };
}

/** Convenience: just the cleaned string. */
export function cleanLatex(input: string | null | undefined): string {
  return sanitizeLatex(input).html;
}