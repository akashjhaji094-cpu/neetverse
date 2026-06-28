import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BUILTIN_TEMPLATES } from "@/lib/email/templates";
import type { EmailBlock } from "@/lib/email/types";

export function TemplateLibrary({ onUse }: { onUse: (blocks: EmailBlock[], title: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {BUILTIN_TEMPLATES.map((t) => (
        <Card key={t.id} className="hover:border-primary transition">
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold text-sm">{t.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {t.blocks.find((b) => b.type === "headline")?.["text" as keyof EmailBlock] as any || "Built-in template"}
            </p>
            <Button size="sm" className="w-full" onClick={() => onUse(t.blocks, t.name)}>Use Template</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
