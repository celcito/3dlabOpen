import { useState, useEffect, useRef, useMemo } from "react";

export interface JobProgress {
  status: string;
  progress: number;
  step: string;
  error: string | null;
  files: Record<string, string> | null;
}

const EMPTY: JobProgress = {
  status: "idle",
  progress: 0,
  step: "",
  error: null,
  files: null,
};

export function useJobStream(jobId: string | null) {
  const [progress, setProgress] = useState<JobProgress>(EMPTY);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setProgress(EMPTY);
      setConnected(false);
      return;
    }

    if (jobIdRef.current === jobId) return;
    jobIdRef.current = jobId;

    const url = `/api/img2-3d/${jobId}/sse`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as JobProgress;
        setProgress(data);
        setConnected(true);
      } catch {
        /* ignore malformed */
      }
    });

    es.addEventListener("ping", () => {
      setConnected(true);
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      setProgress((prev) => {
        if (prev.status !== "done" && prev.status !== "error") {
          return { ...prev, status: "error", error: "Connection lost — backend may have crashed" };
        }
        return prev;
      });
    };

    return () => {
      es.close();
      esRef.current = null;
      jobIdRef.current = null;
    };
  }, [jobId]);

  const stableProgress = useMemo(() => progress, [JSON.stringify(progress)]);

  return { progress: stableProgress, connected };
}
