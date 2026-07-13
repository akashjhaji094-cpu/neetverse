import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSEO } from "@/hooks/useSEO";
import { PublicPageLayout } from "@/components/seo/PublicPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";

interface SubjectConfig {
  name: "Biology" | "Physics" | "Chemistry";
  title: string;
  description: string;
  intro: string;
}

const SUBJECTS: Record<string, SubjectConfig> = {
  biology: {
    name: "Biology",
    title: "NEET Biology Questions — Chapter-wise Practice | NEETVerse",
    description: "Practice NEET Biology questions chapter-wise, free. Botany and Zoology from NCERT for NEET 2027, with instant scoring and explanations.",
    intro: "Biology carries the highest weightage in NEET — 90 of 180 questions (50%). Strong NCERT-based recall across the chapters below is the single biggest lever for your score.",
  },
  physics: {
    name: "Physics",
    title: "NEET Physics Questions — Chapter-wise Practice | NEETVerse",
    description: "Practice NEET Physics questions chapter-wise, free — numerical and conceptual, for NEET 2027, with instant scoring.",
    intro: "Physics is usually the most calculation-heavy, time-consuming NEET section. Chapter-wise practice below builds speed and accuracy one topic at a time.",
  },
  chemistry: {
    name: "Chemistry",
    title: "NEET Chemistry Questions — Chapter-wise Practice | NEETVerse",
    description: "Practice NEET Chemistry questions chapter-wise, free — Physical, Organic and Inorganic Chemistry for NEET 2027.",
    intro: "Chemistry splits into Physical, Organic and Inorganic — each needs a different approach. Practice each chapter below to find exactly where you're losing marks.",
  },
};

export default function SubjectPage({ subjectSlug }: { subjectSlug: "biology" | "physics" | "chemistry" }) {
  const config = SUBJECTS[subjectSlug];

  useSEO({ title: config.title, description: config.description, path: `/${subjectSlug}` });

  const { data: chapters, isLoading } = useQuery({
    queryKey: ["seo-chapters", subjectSlug],
    queryFn: async () => {
      const { data: subject } = await supabase.from("subjects").select("id").ilike("name", config.name).maybeSingle();
      if (!subject) return [];
      const { data } = await supabase.from("chapters").select("id, name").eq("subject_id", subject.id).order("name");
      return data || [];
    },
  });

  return (
    <PublicPageLayout breadcrumbs={[{ label: config.name, href: `/${subjectSlug}` }]}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: config.title,
        url: `https://neetverse.site/${subjectSlug}`,
      }} />
      <h1 className="text-3xl font-bold mb-3">NEET {config.name} Questions — Chapter-wise Practice</h1>
      <p className="text-muted-foreground mb-8">{config.intro}</p>

      <h2 className="text-xl font-semibold mb-4">All {config.name} Chapters {chapters ? `(${chapters.length})` : ""}</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading chapters…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {(chapters || []).map((c) => (
          <Link key={c.id} to="/auth" className="p-4 rounded-xl border hover:border-primary hover:shadow-sm transition text-sm font-medium">
            {c.name}
          </Link>
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-3">Why practice {config.name} on NEETVerse?</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground mb-8">
        <li>Chapter-wise and topic-wise question sets, not just random mixed papers</li>
        <li>Instant scoring with NEET's own +4 / −1 marking scheme</li>
        <li>Explanations on every question, plus AI-powered doubt solving on Premium</li>
        <li>Automatic weak-topic detection after every test</li>
      </ul>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center">
        <p className="font-semibold mb-3">Start practicing {config.name} for free.</p>
        <Link to="/auth" className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm">Create Free Account</Link>
      </div>

      <div className="mt-10 pt-6 border-t flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">Related:</span>
        <Link to="/neet-pyq" className="text-primary hover:underline">NEET PYQs</Link>
        <Link to="/neet-mock-test" className="text-primary hover:underline">NEET Mock Tests</Link>
        <Link to="/neet-2027" className="text-primary hover:underline">NEET 2027 Guide</Link>
      </div>
    </PublicPageLayout>
  );
}
