import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSubjects from "./tools/list-subjects";
import listChapters from "./tools/list-chapters";
import getRandomQuestion from "./tools/get-random-question";
import getMyStats from "./tools/get-my-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "neetverse-mcp",
  title: "NEETVerse MCP",
  version: "0.1.0",
  instructions:
    "Tools for NEETVerse — a NEET (Physics, Chemistry, Biology) practice platform. " +
    "Use `list_subjects` and `list_chapters` to browse the syllabus, `get_random_question` to pull a practice MCQ, " +
    "and `get_my_stats` to view the signed-in student's accuracy and streak.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSubjects, listChapters, getRandomQuestion, getMyStats],
});