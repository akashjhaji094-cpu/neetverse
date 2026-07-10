import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { BookX, Search, XCircle, MinusCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { formatQuestionHtml } from "@/lib/questionFormatter";
import { formatQuestionHtml } from "@/lib/questionFormatter";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockCard } from "@/components/FeatureLockCard";
import { FeatureLockedPopup } from "@/components/FeatureLockedPopup";

const PAGE_SIZE = 20;

const MistakeBook = () => {
  const { data, isLoading } = usePerformanceData();
  const [search, setSearch] = useState("");
  const access = useFeatureAccess();
  const [showLockPopup, setShowLockPopup] = useState(false);

  if (!access.isLoading && !access.hasAccess) {
    return (
      <DashboardLayout>
        <FeatureLockCard
          featureName="Mistake Book"
          description="Every wrong and skipped question across every test you've taken, searchable and filterable by subject."
          onMount={() => setShowLockPopup(true)}
        />
        <FeatureLockedPopup open={showLockPopup} onClose={() => setShowLockPopup(false)} featureName="Mistake Book" />
      </DashboardLayout>
    );
  }
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "wrong" | "skipped">("all");
  const [page, setPage] = useState(1);

  const mistakes = data?.mistakes || [];

  const subjects = useMemo(
    () => Array.from(new Set(mistakes.map((m) => m.subjectName))).sort(),
    [mistakes]
  );

  const filtered = useMemo(() => {
    return mistakes.filter((m) => {
      if (subjectFilter !== "all" && m.subjectName !== subjectFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const plain = m.questionText.replace(/<[^>]*>/g, "").toLowerCase();
        if (!plain.includes(q) && !m.chapterName.toLowerCase().includes(q) && !m.testName.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [mistakes, subjectFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const wrongCount = mistakes.filter((m) => m.status === "wrong").length;
  const skippedCount = mistakes.filter((m) => m.status === "skipped").length;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-destructive/10 rounded-xl">
            <BookX className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Mistake Book</h1>
            <p className="text-muted-foreground">Every wrong & skipped question, across every test</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto mb-1 text-red-500" />
              <div className="text-2xl font-bold">{wrongCount}</div>
              <p className="text-xs text-muted-foreground">Wrong Questions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <MinusCircle className="h-6 w-6 mx-auto mb-1 text-gray-500" />
              <div className="text-2xl font-bold">{skippedCount}</div>
              <p className="text-xs text-muted-foreground">Skipped Questions</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search question, chapter, test..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wrong + Skipped</SelectItem>
                <SelectItem value="wrong">Wrong Only</SelectItem>
                <SelectItem value="skipped">Skipped Only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">Loading mistakes...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            {mistakes.length === 0 ? "🎉 No mistakes recorded yet — keep practicing!" : "No mistakes match your filters."}
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pageItems.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge variant={m.status === "wrong" ? "destructive" : "secondary"} className="text-[10px]">
                          {m.status === "wrong" ? "Wrong" : "Skipped"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{m.subjectName}</Badge>
                        <Badge variant="outline" className="text-[10px]">{m.chapterName}</Badge>
                      </div>
                      <p
                        className="text-sm line-clamp-2 text-foreground"
                        dangerouslySetInnerHTML={{ __html: formatQuestionHtml(m.questionText) }}
                      />
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{m.testName}</span>
                        <span>•</span>
                        <span>{format(new Date(m.date), "d MMM yyyy")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MistakeBook;
