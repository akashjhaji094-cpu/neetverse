import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone } from "lucide-react";
import type { EmailBlock } from "@/lib/email/types";
import { cn } from "@/lib/utils";

const GOLD = "#C9A227";
const GOLD_DARK = "#9C7E1A";

function BlockPreview({ block }: { block: EmailBlock }) {
  switch (block.type) {
    case "headline":
      return <h2 className="text-2xl font-bold px-8 pt-6 pb-2">{block.text}</h2>;
    case "subheading":
      return <p className="text-sm text-gray-500 px-8 pb-4">{block.text}</p>;
    case "text":
      return <div className="text-sm leading-relaxed px-8 pb-4" dangerouslySetInnerHTML={{ __html: block.html }} />;
    case "image":
      return <div className="px-8 pb-4"><img src={block.url} alt={block.alt} className="w-full rounded-lg" /></div>;
    case "button":
      return (
        <div className="px-8 pb-4">
          <span
            className="inline-block px-7 py-3 rounded-lg font-bold text-sm"
            style={block.style === "secondary"
              ? { border: `2px solid ${GOLD}`, color: GOLD_DARK, background: "#fff" }
              : { background: GOLD, color: "#fff" }}
          >
            {block.text}
          </span>
        </div>
      );
    case "featureCard":
      return (
        <div className="px-8 pb-3">
          <div className="border rounded-lg p-4">
            {block.icon && <div className="text-xl mb-1">{block.icon}</div>}
            <div className="font-bold text-sm mb-1">{block.title}</div>
            <div className="text-xs text-gray-500">{block.description}</div>
          </div>
        </div>
      );
    case "coloredSection":
      return (
        <div style={{ backgroundColor: block.bgColor }}>
          {block.blocks.map((b, i) => <BlockPreview key={i} block={b} />)}
        </div>
      );
    case "divider":
      return <div className="px-8 pb-2"><div className="border-t" /></div>;
    case "footer":
      return (
        <div className="px-8 py-6 bg-gray-50 border-t text-xs text-gray-500">
          NEETVerse — Your Universe of NEET Preparation
          {block.socials?.website && <div className="mt-1"><a className="underline">{block.socials.website}</a></div>}
        </div>
      );
    default:
      return null;
  }
}

export function EmailPreview({ blocks, subject }: { blocks: EmailBlock[]; subject: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
        <div className="flex gap-1">
          <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}>
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}>
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
        <div className={cn("bg-white rounded-lg shadow-md overflow-hidden border", device === "mobile" ? "w-[375px]" : "w-full max-w-[600px]")}>
          {/* Gmail-style top bar */}
          <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-white text-xs font-bold">N</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">NEETVerse</p>
              <p className="text-[11px] text-gray-400 truncate">{subject || "(no subject)"}</p>
            </div>
          </div>
          <div className="border-t-[3px]" style={{ borderColor: GOLD }} />
          <div className="px-8 pt-4">
            <span className="text-base font-extrabold">NEET<span style={{ color: GOLD_DARK }}>Verse</span></span>
          </div>
          {blocks.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">Add blocks to see your email here</p>
          ) : (
            blocks.map((b, i) => <BlockPreview key={i} block={b} />)
          )}
        </div>
      </div>
    </div>
  );
}
