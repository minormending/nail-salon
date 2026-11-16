import type { Digit, Hand, NailDesign, NailLook } from '../state/store';
import { isSpecial } from './polish';
import { BARE_NAIL, DIGITS, HANDS, handNails, lookShape } from '../state/store';

/** The polish bottles in the Salon: 14 colours, then three specials (rainbow, two glitters; `hex` is their id). */
export const BOTTLES: { name: string; hex: string }[] = [
  { name: 'Magenta', hex: '#D81E5B' },
  { name: 'Red', hex: '#E53935' },
  { name: 'Orange', hex: '#F57C00' },
  { name: 'Marigold', hex: '#F5A623' },
  { name: 'Sunshine', hex: '#FDD835' },
  { name: 'Mint', hex: '#7FD6B5' },
  { name: 'Leaf', hex: '#0E8A6E' },
  { name: 'Sky', hex: '#64B5F6' },
  { name: 'Turquoise', hex: '#16A0BD' },
  { name: 'Lavender', hex: '#B39DDB' },
  { name: 'Purple', hex: '#7B1FA2' },
  { name: 'Plum', hex: '#40163C' },
  { name: 'Blush', hex: '#F4B6C2' },
  { name: 'Clear', hex: '#FFFFFF' },
  { name: 'Rainbow', hex: 'rainbow' },
  { name: 'Gold glitter', hex: 'glitter-gold' },
  { name: 'Pink glitter', hex: 'glitter-pink' },
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

/** One of the ten nails: which hand, which finger. */
export type NailRef = { hand: Hand; digit: Digit };

/**
 * Screen order, left to right, thumbs outside: left thumb ... left little finger, then right little
 * finger ... right thumb.
 */
export const NAIL_ORDER: NailRef[] = [
  ...DIGITS.map((digit) => ({ hand: 'left' as const, digit })),
  ...[...DIGITS].reverse().map((digit) => ({ hand: 'right' as const, digit })),
];

export const RIGHT_THUMB: NailRef = { hand: 'right', digit: 'thumb' };

export const sameNail = (a: NailRef | null | undefined, b: NailRef | null | undefined) =>
  !!a && !!b && a.hand === b.hand && a.digit === b.digit;

export const nailKey = (r: NailRef) => `${r.hand}:${r.digit}`;

/** "LEFT · RING FINGER" for the chip on the zoomed canvas. */
export function nailChipLabel(r: NailRef): string {
  return `${r.hand.toUpperCase()} · ${FINGER_NAMES[r.digit].toUpperCase()}`;
}

/** "Left ring finger" for screen readers. */
export function nailSpokenName(r: NailRef): string {
  return `${capitalise(r.hand)} ${FINGER_NAMES[r.digit].toLowerCase()}`;
}

/** The look on one of the ten nails. */
export function lookOf(design: NailDesign, r: NailRef): NailLook {
  return handNails(design, r.hand)[r.digit];
}

/** The design with one nail's look replaced (a missing left hand is filled in bare first). */
export function withLook(design: NailDesign, r: NailRef, look: NailLook): NailDesign {
  if (r.hand === 'right') return { ...design, nails: { ...design.nails, [r.digit]: look } };
  return { ...design, left: { ...handNails(design, 'left'), [r.digit]: look } };
}

/**
 * `?zoom=` for the nail chair: a digit (0-4) or finger name means the right hand;
 * `left:<digit>` / `right:<digit>` picks a hand.
 */
export function nailFromParam(v: string | undefined): NailRef | null {
  if (!v) return null;
  const m = /^(?:(left|right):)?(.+)$/.exec(v.trim().toLowerCase());
  if (!m) return null;
  const hand = (m[1] as Hand | undefined) ?? 'right';
  const digit = DIGITS.find((d) => d === m[2]) ?? (/^[0-4]$/.test(m[2]) ? DIGITS[Number(m[2])] : undefined);
  return digit && HANDS.includes(hand) ? { hand, digit } : null;
}

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

/** The bottle whose colour is closest to `hex` (a special polish is its own bottle). */
export function nearestBottle(hex: string): { name: string; hex: string } {
  if (isSpecial(hex)) return BOTTLES.find((b) => b.hex === hex) ?? BOTTLES[0];
  const [r, g, b] = rgb(hex);
  let best = BOTTLES[0];
  let bestD = Infinity;
  for (const bt of BOTTLES) {
    if (isSpecial(bt.hex)) continue;
    const [r2, g2, b2] = rgb(bt.hex);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = bt;
    }
  }
  return best;
}

/**
 * "Turquoise stilettos": the colour most nails wear plus the shape most nails have. Bare nails do not
 * count for colour (all bare is "Bare nails"); three or more colours is "Rainbow".
 */
export function nailName(design: NailDesign): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  const shapes = new Map<string, number>();
  const shapeOrder: string[] = [];
  // Right hand first (thumb to little finger), so a tie goes to the colour the right thumb wears.
  const all: NailRef[] = [...DIGITS.map((digit) => ({ hand: 'right' as const, digit })), ...DIGITS.map((digit) => ({ hand: 'left' as const, digit }))];
  for (const r of all) {
    const look = lookOf(design, r);
    const sh = lookShape(design, r.hand, r.digit);
    if (!shapes.has(sh)) shapeOrder.push(sh);
    shapes.set(sh, (shapes.get(sh) ?? 0) + 1);
    if (look.color.toUpperCase() === BARE_NAIL) continue;
    const name = nearestBottle(look.color).name;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (!order.length) return 'Bare nails';
  let colour = order[0];
  if (order.length >= 3) colour = 'Rainbow';
  else {
    for (const name of order) if ((counts.get(name) ?? 0) > (counts.get(colour) ?? 0)) colour = name;
  }
  let shape = shapeOrder[0];
  for (const sh of shapeOrder) if ((shapes.get(sh) ?? 0) > (shapes.get(shape) ?? 0)) shape = sh;
  return `${colour} ${shapePlural(shape)}`;
}
