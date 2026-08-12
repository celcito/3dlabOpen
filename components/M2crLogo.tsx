export function M2crLogo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="-80 -92 160 152"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon points="0,-72 62,-36 62,0 0,36 -62,0 -62,-36" fill="#E8F4FD" opacity="0.3" />
        <polygon points="-62,-36 0,0 0,36 -62,0" fill="#F97316" />
        <polygon points="62,-36 0,0 0,36 62,0" fill="#3B82F6" />
        <polygon points="0,-72 62,-36 0,0 -62,-36" fill="#8B5CF6" />
        <line x1="0" y1="-72" x2="0" y2="0" stroke="white" strokeWidth="2" opacity="0.6" />
        <line x1="0" y1="0" x2="-62" y2="-36" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="0" y1="0" x2="62" y2="-36" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="0" y1="0" x2="0" y2="36" stroke="white" strokeWidth="1.5" opacity="0.5" />
        <line x1="62" y1="-26" x2="0" y2="10" stroke="white" strokeWidth="1" opacity="0.3" />
        <line x1="62" y1="-16" x2="0" y2="20" stroke="white" strokeWidth="1" opacity="0.3" />
        <line x1="62" y1="-6" x2="0" y2="30" stroke="white" strokeWidth="1" opacity="0.3" />
        <circle cx="0" cy="-72" r="5" fill="#F59E0B" />
      </svg>
      {withWordmark && (
        <span className="font-sans text-[18px] font-medium tracking-tight text-[#2C2C2A]">
          M2CR <span className="text-[#7C3AED] font-semibold">Studio</span>
        </span>
      )}
    </span>
  );
}