import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Eager load critical pages
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load heavy pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Practice = lazy(() => import("./pages/Practice"));
const Revision = lazy(() => import("./pages/Revision"));
const Pyqs = lazy(() => import("./pages/Pyqs"));
const Test = lazy(() => import("./pages/Test"));
const Notes = lazy(() => import("./pages/Notes"));
const Admin = lazy(() => import("./pages/Admin"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Progress = lazy(() => import("./pages/Progress"));
const Account = lazy(() => import("./pages/Account"));
const Settings = lazy(() => import("./pages/Settings"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Notifications = lazy(() => import("./pages/Notifications"));
const MistakeBook = lazy(() => import("./pages/MistakeBook"));
const TestHistory = lazy(() => import("./pages/TestHistory"));
const WeakChapters = lazy(() => import("./pages/WeakChapters"));
const PendingOMR = lazy(() => import("./pages/PendingOMR"));
const Premium = lazy(() => import("./pages/Premium"));
const AdaptiveLearning = lazy(() => import("./pages/AdaptiveLearning"));
const BattleArena = lazy(() => import("./pages/BattleArena"));
const MockAnalysis = lazy(() => import("./pages/MockAnalysis"));
const QpToCbt = lazy(() => import("./pages/QpToCbt"));

// QP to CBT Phase 2 Lazy Imports
const QpToCbtCapture = lazy(() => import("./pages/QpToCbtCapture"));
const QpToCbtAnswerKey = lazy(() => import("./pages/QpToCbtAnswerKey"));
const QpToCbtTake = lazy(() => import("./pages/QpToCbtTake"));
const QpToCbtResults = lazy(() => import("./pages/QpToCbtResults"));

const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4 w-full max-w-md px-4">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-1/2 mx-auto" />
      <div className="space-y-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Toaster />
            <Sonner position="top-right" richColors closeButton />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/practice" element={<Practice />} />
                <Route path="/revision" element={<Revision />} />
                <Route path="/pyqs" element={<Pyqs />} />
                <Route path="/test" element={<Test />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/account" element={<Account />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/mistake-book" element={<MistakeBook />} />
                <Route path="/test-history" element={<TestHistory />} />
                <Route path="/weak-chapters" element={<WeakChapters />} />
                <Route path="/pending-omr" element={<PendingOMR />} />
                <Route path="/premium" element={<Premium />} />
                <Route path="/adaptive-learning" element={<AdaptiveLearning />} />
                <Route path="/battle-arena" element={<BattleArena />} />
                <Route path="/mock-analysis/:attemptId" element={<MockAnalysis />} />
                
                {/* QP to CBT Routes */}
                <Route path="/qp-to-cbt" element={<QpToCbt />} />
                <Route path="/qp-to-cbt/capture/:testId" element={<QpToCbtCapture />} />
                <Route path="/qp-to-cbt/answer-key/:testId" element={<QpToCbtAnswerKey />} />
                <Route path="/qp-to-cbt/take/:testId" element={<QpToCbtTake />} />
                <Route path="/qp-to-cbt/results/:attemptId" element={<QpToCbtResults />} />

                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
