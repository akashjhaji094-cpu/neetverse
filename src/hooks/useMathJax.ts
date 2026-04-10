import { useEffect, useRef, useCallback } from "react";

let mathJaxLoaded = false;
let mathJaxLoading = false;

function loadMathJax(): Promise<void> {
  if (mathJaxLoaded) return Promise.resolve();
  if (mathJaxLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (mathJaxLoaded) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
  mathJaxLoading = true;
  return new Promise((resolve) => {
    (window as any).MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
      startup: { ready: () => { (window as any).MathJax.startup.defaultReady(); mathJaxLoaded = true; resolve(); } },
    };
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
  });
}

export function useMathJax(deps: any[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);

  const typeset = useCallback(() => {
    const MJ = (window as any).MathJax;
    if (MJ?.typesetPromise && containerRef.current) {
      MJ.typesetPromise([containerRef.current]).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadMathJax().then(typeset);
  }, [typeset, ...deps]);

  return containerRef;
}
