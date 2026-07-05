import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";

const TRIAL_DAYS = 7;

interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  plan: "free" | "premium";
  premiumExpiresAt: string | null;
}

export function UsersPanel() {
  const [search, setSearch] = useState("");

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin-users-overview"],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase.rpc("get_admin_user_overview" as any);
      if (error) throw error;
      return (data as unknown as AdminUserRow[]) || [];
    },
  });

  const getTrialStatus = (u: AdminUserRow) => {
    const daysSince = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = TRIAL_DAYS - daysSince;
    return daysLeft > 0 ? { active: true, daysLeft } : { active: false, daysLeft: 0 };
  };

  const filtered = (users || []).filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (isError) {
    return <p className="text-center py-8 text-muted-foreground text-sm">Couldn't load users.</p>;
  }

  const freeCount = (users || []).filter((u) => u.plan === "free").length;
  const premiumCount = (users || []).filter((u) => u.plan === "premium").length;
  const trialActiveCount = (users || []).filter((u) => u.plan === "free" && getTrialStatus(u).active).length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold">Users ({users?.length ?? 0})</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{premiumCount}</p>
            <p className="text-xs text-muted-foreground">Premium</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{trialActiveCount}</p>
            <p className="text-xs text-muted-foreground">On Trial</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{freeCount}</p>
            <p className="text-xs text-muted-foreground">Free (no trial)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">Trial / Expiry</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const trial = getTrialStatus(u);
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{u.name || "—"}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{format(new Date(u.createdAt), "d MMM yyyy")}</td>
                    <td className="py-2.5 pr-3">
                      <Badge variant={u.plan === "free" ? "secondary" : "default"} className={u.plan !== "free" ? "bg-amber-500 hover:bg-amber-500" : ""}>
                        {u.plan}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.plan === "premium" ? (
                        u.premiumExpiresAt ? (
                          <span className="text-xs text-muted-foreground">Expires {format(new Date(u.premiumExpiresAt), "d MMM yyyy")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No expiry</span>
                        )
                      ) : trial.active ? (
                        <Badge className="bg-orange-500 hover:bg-orange-500 text-white">Trial • {trial.daysLeft}d left</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Trial ended</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No users found.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
