import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, MousePointerClick, LayoutGrid, Minus, Plus } from "lucide-react";
import type { EmailBlock } from "@/lib/email/types";

interface Props {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

const BLOCK_DEFAULTS: Record<string, () => EmailBlock> = {
  headline: () => ({ type: "headline", text: "New Headline" }),
  subheading: () => ({ type: "subheading", text: "Supporting subheading text" }),
  text: () => ({ type: "text", html: "Write your message here..." }),
  image: () => ({ type: "image", url: "", alt: "" }),
  button: () => ({ type: "button", text: "Click Here", url: "https://neetverse.lovable.app", style: "primary" }),
  featureCard: () => ({ type: "featureCard", icon: "✨", title: "Feature Title", description: "Short description" }),
  divider: () => ({ type: "divider" }),
};

export function CampaignBuilder({ blocks, onChange }: Props) {
  const addBlock = (type: keyof typeof BLOCK_DEFAULTS) => onChange([...blocks, BLOCK_DEFAULTS[type]()]);
  const removeBlock = (i: number) => onChange(blocks.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: -1 | 1) => {
    const next = [...blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const updateBlock = (i: number, patch: Partial<EmailBlock>) => {
    const next = [...blocks];
    next[i] = { ...next[i], ...patch } as EmailBlock;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => addBlock("headline")}><Type className="h-3.5 w-3.5 mr-1" />Headline</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("subheading")}><Type className="h-3.5 w-3.5 mr-1" />Subheading</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("text")}><Type className="h-3.5 w-3.5 mr-1" />Text</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("image")}><ImageIcon className="h-3.5 w-3.5 mr-1" />Image</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("button")}><MousePointerClick className="h-3.5 w-3.5 mr-1" />Button</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("featureCard")}><LayoutGrid className="h-3.5 w-3.5 mr-1" />Feature Card</Button>
        <Button size="sm" variant="outline" onClick={() => addBlock("divider")}><Minus className="h-3.5 w-3.5 mr-1" />Divider</Button>
      </div>

      <div className="space-y-2">
        {blocks.map((block, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{block.type}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveBlock(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveBlock(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeBlock(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {block.type === "headline" && (
                <Input value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} />
              )}
              {block.type === "subheading" && (
                <Input value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} />
              )}
              {block.type === "text" && (
                <Textarea rows={3} value={block.html} onChange={(e) => updateBlock(i, { html: e.target.value } as any)} />
              )}
              {block.type === "image" && (
                <div className="space-y-1.5">
                  <Input placeholder="Image URL" value={block.url} onChange={(e) => updateBlock(i, { url: e.target.value } as any)} />
                  <Input placeholder="Alt text" value={block.alt || ""} onChange={(e) => updateBlock(i, { alt: e.target.value } as any)} />
                </div>
              )}
              {block.type === "button" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <Input placeholder="Button text" value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value } as any)} />
                  <Input placeholder="Link URL" value={block.url} onChange={(e) => updateBlock(i, { url: e.target.value } as any)} />
                  <Select value={block.style || "primary"} onValueChange={(v) => updateBlock(i, { style: v } as any)}>
                    <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary (Gold)</SelectItem>
                      <SelectItem value="secondary">Secondary (Outline)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {block.type === "featureCard" && (
                <div className="space-y-1.5">
                  <Input placeholder="Icon (emoji)" value={block.icon || ""} onChange={(e) => updateBlock(i, { icon: e.target.value } as any)} />
                  <Input placeholder="Title" value={block.title} onChange={(e) => updateBlock(i, { title: e.target.value } as any)} />
                  <Textarea rows={2} placeholder="Description" value={block.description} onChange={(e) => updateBlock(i, { description: e.target.value } as any)} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No blocks yet — add one above, or load a template.</p>
        )}
      </div>
    </div>
  );
}
