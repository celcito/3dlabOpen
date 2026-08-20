import { useEffect, useState } from "react";
import { useJobStream } from "../../hooks/useJobStream";
import { useMultiJobStream } from "../../hooks/useMultiJobStream";

export interface Provider {
  id: string;
  label: string;
  modes: ("image" | "text")[];
  available: boolean;
  reason?: string | null;
  hint?: string;
  pricing?: string;
  model_version?: string;
  versions?: { id: string; label: string; available: boolean; reason?: string }[];
}

const IMAGE_PROVIDER_KEY = "m2cr.provider.image";
const TEXT_PROVIDER_KEY = "m2cr.provider.text";
const HUNYUAN_VERSION_KEY = "m2cr.provider.hunyuanVersion";

function readPreference(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
}

export function useImageTo3D() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState(() => readPreference(IMAGE_PROVIDER_KEY, "local"));
  const [textProvider, setTextProvider] = useState(() => readPreference(TEXT_PROVIDER_KEY, "local"));
  const [modelVersion, setModelVersion] = useState(() => readPreference(HUNYUAN_VERSION_KEY, "hunyuan3d-2"));
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
        const imageProvider = (data.providers || []).find((p: Provider) => p.available && p.modes?.includes("image"));
        if (!(data.providers || []).some((p: Provider) => p.id === provider && p.available && p.modes?.includes("image"))) {
          setProvider(imageProvider?.id || "local");
        }
        const textProviderOption = (data.providers || []).find((p: Provider) => p.available && p.modes?.includes("text"));
        if (!(data.providers || []).some((p: Provider) => p.id === textProvider && p.available && p.modes?.includes("text"))) {
          setTextProvider(textProviderOption?.id || "local");
        }
      })
      .catch(() => {
        setProvider("local");
        setTextProvider("local");
      });
  }, []);

  useEffect(() => writePreference(IMAGE_PROVIDER_KEY, provider), [provider]);
  useEffect(() => writePreference(TEXT_PROVIDER_KEY, textProvider), [textProvider]);
  useEffect(() => writePreference(HUNYUAN_VERSION_KEY, modelVersion), [modelVersion]);

  const handleGenerate = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const params = new URLSearchParams({
        mc_resolution: String(resolution),
        provider,
      });
      if (modelVersion) params.set("model_version", modelVersion);
      const response = await fetch(`/api/img2-3d?${params.toString()}`, { method: "POST", body: formData });
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
        body: JSON.stringify({ prompt, mcResolution: resolution, provider: textProvider }),
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
        formData.append("modelVersion", modelVersion);
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
    provider, setProvider, textProvider, setTextProvider, modelVersion, setModelVersion,
    availableProviders, multiMode, setMultiMode,
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
