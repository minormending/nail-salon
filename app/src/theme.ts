// Mela look: cream ground, plum ink, marigold/magenta/turquoise/green accents.
export const colors = {
  cream: '#FFF3DC',
  creamDeep: '#FFE9C4',
  plum: '#40163C',
  magenta: '#C2185B',
  magentaBright: '#D81E5B',
  turquoise: '#16A0BD',
  turquoiseDeep: '#0B6E83',
  marigold: '#F5A623',
  green: '#0E8A6E',
  muted: '#6A4A60',
  white: '#FFFFFF',
  blush: '#F4B6C2',
  rule: '#F0DCC0',
} as const;

// Henna is only ever these four colours (PPD safety: never black).
export const henna = {
  paste: '#3B3326',
  orange: '#D2691E',
  red: '#B2441C',
  brown: '#9C3418',
} as const;

export const fonts = {
  heading: 'Baloo2_800ExtraBold',
  headingMedium: 'Baloo2_600SemiBold',
  body: 'Nunito_400Regular',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
} as const;

export const border = 2.5;

export const radius = { button: 16, iconButton: 14, card: 22, pill: 999 } as const;

export type ToneId = 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7';

// skin tones: id, name, skin, line (from the canvas)
export const TONES: { id: ToneId; label: string; skin: string; line: string }[] = [
  { id: 't0', label: 'Colouring book', skin: '#FFFFFF', line: '#2B1A26' },
  { id: 't1', label: 'Lightest', skin: '#F9E4D4', line: '#2B1A26' },
  { id: 't2', label: 'Light', skin: '#EFC8A8', line: '#2B1A26' },
  { id: 't3', label: 'Medium light', skin: '#D9A47C', line: '#2B1A26' },
  { id: 't4', label: 'Medium', skin: '#B47A54', line: '#24121C' },
  { id: 't5', label: 'Medium deep', skin: '#83533A', line: '#1A0C12' },
  { id: 't6', label: 'Deepest', skin: '#553324', line: '#120709' },
  { id: 't7', label: 'Green', skin: '#8CC181', line: '#2B1A26' },
];
