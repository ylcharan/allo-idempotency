import { useEffect, useRef } from "react";

/** How often to refetch inventory (available = total − reserved, after lazy expiry). */
const POLL_INTERVAL_MS = 4_000;

/**
 * Periodically calls `tick` while the document is visible. Also runs `tick` when the
 * tab becomes visible again so numbers catch up immediately.
 */
export function useInventoryPoll(tick: () => void | Promise<void>) {
  const tickRef = useRef(tick);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    const run = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void tickRef.current();
    };

    const id = window.setInterval(run, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (!document.hidden) run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
