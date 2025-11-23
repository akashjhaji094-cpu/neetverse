import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Upload, Users, Copy, Check, FileText, BookOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AccessKey {
  id: string;
  user_id: string;
  access_key: string;
  created_at: string;
  is_active: boolean;
  profiles: {
    email: string;
    name: string | null;
  };
}

export const PremiumUpload = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [accessKeys, setAccessKeys] = useState<AccessKey[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [plannerTitle, setPlannerTitle] = useState("");
  const [plannerFile, setPlannerFile] = useState<File | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [testFile, setTestFile] = useState<File | null>(null);
  const [selectedAccessKey, setSelectedAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchAccessKeys();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch users");
      console.error(error);
      return;
    }

    setUsers(data || []);
  };

  const fetchAccessKeys = async () => {
    const { data, error } = await supabase
      .from("premium_access_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch access keys");
      console.error(error);
      return;
    }

    // Fetch profiles separately
    if (data && data.length > 0) {
      const userIds = data.map((key) => key.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", userIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]));
      
      const keysWithProfiles = data.map((key) => ({
        ...key,
        profiles: profilesMap.get(key.user_id) || { email: "Unknown", name: "Unknown" }
      }));

      setAccessKeys(keysWithProfiles as any);
    } else {
      setAccessKeys([]);
    }
  };

  const generateAccessKey = () => {
    return `PRM-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  const handleGenerateKey = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setLoading(true);
    const newKey = generateAccessKey();

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("premium_access_keys").insert({
      user_id: selectedUserId,
      access_key: newKey,
      created_by: authData.user.id,
    });

    if (error) {
      toast.error("Failed to generate access key: " + error.message);
      console.error(error);
    } else {
      toast.success("Access key generated successfully!");
      fetchAccessKeys();
      setSelectedUserId("");
    }

    setLoading(false);
  };

  const handleUploadPlanner = async () => {
    if (!plannerTitle || !plannerFile) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);

    // Upload file to storage
    const fileExt = plannerFile.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `planners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("question-images")
      .upload(filePath, plannerFile);

    if (uploadError) {
      toast.error("Failed to upload file");
      console.error(uploadError);
      setLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("question-images")
      .getPublicUrl(filePath);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("premium_planners").insert({
      title: plannerTitle,
      file_url: urlData.publicUrl,
      uploaded_by: authData.user.id,
    });

    if (error) {
      toast.error("Failed to upload planner");
      console.error(error);
    } else {
      toast.success("Planner uploaded successfully!");
      setPlannerTitle("");
      setPlannerFile(null);
    }

    setLoading(false);
  };

  const handleUploadPremiumTest = async () => {
    if (!testTitle || !testFile || !selectedAccessKey) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);

    // Upload file to storage
    const fileExt = testFile.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `premium-tests/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("question-images")
      .upload(filePath, testFile);

    if (uploadError) {
      toast.error("Failed to upload test");
      console.error(uploadError);
      setLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("question-images")
      .getPublicUrl(filePath);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("premium_tests").insert({
      title: testTitle,
      description: testDescription,
      file_url: urlData.publicUrl,
      access_key: selectedAccessKey,
      uploaded_by: authData.user.id,
    });

    if (error) {
      toast.error("Failed to upload premium test");
      console.error(error);
    } else {
      toast.success("Premium test uploaded successfully!");
      setTestTitle("");
      setTestDescription("");
      setTestFile(null);
      setSelectedAccessKey("");
    }

    setLoading(false);
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success("Access key copied to clipboard!");
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const toggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("premium_access_keys")
      .update({ is_active: !currentStatus })
      .eq("id", keyId);

    if (error) {
      toast.error("Failed to update key status");
      console.error(error);
    } else {
      toast.success(`Key ${!currentStatus ? "activated" : "deactivated"}`);
      fetchAccessKeys();
    }
  };

  return (
    <Tabs defaultValue="access-keys" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="access-keys">
          <Key className="h-4 w-4 mr-2" />
          Access Keys
        </TabsTrigger>
        <TabsTrigger value="premium-tests">
          <FileText className="h-4 w-4 mr-2" />
          Premium Tests
        </TabsTrigger>
        <TabsTrigger value="planners">
          <BookOpen className="h-4 w-4 mr-2" />
          Study Planners
        </TabsTrigger>
      </TabsList>

      {/* Access Keys Tab */}
      <TabsContent value="access-keys" className="space-y-6">
        {/* Generate Access Key Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Generate Premium Access Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || "Unnamed"} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleGenerateKey} disabled={loading}>
              <Key className="h-4 w-4 mr-2" />
              Generate Access Key
            </Button>
          </CardContent>
        </Card>

        {/* Access Keys List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Access Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Access Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{key.profiles.name || "Unnamed"}</div>
                        <div className="text-sm text-muted-foreground">{key.profiles.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {key.access_key}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(key.access_key)}
                        >
                          {copiedKey === key.access_key ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          key.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {key.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleKeyStatus(key.id, key.is_active)}
                      >
                        {key.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Premium Tests Tab */}
      <TabsContent value="premium-tests" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Upload Premium Test PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-title">Test Title</Label>
              <Input
                id="test-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g., NEET 2025 Mock Test 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-description">Description (Optional)</Label>
              <Textarea
                id="test-description"
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                placeholder="Brief description about this test..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-access-key">Access Key (Required)</Label>
              <select
                id="test-access-key"
                value={selectedAccessKey}
                onChange={(e) => setSelectedAccessKey(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select access key...</option>
                {accessKeys
                  .filter((key) => key.is_active)
                  .map((key) => (
                    <option key={key.id} value={key.access_key}>
                      {key.access_key} - {key.profiles.email}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only users with this access key can view/download this test
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-file">Upload PDF Test</Label>
              <Input
                id="test-file"
                type="file"
                onChange={(e) => setTestFile(e.target.files?.[0] || null)}
                accept=".pdf"
              />
              <p className="text-xs text-muted-foreground">
                Upload PDF test files. Users need access key to download.
              </p>
            </div>
            <Button onClick={handleUploadPremiumTest} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Premium Test
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Planners Tab */}
      <TabsContent value="planners" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Upload Study Planner (Public)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                📚 Study planners are available to <span className="font-semibold">ALL users</span> - no access key required
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planner-title">Planner Title</Label>
              <Input
                id="planner-title"
                value={plannerTitle}
                onChange={(e) => setPlannerTitle(e.target.value)}
                placeholder="e.g., NEET 2025 Study Plan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planner-file">Upload PDF Planner</Label>
              <Input
                id="planner-file"
                type="file"
                onChange={(e) => setPlannerFile(e.target.files?.[0] || null)}
                accept=".pdf"
              />
              <p className="text-xs text-muted-foreground">
                Upload PDF study planners for all users (publicly accessible)
              </p>
            </div>
            <Button onClick={handleUploadPlanner} disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Planner
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
