import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";

interface MockTestConfigProps {
  open: boolean;
  onClose: () => void;
  onStart: (selectedChapters: string[]) => void;
  loading?: boolean;
}

interface Subject {
  id: string;
  name: string;
  slug: string;
}

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
}

export const MockTestConfig = ({ open, onClose, onStart, loading }: MockTestConfigProps) => {
  const [selectedChapters, setSelectedChapters] = useState<Record<string, string[]>>({});

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Subject[];
    },
  });

  const { data: chapters, isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Chapter[];
    },
  });

  const handleChapterToggle = (subjectId: string, chapterId: string) => {
    setSelectedChapters(prev => {
      const current = prev[subjectId] || [];
      const updated = current.includes(chapterId)
        ? current.filter(id => id !== chapterId)
        : [...current, chapterId];
      return { ...prev, [subjectId]: updated };
    });
  };

  const isValid = subjects?.every(subject => 
    (selectedChapters[subject.id] || []).length > 0
  );

  const handleStartTest = () => {
    const allSelected = Object.values(selectedChapters).flat();
    onStart(allSelected);
  };

  const chaptersBySubject = chapters?.reduce((acc, chapter) => {
    if (!acc[chapter.subject_id]) acc[chapter.subject_id] = [];
    acc[chapter.subject_id].push(chapter);
    return acc;
  }, {} as Record<string, Chapter[]>);

  if (subjectsLoading || chaptersLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Custom Mock Test - Select Chapters</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Select at least one chapter from each subject</p>
              <p className="text-muted-foreground">180 questions will be randomly selected from your chosen chapters</p>
            </div>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {subjects?.map(subject => (
                <Card key={subject.id}>
                  <CardContent className="pt-6">
                    <div className="mb-4">
                      <h3 className="font-semibold text-lg">{subject.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {(selectedChapters[subject.id] || []).length} chapters selected
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {chaptersBySubject?.[subject.id]?.map(chapter => (
                        <div key={chapter.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={chapter.id}
                            checked={(selectedChapters[subject.id] || []).includes(chapter.id)}
                            onCheckedChange={() => handleChapterToggle(subject.id, chapter.id)}
                          />
                          <label
                            htmlFor={chapter.id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {chapter.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartTest} 
              disabled={!isValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Test...
                </>
              ) : (
                'Start Mock Test (180 Questions, 3 Hours)'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
