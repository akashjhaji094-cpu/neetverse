import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Crown, Download, FileText, BookOpen,
  Sparkles, Star, ChevronDown, ChevronUp, MessageCircle, Gift,
} from "lucide-react";
import { PremiumAccessDialog } from "@/components/mock/PremiumAccessDialog";
import { PremiumPopup } from "@/components/PremiumPopup";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
const TG = "https://t.me/Neetverseowner_bot?text=I%20want%20subscription";

const COMPARISON = [
  { feature: "Practice Questions",     free: "Unlimited",  premium: "Unlimited"                    },
  { feature: "Mock Tests (Online)",    free: "3 / week",   premium: "Unlimited"                     },
  { feature: "Mock Tests (Offline)",   free: "1 / week",   premium: "6 / week"                     },
  { feature: "PYQ Access",             free: "Limited",    premium: "Full 20-Year PYQs"             },
  { feature: "Premium Test PDFs",      free: "❌",          premium: "Curated Sets (PW+Allen+Aakash)"},
  { feature: "Study Planners",         free: "❌",          premium: "Full Access"                   },
  { feature: "Mistake Book",           free: "Basic",      premium: "Advanced"                      },
  { feature: "Weak Chapter Analysis",  free: "Basic",      premium: "Advanced AI"                   },
  { feature: "Support",                free: "Community",  premium: "⚡ Priority Telegram"           },
];

const FAQS: [string, string][] = [
  ["How do I get premium?",            "Click the Telegram button → message us → we activate within minutes. Or refer friends for free premium — see below."],
  ["Is there a refund policy?",        "Due to digital nature, refunds aren't available. But we always help!"],
  ["How long does premium last?",      "1 month from activation. Renew anytime."],
  ["What's in Premium Test PDFs?",     "Curated papers based on 20-year PYQs + PW, Allen, Aakash — for NEET 2026."],
  ["Can I get Premium for free?",      "Yes — refer 3 friends for 1 month free, 7 for 3 months, 15 for free till NEET 2027, or 30 for 2 years free. Get your link on the Account page."],
];

const GoldBtn = ({ onClick, dark = false, children }: {
  onClick: () => void; dark?: boolean; children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base shadow-lg hover:scale-105 transition-all"
    style={dark
      ? { background: "#1A1A1A", color: "#F5C842" }
      : { background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
  >{children}</button>
);

const Premium = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAccessDialog, setShowAccessDialog]   = useState(false);
  const [showPremiumPopup, setShowPremiumPopup]   = useState(false);
  const [faq, setFaq]                             = useState<number | null>(null);

  const { data: userAccess } = useQuery({
    queryKey: ["user-premium-access", user?.id],
    queryFn: async () => {
      if (!user) return { hasAccess: false };
      const { data: accessKeys } = await supabase
        .from("premium_access_keys")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);
      return { hasAccess: (accessKeys?.length || 0) > 0 };
    },
    enabled: !!user,
  });

  const { data: premiumContent } = useQuery({
    queryKey: ["premium-content"],
    queryFn: async () => {
      const { data: tests }   = await supabase.from("premium_tests").select("*").order("created_at", { ascending: false });
      const { data: planners} = await supabase.from("premium_planners").select("*").order("created_at", { ascending: false });
      return { tests: tests || [], planners: planners || [] };
    },
  });

  /* ────── PREMIUM USER VIEW ────── */
  if (userAccess?.hasAccess) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl shadow-md"
              style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}>
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
                Premium Content
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: "#FFF8E1", color: "#B8860B", border: "1px solid #D4AF37" }}>
                  👑 Active
                </span>
              </h1>
              <p className="text-muted-foreground">Your exclusive test series and study materials</p>
            </div>
          </div>

          {/* Tests */}
          {(premiumContent?.tests?.length || 0) > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Test Series</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {premiumContent!.tests.map((test) => (
                  <Card key={test.id} className="card-hover"
                    style={{ border: "1.5px solid #D4AF37" }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg" style={{ background: "#FFF8E1" }}>
                          <FileText className="h-5 w-5" style={{ color: "#D4AF37" }} />
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{ background: "#FFF8E1", color: "#B8860B" }}>Premium</span>
                      </div>
                      <CardTitle className="text-lg">{test.title}</CardTitle>
                      {test.description && <CardDescription>{test.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full font-bold border-none"
                        style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
                        onClick={() => window.open(test.file_url, "_blank")}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Planners */}
          {(premiumContent?.planners?.length || 0) > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Study Planners</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {premiumContent!.planners.map((planner) => (
                  <Card key={planner.id} className="card-hover"
                    style={{ border: "1.5px solid #D4AF37" }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg" style={{ background: "#FFF8E1" }}>
                          <BookOpen className="h-5 w-5" style={{ color: "#D4AF37" }} />
                        </div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{ background: "#FFF8E1", color: "#B8860B" }}>Planner</span>
                      </div>
                      <CardTitle className="text-lg">{planner.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button className="w-full font-bold" variant="outline"
                        style={{ borderColor: "#D4AF37", color: "#B8860B" }}
                        onClick={() => window.open(planner.file_url, "_blank")}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!premiumContent?.tests?.length && !premiumContent?.planners?.length && (
            <Card>
              <CardContent className="py-14 text-center">
                <Crown className="h-12 w-12 mx-auto mb-4" style={{ color: "#D4AF37" }} />
                <p className="text-lg font-semibold">Premium content coming soon!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Check back shortly for exclusive test series.
                </p>
              </CardContent>
            </Card>
          )}

          <PremiumAccessDialog
            open={showAccessDialog}
            onOpenChange={setShowAccessDialog}
            onAccessGranted={() => setShowAccessDialog(false)}
          />
        </div>
      </DashboardLayout>
    );
  }

  /* ────── NON-PREMIUM MARKETING VIEW ────── */
  return (
    <DashboardLayout>
      <div style={{ background: "#FAFAF8", minHeight: "100vh" }}>

        {/* ── HERO ── */}
        <section className="max-w-3xl mx-auto px-4 pt-12 pb-10 text-center">
          <div
            className="inline-flex w-20 h-20 rounded-full items-center justify-center mb-5 shadow-xl"
            style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}>
            <Crown className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-5xl font-black mb-3" style={{ color: "#1A1A1A" }}>
            NEETVerse <span style={{ color: "#D4AF37" }}>Premium</span>
          </h1>
          <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: "#666" }}>
            Unlock the full power of NEETVerse — built for serious NEET aspirants who mean business.
          </p>

          {/* Pricing card */}
          <div
            className="inline-flex flex-col items-center rounded-2xl px-10 py-7 mb-6 shadow-xl"
            style={{ background: "#fff", border: "2.5px solid #D4AF37" }}>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-2xl line-through font-semibold" style={{ color: "#EF4444" }}>₹499</span>
              <span className="text-6xl font-black leading-none" style={{ color: "#D4AF37" }}>₹199</span>
              <span className="text-base mb-1" style={{ color: "#999" }}>/month</span>
            </div>
            <p className="text-sm font-bold" style={{ color: "#E07000" }}>
              🔥 Early Bird — Only for first <strong>999 students</strong>
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3">
            <GoldBtn onClick={() => window.open(TG, "_blank")}>
              <MessageCircle className="w-5 h-5" />
              Get Premium on Telegram →
            </GoldBtn>
            <button
              onClick={() => setShowAccessDialog(true)}
              className="text-sm hover:underline transition-colors"
              style={{ color: "#B8860B" }}>
              Already have an access key? Enter here →
            </button>
          </div>
          <p className="mt-5 text-sm" style={{ color: "#999" }}>
            ✨ All new accounts start with a <strong>free trial</strong>. Upgrade anytime.
          </p>
        </section>

        {/* ── COMPARISON TABLE ── */}
        <section className="max-w-3xl mx-auto px-4 pb-14">
          <h2 className="text-2xl font-bold text-center mb-7" style={{ color: "#1A1A1A" }}>
            Free vs <span style={{ color: "#D4AF37" }}>Premium</span>
          </h2>
          <div className="rounded-2xl overflow-hidden shadow-lg"
            style={{ border: "2.5px solid #D4AF37" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(90deg,#D4AF37,#F5C842)" }}>
                  <th className="py-4 px-5 text-left font-bold"   style={{ color: "#1A1A1A" }}>Feature</th>
                  <th className="py-4 px-4 text-center font-bold" style={{ color: "#1A1A1A" }}>Free 🆓</th>
                  <th className="py-4 px-4 text-center font-bold" style={{ color: "#1A1A1A" }}>Premium 👑</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FFFDF0" }}>
                    <td className="py-3 px-5 font-medium" style={{ color: "#1A1A1A" }}>{row.feature}</td>
                    <td className="py-3 px-4 text-center"          style={{ color: "#888" }}>{row.free}</td>
                    <td className="py-3 px-4 text-center font-semibold" style={{ color: "#B8860B" }}>{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── LOCKED CONTENT PREVIEW ── */}
        {(premiumContent?.tests?.length || 0) > 0 && (
          <section className="max-w-4xl mx-auto px-4 pb-14">
            <h2 className="text-2xl font-bold text-center mb-2" style={{ color: "#1A1A1A" }}>
              Exclusive Content
            </h2>
            <p className="text-center text-sm mb-7" style={{ color: "#888" }}>
              Upgrade to unlock full access
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {premiumContent!.tests.slice(0, 3).map((test) => (
                <div key={test.id} className="relative rounded-xl overflow-hidden"
                  style={{ border: "1.5px solid #D4AF37", background: "#fff" }}>
                  {/* Lock overlay */}
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                    style={{ background: "rgba(255,253,240,0.93)", backdropFilter: "blur(2px)" }}>
                    <Crown className="w-8 h-8 mb-2" style={{ color: "#D4AF37" }} />
                    <span className="text-sm font-bold mb-2" style={{ color: "#B8860B" }}>Premium Only</span>
                    <button
                      onClick={() => setShowPremiumPopup(true)}
                      className="px-4 py-2 rounded-lg text-xs font-bold shadow hover:scale-105 transition-all"
                      style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}>
                      Unlock Now
                    </button>
                  </div>
                  <div className="p-4">
                    <FileText className="h-5 w-5 mb-2" style={{ color: "#D4AF37" }} />
                    <p className="font-semibold text-sm">{test.title}</p>
                    {test.description && (
                      <p className="text-xs text-gray-400 mt-1">{test.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TESTIMONIALS ── */}
        <section className="max-w-4xl mx-auto px-4 pb-14">
          <h2 className="text-2xl font-bold text-center mb-7" style={{ color: "#1A1A1A" }}>
            What Students Say
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              ["This platform helped me revise all 20 years of PYQs in just 1 month!", "Rahul S."],
              ["Premium mock tests feel exactly like the real NEET paper. 100% recommended!", "Priya M."],
              ["Best ₹199 I ever spent for NEET prep. Absolutely worth every rupee!", "Amit K."],
            ].map(([text, name], i) => (
              <div key={i} className="rounded-2xl p-6 shadow-md"
                style={{ background: "#fff", border: "2px solid #D4AF37" }}>
                <div className="flex mb-3">
                  {[...Array(5)].map((_, si) => (
                    <Star key={si} className="w-4 h-4"
                      style={{ fill: "#F5C842", color: "#F5C842" }} />
                  ))}
                </div>
                <p className="text-sm italic mb-3" style={{ color: "#555" }}>"{text}"</p>
                <p className="font-bold text-sm" style={{ color: "#1A1A1A" }}>— {name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-2xl mx-auto px-4 pb-14">
          <h2 className="text-2xl font-bold text-center mb-7" style={{ color: "#1A1A1A" }}>FAQs</h2>
          <div className="space-y-3">
            {FAQS.map(([q, a], i) => (
              <div key={i} className="rounded-xl overflow-hidden"
                style={{ border: "1.5px solid #D4AF37" }}>
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold"
                  style={{ background: faq === i ? "#FFFDF0" : "#FEFDF7", color: "#1A1A1A" }}
                  onClick={() => setFaq(faq === i ? null : i)}>
                  <span>{q}</span>
                  {faq === i
                    ? <ChevronUp   className="w-4 h-4 shrink-0" style={{ color: "#D4AF37" }} />
                    : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "#D4AF37" }} />}
                </button>
                {faq === i && (
                  <div className="px-5 py-4 text-sm"
                    style={{ background: "#fff", color: "#555" }}>{a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA BANNER ── */}
        <section className="max-w-3xl mx-auto px-4 pb-20">
          <div className="rounded-2xl p-10 text-center shadow-2xl"
            style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}>
            <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: "#1A1A1A" }} />
            <h2 className="text-3xl font-black mb-2" style={{ color: "#1A1A1A" }}>
              🚀 Join 999 early birds and crack NEET 2026!
            </h2>
            <p className="mb-6" style={{ color: "rgba(26,26,26,0.7)" }}>
              Limited slots — once 999 is full, price goes back to ₹499.
            </p>
            <GoldBtn onClick={() => window.open(TG, "_blank")} dark>
              <MessageCircle className="w-5 h-5" />
              Get Premium Now →
            </GoldBtn>
          </div>
        </section>

        <PremiumAccessDialog
          open={showAccessDialog}
          onOpenChange={setShowAccessDialog}
          onAccessGranted={() => setShowAccessDialog(false)}
        />
        <PremiumPopup open={showPremiumPopup} onClose={() => setShowPremiumPopup(false)} />
      </div>
    </DashboardLayout>
  );
};

export default Premium;
