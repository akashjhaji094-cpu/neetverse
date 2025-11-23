import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Notes = () => {
  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom">
          <Card>
            <CardHeader>
              <CardTitle>Notes &amp; Study Material</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Curated NEET notes, books and PDFs will come here. Admin uploads from HTML
                and other formats will feed this section.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Notes;
