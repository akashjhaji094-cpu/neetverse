import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HtmlUpload } from "@/components/admin/HtmlUpload";
import { ResourceUpload } from "@/components/admin/ResourceUpload";
import { PremiumUpload } from "@/components/admin/PremiumUpload";
import { Upload, BookOpen, Crown } from "lucide-react";

const Admin = () => {
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
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="html" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">HTML Upload</span>
                <span className="sm:hidden">HTML</span>
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
            </TabsList>

            <div className="mt-6">
              <TabsContent value="html" className="m-0">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 mb-6">
                      <h2 className="text-xl font-semibold">HTML Question Importer</h2>
                      <p className="text-sm text-muted-foreground">
                        Upload NEET-style HTML files to extract questions, options with images, and
                        automatically match answer keys for practice and mock tests.
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
                        These will be available to all users in the Notes section.
                      </p>
                    </div>
                    <ResourceUpload />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="premium" className="m-0">
                <PremiumUpload />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  );
};

export default Admin;
