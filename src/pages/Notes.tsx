import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, FileText, Filter, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface Note {
  id: string;
  title: string;
  drive_link: string | null;
  file_url: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  created_at: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
}

const Notes = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedChapter, setSelectedChapter] = useState<string>("all");

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Note[];
    }
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      return data as Subject[];
    }
  });

  const { data: chapters } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chapters').select('*');
      if (error) throw error;
      return data as Chapter[];
    }
  });

  const filteredNotes = notes?.filter(note => {
    if (selectedSubject !== "all" && note.subject_id !== selectedSubject) return false;
    if (selectedChapter !== "all" && note.chapter_id !== selectedChapter) return false;
    return true;
  });

  const filteredChapters = chapters?.filter(ch => 
    selectedSubject === "all" || ch.subject_id === selectedSubject
  );

  const getSubjectName = (subjectId: string | null) => {
    if (!subjectId) return null;
    return subjects?.find(s => s.id === subjectId)?.name;
  };

  const getChapterName = (chapterId: string | null) => {
    if (!chapterId) return null;
    return chapters?.find(c => c.id === chapterId)?.name;
  };

  const openResource = (note: Note) => {
    const url = note.drive_link || note.file_url;
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-secondary/10 rounded-xl">
            <BookOpen className="h-7 w-7 text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Notes & Study Material</h1>
            <p className="text-muted-foreground">
              Access curated NEET notes, books and PDFs
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedSubject} onValueChange={(val) => {
                setSelectedSubject(val);
                setSelectedChapter("all");
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects?.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Chapters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {filteredChapters?.map(chapter => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        {notesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotes && filteredNotes.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map(note => (
              <Card key={note.id} className="card-hover">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{note.title}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getSubjectName(note.subject_id) && (
                          <span className="text-xs bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">
                            {getSubjectName(note.subject_id)}
                          </span>
                        )}
                        {getChapterName(note.chapter_id) && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {getChapterName(note.chapter_id)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => openResource(note)}
                    disabled={!note.drive_link && !note.file_url}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Resource
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">
                {notes?.length === 0 
                  ? "No resources uploaded yet." 
                  : "No resources match your filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notes;
