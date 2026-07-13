import { Link } from "react-router-dom";
import { JsonLd } from "./JsonLd";

const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Practice",
    links: [
      { label: "Biology Questions", href: "/biology" },
      { label: "Physics Questions", href: "/physics" },
      { label: "Chemistry Questions", href: "/chemistry" },
    ],
  },
  {
    heading: "Tests",
    links: [
      { label: "NEET Mock Tests", href: "/neet-mock-test" },
      { label: "Previous Year Questions", href: "/neet-pyq" },
    ],
  },
  {
    heading: "NEET 2027",
    links: [{ label: "NEET 2027 Guide", href: "/neet-2027" }],
  },
];

interface Breadcrumb { label: string; href: string; }

export function PublicPageLayout({ children, breadcrumbs }: { children: React.ReactNode; breadcrumbs?: Breadcrumb[] }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-primary">NEETVerse</Link>
          <div className="flex gap-3">
            <Link to="/auth" className="text-sm font-medium px-3 py-1.5 rounded-lg border">Log In</Link>
            <Link to="/auth" className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">Start Free</Link>
          </div>
        </div>
      </header>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <>
          <nav className="max-w-5xl mx-auto px-4 pt-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/" className="hover:underline">Home</Link></li>
              {breadcrumbs.map((b) => (
                <li key={b.href} className="flex items-center gap-1.5">
                  <span>/</span>
                  <Link to={b.href} className="hover:underline">{b.label}</Link>
                </li>
              ))}
            </ol>
          </nav>
          <JsonLd data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://neetverse.site/" },
              ...breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 2, name: b.label, item: `https://neetverse.site${b.href}` })),
            ],
          }} />
        </>
      )}

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">{children}</main>

      <footer className="border-t mt-12">
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <p className="font-bold text-primary mb-2">NEETVerse</p>
            <p className="text-xs text-muted-foreground">Free NEET practice questions, mock tests and PYQs for NEET 2027 aspirants.</p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">{group.heading}</p>
              <ul className="space-y-1.5">
                {group.links.map((l) => (
                  <li key={l.href}><Link to={l.href} className="text-sm hover:underline">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-muted-foreground pb-6">© {new Date().getFullYear()} NEETVerse</div>
      </footer>
    </div>
  );
}
