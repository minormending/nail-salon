import type { Digit, NailDesign } from '../state/store';
import { DIGITS } from '../state/store';

/** The polish bottles in the Salon, by their names in the canvas. */
export const BOTTLES: { name: string; hex: string }[] = [
  { name: 'Magenta', hex: '#D81E5B' },
  { name: 'Marigold', hex: '#F5A623' },
  { name: 'Turquoise', hex: '#16A0BD' },
  { name: 'Leaf', hex: '#0E8A6E' },
  { name: 'Plum', hex: '#40163C' },
  { name: 'Blush', hex: '#F4B6C2' },
  { name: 'Clear', hex: '#FFFFFF' },
];

/** The six shapes the Salon offers (the Studio has all fifteen), in the canvas order. */
export const SALON_SHAPES = ['almond', 'oval', 'round', 'square', 'ballerina', 'natural'] as const;

export const FINGER_NAMES: Record<Digit, string> = {
  thumb: 'Thumb',
  index: 'Pointer finger',
  middle: 'Middle finger',
  ring: 'Ring finger',
  pinky: 'Little finger',
};

const PLURALS: Record<string, string> = {
  almond: 'almonds',
  oval: 'ovals',
  round: 'rounds',
  'round long': 'long rounds',
  square: 'squares',
  ballerina: 'ballerinas',
  natural: 'naturals',
  pointed: 'points',
  stiletto: 'stilettos',
  'arrow head': 'arrowheads',
  edge: 'edges',
  'rock peak': 'rock peaks',
  lipstick: 'lipsticks',
  flare: 'flares',
  trapeze: 'trapezes',
};

export function shapePlural(shape: string): string {
  return PLURALS[shape] ?? `${shape}s`;
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The bottle whose colour is closest to `hex`. */
export function nearestBottle(hex: string): { name: string; hex: string } {
  const [r, g, b] = rgb(hex);
  let best = BOTTLES[0];
  let bestD = Infinity;
  for (const bt of BOTTLES) {
    const [r2, g2, b2] = rgb(bt.hex);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = bt;
    }
  }
  return best;
}

/** "Turquoise stilettos": the colour most nails wear plus the shape. Three or more colours is "Rainbow". */
export function nailName(design: NailDesign): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const dg of DIGITS) {
    const name = nearestBottle(design.nails[dg].color).name;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let colour = order[0];
  if (order.length >= 3) colour = 'Rainbow';
  else {
    for (const name of order) if ((counts.get(name) ?? 0) > (counts.get(colour) ?? 0)) colour = name;
  }
  return `${colour} ${shapePlural(design.shape)}`;
}
