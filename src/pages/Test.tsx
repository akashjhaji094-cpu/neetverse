import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Test = () => {
  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom">
          <Card>
            <CardHeader>
              <CardTitle>Mock Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Full-length NEET mock tests will be available here soon. For now, you can
                explore chapter-wise practice from the home page.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Test;
