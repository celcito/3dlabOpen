import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

interface Props {
  file: File | null;
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ file, onFile, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f && ["image/png", "image/jpeg", "image/webp", "image/bmp"].includes(f.type)) onFile(f);
    },
    [disabled, onFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && ["image/png", "image/jpeg", "image/webp", "image/bmp"].includes(f.type)) onFile(f);
    },
    [onFile]
  );

  const handleClear = useCallback(() => {
    onFile(null as unknown as File);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFile]);

  if (file) {
    return (
      <div className="relative group">
        <img
          src={URL.createObjectURL(file)}
          alt="preview"
          className="w-full aspect-square object-cover rounded-lg border border-[#333]"
        />
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 bg-black/80 text-white p-1 rounded hover:bg-red-600 transition-colors"
          disabled={disabled}
        >
          <X className="w-4 h-4" />
        </button>
        <p className="text-[9px] text-zinc-500 mt-1 truncate">{file.name}</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-[#00E5FF] bg-[#00E5FF]/5"
          : disabled
          ? "border-[#222] bg-[#080808] opacity-50"
          : "border-[#333] bg-[#0A0A0A] hover:border-zinc-500"
      }`}
    >
      <Upload className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
        {disabled ? "Processing..." : "Drop or click"}
      </p>
      <p className="text-[9px] text-zinc-700 mt-1">PNG, JPG, WebP</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
