// src/hooks/useTelegramBotTick.ts
import { useEffect } from "react";

const THROTTLE_MS = 10 * 60 * 1000; // at most once every 10 min per browser tab
const STORAGE_KEY = "nv_tg_tick_last";

/**
 * Fire-and-forget "is it time to post?" ping. Completely invisible to the
 * user — never blocks rendering, never shows an error. The actual posting
 * decision (due-time + on/off) happens server-side in api/telegram-bot-tick;
 * this hook just gives it a chance to run whenever someone's browsing.
 */
export function useTelegramBotTick() {
  useEffect(() => {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() - last < THROTTLE_MS) return;
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    fetch("/api/telegram-bot-tick").catch(() => {});
  }, []);
}
