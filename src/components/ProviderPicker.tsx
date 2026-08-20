import type { Provider } from "../hooks/useImageTo3D";

interface ProviderPickerProps {
  providers: Provider[];
  mode: "image" | "text";
  value: string;
  version: string;
  onChange: (provider: string) => void;
  onVersionChange: (version: string) => void;
}

export function ProviderPicker({ providers, mode, value, version, onChange, onVersionChange }: ProviderPickerProps) {
  const options = providers.filter((provider) => provider.modes?.includes(mode));
  const selected = options.find((provider) => provider.id === value);
  const versions = selected?.versions ?? [];

  return (
    <div className="w-64 space-y-2">
      <label className="block text-[10px] uppercase tracking-widest text-[#687064] font-bold">
        Engine {mode === "text" ? "de texto" : "de imagem"}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[var(--workbench-line)] bg-[var(--workbench-panel)] px-3 py-2 text-[11px] font-bold text-[#1A1C19] outline-none"
      >
        {options.map((provider) => (
          <option key={provider.id} value={provider.id} disabled={!provider.available}>
            {provider.label}{provider.available ? "" : " (indisponível)"}
          </option>
        ))}
      </select>
      {selected && (
        <div className="space-y-1 text-[10px] leading-relaxed text-[#687064]">
          <p>{selected.hint}</p>
          {selected.pricing && <p className="font-semibold text-[#A05A00]">Preço: {selected.pricing}</p>}
          {!selected.available && <p className="text-red-600">{selected.reason}</p>}
        </div>
      )}
      {options.filter((provider) => provider.id !== selected?.id && provider.pricing).map((provider) => (
        <p key={provider.id} className="text-[9px] leading-relaxed text-[#A05A00]">
          {provider.label}: {provider.pricing}
        </p>
      ))}
      {versions.length > 0 && (
        <select
          value={version}
          onChange={(event) => onVersionChange(event.target.value)}
          className="w-full rounded-lg border border-[var(--workbench-line)] bg-[var(--workbench-panel)] px-3 py-2 text-[10px] text-[#1A1C19] outline-none"
        >
          {versions.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.available}>
              {item.label}{item.available ? "" : " (indisponível)"}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
