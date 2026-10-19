import { useCallback, useEffect, useRef, useState } from "react";

/** Load async data with loading/error state and optional polling. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[] = [], every = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const run = useCallback(() => fn().then((d) => { if (alive.current) { setData(d); setError(""); } }).catch((e: any) => { if (alive.current) setError(e?.message || "Could not load data"); }).finally(() => { if (alive.current) setLoading(false); }), deps);
  useEffect(() => {
    alive.current = true;
    run();
    const id = every ? window.setInterval(run, every) : 0;
    return () => { alive.current = false; if (id) window.clearInterval(id); };
  }, [run, every]);
  return { data, error, loading, reload: run };
}
