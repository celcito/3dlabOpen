import { useCallback, useRef, useState } from "react";
import { Upload, AlertTriangle, FileBox } from "lucide-react";

export interface SplitDropzoneProps {
  fileName: string | null;
  onFile: (file: File) => void;
  disabled?: boolean;
}

const SOFT_LIMIT = 50 * 1024 * 1024;
const HARD_LIMIT = 200 * 1024 * 1024;
const ACCEPTED = [".3mf", ".glb", ".gltf", ".obj"];

export function SplitDropzone({ fileName, onFile, disabled }: SplitDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!ACCEPTED.includes(`.${ext}`)) {
       setWarn(`Formato ".${ext}" não suportado. Use .3mf, .glb, .gltf ou .obj.`);
      return;
    }
    if (f.size > HARD_LIMIT) {
      setWarn(`Arquivo muito grande (${Math.round(f.size / 1024 / 1024)} MB). Limite é 200 MB.`);
      return;
    }
    setWarn(f.size > SOFT_LIMIT ? `Arquivo > 50 MB — o processamento pode ser lento.` : null);
    onFile(f);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) accept(f);
  }, [accept, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) accept(f);
  }, [accept]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-[#632CE5] bg-[#632CE5]/5"
            : disabled
            ? "border-[#E8E9E3] bg-[#E8E9E3] opacity-50"
            : "border-[#CAC3D8] bg-[#F2F0F5] hover:border-[#632CE5]"
        }`}
      >
        {fileName ? (
          <div className="flex items-center justify-center gap-2 text-[#1A1C19]">
            <FileBox className="w-5 h-5 text-[#632CE5]" />
            <span className="font-mono text-[12px] font-semibold truncate">{fileName}</span>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto mb-2 text-[#632CE5]" />
            <p className="text-[11px] uppercase tracking-widest text-[#494455] font-bold">
              Arraste ou clique
            </p>
            <p className="text-[10px] text-[#7A7487] mt-1">3MF, GLB, GLTF ou OBJ · até 200 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
           accept=".3mf,.glb,.gltf,.obj"
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {warn && (
        <div className="flex items-center gap-2 text-[#B26A00] bg-[#FFF4E5] border border-[#FFD9A8] rounded-lg px-3 py-2 text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{warn}</span>
        </div>
      )}
    </div>
  );
}
