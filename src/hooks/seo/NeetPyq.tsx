import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { PublicPageLayout } from "@/components/seo/PublicPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";

export default function NeetPyq() {
  useSEO({
    title: "NEET Previous Year Questions (PYQs) — 20-Year Archive | NEETVerse",
    description: "Practice NEET previous year questions from the last 20 years, organized by subject and chapter, with instant scoring and explanations.",
    path: "/neet-pyq",
  });

  return (
    <PublicPageLayout breadcrumbs={[{ label: "Previous Year Questions", href: "/neet-pyq" }]}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "NEET Previous Year Questions",
        url: "https://neetverse.site/neet-pyq",
      }} />
      <h1 className="text-3xl font-bold mb-3">NEET Previous Year Questions (PYQs)</h1>
      <p className="text-muted-foreground mb-8">
        Actual NEET questions from past papers are the closest thing to knowing exactly what the exam expects. NEETVerse's PYQ archive covers 20 years, organized by year and subject.
      </p>

      <h2 className="text-xl font-semibold mb-3">Why PYQs Matter More Than Random Practice</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground mb-8">
        <li>NEET repeats concepts (not exact questions) across years — patterns become visible once you've seen 5-10 years of papers</li>
        <li>PYQs calibrate your sense of NEET's actual difficulty level, which differs from typical coaching-material questions</li>
        <li>Year-wise attempts let you track whether your accuracy is actually improving over time</li>
      </ul>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center mb-8">
        <p className="font-semibold mb-3">Browse the full PYQ archive free after signing up.</p>
        <Link to="/auth" className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm">Create Free Account</Link>
      </div>

      <div className="pt-6 border-t flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">Explore:</span>
        <Link to="/neet-mock-test" className="text-primary hover:underline">Mock Tests</Link>
        <Link to="/biology" className="text-primary hover:underline">Biology Questions</Link>
        <Link to="/physics" className="text-primary hover:underline">Physics Questions</Link>
        <Link to="/chemistry" className="text-primary hover:underline">Chemistry Questions</Link>
      </div>
    </PublicPageLayout>
  );
}
