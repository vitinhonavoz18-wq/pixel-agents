import React from 'react';
import { COLORS } from '../config/theme';

type P = { size?: number; color?: string; rotate?: number; style?: React.CSSProperties };

export const SunIcon: React.FC<P & { rays?: number }> = ({ size = 120, color = COLORS.yellow, rotate = 0, rays = 12, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <g transform={`rotate(${rotate} 50 50)`}>
      {Array.from({ length: rays }).map((_, i) => (
        <rect key={i} x={47} y={2} width={6} height={16} rx={3} fill={color} transform={`rotate(${(360 / rays) * i} 50 50)`} />
      ))}
    </g>
    <circle cx={50} cy={50} r={26} fill={color} />
    <circle cx={42} cy={42} r={8} fill="rgba(255,255,255,0.45)" />
  </svg>
);

export const CheckIcon: React.FC<P & { progress?: number }> = ({ size = 80, color = COLORS.white, progress = 1, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path
      d="M24 53 L43 71 L77 32"
      fill="none"
      stroke={color}
      strokeWidth={13}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

export const HatIcon: React.FC<P> = ({ size = 120, color = COLORS.yellow, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <ellipse cx={50} cy={66} rx={44} ry={13} fill={color} />
    <path d="M28 64 C28 34 38 26 50 26 C62 26 72 34 72 64 Z" fill={color} />
    <path d="M29 56 C40 60 60 60 71 56 L71 62 C60 66 40 66 29 62 Z" fill={COLORS.orange} />
  </svg>
);

export const BottleIcon: React.FC<P> = ({ size = 120, color = COLORS.yellow, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <rect x={40} y={6} width={20} height={14} rx={3} fill={COLORS.orange} />
    <path d="M34 22 H66 L72 88 Q72 94 66 94 H34 Q28 94 28 88 Z" fill={color} />
    <rect x={36} y={46} width={28} height={26} rx={5} fill="rgba(4,12,34,0.85)" />
    <text x={50} y={64} textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize={15} fill={COLORS.yellow}>
      FPS
    </text>
  </svg>
);

export const ShadeIcon: React.FC<P> = ({ size = 120, color = COLORS.yellow, style }) => (
  // guarda-sol (sombra)
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d="M8 46 Q50 -6 92 46 Q81 38 71 46 Q60 38 50 46 Q40 38 29 46 Q19 38 8 46 Z" fill={color} />
    <path d="M29 46 Q50 6 50 46 Q50 6 71 46" fill="none" stroke={COLORS.orange} strokeWidth={4} />
    <rect x={47.5} y={44} width={5} height={46} rx={2.5} fill={COLORS.white} />
    <path d="M50 90 Q50 96 44 96" fill="none" stroke={COLORS.white} strokeWidth={5} strokeLinecap="round" />
  </svg>
);

export const ClockIcon: React.FC<P> = ({ size = 60, color = COLORS.yellow, rotate = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={50} cy={54} r={38} fill="none" stroke={color} strokeWidth={10} />
    <rect x={42} y={4} width={16} height={10} rx={3} fill={color} />
    <g transform={`rotate(${rotate} 50 54)`}>
      <rect x={46} y={28} width={8} height={30} rx={4} fill={color} />
    </g>
  </svg>
);

export const HeartIcon: React.FC<P> = ({ size = 80, color = COLORS.brandRed, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z" fill={color} />
  </svg>
);

export const EyesIcon: React.FC<P & { look?: number }> = ({ size = 140, look = 0, style }) => {
  // look: -1 (esquerda) … 1 (direita)
  const dx = look * 7;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" style={style}>
      {[27, 73].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={31} rx={21} ry={28} fill={COLORS.white} />
          <circle cx={cx + dx} cy={35} r={11} fill={COLORS.navy950} />
          <circle cx={cx + dx + 4} cy={30} r={3.5} fill={COLORS.white} />
        </g>
      ))}
    </svg>
  );
};
