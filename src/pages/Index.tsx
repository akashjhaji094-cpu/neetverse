import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, TestTube, FileText, Crown, LogOut, Shield, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut, loading, isGuest } = useAuth();
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch available premium tests and planners
  const { data: premiumContent } = useQuery({
    queryKey: ['premium-content', user?.id],
    queryFn: async () => {
      if (!user) return { tests: [], planners: [], hasAccess: false };

      // Check if user has any active access key
      const { data: accessKeys } = await supabase
        .from('premium_access_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const hasAccess = (accessKeys?.length || 0) > 0;

      if (!hasAccess) {
        return { tests: [], planners: [], hasAccess: false };
      }

      // Fetch premium tests (available to all OR specific to user's key)
      const { data: tests } = await supabase
        .from('premium_tests')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch all planners (public)
      const { data: planners } = await supabase
        .from('premium_planners')
        .select('*')
        .order('created_at', { ascending: false });

      return { tests: tests || [], planners: planners || [], hasAccess };
    },
    enabled: !!user,
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["superadmin", "content_admin"]);

      setIsAdmin(!!roles && roles.length > 0);
    };

    checkAdminRole();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user && !isGuest) {
    navigate('/auth');
    return null;
  }

  const handleFeatureClick = (featureTitle: string, action: () => void) => {
    if (isGuest && featureTitle !== 'Unlimited Practice') {
      setShowSignupDialog(true);
    } else {
      action();
    }
  };

  const features = [
    {
      icon: BookOpen,
      title: 'Unlimited Practice',
      description: 'Choose any chapter and practice as many questions as you want',
      action: () => navigate('/practice'),
      color: 'bg-primary',
    },
    {
      icon: TestTube,
      title: 'Mock Tests',
      description: 'Full-length tests with 180 questions mimicking the actual NEET exam',
      action: () => navigate('/test'),
      color: 'bg-secondary',
    },
    {
      icon: FileText,
      title: 'Free Notes & Books',
      description: 'Access comprehensive study materials for all subjects',
      action: () => navigate('/notes'),
      color: 'bg-accent',
    },
    {
      icon: Crown,
      title: 'Premium Tests',
      description: 'Exclusive test series based on 20 years PYQs - Only ₹399',
      action: () => navigate('/test'),
      color: 'bg-warning',
      badge: 'Exclusive',
    },
  ];

  // Add admin panel for admin users only
  const allFeatures = isAdmin
    ? [
        ...features,
        {
          icon: Shield,
          title: 'Admin Panel',
          description: 'Upload HTML tests and manage chapters & questions',
          action: () => navigate('/admin'),
          color: 'bg-secondary',
        },
      ]
    : features;

  return (
    <div className="min-h-screen" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container-custom section-padding py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">NEETVERSE</h1>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="section-padding">
        <div className="container-custom text-center">
          <h2 className="text-5xl font-bold mb-4">
            Welcome to <span className="text-gradient">NEETVERSE</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            Your complete platform for NEET preparation with unlimited practice,
            mock tests, and comprehensive study materials.
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {allFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="card-hover cursor-pointer relative overflow-hidden"
                  onClick={() => handleFeatureClick(feature.title, feature.action)}
                >
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-left">{feature.title}</CardTitle>
                    <CardDescription className="text-left">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feature.badge && (
                      <div className="absolute top-4 right-4">
                        <span className="px-2 py-1 text-xs font-medium bg-warning text-warning-foreground rounded-full">
                          {feature.badge}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium Content Section */}
      {premiumContent?.hasAccess && (premiumContent.tests.length > 0 || premiumContent.planners.length > 0) && (
        <section className="section-padding bg-card/30 backdrop-blur-sm">
          <div className="container-custom">
            <div className="flex items-center gap-3 mb-8">
              <Crown className="w-8 h-8 text-warning" />
              <h2 className="text-3xl font-bold text-gradient">Premium Content</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {premiumContent.tests.map((test) => (
                <Card key={test.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-lg bg-warning flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-warning text-warning-foreground rounded-full">
                        Premium
                      </span>
                    </div>
                    <CardTitle className="text-left">{test.title}</CardTitle>
                    {test.description && (
                      <CardDescription className="text-left">{test.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      onClick={() => window.open(test.file_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Test
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {premiumContent.planners.map((planner) => (
                <Card key={planner.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-full">
                        Planner
                      </span>
                    </div>
                    <CardTitle className="text-left">{planner.title}</CardTitle>
                    <CardDescription className="text-left">Study Planner</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => window.open(planner.file_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Planner
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      <section className="section-padding bg-card/30 backdrop-blur-sm">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-4xl font-bold text-primary mb-2">10,000+</h3>
              <p className="text-muted-foreground">Practice Questions</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-secondary mb-2">500+</h3>
              <p className="text-muted-foreground">Mock Tests</p>
            </div>
            <div>
              <h3 className="text-4xl font-bold text-accent mb-2">100+</h3>
              <p className="text-muted-foreground">Study Materials</p>
            </div>
          </div>
        </div>
      </section>

      <AlertDialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Up Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please sign up to continue and access all features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate('/auth')}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;