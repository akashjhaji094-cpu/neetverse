// src/lib/email/templates.ts
// 9 built-in templates as EmailBlock[] — loading one into the builder is
// just `setBlocks(template.blocks)`, since the content model is identical
// everywhere (preview, builder, sent HTML).

import type { EmailBlock, EmailTemplate } from "./types";

const SITE = "https://neetverse.lovable.app";

function tpl(id: string, name: string, blocks: EmailBlock[]): EmailTemplate {
  return { id, name, blocks, is_builtin: true };
}

export const BUILTIN_TEMPLATES: EmailTemplate[] = [
  tpl("welcome", "Welcome", [
    { type: "headline", text: "Welcome to NEETVerse, {{name}}! 🎯" },
    { type: "subheading", text: "Your journey to cracking NEET starts right now." },
    { type: "text", html: "You've got access to 38,000+ practice questions, full-length mocks, and a live national leaderboard — completely free to start." },
    { type: "button", text: "Start Practicing →", url: SITE },
    { type: "featureCard", icon: "⚡", title: "Infinity Practice", description: "Chapter-wise questions that adapt to what you've already mastered." },
    { type: "featureCard", icon: "🏆", title: "National Leaderboard", description: "See exactly where you stand among thousands of aspirants." },
    { type: "divider" },
    { type: "footer", socials: { website: SITE, telegram: "https://t.me/akaxxh_bot" } },
  ]),

  tpl("premium-launch", "Premium Launch", [
    { type: "headline", text: "Introducing NEETVerse Premium 👑" },
    { type: "subheading", text: "AI Doubt Solver, Weak Chapter Radar, and more — for ₹39/month." },
    { type: "text", html: "Less than ₹1.30/day. Unlock unlimited AI explanations, custom mocks, and detailed analytics built to find exactly where you're losing marks." },
    { type: "button", text: "Upgrade to Premium →", url: `${SITE}/account` },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("new-mock", "New Mock Available", [
    { type: "headline", text: "A fresh Full Syllabus Mock just dropped 📝" },
    { type: "text", html: "180 questions, NEET pattern, +4/−1 marking. Your weekly online mock quota has reset — time to test where you stand." },
    { type: "button", text: "Take the Mock →", url: `${SITE}/test` },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("exam-reminder", "Exam Reminder", [
    { type: "headline", text: "{{days_left}} days left for NEET ⏳" },
    { type: "subheading", text: "Every revision hour counts now." },
    { type: "text", html: "Use the Weak Chapter Radar to spend your remaining time where it matters most, instead of re-revising what you already know." },
    { type: "button", text: "Check My Weak Chapters →", url: `${SITE}/weak-chapters` },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("weekly-newsletter", "Weekly Newsletter", [
    { type: "headline", text: "Your Week in NEETVerse 📊" },
    { type: "text", html: "Here's a quick look at what's new and how the community performed this week." },
    { type: "coloredSection", bgColor: "#FAF6EC", blocks: [
      { type: "featureCard", icon: "📈", title: "This Week's Topper", description: "Top scorer crossed 650/720 on the Full Syllabus Mock." },
      { type: "featureCard", icon: "🆕", title: "New This Week", description: "Pending OMR Vault — re-open and scan offline papers anytime." },
    ]},
    { type: "button", text: "Open NEETVerse →", url: SITE },
    { type: "footer", socials: { website: SITE, telegram: "https://t.me/akaxxh" } },
  ]),

  tpl("special-offer", "Special Offer", [
    { type: "headline", text: "Limited-time: 3 months Premium at ₹99 💸" },
    { type: "subheading", text: "That's ₹33/month — save ₹18 versus monthly." },
    { type: "text", html: "Offer valid for a limited window. Unlock AI Doubt Solver, Weak Chapter Radar, and unlimited mocks today." },
    { type: "button", text: "Claim the Offer →", url: `${SITE}/account` },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("result-announcement", "Result Announcement", [
    { type: "headline", text: "Your Mock Test Result is Ready 🎯" },
    { type: "text", html: "Hi {{name}}, your latest mock has been scored. Check your subject-wise breakdown and see how you compare on the leaderboard." },
    { type: "button", text: "View Result →", url: `${SITE}/test-history` },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("maintenance", "Maintenance Notice", [
    { type: "headline", text: "Scheduled Maintenance Notice 🛠️" },
    { type: "text", html: "NEETVerse will be briefly unavailable for scheduled maintenance. We'll be back shortly — your data and progress are completely safe." },
    { type: "footer", socials: { website: SITE } },
  ]),

  tpl("premium-expiry", "Premium Expiry Reminder", [
    { type: "headline", text: "Your Premium access ends in {{days_left}} days" },
    { type: "subheading", text: "Don't lose access to AI Doubt Solver and unlimited mocks." },
    { type: "text", html: "Renew now to keep your weak-chapter tracking and analytics uninterrupted through exam day." },
    { type: "button", text: "Renew Premium →", url: `${SITE}/account` },
    { type: "footer", socials: { website: SITE } },
  ]),
];

export function getTemplateById(id: string): EmailTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
