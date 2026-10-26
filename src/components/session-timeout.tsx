"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { timedOut } from "@/app/login/actions";

/**
 * Two hours idle signs you out, with a five-minute warning; twelve hours signs you out
 * regardless. Activity in one tab counts in all of them.
 */
const IDLE_MS = 120 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const WARN_MS = 5 * 60 * 1000;
const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"];
const KEY = "cp-portal-active";

export function SessionTimeout() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastActive = useRef(0);
  const started = useRef(0);

  const end = useCallback((reason: "Timed out" | "Session ended") => {
    void timedOut(reason);
  }, []);

  const stayOn = useCallback(() => {
    lastActive.current = Date.now();
    setRemaining(null);
  }, []);

  useEffect(() => {
    lastActive.current = Date.now();
    started.current = Date.now();
    let ready = true;
    const note = () => {
      if (!ready) return;
      ready = false;
      setTimeout(() => (ready = true), 1000);
      lastActive.current = Date.now();
      setRemaining((r) => (r === null ? r : null));
    };
    EVENTS.forEach((e) => window.addEventListener(e, note, { passive: true }));
    const heard = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        lastActive.current = Math.max(lastActive.current, Number(e.newValue));
        setRemaining(null);
      }
    };
    window.addEventListener("storage", heard);
    const broadcast = setInterval(() => {
      try {
        localStorage.setItem(KEY, String(lastActive.current));
      } catch {}
    }, 20_000);
    const tick = setInterval(() => {
      const now = Date.now();
      const idle = now - lastActive.current;
      if (now - started.current >= ABSOLUTE_MS) return end("Session ended");
      if (idle >= IDLE_MS) return end("Timed out");
      if (idle >= IDLE_MS - WARN_MS) setRemaining(IDLE_MS - idle);
    }, 5_000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, note));
      window.removeEventListener("storage", heard);
      clearInterval(broadcast);
      clearInterval(tick);
    };
  }, [end]);

  if (remaining === null) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-4">
      <div className="card w-full max-w-sm border-t-4 border-t-accent">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Still there?</p>
        <h2 className="mt-2 mb-3 text-2xl">Signing out in {mins}:{String(secs).padStart(2, "0")}</h2>
        <p className="mb-5 text-sm text-muted">Nothing has happened here for a while. Anything you&apos;ve saved will still be there when you sign back in.</p>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={stayOn}>Stay signed in</button>
          <button className="btn-ghost" onClick={() => end("Timed out")}>Sign out now</button>
        </div>
      </div>
    </div>
  );
}
