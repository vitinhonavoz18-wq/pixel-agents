import React from 'react';
import {C} from '../styles/theme';

// Geometria OFICIAL do símbolo (site.conectfly.com.br — header .logo-mark). Não alterar.
export const LOGO_PATH =
  'M24 12c3-4.4 6.2-8.5 11-8.5 4.8 0 8.5 3.8 8.5 8.5s-3.7 8.5-8.5 8.5c-4.8 0-8-4.1-11-8.5Zm0 0c-3-4.4-6.2-8.5-11-8.5-4.8 0-8.5 3.8-8.5 8.5s3.7 8.5 8.5 8.5c4.8 0 8-4.1 11-8.5Z';

type Props = {
  width: number;
  /** 0..1 — progresso do desenho do traço */
  draw?: number;
  /** 0..1 — intensidade do brilho controlado */
  glow?: number;
  id?: string;
  style?: React.CSSProperties;
};

export const InfinityMark: React.FC<Props> = ({width, draw = 1, glow = 0, id = 'cf', style}) => {
  const h = width / 2; // proporção oficial 48:24, sempre uniforme
  const gid = `${id}-grad`;
  const fid = `${id}-glow`;
  return (
    <svg width={width} height={h} viewBox="0 0 48 24" style={{overflow: 'visible', ...style}}>
      <defs>
        <linearGradient id={gid} x1="2" y1="12" x2="46" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.g0} />
          <stop offset="0.5" stopColor={C.g1} />
          <stop offset="1" stopColor={C.g2} />
        </linearGradient>
        <filter id={fid} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      {glow > 0 && (
        <path
          d={LOGO_PATH}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={3.4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - draw}
          filter={`url(#${fid})`}
          opacity={glow}
        />
      )}
      <path
        d={LOGO_PATH}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={3.4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
};
