import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HtmlUpload } from "@/components/admin/HtmlUpload";
import { ResourceUpload } from "@/components/admin/ResourceUpload";
import { PremiumUpload } from "@/components/admin/PremiumUpload";
import { QuestionCleaner } from "@/components/admin/QuestionCleaner";
import { BroadcastManager } from "@/components/admin/BroadcastManager";
import { PyqsUpload } from "@/components/admin/PyqsUpload";
import { TelegramBotManager } from "@/components/admin/TelegramBotManager";
import { TestSeriesManager } from "@/components/admin/TestSeriesManager";
import { ManualQuestionUpload } from "@/components/admin/ManualQuestionUpload";
import { SubmissionsReview } from "@/components/admin/SubmissionsReview";
import { ExplanationSubmissionsReview } from "@/components/admin/ExplanationSubmissionsReview";
import EmailCampaigns from "@/components/admin/email/EmailCampaigns";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Upload, BookOpen, Crown, Loader2, Sparkles, Brain, Megaphone, FileText, Send, Mail, Layers, PenSquare, Inbox } from "lucide-react";

const Admin = () => {
  const { isAdmin, loading } = useAdminAccess();

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom space-y-6">
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Admin Panel
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Content Management
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Upload and manage questions, study materials, and premium content for NEETVERSE.
            </p>
          </header>

          <Tabs defaultValue="html" className="w-full">
            {/* Mobile: every tab on its own full-width row, no horizontal
                squeezing. Desktop (sm and up): back to a normal inline row,
                unchanged from before. */}
            <TabsList className="grid grid-cols-1 sm:flex sm:flex-wrap w-full sm:w-auto h-auto gap-1 sm:gap-0 p-1">
              <TabsTrigger value="html" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Brain className="h-4 w-4 shrink-0" />
                <span>AI Import</span>
              </TabsTrigger>
              <TabsTrigger value="resources" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>Free Resources</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <PenSquare className="h-4 w-4 shrink-0" />
                <span>Manual Upload</span>
              </TabsTrigger>
              <TabsTrigger value="series" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Layers className="h-4 w-4 shrink-0" />
                <span>Test Series</span>
              </TabsTrigger>
              <TabsTrigger value="submissions" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Inbox className="h-4 w-4 shrink-0" />
                <span>Submissions</span>
              </TabsTrigger>
              <TabsTrigger value="premium" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Crown className="h-4 w-4 shrink-0" />
                <span>Premium Tests</span>
              </TabsTrigger>
              <TabsTrigger value="cleaner" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Clean DB</span>
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Megaphone className="h-4 w-4 shrink-0" />
                <span>Broadcast</span>
              </TabsTrigger>
              <TabsTrigger value="pyqs" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <FileText className="h-4 w-4 shrink-0" />
                <span>PYQS</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Email Campaigns</span>
              </TabsTrigger>
              <TabsTrigger value="telegram" className="w-full sm:w-auto justify-start sm:justify-center gap-2 py-2.5">
                <Send className="h-4 w-4 shrink-0" />
                <span>Telegram Bot</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="html" className="m-0">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-6">
                      <h2 className="text-xl font-semibold">HTML Question Importer</h2>
                      <p className="text-sm text-muted-foreground">
                        Upload HTML files (up to 10). Questions, options, images & correct answers 
                        are parsed instantly — no AI needed. Review everything before saving.
                      </p>
                    </div>
                    <HtmlUpload />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="resources" className="m-0">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-6">
                      <h2 className="text-xl font-semibold">Free Study Resources</h2>
                      <p className="text-sm text-muted-foreground">
                        Add free study materials, books, and notes via Google Drive links.
                      </p>
                    </div>
                    <ResourceUpload />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="premium" className="m-0">
                <PremiumUpload />
              </TabsContent>

              <TabsContent value="manual" className="m-0">
                <ManualQuestionUpload />
              </TabsContent>

              <TabsContent value="series" className="m-0">
                <TestSeriesManager />
              </TabsContent>

              <TabsContent value="submissions" className="m-0">
                <div className="space-y-6">
                  <SubmissionsReview />
                  <ExplanationSubmissionsReview />
                </div>
              </TabsContent>

              <TabsContent value="cleaner" className="m-0">
                <QuestionCleaner />
              </TabsContent>

              <TabsContent value="broadcast" className="m-0">
                <BroadcastManager />
              </TabsContent>

              <TabsContent value="pyqs" className="m-0">
                <PyqsUpload />
              </TabsContent>

              <TabsContent value="email" className="m-0">
                <EmailCampaigns />
              </TabsContent>

              <TabsContent value="telegram" className="m-0">
                <TelegramBotManager />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  );
};

export default Admin;
