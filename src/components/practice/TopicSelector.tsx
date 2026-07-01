import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronRight, Layers } from "lucide-react";

export interface TopicOption {
  id: string | null; // null = "All topics"
  name: string;
  count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  chapterId: string;
  chapterName: string;
  totalChapterCount: number;
  onSelect: (topic: TopicOption) => void;
}

export const TopicSelector = ({ open, onClose, chapterId, chapterName, totalChapterCount, onSelect }: Props) => {
  const [topics, setTopics] = useState<TopicOption[] | null>(null);

  useEffect(() => {
    if (!open || !chapterId) return;
    let cancelled = false;
    setTopics(null);
    (async () => {
      // Fetch topics for chapter + counts in parallel
      const [topicsRes, countsRes] = await Promise.all([
        supabase.from("topics").select("id, name, position").eq("chapter_id", chapterId).order("position"),
        supabase.rpc("get_question_counts_per_topic"),
      ]);
      if (cancelled) return;
      const countMap = new Map<string, number>();
      for (const row of (countsRes.data || []) as { topic_id: string; total: number }[]) {
        countMap.set(row.topic_id, Number(row.total) || 0);
      }
      const list: TopicOption[] = (topicsRes.data || [])
        .map((t: any) => ({ id: t.id as string, name: t.name as string, count: countMap.get(t.id) || 0 }))
        .filter((t) => t.count > 0);
      setTopics(list);
    })();
    return () => { cancelled = true; };
  }, [open, chapterId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {chapterName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Pick a topic to practice, or all topics in this chapter.</p>
        </DialogHeader>
        {topics === null ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading topics…
          </div>
        ) : (
          <div className="overflow-y-auto space-y-1 pr-1">
            <Button
              variant="secondary"
              className="w-full justify-between text-left h-auto py-3 px-3"
              onClick={() => onSelect({ id: null, name: "All topics", count: totalChapterCount })}
            >
              <span className="font-semibold">All topics</span>
              <span className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-0">{totalChapterCount} Q</Badge>
                <ChevronRight className="h-4 w-4" />
              </span>
            </Button>
            {topics.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">No topic-tagged questions yet in this chapter.</p>
            )}
            {topics.map((t) => (
              <Button
                key={t.id!}
                variant="ghost"
                className="w-full justify-between text-left h-auto py-2.5 px-3"
                onClick={() => onSelect(t)}
              >
                <span className="truncate mr-2">{t.name}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">{t.count} Q</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};