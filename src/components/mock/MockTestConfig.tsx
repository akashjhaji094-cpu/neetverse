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
  bioOnly?: boolean;
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

export const MockTestConfig = ({ open, onClose, onStart, loading, bioOnly }: MockTestConfigProps) => {
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

  const filteredSubjects = bioOnly
    ? subjects?.filter(s => s.name.toLowerCase() === 'biology')
    : subjects;

  const handleChapterToggle = (subjectId: string, chapterId: string) => {
    setSelectedChapters(prev => {
      const current = prev[subjectId] || [];
      const updated = current.includes(chapterId)
        ? current.filter(id => id !== chapterId)
        : [...current, chapterId];
      return { ...prev, [subjectId]: updated };
    });
  };

  const handleSelectAll = (subjectId: string, chapterIds: string[]) => {
    setSelectedChapters(prev => {
      const current = prev[subjectId] || [];
      const allSelected = chapterIds.every(id => current.includes(id));
      return { ...prev, [subjectId]: allSelected ? [] : chapterIds };
    });
  };

  const isValid = filteredSubjects?.every(subject => 
    (selectedChapters[subject.id] || []).length > 0
  );

  const handleSelectFullSyllabus = () => {
    if (!filteredSubjects || !chaptersBySubject) return;
    const next: Record<string, string[]> = {};
    filteredSubjects.forEach(s => {
      next[s.id] = (chaptersBySubject[s.id] || []).map(c => c.id);
    });
    setSelectedChapters(next);
  };

  const handleStartTest = () => {
    const allSelected = Object.values(selectedChapters).flat();
    onStart(allSelected);
  };

  const chaptersBySubject = chapters?.reduce((acc, chapter) => {
    if (!acc[chapter.subject_id]) acc[chapter.subject_id] = [];
    acc[chapter.subject_id].push(chapter);
    return acc;
  }, {} as Record<string, Chapter[]>);

  const totalQuestions = bioOnly ? 90 : 180;
  const timeLimit = bioOnly ? '60 min' : '3 Hours';

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
          <DialogTitle>
            {bioOnly ? 'Biology Mock Test — Select Chapters' : 'Full Mock Test — Select Chapters'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Select at least one chapter from each subject</p>
              <p className="text-muted-foreground">
                {totalQuestions} questions distributed by <b>NEET 2026 weightage</b> across your chosen chapters (every selected chapter gets at least 1 question)
                {!bioOnly && ' — 45 Phy + 45 Chem + 90 Bio'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={handleSelectFullSyllabus}>
              {bioOnly ? 'Select Full Biology Syllabus' : 'Select Full Syllabus (All Chapters)'}
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {filteredSubjects?.map(subject => {
                const subjectChapters = chaptersBySubject?.[subject.id] || [];
                const selectedCount = (selectedChapters[subject.id] || []).length;
                const allSelected = subjectChapters.length > 0 && selectedCount === subjectChapters.length;

                return (
                  <Card key={subject.id}>
                    <CardContent className="pt-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{subject.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedCount} of {subjectChapters.length} chapters selected
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectAll(subject.id, subjectChapters.map(c => c.id))}
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {subjectChapters.map(chapter => (
                          <div key={chapter.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={chapter.id}
                              checked={(selectedChapters[subject.id] || []).includes(chapter.id)}
                              onCheckedChange={() => handleChapterToggle(subject.id, chapter.id)}
                            />
                            <label htmlFor={chapter.id} className="text-sm cursor-pointer flex-1">
                              {chapter.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleStartTest} disabled={!isValid || loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing Test...</>
              ) : (
                `Start Mock Test (${totalQuestions} Questions, ${timeLimit})`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
