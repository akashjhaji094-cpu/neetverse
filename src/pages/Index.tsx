import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, TestTube, FileText, Crown, LogOut, Shield } from 'lucide-react';
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
    {
      icon: Shield,
      title: 'Admin Panel',
      description: 'Upload HTML tests and manage chapters & questions',
      action: () => navigate('/admin'),
      color: 'bg-secondary',
    },
  ];

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
            {features.map((feature, index) => {
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