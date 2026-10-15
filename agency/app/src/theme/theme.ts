/**
 * PIXEL AGENCY visual tokens — taken from the approved reference (navy
 * panels, discreet orange outline, blue progress bars) and the Pixel Agents
 * pixel aesthetic (square corners, hard offset shadows, pixel font).
 */
export const colors = {
  bg: '#0b1224',
  bgDeep: '#070c19',
  panel: '#121c36',
  panelAlt: '#18264a',
  panelHi: '#1f2f5a',
  border: '#2a3a66',
  borderHi: '#3d5291',
  orange: '#f5a623',
  orangeDeep: '#d9781a',
  blue: '#3b82f6',
  blueSoft: '#60a5fa',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  purple: '#a855f7',
  text: '#e8edf8',
  textMuted: '#93a1c4',
  textDim: '#5d6b8f',
  shadow: '#03060d',
  demo: '#e11d74',
  overlay: 'rgba(5, 9, 20, 0.72)',
} as const;

export const fonts = {
  pixel: 'FSPixelSans',
} as const;

export const space = (n: number) => n * 4;

/** Hard offset pixel shadow (no blur), per the Pixel Agents style guide. */
export const pixelShadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 3, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 0,
} as const;

export const TABLET_MIN_WIDTH = 900;
