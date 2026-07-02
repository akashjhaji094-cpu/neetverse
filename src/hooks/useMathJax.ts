import { useEffect, useRef, useCallback, useState } from "react";

let mathJaxLoaded = false;
let mathJaxLoading = false;
let loadPromise: Promise<void> | null = null;

const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
const MATHJAX_TIMEOUT = 15000;

function loadMathJax(): Promise<void> {
  if (mathJaxLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  
  mathJaxLoading = true;
  
  loadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      mathJaxLoading = false;
      reject(new Error('MathJax load timeout'));
    }, MATHJAX_TIMEOUT);

    if ((window as any).MathJax?.startup?.ready) {
      clearTimeout(timeout);
      mathJaxLoaded = true;
      mathJaxLoading = false;
      resolve();
      return;
    }

    (window as any).MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true,
        packages: { '[+]': ['ams', 'noerrors', 'noundefined', 'mhchem'] },
      },
      loader: {
        load: ['[tex]/ams', '[tex]/noerrors', '[tex]/noundefined', '[tex]/mhchem'],
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
        enableMenu: false,
      },
      startup: { 
        ready: () => { 
          (window as any).MathJax.startup.defaultReady(); 
          clearTimeout(timeout);
          mathJaxLoaded = true;
          mathJaxLoading = false;
          resolve(); 
        } 
      },
    };

    const script = document.createElement('script');
    script.src = MATHJAX_URL;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      mathJaxLoading = false;
      reject(new Error('MathJax script failed to load'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useMathJax(deps: any[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mathReady, setMathReady] = useState(false);
  const [mathError, setMathError] = useState<string | null>(null);

  const typeset = useCallback(() => {
    const MJ = (window as any).MathJax;
    if (!MJ?.typesetPromise || !containerRef.current) return;
    
    MJ.typesetPromise([containerRef.current]).catch((err: any) => {
      console.warn('MathJax typeset error:', err);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    loadMathJax()
      .then(() => {
        if (!cancelled) {
          setMathReady(true);
          setMathError(null);
          typeset();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMathError(err.message);
          setMathReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [typeset, ...deps]);

  return { ref: containerRef, mathReady, mathError, typeset };
}

export async function renderMath(element: HTMLElement): Promise<void> {
  try {
    await loadMathJax();
    const MJ = (window as any).MathJax;
    if (MJ?.typesetPromise) {
      await MJ.typesetPromise([element]);
    }
  } catch (err) {
    console.warn('MathJax render error:', err);
  }
}
