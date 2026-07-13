import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noindex?: boolean;
}

const SITE_URL = "https://neetverse.site";
const DEFAULT_OG_IMAGE = "/logo.jpg";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Updates <head> tags on route mount. Client-side only (this is a Vite SPA,
 *  not SSR) — see the final report for what that does and doesn't cover. */
export function useSEO({ title, description, path, ogImage = DEFAULT_OG_IMAGE, noindex = false }: SEOProps) {
  useEffect(() => {
    const fullUrl = `${SITE_URL}${path}`;
    document.title = title;
    setMeta("name", "description", description);
    setCanonical(fullUrl);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", fullUrl);
    setMeta("property", "og:image", `${SITE_URL}${ogImage}`);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", `${SITE_URL}${ogImage}`);

    let robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsEl) {
      robotsEl = document.createElement("meta");
      robotsEl.setAttribute("name", "robots");
      document.head.appendChild(robotsEl);
    }
    robotsEl.setAttribute("content", noindex ? "noindex, nofollow" : "index, follow");
  }, [title, description, path, ogImage, noindex]);
}
