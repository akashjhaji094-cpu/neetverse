import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { applyReferralCode } from '@/hooks/useReferral';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift } from 'lucide-react';
import neetverseLogo from '@/assets/neetverse-logo.jpg';

const Auth = () => {
  const navigate = useNavigate();
  const { signUp, signIn, user, setGuestMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // Same-origin relative path only.
  const rawNext = searchParams.get('next') || '';
  const nextPath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';
  const goNext = (fallback: string) => navigate(nextPath || fallback);

  // Pre-fill from ?ref=CODE in the URL (shared link), but the field stays
  // EDITABLE and OPTIONAL — someone who got a code via WhatsApp text instead
  // of a link can type it manually, and anyone can just leave it blank.
  const [referralInput, setReferralInput] = useState(searchParams.get('ref') || '');

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setReferralInput(ref);
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      goNext('/dashboard');
    }
  }, [user, navigate, nextPath]);

  const handleSkipSignup = () => {
    setGuestMode();
    goNext('/dashboard');
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    const { error, userId } = await signUp(email, password, name);
    if (!error) {
      const code = referralInput.trim();
      if (code && userId) {
        // fire-and-forget — don't block navigation if this fails
        applyReferralCode(code, userId);
      }
      goNext('/dashboard');
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    if (!error) {
      goNext('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center section-padding" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img 
              src={neetverseLogo} 
              alt="NEETVerse" 
              className="w-24 h-24 rounded-2xl shadow-2xl border-2 border-primary/20"
            />
          </div>
          <h1 className="text-5xl font-bold text-gradient mb-3">NEETVerse</h1>
          <p className="text-lg text-muted-foreground">Your journey to NEET success starts here</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full btn-gradient" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="name"
                      type="text"
                      placeholder="Your Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>

                  {/* Optional, skippable — type a friend's code or leave blank */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-referral" className="flex items-center gap-1.5 text-muted-foreground">
                      <Gift className="h-3.5 w-3.5" />
                      Referral Code <span className="text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="signup-referral"
                      name="referralCode"
                      type="text"
                      placeholder="e.g. RAHU8X2K — leave blank if none"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                    />
                  </div>

                  <Button type="submit" className="w-full btn-gradient" disabled={loading}>
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleSkipSignup}
            >
              Skip & Try Practice Mode
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
