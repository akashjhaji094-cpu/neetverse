import { memo, type ElementType, type HTMLAttributes } from "react";
import { useMathJax } from "@/hooks/useMathJax";

interface MathContentProps
  extends Omit<HTMLAttributes<HTMLElement>, "dangerouslySetInnerHTML" | "children"> {
  /** Raw HTML (already containing $...$ / $$...$$ LaTeX) to render. */
  html: string | null | undefined;
  /** Element to render as. Defaults to "div". */
  as?: ElementType;
}

/**
 * The ONE component every question / option / explanation surface in the
 * app should use to render database HTML. It loads MathJax (once, globally)
 * and automatically re-typesets whenever `html` changes — no manual refs,
 * no timing hacks, nothing to get wrong. Drop this in and LaTeX just works,
 * including in components written after this file.
 *
 * Example: <MathContent html={formatQuestionHtml(question.question_text)} />
 */
function MathContentBase({ html, as = "div", className, ...rest }: MathContentProps) {
  const { ref } = useMathJax<HTMLElement>([html]);
  const Tag = as as ElementType;

  return (
    <Tag
      ref={ref as any}
      className={className}
      dangerouslySetInnerHTML={{ __html: html || "" }}
      {...rest}
    />
  );
}

export const MathContent = memo(MathContentBase);
