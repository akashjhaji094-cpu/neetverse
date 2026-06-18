import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain, Target, Trophy, BookOpen, BarChart3, Zap,
  CheckCircle, XCircle, ArrowRight, Star, Users,
  FileText, Scan, LayoutDashboard, QrCode, TrendingUp,
  ChevronRight, Sparkles, Shield, Clock, Award,
  MessageSquare, PieChart, GraduationCap, Building2,
  FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Intersection Observer hook ───────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Animated counter ──────────────────────────────────── */
function AnimatedCounter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useInView(0.3);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = to / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(id); } else { setVal(Math.floor(start)); }
    }, 16);
    return () => clearInterval(id);
  }, [visible, to]);
  return (
    <div ref={ref} className="tabular-nums">
      {prefix}{val.toLocaleString("en-IN")}{suffix}
    </div>
  );
}

/* ─── Fade-in wrapper ───────────────────────────────────── */
function FadeIn({ children, delay = 0, className = "", from = "bottom" }: {
  children: React.ReactNode; delay?: number; className?: string; from?: "bottom" | "left" | "right" | "none";
}) {
  const { ref, visible } = useInView();
  const translateMap = { bottom: "translateY(32px)", left: "translateX(-32px)", right: "translateX(32px)", none: "none" };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : translateMap[from],
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    }}>{children}</div>
  );
}

/* ─── Glass card ────────────────────────────────────────── */
function GlassCard({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md ${glow ? "shadow-[0_0_30px_rgba(99,102,241,0.15)]" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ─── Section wrapper ───────────────────────────────────── */
function Section({ children, id, className = "" }: { children: React.ReactNode; id?: string; className?: string }) {
  return <section id={id} className={`px-4 py-24 md:px-8 lg:px-16 ${className}`}>{children}</section>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
      <Sparkles className="h-3 w-3" />
      {children}
    </div>
  );
}

/* ─── Dashboard Mockup ──────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-3xl scale-95 -z-10" />
      <GlassCard className="p-4 overflow-hidden" glow>
        {/* top bar */}
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">N</div>
            <span className="text-xs font-semibold text-white/80">NEETVerse Dashboard</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
          </div>
        </div>
        {/* score row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Score", value: "487", sub: "/ 720", color: "from-primary to-blue-400" },
            { label: "Rank", value: "#234", sub: "National", color: "from-secondary to-purple-400" },
            { label: "Accuracy", value: "73%", sub: "+8% ↑", color: "from-emerald-500 to-green-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
              <div className={`text-sm font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</div>
              <div className="text-[9px] text-white/40">{s.sub}</div>
              <div className="text-[8px] text-white/30 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {/* subject bars */}
        <div className="mb-4 rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="text-[9px] font-semibold text-white/40 uppercase tracking-wider mb-2">Subject Accuracy</div>
          {[
            { s: "Biology", p: 78, c: "bg-emerald-500" },
            { s: "Chemistry", p: 71, c: "bg-primary" },
            { s: "Physics", p: 62, c: "bg-secondary" },
          ].map(({ s, p, c }) => (
            <div key={s} className="flex items-center gap-2 mb-1.5">
              <div className="text-[9px] text-white/50 w-14 shrink-0">{s}</div>
              <div className="flex-1 h-1.5 rounded-full bg-white/10">
                <div className={`h-full rounded-full ${c}`} style={{ width: `${p}%`, transition: "width 1s ease" }} />
              </div>
              <div className="text-[9px] text-white/50 w-6 text-right">{p}%</div>
            </div>
          ))}
        </div>
        {/* question card */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">Today's Practice</div>
            <div className="text-[9px] text-primary">Genetics • 15 Qs</div>
          </div>
          <div className="text-[10px] text-white/70 leading-relaxed mb-2">Which of the following is correct regarding Mendel's law of…</div>
          <div className="grid grid-cols-2 gap-1">
            {["Independent Assortment", "Dominance", "Segregation", "Linkage"].map((opt, i) => (
              <div key={opt} className={`rounded-lg px-2 py-1 text-[8px] border ${i === 0 ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 bg-white/5 text-white/40"}`}>
                {String.fromCharCode(65 + i)}. {opt}
              </div>
            ))}
          </div>
        </div>
        {/* leaderboard snippet */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
          <div className="text-[9px] font-semibold text-white/40 uppercase tracking-wider mb-2">Leaderboard</div>
          {[
            { r: 1, n: "Arjun S.", s: "612", medal: "🥇" },
            { r: 2, n: "Priya K.", s: "598", medal: "🥈" },
            { r: 3, n: "You",     s: "487", medal: "🎯" },
          ].map(({ r, n, s, medal }) => (
            <div key={r} className="flex items-center gap-2 py-0.5">
              <span className="text-[9px]">{medal}</span>
              <span className="text-[9px] text-white/60 flex-1">{n}</span>
              <span className="text-[9px] font-bold text-primary">{s}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
                                                                                    }
/* ═══════════════════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════════════════ */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="dark min-h-screen bg-[hsl(220,20%,8%)] text-white overflow-x-hidden">

      {/* ── STARFIELD ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 0.5, height: Math.random() * 2 + 0.5,
            top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.5 + 0.1,
            animation: `pulse ${Math.random() * 3 + 2}s ease-in-out ${Math.random() * 2}s infinite alternate`,
          }} />
        ))}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>

      {/* ─────────────── NAV ─────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-4 md:px-8 lg:px-16 transition-all duration-300 ${scrolled ? "py-3 bg-[hsl(220,20%,8%)]/90 backdrop-blur-xl border-b border-white/8 shadow-lg" : "py-5"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-sm text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]">N</div>
            <span className="font-bold text-lg">NEET<span className="text-primary">Verse</span></span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {[["#features","Features"],["#how","How It Works"],["#pricing","Pricing"],["#coaching","For Institutes"]].map(([h,l]) => (
              <a key={l} href={h} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/8 transition-all">{l}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden md:block text-sm text-white/60 hover:text-white transition-colors px-4 py-2">Sign In</Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-105 transition-all text-sm px-5">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────── HERO ─────────────── */}
      <Section className="pt-36 pb-16 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* left */}
          <div>
            <FadeIn delay={0}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-6">
                <Sparkles className="h-3 w-3" />
                38,000+ Questions · AI-Powered · Free to Start
              </div>
            </FadeIn>

            <FadeIn delay={80}>
              <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight mb-6">
                Practice Smarter.<br />
                Score Higher.<br />
                <span className="bg-gradient-to-r from-primary via-blue-400 to-secondary bg-clip-text text-transparent">
                  Crack NEET.
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={160}>
              <p className="text-lg text-white/55 leading-relaxed mb-8 max-w-lg">
                38,000+ questions, AI analysis, real exam mocks and national ranking — all in one platform. Free forever, no catch.
              </p>
            </FadeIn>

            <FadeIn delay={240}>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link to="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white border-0 px-8 py-6 text-base font-bold shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.55)] hover:scale-105 transition-all">
                    Start Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 px-8 py-6 text-base backdrop-blur-sm">
                    View Features
                  </Button>
                </a>
              </div>
            </FadeIn>

            <FadeIn delay={320}>
              <div className="flex items-center gap-6 text-sm text-white/45">
                {[
                  { icon: <Shield className="h-3.5 w-3.5" />, t: "100% Free to start" },
                  { icon: <Zap className="h-3.5 w-3.5" />, t: "No credit card needed" },
                  { icon: <Users className="h-3.5 w-3.5" />, t: "500+ students active" },
                ].map(({ icon, t }) => (
                  <div key={t} className="flex items-center gap-1.5">{icon}<span>{t}</span></div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* right — dashboard mockup */}
          <FadeIn delay={200} from="right" className="hidden lg:block">
            <DashboardMockup />
          </FadeIn>
        </div>
      </Section>

      {/* ─────────────── SOCIAL PROOF ─────────────── */}
      <div className="border-y border-white/8 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { to: 38000, suf: "+", label: "Questions", sub: "Across all chapters" },
            { to: 12000, suf: "+", label: "Mock Tests Taken", sub: "By our students" },
            { to: 500,   suf: "+", label: "Students", sub: "And growing daily" },
            { to: 23,    suf: "%", pre: "+", label: "Accuracy Gain", sub: "Average improvement" },
          ].map(({ to, suf, pre, label, sub }) => (
            <FadeIn key={label}>
              <div className="text-3xl md:text-4xl font-extrabold text-white mb-1">
                <AnimatedCounter to={to} suffix={suf} prefix={pre} />
              </div>
              <div className="text-sm font-semibold text-white/70">{label}</div>
              <div className="text-xs text-white/35 mt-0.5">{sub}</div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* ─────────────── HOW IT WORKS ─────────────── */}
      <Section id="how" className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <FadeIn><SectionLabel>How It Works</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Four Steps to a Better Rank</h2></FadeIn>
          <FadeIn delay={160}><p className="text-white/50 max-w-xl mx-auto text-lg">Simple, focused, proven process to move from confusion to confidence.</p></FadeIn>
        </div>

        <div className="relative">
          {/* connecting line desktop */}
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { n: "01", icon: <BookOpen className="h-6 w-6" />, title: "Practice Questions", desc: "Chapter-wise practice from 38,000+ NEET-level questions. Smart exclusion of already-mastered topics." },
              { n: "02", icon: <Brain className="h-6 w-6" />, title: "Analyze Weak Chapters", desc: "AI maps your accuracy per chapter and highlights exactly where you're losing marks." },
              { n: "03", icon: <FileText className="h-6 w-6" />, title: "Attempt Mock Tests", desc: "Full 180Q mocks with +4/−1 marking, 3-hour timer. Online or offline with OMR upload." },
              { n: "04", icon: <Trophy className="h-6 w-6" />, title: "Climb the Rank", desc: "Track your national rank in real time. Compete, improve, and hit your target score." },
            ].map(({ n, icon, title, desc }, i) => (
              <FadeIn key={n} delay={i * 100}>
                <div className="relative text-center group">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/25 flex flex-col items-center justify-center gap-0.5 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300 group-hover:-translate-y-1 relative z-10 bg-[hsl(220,20%,8%)]">
                    <div className="text-primary">{icon}</div>
                    <div className="text-[10px] font-bold text-white/30">{n}</div>
                  </div>
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </Section>

      {/* ─────────────── CORE FEATURES ─────────────── */}
      <Section id="features" className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <FadeIn><SectionLabel>Core Features</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Built to Get You That Seat</h2></FadeIn>
          <FadeIn delay={160}><p className="text-white/50 max-w-xl mx-auto text-lg">Every feature exists for one reason — to improve your NEET score.</p></FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <MessageSquare className="h-5 w-5" />, title: "Never Stay Stuck Again", sub: "AI Doubt Solver", desc: "Ask any question, get a step-by-step explanation instantly. Powered by cutting-edge AI that understands NEET deeply.", grad: "from-primary to-blue-400", premium: true },
            { icon: <Target className="h-5 w-5" />, title: "Know Exactly Where You're Losing Marks", sub: "Weak Chapter Radar", desc: "AI analyzes your answer patterns and pinpoints the exact chapters costing you marks. No more guessing what to revise.", grad: "from-secondary to-purple-400", premium: true },
            { icon: <Zap className="h-5 w-5" />, title: "Practice That Knows What You Know", sub: "Infinity Practice", desc: "Already-correct questions auto-excluded. You only see what you need to practice. 38,000+ questions across all chapters.", grad: "from-emerald-500 to-green-400", premium: false },
            { icon: <BarChart3 className="h-5 w-5" />, title: "Your Score vs the Nation", sub: "Live Leaderboard", desc: "See your real-time national rank. Know exactly where you stand among thousands of NEET aspirants countrywide.", grad: "from-amber-500 to-orange-400", premium: false },
            { icon: <Scan className="h-5 w-5" />, title: "Paper Exam, Digital Results", sub: "OMR Auto-Checking", desc: "Solve on paper. Click a photo of your OMR sheet. Get fully-analyzed digital results in seconds.", grad: "from-rose-500 to-pink-400", premium: false },
            { icon: <GraduationCap className="h-5 w-5" />, title: "Real NEET Pressure, Zero Stress", sub: "Mock Tests", desc: "Full 180Q mock with exact NEET conditions — 200 min timer, +4/−1 marking, subject-wise breakdown post-test.", grad: "from-cyan-500 to-blue-400", premium: false },
          ].map(({ icon, title, sub, desc, grad, premium }, i) => (
            <FadeIn key={sub} delay={i * 60}>
              <GlassCard className="p-6 h-full group hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                <div className={`inline-flex w-11 h-11 rounded-xl bg-gradient-to-br ${grad} items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {icon}
                </div>
                {premium && (
                  <span className="ml-2 inline-block text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 rounded-full px-2 py-0.5">Premium</span>
                )}
                <h3 className="font-bold text-base text-white mb-1 mt-2 leading-snug">{title}</h3>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-3">{sub}</div>
                <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </Section>

      {/* ─────────────── PRODUCT SCREENSHOTS (CSS mockups) ─────────────── */}
      <Section className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <FadeIn><SectionLabel>Product Tour</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">See It in Action</h2></FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Practice Card */}
          <FadeIn from="left">
            <GlassCard className="p-5 group hover:border-primary/30 transition-all">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2"><BookOpen className="h-3 w-3 text-primary" />Practice Mode</div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-3">
                <div className="text-xs text-white/40 mb-2">Biology · Cell Division · Q 14/25</div>
                <div className="h-1.5 rounded-full bg-white/10 mb-3"><div className="h-full w-[56%] rounded-full bg-gradient-to-r from-primary to-secondary" /></div>
                <p className="text-sm text-white/80 mb-4 leading-relaxed">During which stage of meiosis does crossing over occur?</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Leptotene","Zygotene","Pachytene ✓","Diplotene"].map((o, i) => (
                    <div key={o} className={`rounded-lg p-2 text-xs border text-center transition-all ${i === 2 ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-white/50"}`}>{o}</div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-white/30">
                <span>🔥 12-day streak</span><span>⏱ Avg 48s / question</span>
              </div>
            </GlassCard>
          </FadeIn>

          {/* Analytics Card */}
          <FadeIn from="right">
            <GlassCard className="p-5 group hover:border-secondary/30 transition-all">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2"><PieChart className="h-3 w-3 text-secondary" />Analytics</div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-3">
                <div className="text-xs text-white/40 mb-3">Chapter-wise performance this month</div>
                {[
                  { ch: "Genetics", p: 85, delta: "+12%", c: "from-emerald-500 to-green-400" },
                  { ch: "Thermodynamics", p: 52, delta: "-8%", c: "from-rose-500 to-red-400" },
                  { ch: "Organic Chem", p: 68, delta: "+5%", c: "from-amber-500 to-orange-400" },
                  { ch: "Human Physio", p: 74, delta: "+9%", c: "from-primary to-blue-400" },
                ].map(({ ch, p, delta, c }) => (
                  <div key={ch} className="flex items-center gap-2 mb-2">
                    <div className="text-[10px] text-white/50 w-28 shrink-0">{ch}</div>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${c}`} style={{ width: `${p}%` }} />
                    </div>
                    <div className={`text-[10px] w-10 text-right font-semibold ${delta.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>{delta}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-xs text-primary flex items-center gap-2">
                <Brain className="h-3 w-3" />AI Insight: Focus on Thermodynamics — it can boost your score by 18 marks.
              </div>
            </GlassCard>
          </FadeIn>

          {/* Mock Test Card */}
          <FadeIn from="left">
            <GlassCard className="p-5 hover:border-emerald-500/30 transition-all">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2"><Clock className="h-3 w-3 text-emerald-400" />Mock Test</div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">Full Syllabus Mock #7</span>
                  <span className="text-sm font-bold text-emerald-400">1:47:22</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  {[["Attempted","124/180","text-white"],["Correct","94","text-emerald-400"],["Skipped","56","text-amber-400"]].map(([l,v,c]) => (
                    <div key={l} className="rounded-lg bg-white/5 border border-white/10 p-2">
                      <div className={`text-base font-bold ${c}`}>{v}</div>
                      <div className="text-[9px] text-white/30">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({length: 20}).map((_, i) => (
                    <div key={i} className={`w-6 h-6 rounded text-[8px] flex items-center justify-center font-bold ${i < 14 ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/30" : i < 17 ? "bg-rose-500/25 text-rose-400 border border-rose-500/30" : "bg-white/5 text-white/25 border border-white/10"}`}>{i+1}</div>
                  ))}
                  <div className="text-[9px] text-white/25 self-center pl-1">+160 more</div>
                </div>
              </div>
            </GlassCard>
          </FadeIn>

          {/* Leaderboard Card */}
          <FadeIn from="right">
            <GlassCard className="p-5 hover:border-amber-500/30 transition-all">
              <div className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2"><Trophy className="h-3 w-3 text-amber-400" />Leaderboard</div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-[10px] text-white/30 mb-3">National Ranking · This Week</div>
                {[
                  { r:1, n:"Arjun S., Delhi", s:612, m:"🥇", bg:"from-amber-500/20 to-yellow-500/10" },
                  { r:2, n:"Priya K., Mumbai", s:598, m:"🥈", bg:"from-slate-500/20 to-slate-600/10" },
                  { r:3, n:"Riya M., Jaipur", s:587, m:"🥉", bg:"from-orange-600/20 to-orange-700/10" },
                  { r:234, n:"You · Patna", s:487, m:"🎯", bg:"from-primary/20 to-secondary/10", you:true },
                ].map(({ r, n, s, m, bg, you }) => (
  <div key={r} className={`flex items-center gap-3 rounded-lg px-3 py-2 mb-1.5 bg-gradient-to-r ${bg} border ${you ? "border-primary/30" : "border-white/5"}`}>
                    <span className="text-sm">{m}</span>
                    <span className={`text-xs flex-1 ${you ? "text-primary font-semibold" : "text-white/65"}`}>{n}</span>
                    <span className={`text-xs font-bold ${you ? "text-primary" : "text-white/65"}`}>{s}</span>
                    {you && <span className="text-[9px] text-primary border border-primary/30 rounded-full px-1.5 py-0.5">You</span>}
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>
        </div>
      </Section>

      {/* ─────────────── WHY NEETVERSE (Comparison) ─────────────── */}
      <Section className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <FadeIn><SectionLabel>Why NEETVerse</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Why Students Choose Us</h2></FadeIn>
        </div>

        <FadeIn>
          <GlassCard className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-white/40 font-semibold w-[40%]">Feature</th>
                  <th className="px-6 py-4 text-center">
                    <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/30 rounded-lg px-4 py-2">
                      <span className="font-bold text-primary text-sm">NEETVerse</span>
                      <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-white/30 font-medium">Other Apps</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AI Doubt Solver", true, false],
                  ["OMR Auto-Checking", true, false],
                  ["Offline Paper Generation", true, false],
                  ["AI-Powered DPP (for teachers)", true, false],
                  ["National Leaderboard", true, "Limited"],
                  ["38,000+ Questions", true, "5k–10k"],
                  ["Coaching Institute Dashboard", true, false],
                  ["Price", "₹39/mo", "₹299–₹999/mo"],
                  ["Free Plan Available", true, "Trial only"],
                ].map(([feat, nv, ot], i) => (
                  <tr key={i} className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                    <td className="px-6 py-3.5 text-white/65">{feat}</td>
                    <td className="px-6 py-3.5 text-center">
                      {nv === true ? <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto" /> :
                        <span className="text-primary font-semibold text-xs">{nv}</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {ot === false ? <XCircle className="h-5 w-5 text-white/20 mx-auto" /> :
                        <span className="text-white/35 text-xs">{ot}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </FadeIn>
      </Section>

      {/* ─────────────── PRICING ─────────────── */}
      <Section id="pricing" className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <FadeIn><SectionLabel>Pricing</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Simple, Honest Pricing</h2></FadeIn>
          <FadeIn delay={160}><p className="text-white/50 text-lg">Start free today. Upgrade only if you need AI features.</p></FadeIn>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* Free */}
          <FadeIn from="left">
            <GlassCard className="p-8 h-full flex flex-col">
              <div className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Free Forever</div>
              <div className="text-5xl font-extrabold mb-1">₹0<span className="text-lg text-white/35 font-normal ml-2">/ month</span></div>
              <p className="text-sm text-white/40 mb-6">No credit card. No catch. Start in 30 seconds.</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[["🖥️ Online Mock","3 / week"],["📄 Offline Paper","1 / week"]].map(([l,v]) => (
                  <div key={l} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                    <div className="text-xs text-white/35 mb-1">{l}</div>
                    <div className="text-sm font-bold text-white">{v}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5 mb-8 flex-1">
                {["Unlimited chapter-wise practice","38,000+ questions","PYQs with images","Notes & PDFs","Live national leaderboard","Basic analytics"].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />{f}
                  </div>
                ))}
                {["AI Doubt Solver","Weak Chapter Radar","Unlimited Mocks"].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-white/25">
                    <XCircle className="h-4 w-4 text-white/20 shrink-0" />{f}
                  </div>
                ))}
              </div>
              <Link to="/auth">
                <Button variant="outline" className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white py-6 text-base">
                  Get Started Free
                </Button>
              </Link>
            </GlassCard>
          </FadeIn>

          {/* Premium */}
          <FadeIn from="right">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 blur-xl -z-10 scale-95" />
              <GlassCard className="p-8 h-full flex flex-col border-primary/40 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-gradient-to-r from-primary to-secondary text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">Most Popular</div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Premium</div>
                <div className="text-5xl font-extrabold mb-1">₹39<span className="text-lg text-white/35 font-normal ml-2">/ month</span></div>
                <p className="text-sm text-white/40 mb-6">Less than ₹1.30/day. Cancel anytime.</p>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {[["🖥️ Online Mock","6 / week"],["📄 Offline Paper","6 / week"]].map(([l,v]) => (
                    <div key={l} className="rounded-xl bg-primary/10 border border-primary/25 p-3 text-center">
                      <div className="text-xs text-primary/60 mb-1">{l}</div>
                      <div className="text-sm font-bold text-primary">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5 mb-8 flex-1">
                  {["Everything in Free","AI Doubt Solver (unlimited)","Weak Chapter Radar","Custom chapter mock","Subject-only mock (Phy/Chem/Bio)","Difficulty filter","Score trend graph","Monthly performance PDF","Question bookmarks","Early access to features"].map((f, i) => (
                    <div key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${i < 3 ? "text-primary" : "text-emerald-400"}`} />
                      <span className={i < 3 ? "text-white font-medium" : ""}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/auth">
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary text-white border-0 py-6 text-base font-bold shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(99,102,241,0.55)] hover:scale-[1.02] transition-all">
                    Get Premium — ₹39/mo <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </GlassCard>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={200}>
          <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5 flex gap-4 items-start">
            <span className="text-2xl shrink-0">📺</span>
            <div>
              <div className="font-semibold text-amber-300 mb-1">Free users see short ads</div>
              <p className="text-sm text-white/45">15–30 sec skippable video from NEET coaching partners before every 5th session. This keeps the platform free for everyone. Premium users get a completely ad-free experience.</p>
            </div>
          </div>
        </FadeIn>
      </Section>

      {/* ─────────────── REFERRAL ─────────────── */}
      <Section className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <FadeIn><SectionLabel>Refer & Earn</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Don't Want to Pay? Invite Friends.</h2></FadeIn>
          <FadeIn delay={160}><p className="text-white/50 text-lg max-w-xl mx-auto">Every friend who joins and completes one mock test earns you free Premium.</p></FadeIn>
        </div>

        <FadeIn>
          <GlassCard className="p-8" glow>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                {[
                  { cnt:3,  rew:"1 Month Free", worth:"₹39 value",  pct:20 },
                  { cnt:7,  rew:"3 Months Free",worth:"₹99 value",  pct:45 },
                  { cnt:15, rew:"Till NEET 2027",worth:"₹199 value", pct:70 },
                  { cnt:30, rew:"Next 2 NEETs",  worth:"Maximum!",   pct:100 },
                ].map(({ cnt, rew, worth, pct }) => (
                  <div key={cnt} className="relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">{cnt}</div>
                        <div>
                          <div className="text-sm font-semibold text-white">{rew}</div>
                          <div className="text-xs text-white/35">{worth}</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-primary">{pct === 100 ? "✨ Max" : `${pct}%`}</div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <div className="inline-block mb-4">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/30 mx-auto flex items-center justify-center mb-3">
                    <Users className="h-10 w-10 text-primary" />
                  </div>
                  <div className="text-3xl font-extrabold text-white">Invite Friends</div>
                  <div className="text-white/40 text-sm mt-1">Share your unique referral link</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/15 p-4 mb-4 font-mono text-sm text-primary">
                  neetverse.app/ref/yourname
                </div>
                <Link to="/auth">
                  <Button className="w-full bg-gradient-to-r from-primary to-secondary text-white border-0 py-5 font-bold">
                    Get My Referral Link
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      {/* ─────────────── COACHING INSTITUTES ─────────────── */}
      <Section id="coaching" className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <FadeIn><SectionLabel>For Coaching Institutes</SectionLabel></FadeIn>
          <FadeIn delay={80}><h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Run Your Entire Batch<br/>From One Dashboard</h2></FadeIn>
          <FadeIn delay={160}><p className="text-white/50 max-w-xl mx-auto text-lg">Give students the best free platform — and get full visibility into who's studying and who isn't.</p></FadeIn>
        </div>

        {/* Flow diagram */}
        <FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12 relative">
            {/* connecting line */}
            <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-secondary/30" />
            {[
              { icon: <Building2 className="h-5 w-5" />, t: "Create Batch", d: "Set up your class with subject and target date" },
              { icon: <QrCode className="h-5 w-5" />, t: "Generate QR", d: "One QR code — students scan to join instantly" },
              { icon: <Users className="h-5 w-5" />, t: "Students Join", d: "No complex signup. Scan, join, start practicing" },
              { icon: <TrendingUp className="h-5 w-5" />, t: "Track Performance", d: "Real-time batch analytics and individual reports" },
            ].map(({ icon, t, d }, i) => (
              <div key={t} className="relative z-10 text-center">
                <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-secondary/25 to-purple-600/15 border border-secondary/30 flex flex-col items-center justify-center gap-1 bg-[hsl(220,20%,8%)]">
                  <div className="text-secondary">{icon}</div>
                  <div className="text-[9px] text-white/25 font-bold">0{i+1}</div>
                </div>
                <div className="text-sm font-bold text-white mb-1">{t}</div>
                <div className="text-xs text-white/40 leading-relaxed px-2">{d}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Features grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: <FlaskConical className="h-4 w-4" />, t: "AI DPP Generator", d: "Select a topic → AI creates 20–25 NEET questions instantly. Ready to assign." },
            { icon: <FileText className="h-4 w-4" />, t: "Branded Offline Papers", d: "Generate PDFs with your institute logo, phone number, and custom header." },
            { icon: <Scan className="h-4 w-4" />, t: "OMR Auto-Checking", d: "Students upload OMR photo → instant digital results and analysis. No manual work." },
            { icon: <Users className="h-4 w-4" />, t: "Attendance System", d: "Daily attendance with auto-alerts for students missing 3+ consecutive days." },
            { icon: <BarChart3 className="h-4 w-4" />, t: "Parent Portal", d: "Share read-only weekly progress reports with parents automatically." },
            { icon: <Award className="h-4 w-4" />, t: "All Students Get Premium", d: "Every student in your institute batch gets full Premium access — for free." },
          ].map(({ icon, t, d }) => (
            <FadeIn key={t}>
              <GlassCard className="p-4 flex gap-3 hover:border-secondary/25 transition-all">
                <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/25 flex items-center justify-center text-secondary shrink-0 mt-0.5">{icon}</div>
                <div>
                  <div className="text-sm font-semibold text-white mb-1">{t}</div>
                  <div className="text-xs text-white/40 leading-relaxed">{d}</div>
                </div>
              </GlassCard>
            </FadeIn>
          ))}
        </div>

        {/* Pricing */}
        <FadeIn>
          <GlassCard className="p-6 border-secondary/25">
            <div className="grid md:grid-cols-3 gap-6 text-center mb-6">
              {[
                { n: "Basic",    p: "₹2,500", s: "50 students", hi: false },
                { n: "Standard",p: "₹4,000", s: "100 students", hi: true },
                { n: "Advanced",p: "₹6,500", s: "200 students", hi: false },
              ].map(({ n, p, s, hi }) => (
                <div key={n} className={`rounded-xl p-5 border ${hi ? "border-secondary/40 bg-secondary/10" : "border-white/10 bg-white/5"}`}>
                  <div className="text-xs font-bold text-white/35 uppercase tracking-widest mb-2">{n}</div>
                  <div className="text-3xl font-extrabold text-white mb-1">{p}<span className="text-sm text-white/30 font-normal">/mo</span></div>
                  <div className="text-xs text-white/40">{s} included</div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <a href="https://t.me/akaxxh" target="_blank" rel="noopener noreferrer">
                <Button className="bg-gradient-to-r from-secondary to-purple-600 text-white border-0 px-8 py-5 font-bold shadow-[0_0_25px_rgba(139,92,246,0.35)] hover:scale-105 transition-all">
                  Contact for Free 7-Day Demo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
              <p className="text-xs text-white/30 mt-3">Reach us on Telegram @akaxxh for instant response</p>
            </div>
          </GlassCard>
        </FadeIn>
      </Section>

      {/* ─────────────── FINAL CTA ─────────────── */}
      <Section className="max-w-4xl mx-auto text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20 blur-2xl" />
          <GlassCard className="p-14 relative" glow>
            <FadeIn>
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
                Start Preparing For<br />
                <span className="bg-gradient-to-r from-primary via-blue-400 to-secondary bg-clip-text text-transparent">
                  NEET Today
                </span>
              </h2>
              <p className="text-white/50 text-lg mb-10 max-w-lg mx-auto">
                Free forever. No credit card. 38,000+ questions waiting. Join 500+ students already ahead.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-secondary text-white border-0 px-10 py-6 text-base font-bold shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_55px_rgba(99,102,241,0.65)] hover:scale-105 transition-all">
                    Start Practicing Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="https://t.me/akaxxh" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 px-10 py-6 text-base backdrop-blur-sm">
                    Contact on Telegram
                  </Button>
                </a>
              </div>
            </FadeIn>
          </GlassCard>
        </div>
      </Section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer className="border-t border-white/8 bg-white/[0.02] px-4 md:px-8 lg:px-16 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-sm text-white">N</div>
            <span className="font-bold text-lg">NEET<span className="text-primary">Verse</span></span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-white/35 justify-center">
            {[["#features","Features"],["#how","How It Works"],["#pricing","Pricing"],["#coaching","For Institutes"],["https://t.me/akaxxh","Telegram @akaxxh"]].map(([h,l]) => (
              <a key={l} href={h} target={h.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="px-3 py-1.5 hover:text-white transition-colors">{l}</a>
            ))}
          </div>
          <div className="text-xs text-white/25">© 2026 NEETVerse. Made with ♥ for NEET aspirants.</div>
        </div>
      </footer>
    </div>
  );
}
