// src/lib/email/renderEmailHtml.ts
// Walks EmailBlock[] -> a single, self-contained HTML string safe for
// Gmail, Outlook (incl. Word-engine versions), and Apple Mail.
//
// Rules followed throughout (these are NOT optional for email — breaking
// any one of them is the #1 cause of broken-looking marketing emails):
//   - Table-based layout (role="presentation"), not flexbox/grid
//   - Every style is INLINE (no external CSS, no <style> dependency —
//     Outlook strips <style> blocks in many versions)
//   - max-width 600px content column, centered
//   - Web-safe font stack only
//   - No background-image tricks, no CSS variables

const FONT = "Arial, Helvetica, sans-serif";
const GOLD = "#C9A227";
const GOLD_DARK = "#9C7E1A";
const INK = "#1A1A1A";
const MUTED = "#6B6B6B";
const BORDER = "#EDEDED";

function escapeAttr(s: string) {
  return String(s || "").replace(/"/g, "&quot;");
}

import type { EmailBlock } from "./types";

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "headline":
      return `<tr><td style="padding:24px 32px 8px;font-family:${FONT};font-size:26px;line-height:1.3;font-weight:700;color:${INK};">${block.text}</td></tr>`;

    case "subheading":
      return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED};">${block.text}</td></tr>`;

    case "text":
      return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};">${block.html}</td></tr>`;

    case "image":
      return `<tr><td style="padding:0 32px 16px;">
        <img src="${escapeAttr(block.url)}" alt="${escapeAttr(block.alt || "")}" width="536" style="width:100%;max-width:536px;height:auto;display:block;border:0;border-radius:8px;" />
      </td></tr>`;

    case "button": {
      const bg = block.style === "secondary" ? "#FFFFFF" : GOLD;
      const color = block.style === "secondary" ? GOLD_DARK : "#FFFFFF";
      const border = block.style === "secondary" ? `border:2px solid ${GOLD};` : "";
      return `<tr><td style="padding:8px 32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:8px;background-color:${bg};${border}">
            <a href="${escapeAttr(block.url)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${color};text-decoration:none;border-radius:8px;">${block.text}</a>
          </td>
        </tr></table>
      </td></tr>`;
    }

    case "featureCard":
      return `<tr><td style="padding:0 32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;">
          <tr><td style="padding:16px 18px;">
            ${block.icon ? `<div style="font-size:20px;margin-bottom:6px;">${block.icon}</div>` : ""}
            <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK};margin-bottom:4px;">${block.title}</div>
            <div style="font-family:${FONT};font-size:13.5px;line-height:1.6;color:${MUTED};">${block.description}</div>
          </td></tr>
        </table>
      </td></tr>`;

    case "coloredSection":
      return `<tr><td style="background-color:${escapeAttr(block.bgColor)};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${block.blocks.map(renderBlock).join("")}
        </table>
      </td></tr>`;

    case "divider":
      return `<tr><td style="padding:8px 32px;"><div style="border-top:1px solid ${BORDER};"></div></td></tr>`;

    case "footer": {
      const tg = block.socials?.telegram;
      const web = block.socials?.website;
      return `<tr><td style="padding:24px 32px;background-color:#FAFAFA;border-top:1px solid ${BORDER};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${FONT};font-size:12px;color:${MUTED};">
            NEETVerse — Your Universe of NEET Preparation<br/>
            ${web ? `<a href="${escapeAttr(web)}" style="color:${GOLD_DARK};text-decoration:none;">${web.replace(/^https?:\/\//, "")}</a>` : ""}
            ${tg ? ` &nbsp;•&nbsp; <a href="${escapeAttr(tg)}" style="color:${GOLD_DARK};text-decoration:none;">Telegram</a>` : ""}
          </td>
        </tr></table>
      </td></tr>`;
    }

    default:
      return "";
  }
}

export function renderEmailHtml(blocks: EmailBlock[], subjectForTitle = ""): string {
  const body = blocks.map(renderBlock).join("");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${subjectForTitle}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @media only screen and (max-width: 600px) {
    .nv-container { width: 100% !important; }
    .nv-pad { padding-left: 18px !important; padding-right: 18px !important; }
  }
  body { -webkit-text-size-adjust: 100%; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="nv-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:24px 32px 0;border-bottom:3px solid ${GOLD};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-bottom:16px;">
                  <span style="font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:0.5px;color:${INK};">NEET<span style="color:${GOLD_DARK};">Verse</span></span>
                </td>
              </tr></table>
            </td>
          </tr>
          ${body}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
