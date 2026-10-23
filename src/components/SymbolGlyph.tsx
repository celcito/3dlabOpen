import React from 'react';
import { SYMBOL_SHAPES, type SymbolPart } from '../lib/pencilTopper/symbols';

function partElement(part: SymbolPart, fill: string, key: string): React.ReactElement {
  if (part.kind === 'path') return <path key={key} d={part.d} fill={fill} />;
  if (part.kind === 'ellipse') {
    return (
      <ellipse
        key={key}
        cx={part.cx}
        cy={part.cy}
        rx={part.rx}
        ry={part.ry}
        transform={part.rot ? `rotate(${part.rot} ${part.cx} ${part.cy})` : undefined}
        fill={fill}
      />
    );
  }
  return (
    <rect
      key={key}
      x={part.x}
      y={part.y}
      width={part.w}
      height={part.h}
      rx={part.r || undefined}
      ry={part.r || undefined}
      fill={fill}
    />
  );
}

/** Preview em SVG do ícone (mesmo vetor usado na geometria). */
export const SymbolGlyph: React.FC<{
  id: string;
  fallback?: string;
  className?: string;
}> = ({ id, fallback = '🚫', className = 'w-5 h-5' }) => {
  const shapes = SYMBOL_SHAPES[id];
  if (!shapes) return <span className="text-lg leading-none">{fallback}</span>;

  const hasHoles = shapes.sub.length > 0;
  const maskId = `sym-glyph-${id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {hasHoles && (
        <defs>
          <mask id={maskId}>
            <rect width="100" height="100" fill="black" />
            {shapes.add.map((part, index) => partElement(part, 'white', `a${index}`))}
            {shapes.sub.map((part, index) => partElement(part, 'black', `s${index}`))}
          </mask>
        </defs>
      )}
      <g mask={hasHoles ? `url(#${maskId})` : undefined}>
        {shapes.add.map((part, index) => partElement(part, 'currentColor', index.toString()))}
      </g>
    </svg>
  );
};

export default SymbolGlyph;
