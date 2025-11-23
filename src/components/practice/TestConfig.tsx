import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface TestConfigProps {
  open: boolean;
  onClose: () => void;
  chapterName: string;
  totalQuestions: number;
  onStart: (count: number) => void;
  loading?: boolean;
}

export const TestConfig = ({ open, onClose, chapterName, totalQuestions, onStart, loading }: TestConfigProps) => {
  const questionOptions = [10, 20, 30, 50].filter(count => count <= totalQuestions);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{chapterName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {totalQuestions} questions available for this chapter
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Select number of questions:</p>
            <div className="grid grid-cols-2 gap-2">
              {questionOptions.map((count) => (
                <Button
                  key={count}
                  variant="outline"
                  onClick={() => onStart(count)}
                  disabled={loading}
                  className="h-16"
                >
                  {count} Questions
                </Button>
              ))}
            </div>
            {totalQuestions > 0 && questionOptions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Not enough questions available
              </p>
            )}
          </div>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
