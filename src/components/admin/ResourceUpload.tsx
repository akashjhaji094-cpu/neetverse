import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Link as LinkIcon, Loader2, Trash2 } from "lucide-react";

interface Note {
  id: string;
  title: string;
  drive_link: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  created_at: string;
}

export const ResourceUpload = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ['chapters', subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('subject_id', subjectId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!subjectId,
  });

  const { data: notes, refetch } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!driveLink.trim()) {
      toast.error("Please enter a Google Drive link");
      return;
    }

    setUploading(true);

    try {
      const { error } = await supabase.from('notes').insert({
        title: title.trim(),
        drive_link: driveLink.trim(),
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        uploaded_by: user?.id || null,
      });

      if (error) throw error;

      toast.success("Resource added successfully!");
      setTitle("");
      setDriveLink("");
      setSubjectId("");
      setChapterId("");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to add resource: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      toast.success("Resource deleted successfully");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Add Free Resource
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Resource Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., NCERT Biology Class 11 Notes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drive-link">Google Drive Link</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="drive-link"
                    placeholder="https://drive.google.com/..."
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    disabled={uploading}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Make sure the link is publicly accessible
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (Optional)</Label>
                <select
                  id="subject"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setChapterId("");
                  }}
                  disabled={uploading}
                >
                  <option value="">All Subjects</option>
                  {subjects?.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              {subjectId && (
                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter (Optional)</Label>
                  <select
                    id="chapter"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    disabled={uploading}
                  >
                    <option value="">All Chapters</option>
                    {chapters?.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Resource"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Added Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {!notes?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No resources added yet
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{note.title}</p>
                      <a
                        href={note.drive_link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate block"
                      >
                        {note.drive_link}
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(note.id)}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
