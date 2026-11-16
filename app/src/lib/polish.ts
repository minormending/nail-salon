import { colors } from '../theme';

/*
 * Polish colours. Most are hex; three specials are ids stored in `NailLook.color`:
 * 'rainbow' (flat bands across the nail), 'glitter-gold' and 'glitter-pink' (a pale base with
 * scattered sparkles). Everything that draws or names a nail colour goes through these.
 */

export type Special = 'rainbow' | 'glitter-gold' | 'glitter-pink';
export const isSpecial = (c: string): c is Special => c === 'rainbow' || c === 'glitter-gold' || c === 'glitter-pink';

/** The rainbow's bands, cuticle to free edge. */
export const RAINBOW = ['#D81E5B', '#F57C00', '#FDD835', '#0E8A6E', '#16A0BD', '#7B1FA2'] as const;

export const GLITTER = {
  'glitter-gold': { base: '#FFF1C9', sparks: ['#F5A623', '#C99A2E'] },
  'glitter-pink': { base: '#FDE3EA', sparks: ['#D81E5B', '#F4B6C2'] },
} as const;

/** A single hex for a polish, for small flat icons: the rainbow's magenta, a glitter's base. */
export function swatchHex(c: string): string {
  if (c === 'rainbow') return RAINBOW[0];
  if (c === 'glitter-gold' || c === 'glitter-pink') return GLITTER[c].base;
  return c;
}

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** A light polish wants dark marks (plum); a dark one wants cream. */
export function isLight(c: string): boolean {
  if (c === 'rainbow') return false;
  if (c === 'glitter-gold' || c === 'glitter-pink') return true;
  return lum(c) > 0.7;
}

/** The colour for dots, stripes and similar marks on top of this polish. */
export function markColour(c: string): string {
  return isLight(c) ? colors.plum : colors.cream;
}
