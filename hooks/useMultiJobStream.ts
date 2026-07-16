import { useState, useCallback, useRef, useEffect } from "react";

export interface MultiJobEntry {
  jobId: string;
  status: string;
  progress: number;
  step: string;
  error: string | null;
}

export function useMultiJobStream() {
  const [jobs, setJobs] = useState<Map<string, MultiJobEntry>>(new Map());
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sourcesRef.current.forEach((es) => es.close());
      sourcesRef.current.clear();
    };
  }, []);

  const addJobs = useCallback((jobIds: string[]) => {
    const entries: [string, MultiJobEntry][] = jobIds.map((id) => [
      id,
      { jobId: id, status: "pending", progress: 0, step: "", error: null },
    ]);

    setJobs((prev) => {
      const next = new Map(prev);
      for (const [id, entry] of entries) {
        if (!next.has(id)) next.set(id, entry);
      }
      return next;
    });

    for (const id of jobIds) {
      if (sourcesRef.current.has(id)) continue;
      const es = new EventSource(`/api/img2-3d/${id}/sse`);
      sourcesRef.current.set(id, es);

      es.addEventListener("progress", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (!mountedRef.current) return;
          setJobs((prev) => {
            const next = new Map(prev);
            next.set(id, {
              jobId: id,
              status: data.status,
              progress: data.progress,
              step: data.step,
              error: data.error || null,
            });
            return next;
          });

          if (data.status === "done" || data.status === "error") {
            es.close();
            sourcesRef.current.delete(id);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("ping", () => {});

      es.onerror = () => {
        if (!mountedRef.current) return;
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(id);
          if (existing && existing.status !== "done" && existing.status !== "error") {
            next.set(id, { ...existing, status: "disconnected", error: "Connection lost" });
          }
          return next;
        });
        es.close();
        sourcesRef.current.delete(id);
      };
    }
  }, []);

  const allDone = jobs.size > 0 && [...jobs.values()].every(
    (j) => j.status === "done" || j.status === "error" || j.status === "disconnected"
  );

  return { jobs, addJobs, allDone };
}
