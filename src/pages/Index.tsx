import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, TestTube, FileText, Crown, LogOut, Shield, Download, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PremiumAccessDialog } from '@/components/mock/PremiumAccessDialog';
import neetverseLogo from '@/assets/neetverse-logo.jpg';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Loading screen component for Unlimited Practice
const PracticeLoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadedQuestions, setLoadedQuestions] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchQuestionCounts = async () => {
      try {
        // Fetch total question count
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true });
        
        setTotalQuestions(count || 0);
        
        // Animate the loading counter
        const targetCount = count || 0;
        let current = 0;
        const increment = Math.ceil(targetCount / 50);
        
        const counterInterval = setInterval(() => {
          current += increment;
          if (current >= targetCount) {
            setLoadedQuestions(targetCount);
            clearInterval(counterInterval);
            // Navigate after a brief moment
            setTimeout(() => {
              onComplete();
            }, 500);
          } else {
            setLoadedQuestions(current);
          }
        }, 30);

        return () => clearInterval(counterInterval);
      } catch (error) {
        console.error('Error fetching questions:', error);
        // Navigate anyway after 3 seconds if there's an error
        setTimeout(() => onComplete(), 3000);
      }
    };

    fetchQuestionCounts();
  }, [onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4 border-primary/20 shadow-2xl">
        <CardContent className="pt-8 pb-10">
          <div className="flex flex-col items-center space-y-8">
            {/* Logo with spinning circle */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              
              {/* Spinning circle around logo */}
              <div className="absolute -inset-4">
                <svg className="w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray="60 200"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              
              <img 
                src={neetverseLogo} 
                alt="NEETVerse" 
                className="relative w-32 h-32 rounded-2xl shadow-lg"
              />
            </div>
            
            {/* Timer display */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary tabular-nums">
                {formatTime(elapsedSeconds)}
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Loading Practice Centre
              </h3>
              <p className="text-muted-foreground">
                Fetching questions from database...
              </p>
              
              {/* Show message if loading takes more than 20 seconds */}
              {elapsedSeconds > 20 && (
                <p className="text-sm text-amber-500 animate-pulse font-medium mt-2">
                  Fetching hard... please wait 10 sec more
                </p>
              )}
            </div>

            {/* Progress display */}
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Questions Found</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {loadedQuestions.toLocaleString()}
                </span>
              </div>
              
              <div className="relative w-full h-3 bg-muted/50 rounded-full overflow-hidden border border-primary/20">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out"
                  style={{ width: totalQuestions > 0 ? `${(loadedQuestions / totalQuestions) * 100}%` : '0%' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3 w-full text-center text-xs">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="font-bold text-xl text-primary">All Chapters</div>
                <div className="text-muted-foreground mt-1">Available</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="font-bold text-xl text-primary">Unlimited</div>
                <div className="text-muted-foreground mt-1">Practice</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut, loading, isGuest } = useAuth();
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPracticeLoading, setShowPracticeLoading] = useState(false);

  // Fetch all premium tests and planners (visible to everyone)
  const { data: allPremiumContent } = useQuery({
    queryKey: ['all-premium-content'],
    queryFn: async () => {
      // Fetch all premium tests
      const { data: tests, error: testsError } = await supabase
        .from('premium_tests')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch all planners
      const { data: planners, error: plannersError } = await supabase
        .from('premium_planners')
        .select('*')
        .order('created_at', { ascending: false });

      if (testsError || plannersError) {
        console.error('Error fetching premium content:', testsError || plannersError);
      }

      return { tests: tests || [], planners: planners || [] };
    },
  });

  // Check if user has access
  const { data: userAccess } = useQuery({
    queryKey: ['user-premium-access', user?.id],
    queryFn: async () => {
      if (!user) return { hasAccess: false };

      const { data: accessKeys } = await supabase
        .from('premium_access_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      return { hasAccess: (accessKeys?.length || 0) > 0 };
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

  // Show practice loading screen
  if (showPracticeLoading) {
    return <PracticeLoadingScreen onComplete={() => navigate('/practice')} />;
  }

  const features = [
    {
      icon: BookOpen,
      title: 'Unlimited Practice',
      description: 'Choose any chapter and practice as many questions as you want',
      action: () => setShowPracticeLoading(true),
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
      icon: BarChart3,
      title: 'My Analytics',
      description: 'Track your progress, view all attempts and analyze your performance',
      action: () => navigate('/analytics'),
      color: 'bg-accent',
    },
    {
      icon: FileText,
      title: 'Free Notes & Books',
      description: 'Access comprehensive study materials for all subjects',
      action: () => navigate('/notes'),
      color: 'bg-muted',
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
          <div className="flex items-center gap-4">
            <img 
              src={neetverseLogo} 
              alt="NEETVerse" 
              className="w-12 h-12 rounded-xl shadow-lg border border-primary/20"
            />
            <h1 className="text-3xl font-bold text-gradient">NEETVerse</h1>
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
            Welcome to <span className="text-gradient">NEETVerse</span>
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
      {allPremiumContent && (allPremiumContent.tests.length > 0 || allPremiumContent.planners.length > 0) && (
        <section className="section-padding bg-card/30 backdrop-blur-sm">
          <div className="container-custom">
            <div className="flex items-center gap-3 mb-8">
              <Crown className="w-8 h-8 text-warning" />
              <h2 className="text-3xl font-bold text-gradient">Premium Content</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allPremiumContent.tests.map((test) => (
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
                      onClick={() => {
                        if (userAccess?.hasAccess) {
                          window.open(test.file_url, '_blank');
                        } else {
                          setShowPremiumDialog(true);
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Test
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {allPremiumContent.planners.map((planner) => (
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
                      onClick={() => {
                        if (userAccess?.hasAccess) {
                          window.open(planner.file_url, '_blank');
                        } else {
                          setShowPremiumDialog(true);
                        }
                      }}
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

      <PremiumAccessDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog}
        onAccessGranted={() => {
          setShowPremiumDialog(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Index;