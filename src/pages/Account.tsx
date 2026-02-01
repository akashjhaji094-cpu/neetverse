import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { User, Mail, Calendar, Crown, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const Account = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return data;
    },
    enabled: !!user,
  });

  const { data: premiumAccess } = useQuery({
    queryKey: ['user-premium', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('premium_access_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      return data;
    },
    enabled: !!user,
  });

  const { data: userRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      return data?.[0]?.role || 'student';
    },
    enabled: !!user,
  });

  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            My Account
          </h1>
          <p className="text-muted-foreground">
            Manage your profile and account settings
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{profile?.name || 'NEET Aspirant'}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  {premiumAccess && (
                    <span className="px-2 py-1 text-xs font-medium bg-warning text-warning-foreground rounded-full flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Premium
                    </span>
                  )}
                  {(userRole === 'superadmin' || userRole === 'content_admin') && (
                    <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {userRole === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={profile?.name || ''} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} readOnly />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Joined {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : 'Recently'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              Subscription
            </CardTitle>
            <CardDescription>Your premium access status</CardDescription>
          </CardHeader>
          <CardContent>
            {premiumAccess ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-warning/20 to-warning/10 border border-warning/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-warning-foreground">Premium Active</p>
                    <p className="text-sm text-muted-foreground">
                      Access Key: {premiumAccess.access_key}
                    </p>
                    {premiumAccess.expires_at && (
                      <p className="text-sm text-muted-foreground">
                        Expires: {format(new Date(premiumAccess.expires_at), 'PPP')}
                      </p>
                    )}
                  </div>
                  <Crown className="h-10 w-10 text-warning" />
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No Active Subscription</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade to premium for exclusive test series
                </p>
                <Button className="bg-warning text-warning-foreground hover:bg-warning/90">
                  Get Premium Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Account;
