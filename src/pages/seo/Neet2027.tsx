import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { PublicPageLayout } from "@/components/seo/PublicPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";

export default function Neet2027() {
  useSEO({
    title: "NEET 2027 — Exam Pattern, Marking Scheme & Preparation Guide | NEETVerse",
    description: "Complete NEET 2027 guide: exam pattern, +4/-1 marking scheme, subject-wise weightage, and how to structure your preparation with free chapter-wise practice.",
    path: "/neet-2027",
  });

  return (
    <PublicPageLayout breadcrumbs={[{ label: "NEET 2027", href: "/neet-2027" }]}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "NEET 2027 Guide",
        url: "https://neetverse.site/neet-2027",
      }} />
      <h1 className="text-3xl font-bold mb-3">NEET 2027: Exam Pattern, Marking & Preparation Guide</h1>
      <p className="text-muted-foreground mb-8">
        A working guide for NEET UG 2027 aspirants — how the exam is structured, how it's marked, and how to build a chapter-wise preparation plan using real practice data instead of guesswork.
      </p>

      <h2 className="text-xl font-semibold mb-3">Exam Pattern & Marking Scheme</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-xl border"><p className="font-bold text-lg">180</p><p className="text-xs text-muted-foreground">Questions attempted (out of 200 available)</p></div>
        <div className="p-4 rounded-xl border"><p className="font-bold text-lg">720</p><p className="text-xs text-muted-foreground">Maximum marks</p></div>
        <div className="p-4 rounded-xl border"><p className="font-bold text-lg">+4 / −1</p><p className="text-xs text-muted-foreground">Marks per correct / incorrect answer</p></div>
      </div>

      <h2 className="text-xl font-semibold mb-3">Subject-wise Split</h2>
      <ul className="space-y-2 text-sm mb-8">
        <li className="flex justify-between p-3 rounded-lg border"><span>Biology (Botany + Zoology)</span><span className="font-semibold">90 questions</span></li>
        <li className="flex justify-between p-3 rounded-lg border"><span>Physics</span><span className="font-semibold">45 questions</span></li>
        <li className="flex justify-between p-3 rounded-lg border"><span>Chemistry</span><span className="font-semibold">45 questions</span></li>
      </ul>

      <h2 className="text-xl font-semibold mb-3">How to Prepare</h2>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground mb-8">
        <li>Go chapter-wise first, not straight to full mocks — you need to know which chapters are actually weak before timed practice is useful.</li>
        <li>Track accuracy, not just completion. A chapter you "finished" at 40% accuracy is still a weak chapter.</li>
        <li>Introduce full-length, timed mocks (3 hours, 180 questions) once your chapter-wise accuracy across most chapters is reasonably stable.</li>
        <li>Review every wrong answer's explanation before moving on — repeating the same mistake type is the single biggest score-killer.</li>
      </ol>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center mb-8">
        <p className="font-semibold mb-3">NEETVerse gives you chapter-wise practice, full mocks with a real 3-hour timer, and automatic weak-topic detection after every test — free.</p>
        <Link to="/auth" className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm">Create Free Account</Link>
      </div>

      <div className="pt-6 border-t flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">Explore:</span>
        <Link to="/biology" className="text-primary hover:underline">Biology Questions</Link>
        <Link to="/physics" className="text-primary hover:underline">Physics Questions</Link>
        <Link to="/chemistry" className="text-primary hover:underline">Chemistry Questions</Link>
        <Link to="/neet-mock-test" className="text-primary hover:underline">Mock Tests</Link>
        <Link to="/neet-pyq" className="text-primary hover:underline">Previous Year Questions</Link>
      </div>
    </PublicPageLayout>
  );
}
