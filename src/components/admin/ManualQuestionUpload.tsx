import { Card, CardContent } from "@/components/ui/card";
import { ManualQuestionForm } from "@/components/questions/ManualQuestionForm";

export function ManualQuestionUpload() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Manual Question Upload</h2>
          <p className="text-sm text-muted-foreground">
            Add a question by hand — MCQ, Assertion–Reason, Statement based or Match the Column.
            Images are compressed automatically before upload. Saved questions go straight into the
            main question bank and are instantly usable in Practice, Mocks and Test Series.
          </p>
        </div>
        <ManualQuestionForm mode="admin" />
      </CardContent>
    </Card>
  );
}