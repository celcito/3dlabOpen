import { useNavigate } from "react-router-dom";
import {
  Image, Loader2, CheckCircle, XCircle, Download, Box, ExternalLink,
  LayoutGrid, LayoutList, Type, Cloud, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useImageTo3D, type Provider } from "../hooks/useImageTo3D";

const MAX_MULTI = 4;
const MULTI_OPTIONS = [2, 3, 4] as const;

function stepLabel(step: string) {
  const labels: Record<string, string> = {
    starting: "Initializing...",
    loading_model: "Loading model...",
    model_loaded: "Processing...",
    preprocessing_done: "Preprocessing...",
    inference_done: "Generating mesh...",
    converting_formats: "Converting...",
    complete: "Done",
    cloud_uploading: "Uploading to cloud...",
    cloud_processing: "Tripo cloud processing...",
    cloud_downloading: "Downloading result...",
    cloud_converting: "Converting formats...",
  };
  return labels[step] || step;
}

export default function ImageTo3D() {
  const navigate = useNavigate();
  const {
    file, setFile, uploading, setUploading, jobId, setJobId, error, setError,
    provider, setProvider, multiMode, setMultiMode, multiCount, setMultiCount,
    multiFiles, setMultiFiles, multiUploading, setMultiUploading, resolution,
    setResolution, textMode, setTextMode, prompt, setPrompt, textUploading,
    setTextUploading, textJobId, setTextJobId, progress, connected,
    textProgress, textConnected, multiJobs, addJobs, multiAllDone,
    handleGenerate, handleTextGenerate, handleGenerateMulti, handleReset, handleTextReset,
    handleMultiReset, setMultiFileAt, isProcessing, isDone, isError, showProgress,
    textIsProcessing, textIsDone, textIsError, textShowProgress, formatDownloadUrl,
    multiFormatDownloadUrl, multiProcessing, multiHasResults, multiJobEntries,
  } = useImageTo3D();


  return (
    <div className="flex flex-col h-full overflow-hidden text-[#1A1C19]">
      <header className="p-6 flex justify-between items-end border-b border-[#E2E3DD] shrink-0 bg-[#F9FAF4]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#632CE5] font-bold mb-2">VÉRTICE STUDIO TOOLS / v0.6.0</p>
          <h1 className="text-5xl font-black tracking-tighter leading-none uppercase">Image to 3D</h1>
        </div>
        <div className="text-right flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[#F9FAF4] border border-[#E2E3DD] p-1">
            <button
              onClick={() => { setMultiMode(false); setTextMode(false); handleReset(); }}
              className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${!multiMode && !textMode ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
            >
              <LayoutList className="w-3 h-3 inline mr-1" />
              Single
            </button>
            <button
              onClick={() => { setMultiMode(true); setTextMode(false); handleMultiReset(); }}
              className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${multiMode ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
            >
              <LayoutGrid className="w-3 h-3 inline mr-1" />
              Multi
            </button>
            <button
              onClick={() => { setTextMode(true); setMultiMode(false); handleTextReset(); }}
              className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${textMode ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
            >
              <Type className="w-3 h-3 inline mr-1" />
              Texto
            </button>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            <div>Engine</div>
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => setProvider("local")}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                  provider === "local"
                    ? "bg-[#632CE5] text-white"
                    : "bg-[#F9FAF4] text-zinc-400 hover:text-[#212121]"
                }`}
              >
                <Cpu className="w-3 h-3" />
                local
              </button>
              <button
                onClick={() => setProvider("cloud")}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                  provider === "cloud"
                    ? "bg-[#632CE5] text-white"
                    : "bg-[#F9FAF4] text-zinc-400 hover:text-[#212121]"
                }`}
              >
                <Cloud className="w-3 h-3" />
                cloud
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* LEFT PANE */}
        <div className="bg-[#F9FAF4] p-6 overflow-y-auto border-r border-[#E2E3DD]">
          {!multiMode && !textMode ? (
            <section>
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">01. Upload Image</h3>
              <div className="mb-4">
                <UploadDropzone file={file} onFile={setFile} disabled={isProcessing} />
              </div>
              <div className="flex gap-3">
                <Button disabled={!file || isProcessing} onClick={handleGenerate}
                  className="flex-1 bg-[#632CE5] text-[#212121] font-black uppercase text-xs py-4 tracking-widest hover:bg-white transition-colors">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</> : <><Image className="w-4 h-4 mr-2" /> Generate</>}
                </Button>
                {isDone && <Button onClick={handleReset} variant="outline" className="font-black uppercase text-xs tracking-widest">New</Button>}
              </div>
              {error && (
                <div className="mt-4 border border-red-900/40 bg-red-950/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-400">{error}</div>
                  </div>
                </div>
              )}
            </section>
          ) : textMode ? (
            <section>
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">01. Describe your object</h3>
              <div className="mb-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. a red toy car, a wooden boat, a fantasy sword..."
                  rows={4}
                  className="w-full bg-[#F9FAF4] border border-[#E2E3DD] rounded-lg px-4 py-3 text-[#212121] font-mono text-sm resize-none placeholder:text-[#212121]/20 focus:border-[#632CE5] focus:outline-none"
                  disabled={textIsProcessing}
                />
              </div>
              <p className="text-[10px] text-zinc-500 mb-4">
                Describe the object you want to generate. The system will automatically add "product photo, white background" for best results.
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!prompt.trim() || textIsProcessing}
                  onClick={handleTextGenerate}
                  className="flex-1 bg-[#632CE5] text-[#212121] font-black uppercase text-xs py-4 tracking-widest hover:bg-white transition-colors"
                >
                  {textUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Starting...</> : <><Type className="w-4 h-4 mr-2" /> Generate 3D</>}
                </Button>
                {textIsDone && (
                  <Button onClick={handleTextReset} variant="outline" className="font-black uppercase text-xs tracking-widest">New</Button>
                )}
              </div>
              {error && (
                <div className="mt-4 border border-red-900/40 bg-red-950/20 rounded-lg p-4">
                  <div className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><div className="text-xs text-red-400">{error}</div></div>
                </div>
              )}
            </section>
          ) : multiMode ? (
            <section>
              <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">01. Upload Images</h3>
              <p className="text-[10px] text-zinc-500 mb-3">
                Upload 2–4 photos of the same object from different angles for better results.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[9px] uppercase tracking-widest text-zinc-500">Images:</span>
                {MULTI_OPTIONS.map((n) => (
                  <button key={n} onClick={() => { setMultiCount(n); setMultiFiles(new Array(4).fill(null)); }}
                    className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${multiCount === n ? "bg-[#632CE5] text-[#212121]" : "bg-[#F9FAF4] text-zinc-400 hover:bg-[#F9FAF4]"}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Array.from({ length: multiCount }).map((_, i) => (
                  <div key={i} className="border border-[#E8E9E3] rounded-lg p-3 bg-[#F9FAF4]/50">
                    <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 font-bold">View {i + 1}</p>
                    <UploadDropzone file={multiFiles[i]} onFile={setMultiFileAt(i)} disabled={multiProcessing} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  disabled={multiFiles.filter((f): f is File => f !== null).length < 2 || multiProcessing}
                  onClick={handleGenerateMulti}
                  className="flex-1 bg-[#632CE5] text-[#212121] font-black uppercase text-xs py-4 tracking-widest hover:bg-white transition-colors">
                  {multiUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</> : <><Image className="w-4 h-4 mr-2" /> Generate All</>}
                </Button>
                {multiAllDone && (
                  <Button onClick={handleMultiReset} variant="outline" className="font-black uppercase text-xs tracking-widest">New</Button>
                )}
              </div>
              {error && (
                <div className="mt-4 border border-red-900/40 bg-red-950/20 rounded-lg p-4">
                  <div className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><div className="text-xs text-red-400">{error}</div></div>
                </div>
              )}
            </section>
          ) : null}

          <section className="mt-6">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">02. Resolution</h3>
            <div className="flex items-center gap-1 bg-[#F9FAF4] border border-[#E2E3DD] p-1 w-fit mb-4">
              <button
                onClick={() => setResolution(128)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${resolution === 128 ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
              >
                Fast (128)
              </button>
              <button
                onClick={() => setResolution(256)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${resolution === 256 ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
              >
                Standard (256)
              </button>
              <button
                onClick={() => setResolution(512)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors ${resolution === 512 ? "bg-[#632CE5] text-white" : "text-zinc-500 hover:text-white"}`}
              >
                High (512)
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 mb-4">
              {resolution === 128
                ? "128: 8x mais rapido que 256. Ideal para testes rapidos em CPU."
                : resolution === 512
                ? "512: ~2x mais detalhes, ~4x mais triangulos. Use para pecas com detalhes finos."
                : "256: Bom balanco qualidade/velocidade. Ideal para a maioria dos cases."}
            </p>
          </section>

          <section className="mt-6">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">03. Tips</h3>
            <ul className="space-y-2 text-[11px] text-zinc-500 leading-relaxed">
              <li className="flex items-start gap-2"><span className="text-[#632CE5] mt-0.5">&#x2022;</span>Use well-lit photos with the object centered on a neutral background</li>
              <li className="flex items-start gap-2"><span className="text-[#632CE5] mt-0.5">&#x2022;</span>Single objects work best</li>
              <li className="flex items-start gap-2"><span className="text-[#632CE5] mt-0.5">&#x2022;</span>Generation takes 10–30s on GPU, up to 3 min on CPU</li>
              <li className="flex items-start gap-2"><span className="text-[#632CE5] mt-0.5">&#x2022;</span>Multi-image mode uploads from different angles for comparison</li>
            </ul>
          </section>
        </div>

        {/* RIGHT PANE */}
        <div className="bg-[#F9FAF4] p-6 flex flex-col overflow-y-auto">
          {!multiMode ? (
            !jobId && !isProcessing && !isDone ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-zinc-600"><Box className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-[10px] uppercase tracking-widest">Upload an image and click Generate</p></div>
              </div>
            ) : showProgress && progress.status !== "done" && progress.status !== "error" ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold">Generating 3D Model</h3>
                <div className="bg-white border border-[#E2E3DD] rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 text-[#632CE5] animate-spin" /><span className="text-sm font-mono text-zinc-300">{stepLabel(progress.step) || "Processing..."}</span></div>
                  <div className="w-full bg-[#E8E9E3] rounded-full h-1.5 overflow-hidden"><div className="h-full bg-[#632CE5] rounded-full transition-all duration-500" style={{ width: `${Math.max(progress.progress, 2)}%` }} /></div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">{progress.progress}%</p>
                </div>
              </section>
            ) : isDone ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">03. Result</h3>
                <div className="bg-white border border-[#632CE5]/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-[#00FF41]" /><span className="text-xs font-bold text-[#00FF41] uppercase tracking-wider">Complete</span></div>
                  <p className="text-[11px] text-zinc-500">Your 3D model is ready.</p>
                </div>
                <Button onClick={() => navigate(`/viewer?model=${jobId}`)} className="w-full bg-white text-black font-black uppercase text-xs py-3 tracking-widest hover:bg-[#632CE5] mb-4"><ExternalLink className="w-4 h-4 mr-2" />Open in 3D Viewer</Button>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-bold">Download</h4>
                <div className="space-y-2">
                  {(["glb", "obj", "stl"] as const).map((fmt) => (
                    <a key={fmt} href={formatDownloadUrl(fmt)} download={`model.${fmt}`} className="flex items-center justify-between p-2.5 bg-[#E8E9E3] border border-[#E8E9E3] hover:border-[#632CE5]/40 transition-colors group">
                      <span className="text-xs font-mono uppercase">{fmt}</span>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500 group-hover:text-[#632CE5]"><Download className="w-3 h-3" /> .{fmt}</span>
                    </a>
                  ))}
                </div>
              </section>
            ) : isError && !showProgress ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold">Error</h3>
                <div className="bg-white border border-red-900/40 rounded-lg p-6">
                  <div className="flex items-start gap-2 mb-3"><XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-red-400">Generation Failed</p><p className="text-[11px] text-zinc-500 mt-1">{error || progress.error || "Unknown error"}</p></div></div>
                  <Button onClick={handleReset} variant="outline" className="w-full mt-4 font-black uppercase text-xs tracking-widest">Try Again</Button>
                </div>
              </section>
            ) : null
          ) : textMode ? (
            !textJobId && !textIsProcessing && !textIsDone ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-zinc-600"><Type className="w-16 h-16 mx-auto mb-4 opacity-20" /><p className="text-[10px] uppercase tracking-widest">Describe your object and click Generate 3D</p></div>
              </div>
            ) : textShowProgress && textProgress.status !== "done" && textProgress.status !== "error" ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold">Generating 3D Model</h3>
                <div className="bg-white border border-[#E2E3DD] rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 text-[#632CE5] animate-spin" /><span className="text-sm font-mono text-zinc-300">{stepLabel(textProgress.step) || "Processing..."}</span></div>
                  <div className="w-full bg-[#E8E9E3] rounded-full h-1.5 overflow-hidden"><div className="h-full bg-[#632CE5] rounded-full transition-all duration-500" style={{ width: `${Math.max(textProgress.progress, 2)}%` }} /></div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">{textProgress.progress}%</p>
                </div>
              </section>
            ) : textIsDone ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-4 font-bold">03. Result</h3>
                <div className="bg-white border border-[#632CE5]/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-[#00FF41]" /><span className="text-xs font-bold text-[#00FF41] uppercase tracking-wider">Complete</span></div>
                  <p className="text-[11px] text-zinc-500">Your 3D model is ready.</p>
                </div>
                <Button onClick={() => navigate(`/viewer?model=${textJobId}`)} className="w-full bg-white text-black font-black uppercase text-xs py-3 tracking-widest hover:bg-[#632CE5] mb-4"><ExternalLink className="w-4 h-4 mr-2" />Open in 3D Viewer</Button>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-bold">Download</h4>
                <div className="space-y-2">
                  {(["glb", "obj", "stl"] as const).map((fmt) => (
                    <a key={fmt} href={`/api/img2-3d/${textJobId}/result/${fmt}`} download={`model.${fmt}`} className="flex items-center justify-between p-2.5 bg-[#E8E9E3] border border-[#E8E9E3] hover:border-[#632CE5]/40 transition-colors group">
                      <span className="text-xs font-mono uppercase">{fmt}</span>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-500 group-hover:text-[#632CE5]"><Download className="w-3 h-3" /> .{fmt}</span>
                    </a>
                  ))}
                </div>
              </section>
            ) : textIsError ? (
              <section className="flex-1">
                <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-6 font-bold">Error</h3>
                <div className="bg-white border border-red-900/40 rounded-lg p-6">
                  <div className="flex items-start gap-2 mb-3"><XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-red-400">Generation Failed</p><p className="text-[11px] text-zinc-500 mt-1">{error || textProgress.error || "Unknown error"}</p></div></div>
                  <Button onClick={handleTextReset} variant="outline" className="w-full mt-4 font-black uppercase text-xs tracking-widest">Try Again</Button>
                </div>
              </section>
            ) : null
          ) : !multiAllDone && !multiProcessing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-zinc-600"><Box className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-[10px] uppercase tracking-widest">Upload 2–4 images and click Generate All</p></div>
            </div>
          ) : (
            <div className="space-y-4">
              {multiProcessing && (
                <section>
                  <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">
                    Generating ({multiJobEntries.filter((j) => j.status === "done").length}/{multiJobEntries.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {multiJobEntries.map((j) => (
                      <div key={j.jobId} className="bg-white border border-[#E2E3DD] rounded p-3">
                        <span className="font-mono text-[9px] text-zinc-500 block mb-1">{j.jobId.slice(0, 6)}</span>
                        {j.status === "done" ? (
                          <div className="flex items-center gap-1 text-[9px] text-[#00FF41]"><CheckCircle className="w-3 h-3" /> Done</div>
                        ) : j.status === "error" ? (
                          <div className="text-[9px] text-red-400">Error</div>
                        ) : (
                          <div>
                            <div className="w-full bg-[#E8E9E3] rounded-full h-1 mb-1"><div className="h-full bg-[#632CE5] rounded-full" style={{ width: `${Math.max(j.progress, 2)}%` }} /></div>
                            <span className="text-[9px] text-zinc-500 font-mono">{stepLabel(j.step)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {multiHasResults && (
                <section>
                  <h3 className="text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold">Results</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {multiJobEntries.filter((j) => j.status === "done").map((j, i) => (
                      <div key={j.jobId} className="bg-white border border-[#632CE5]/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-[#00FF41]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-200">View {i + 1}</span>
                        </div>
                        <Button onClick={() => navigate(`/viewer?model=${j.jobId}`)} className="w-full bg-white text-black font-black uppercase text-[9px] py-2 tracking-widest">
                          <ExternalLink className="w-3 h-3 mr-1" /> Open
                        </Button>
                        <div className="flex gap-1">
                          {(["glb", "obj", "stl"] as const).map((fmt) => (
                            <a key={fmt} href={multiFormatDownloadUrl(j.jobId, fmt)} download={`view${i + 1}.${fmt}`}
                              className="flex-1 bg-[#F9FAF4] hover:bg-[#F9FAF4] text-center text-[8px] font-mono uppercase py-1 text-zinc-400 hover:text-[#212121] transition-colors">
                              {fmt}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="h-12 border-t border-[#E2E3DD] px-6 flex items-center justify-between bg-[#F9FAF4] shrink-0">
        <div className="flex gap-6 items-center text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          <span>Engine: <span className="text-[#632CE5]">{provider === "cloud" ? "Tripo Cloud" : "TripoSR"}</span></span>
          <span>Mode: <span className={multiMode || textMode ? "text-[#632CE5]" : "text-zinc-500"}>{textMode ? "Texto → 3D" : multiMode ? "Multi-View" : "Single"}</span></span>
        </div>
      </footer>
    </div>
  );
}
