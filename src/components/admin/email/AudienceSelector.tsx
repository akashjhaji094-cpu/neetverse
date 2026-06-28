import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, Crown, Gift, ListChecks, Mail } from "lucide-react";
import { useAudiencePreviewCount } from "@/hooks/useEmailCampaigns";
import type { AudienceType, AudienceFilter } from "@/lib/email/types";

interface Props {
  audienceType: AudienceType;
  filter: AudienceFilter;
  onChange: (type: AudienceType, filter: AudienceFilter) => void;
}

const OPTIONS: { value: AudienceType; label: string; icon: any }[] = [
  { value: "all", label: "All Users", icon: Users },
  { value: "premium", label: "Premium Users", icon: Crown },
  { value: "free", label: "Free Users", icon: Gift },
  { value: "selected", label: "Selected Users", icon: ListChecks },
  { value: "single", label: "Single Email", icon: Mail },
];

export function AudienceSelector({ audienceType, filter, onChange }: Props) {
  const { data: count, isLoading } = useAudiencePreviewCount(audienceType, filter);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipients</Label>
        <RadioGroup value={audienceType} onValueChange={(v) => onChange(v as AudienceType, filter)} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <label key={value} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${audienceType === value ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value={value} />
              <Icon className="h-3.5 w-3.5" />
              {label}
            </label>
          ))}
        </RadioGroup>

        {audienceType === "single" && (
          <Input
            type="email"
            placeholder="someone@example.com"
            value={filter.email || ""}
            onChange={(e) => onChange("single", { email: e.target.value })}
          />
        )}

        {audienceType === "selected" && (
          <p className="text-xs text-muted-foreground">
            Comma-separated user IDs (paste from Admin → Users):
            <Input
              className="mt-1"
              placeholder="uuid1, uuid2, uuid3"
              onChange={(e) => onChange("selected", { user_ids: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            />
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {isLoading ? "Counting..." : <>This will reach <b className="text-foreground">{count ?? 0}</b> recipient{count === 1 ? "" : "s"}.</>}
        </p>
      </CardContent>
    </Card>
  );
}
