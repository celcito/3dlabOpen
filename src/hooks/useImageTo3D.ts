import { useEffect, useState } from "react";
import { useJobStream } from "../../hooks/useJobStream";
import { useMultiJobStream } from "../../hooks/useMultiJobStream";

export interface Provider {
  id: string;
  label: string;
  available: boolean;
  model_version?: string;
}

export function useImageTo3D() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState("local");
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [multiCount, setMultiCount] = useState(4);
  const [multiFiles, setMultiFiles] = useState<(File | null)[]>(new Array(4).fill(null));
  const [multiUploading, setMultiUploading] = useState(false);
  const [resolution, setResolution] = useState<128 | 256 | 512>(128);
  const [textMode, setTextMode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [textUploading, setTextUploading] = useState(false);
  const [textJobId, setTextJobId] = useState<string | null>(null);
  const { progress, connected } = useJobStream(jobId);
  const { progress: textProgress, connected: textConnected } = useJobStream(textJobId);
  const { jobs: multiJobs, addJobs, allDone: multiAllDone } = useMultiJobStream();

  useEffect(() => {
    fetch("/api/img2-3d/providers")
      .then((response) => response.json())
      .then((data) => {
        setAvailableProviders(data.providers || []);
        const cloud = (data.providers || []).find((p: Provider) => p.available && p.id === "cloud");
        if (cloud) setProvider("cloud");
      })
      .catch(() => setProvider("local"));
  }, []);

  const handleGenerate = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("mcResolution", String(resolution));
      formData.append("provider", provider);
      const response = await fetch("/api/img2-3d/generate", { method: "POST", body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setJobId((await response.json()).jobId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const handleTextGenerate = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setTextUploading(true);
    try {
      const response = await fetch("/api/text-to-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mcResolution: resolution, provider }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setTextJobId((await response.json()).jobId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown error");
    } finally {
      setTextUploading(false);
    }
  };

  const handleGenerateMulti = async () => {
    const files = multiFiles.filter((item): item is File => item !== null);
    if (files.length < 2) return;
    setError(null);
    setMultiUploading(true);
    const jobIds: string[] = [];
    try {
      for (const currentFile of files.slice(0, multiCount)) {
        const formData = new FormData();
        formData.append("image", currentFile);
        formData.append("mcResolution", String(resolution));
        formData.append("provider", provider);
        const response = await fetch("/api/img2-3d", { method: "POST", body: formData });
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        jobIds.push((await response.json()).jobId);
      }
      addJobs(jobIds);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unknown error");
    } finally {
      setMultiUploading(false);
    }
  };

  const handleReset = () => { setFile(null); setJobId(null); setError(null); };
  const handleTextReset = () => { setPrompt(""); setTextJobId(null); setTextUploading(false); setError(null); };
  const handleMultiReset = () => { setMultiFiles(new Array(4).fill(null)); setMultiUploading(false); setError(null); };
  const setMultiFileAt = (index: number) => (currentFile: File) => {
    const next = [...multiFiles];
    next[index] = currentFile;
    setMultiFiles(next);
  };
  const isProcessing = jobId !== null && progress.status !== "done" && progress.status !== "error";
  const isDone = progress.status === "done";
  const isError = progress.status === "error" || !!error;
  const showProgress = uploading || isProcessing;
  const textIsProcessing = textJobId !== null && textProgress.status !== "done" && textProgress.status !== "error";
  const textIsDone = textProgress.status === "done";
  const textIsError = textProgress.status === "error";
  const textShowProgress = textUploading || textIsProcessing;
  const formatDownloadUrl = (format: string) => `/api/img2-3d/${jobId}/result/${format}`;
  const multiFormatDownloadUrl = (id: string, format: string) => `/api/img2-3d/${id}/result/${format}`;
  const multiProcessing = multiUploading || [...multiJobs.values()].some((job) => job.status !== "done" && job.status !== "error" && job.status !== "disconnected");
  const multiHasResults = [...multiJobs.values()].some((job) => job.status === "done");
  const multiJobEntries = [...multiJobs.values()];

  return {
    file, setFile, uploading, setUploading, jobId, setJobId, error, setError,
    provider, setProvider, availableProviders, multiMode, setMultiMode,
    multiCount, setMultiCount, multiFiles, setMultiFiles, multiUploading,
    setMultiUploading, resolution, setResolution, textMode, setTextMode,
    prompt, setPrompt, textUploading, setTextUploading, textJobId, setTextJobId,
    progress, connected, textProgress, textConnected, multiJobs, addJobs, multiAllDone,
    handleGenerate, handleTextGenerate, handleGenerateMulti, handleReset, handleTextReset,
    handleMultiReset, setMultiFileAt, isProcessing, isDone, isError, showProgress,
    textIsProcessing, textIsDone, textIsError, textShowProgress, formatDownloadUrl,
    multiFormatDownloadUrl, multiProcessing, multiHasResults, multiJobEntries,
  };
}
