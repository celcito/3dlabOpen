import { useCallback, useRef, useState } from "react";
import { AlertTriangle, FileBox, Upload, X } from "lucide-react";

interface Props {
  file: File | null;
  onFile: (file: File) => void;
  disabled?: boolean;
  onClear?: () => void;
}

const SOFT_LIMIT = 50 * 1024 * 1024;
const HARD_LIMIT = 200 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/bmp"];

export function UploadDropzone({ file, onFile, disabled, onClear }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((candidate: File) => {
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setWarning("Formato não suportado. Use PNG, JPG ou WebP.");
      return;
    }
    if (candidate.size > HARD_LIMIT) {
      setWarning(`Arquivo muito grande (${Math.round(candidate.size / 1024 / 1024)} MB). Limite é 200 MB.`);
      return;
    }
    setWarning(candidate.size > SOFT_LIMIT ? "Arquivo > 50 MB — o processamento pode ser lento." : null);
    onFile(candidate);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const candidate = e.dataTransfer.files?.[0];
    if (candidate) acceptFile(candidate);
  }, [acceptFile, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const candidate = e.target.files?.[0];
    if (candidate) acceptFile(candidate);
  }, [acceptFile]);

  const handleClear = useCallback(() => {
    onClear?.();
    if (inputRef.current) inputRef.current.value = "";
  }, [onClear]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragOver(true); }}
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
        {file ? (
          <div className="flex items-center justify-center gap-2 text-[#1A1C19]">
            <FileBox className="w-5 h-5 text-[#632CE5]" />
            <span className="font-mono text-[12px] font-semibold truncate max-w-[190px]">{file.name}</span>
            {onClear && (
              <button type="button" onClick={(event) => { event.stopPropagation(); handleClear(); }} className="p-1 rounded text-[#7A7487] hover:bg-white hover:text-red-600" disabled={disabled} aria-label="Remover arquivo">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto mb-2 text-[#632CE5]" />
            <p className="text-[11px] uppercase tracking-widest text-[#494455] font-bold">{disabled ? "Processando" : "Arraste ou clique"}</p>
            <p className="text-[10px] text-[#7A7487] mt-1">PNG, JPG ou WebP · até 200 MB</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={handleChange} className="hidden" disabled={disabled} />
      </div>
      {warning && <div className="flex items-center gap-2 text-[#B26A00] bg-[#FFF4E5] border border-[#FFD9A8] rounded-lg px-3 py-2 text-[11px]"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{warning}</span></div>}
    </div>
  );
}
