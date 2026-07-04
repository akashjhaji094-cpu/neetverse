import { useEffect, useLayoutEffect, useRef, useCallback, useState, type RefObject } from "react";

let mathJaxLoaded = false;
let loadPromise: Promise<void> | null = null;

const MATHJAX_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
const MATHJAX_TIMEOUT = 15000;

/**
 * Loads the MathJax runtime exactly once for the entire app, no matter how
 * many components call this. Every subsequent call reuses the same
 * in-flight (or resolved) promise instead of injecting another script tag.
 */
function loadMathJax(): Promise<void> {
  if (mathJaxLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("MathJax load timeout"));
    }, MATHJAX_TIMEOUT);

    if ((window as any).MathJax?.startup?.ready) {
      clearTimeout(timeout);
      mathJaxLoaded = true;
      resolve();
      return;
    }

    (window as any).MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\(", "\\)"]],
        displayMath: [["$$", "$$"], ["\\[", "\\]"]],
        processEscapes: true,
        processEnvironments: true,
        packages: { "[+]": ["ams", "noerrors", "noundefined", "mhchem"] },
      },
      loader: {
        load: ["[tex]/ams", "[tex]/noerrors", "[tex]/noundefined", "[tex]/mhchem"],
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"],
        enableMenu: false,
      },
      startup: {
        ready: () => {
          (window as any).MathJax.startup.defaultReady();
          clearTimeout(timeout);
          mathJaxLoaded = true;
          resolve();
        },
      },
    };

    const script = document.createElement("script");
    script.id = "mathjax-script";
    script.src = MATHJAX_URL;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      loadPromise = null; // allow a later mount to retry instead of failing forever
      reject(new Error("MathJax script failed to load"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

interface UseMathJaxResult<T extends HTMLElement> {
  ref: RefObject<T>;
  mathReady: boolean;
  mathError: string | null;
  typeset: () => void;
}

/**
 * Low-level MathJax primitive. Loads MathJax once globally and (re)typesets
 * the element attached to the returned `ref` whenever anything in `deps`
 * changes (pass the question id / html so it re-renders on Next, Previous,
 * Jump-to-question, Review mode, etc).
 *
 * Most components should use <MathContent> instead — it wraps this
 * correctly with zero chance of the ref being wired up wrong. Reach for
 * this hook directly only when you need to typeset a custom container
 * (e.g. a whole scrollable list) rather than a single piece of HTML.
 */
export function useMathJax<T extends HTMLElement = HTMLDivElement>(
  deps: any[] = []
): UseMathJaxResult<T> {
  const containerRef = useRef<T>(null);
  const [mathReady, setMathReady] = useState(mathJaxLoaded);
  const [mathError, setMathError] = useState<string | null>(null);

  const typeset = useCallback(() => {
    const MJ = (window as any).MathJax;
    const node = containerRef.current;
    if (!MJ?.typesetPromise || !node) return;

    try {
      if (typeof MJ.typesetClear === "function") {
        MJ.typesetClear([node]);
      }
    } catch {
      // Node may never have been typeset before — safe to ignore.
    }

    MJ.typesetPromise([node]).catch((err: any) => {
      console.warn("MathJax typeset error:", err);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadMathJax()
      .then(() => {
        if (!cancelled) {
          setMathReady(true);
          setMathError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMathError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // useLayoutEffect fires after the DOM has actually been updated (new
  // dangerouslySetInnerHTML content committed) but before paint, so there's
  // no need to guess with setTimeout — containerRef.current is guaranteed
  // to hold the latest markup by the time typeset() runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (mathReady) {
      typeset();
    }
  }, [mathReady, typeset, ...deps]);

  return { ref: containerRef, mathReady, mathError, typeset };
}

/** Imperatively (re)typeset an arbitrary element outside of the hook. */
export async function renderMath(element: HTMLElement): Promise<void> {
  try {
    await loadMathJax();
    const MJ = (window as any).MathJax;
    if (MJ?.typesetPromise) {
      if (typeof MJ.typesetClear === "function") {
        try { MJ.typesetClear([element]); } catch { /* ignore */ }
      }
      await MJ.typesetPromise([element]);
    }
  } catch (err) {
    console.warn("MathJax render error:", err);
  }
}
