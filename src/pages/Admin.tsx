import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HtmlUpload } from "@/components/admin/HtmlUpload";
import { ResourceUpload } from "@/components/admin/ResourceUpload";
import { PremiumUpload } from "@/components/admin/PremiumUpload";
import { QuestionCleaner } from "@/components/admin/QuestionCleaner";
import { BroadcastManager } from "@/components/admin/BroadcastManager";
import { PyqsUpload } from "@/components/admin/PyqsUpload";
import EmailCampaigns from "@/pages/admin/EmailCampaigns"; // 1. नया इम्पोर्ट जोड़ा गया
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Upload, BookOpen, Crown, Loader2, Sparkles, Brain, Megaphone, FileText, Mail } from "lucide-react"; // 1. Mail आइकॉन जोड़ा गया

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
            {/* 6 की जगह grid-cols-7 किया गया है ताकि नया टैब सही से फिट हो सके */}
            <TabsList className="grid w-full max-w-4xl grid-cols-7">
              <TabsTrigger value="html" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">AI Import</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Free Resources</span>
                <span className="sm:hidden">Resources</span>
              </TabsTrigger>
              <TabsTrigger value="premium" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">Premium Tests</span>
                <span className="sm:hidden">Premium</span>
              </TabsTrigger>
              <TabsTrigger value="cleaner" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Clean DB</span>
                <span className="sm:hidden">Clean</span>
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                <span className="hidden sm:inline">Broadcast</span>
                <span className="sm:hidden">Msg</span>
              </TabsTrigger>
              <TabsTrigger value="pyqs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">PYQS</span>
                <span className="sm:hidden">PYQ</span>
              </TabsTrigger>
              {/* 2. नया TabsTrigger यहाँ जोड़ा गया है */}
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email</span>
                <span className="sm:hidden">Mail</span>
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

              <TabsContent value="cleaner" className="m-0">
                <QuestionCleaner />
              </TabsContent>

              <TabsContent value="broadcast" className="m-0">
                <BroadcastManager />
              </TabsContent>

              <TabsContent value="pyqs" className="m-0">
                <PyqsUpload />
              </TabsContent>

              {/* 3. नया TabsContent यहाँ जोड़ा गया है */}
              <TabsContent value="email" className="m-0">
                <EmailCampaigns />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  );
};

export default Admin;
