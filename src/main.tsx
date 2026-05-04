import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply persisted theme before render to avoid flash
(() => {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  } catch {}
})();

createRoot(document.getElementById("root")!).render(<App />);
