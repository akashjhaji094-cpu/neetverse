import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { neetSubjects } from "@/data/neetChapters";

const Practice = () => {
  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom space-y-6">
          <header className="space-y-2 text-center md:text-left">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Practice Centre
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              NEET Chapters for Focused Practice
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto md:mx-0">
              Pick any chapter from Physics, Chemistry or Biology to start your targeted
              question practice. Chapter-wise tests and imports from HTML files will
              appear here.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {neetSubjects.map((subject) => (
              <Card key={subject.id} className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>{subject.name}</CardTitle>
                  {subject.tagline && (
                    <p className="text-sm text-muted-foreground">{subject.tagline}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 overflow-y-auto max-h-[480px]">
                  {subject.chapters.map((chapter) => (
                    <Button
                      key={chapter.id}
                      variant="outline"
                      className="w-full justify-start text-left text-sm"
                      type="button"
                    >
                      {chapter.name}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-1">What&apos;s coming next?</p>
            <p>
              Selecting a chapter will soon start a clean practice session built from your
              uploaded HTML question files, with proper answer keys and no extra symbols.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Practice;
