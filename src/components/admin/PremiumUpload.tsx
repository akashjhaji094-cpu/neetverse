import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Rocket } from "lucide-react";

export const PremiumUpload = () => {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Premium Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <Badge variant="secondary" className="text-sm px-4 py-2">
              Coming Soon
            </Badge>
            <p className="text-muted-foreground max-w-md mx-auto">
              Premium test upload feature with PDF support is under development. 
              This will allow you to upload exclusive test series for premium users.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Upcoming Features</h4>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground ml-8">
              <li className="list-disc">Direct PDF upload for premium tests</li>
              <li className="list-disc">Automated question extraction from PDFs</li>
              <li className="list-disc">Subscription-based access control</li>
              <li className="list-disc">Advanced analytics for premium users</li>
              <li className="list-disc">Time-limited test access</li>
            </ul>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This feature will be available in the next major update. Stay tuned!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
