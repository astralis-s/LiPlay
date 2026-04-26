import { useEffect, useState } from "react";

/** Returns true when the user has been inactive (no mouse / key / touch /
 *  wheel events) for `delayMs`. Resets immediately on any activity. */
export function useIdle(delayMs: number = 120_000): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const arm = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), delayMs);
    };
    const wake = () => { if (idle) setIdle(false); arm(); };

    arm();
    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "wheel", "touchstart",
    ];
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, wake));
      if (timer != null) window.clearTimeout(timer);
    };
  }, [delayMs, idle]);
  return idle;
}
