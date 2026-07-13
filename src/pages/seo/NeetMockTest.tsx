import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { PublicPageLayout } from "@/components/seo/PublicPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";

export default function NeetMockTest() {
  useSEO({
    title: "Free NEET 2027 Mock Test — Online & Offline (OMR) | NEETVerse",
    description: "Take free NEET mock tests online with a real 3-hour countdown timer, or download an offline paper with a scannable OMR sheet. Instant scoring and detailed analysis.",
    path: "/neet-mock-test",
  });

  return (
    <PublicPageLayout breadcrumbs={[{ label: "Mock Tests", href: "/neet-mock-test" }]}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "NEET Mock Test",
        url: "https://neetverse.site/neet-mock-test",
      }} />
      <h1 className="text-3xl font-bold mb-3">Free NEET Mock Tests — Online & Offline</h1>
      <p className="text-muted-foreground mb-8">
        Full-length (180-question, 3-hour) or Biology-only (90-question, 60-minute) mock tests, in two formats.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="p-5 rounded-xl border">
          <h2 className="font-semibold mb-2">Online Mock</h2>
          <p className="text-sm text-muted-foreground mb-3">Attempt directly in the browser with a real exam-style question palette and countdown timer. Auto-submits when time is up, exactly like the real NEET CBT.</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Instant scoring the moment you submit</li>
            <li>Full topic and chapter-wise breakdown afterward</li>
          </ul>
        </div>
        <div className="p-5 rounded-xl border">
          <h2 className="font-semibold mb-2">Offline Mock (Printable + OMR)</h2>
          <p className="text-sm text-muted-foreground mb-3">Download a print-ready A4 question paper plus a full-page OMR answer sheet — attempt it on paper like the real exam, then scan your filled OMR back in for automatic scoring.</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Built-in 3-hour / 60-minute timer screen once you print</li>
            <li>Bubble-detection scoring from your scanned sheet</li>
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-3">What You Get After Every Mock</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-8">
        <li className="p-3 rounded-lg border">Subject, chapter and topic-wise accuracy</li>
        <li className="p-3 rounded-lg border">Weak and strong areas, ranked</li>
        <li className="p-3 rounded-lg border">Time-per-question analysis</li>
        <li className="p-3 rounded-lg border">Rank estimate against other test-takers</li>
      </ul>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center mb-8">
        <p className="font-semibold mb-3">Start your first free mock test now.</p>
        <Link to="/auth" className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm">Create Free Account</Link>
      </div>

      <div className="pt-6 border-t flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">Explore:</span>
        <Link to="/neet-pyq" className="text-primary hover:underline">Previous Year Questions</Link>
        <Link to="/biology" className="text-primary hover:underline">Biology Questions</Link>
        <Link to="/neet-2027" className="text-primary hover:underline">NEET 2027 Guide</Link>
      </div>
    </PublicPageLayout>
  );
}
