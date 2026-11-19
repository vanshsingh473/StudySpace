import { useEffect, useState } from "react";

/** Counts down from `seconds` (measured at `stamp`, a Date.now() value). */
export function useCountdown(seconds: number, stamp: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round(seconds - (now - stamp) / 1000));
}

export function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function Countdown({ seconds, stamp, className }: { seconds: number; stamp: number; className?: string }) {
  const left = useCountdown(seconds, stamp);
  return <span className={`tabular ${className ?? ""}`} aria-live="off">{fmtDuration(left)}</span>;
}

export const hm = (t: string) => t.slice(0, 5);
