import hennaArt from '../art/henna.json';
import type { Section, SectionState } from '../state/store';

/*
 * The Salon stencil is made of sections (the back of the hand, each finger, the wrist), each with a
 * chosen style. The drawings live in henna.json: `sections`, `styles`, `designs`, `designBounds`
 * (where a drawing sits, x y w h) and `sectionHit` (the tap box of each section on the left hand).
 */

type Rect = [number, number, number, number];
export type StyleGroup = 'gol' | 'finger' | 'cuff';
export type StyleInfo = { id: string; name: string };

export const DIGIT_SECTIONS: Section[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export const SECTION_IDS = hennaArt.sections as Section[];
export const STYLES = hennaArt.styles as Record<StyleGroup, StyleInfo[]>;
const DESIGNS = hennaArt.designs as Record<string, Record<string, string>>;
const BOUNDS = hennaArt.designBounds as unknown as Record<string, Record<string, Rect>>;
export const SECTION_HIT = hennaArt.sectionHit as unknown as Record<string, Rect>;

export const groupOf = (s: Section): StyleGroup => (s === 'gol' ? 'gol' : s === 'cuff' ? 'cuff' : 'finger');
export const defaultStyle = (s: Section): string => STYLES[groupOf(s)][0].id;
export const styleName = (s: Section, style: string): string =>
  STYLES[groupOf(s)].find((x) => x.id === style)?.name ?? STYLES[groupOf(s)][0].name;

const validStyle = (s: Section, style: string | undefined): string =>
  style && STYLES[groupOf(s)].some((x) => x.id === style) ? style : defaultStyle(s);

/** The SVG fragment (no paint) of a section in a style; an unknown style falls back to the default. */
export const fragmentOf = (s: Section, style: string): string =>
  DESIGNS[s]?.[validStyle(s, style)] ?? DESIGNS[s]?.[defaultStyle(s)] ?? '';
/** Where that drawing sits in the image: x, y, w, h. */
export const boundsOf = (s: Section, style: string): Rect =>
  BOUNDS[s]?.[validStyle(s, style)] ?? BOUNDS[s]?.[defaultStyle(s)] ?? [0, 0, 1, 1];

export type Sections = Record<Section, SectionState>;

/** Every section in its default style, none inked. */
export function defaultSections(): Sections {
  return Object.fromEntries(SECTION_IDS.map((s) => [s, { style: defaultStyle(s), inked: false }])) as Sections;
}

/** A design's sections, with any missing one filled in as default and un-inked. */
export function fullSections(sections: Partial<Record<Section, SectionState>> | undefined): Sections {
  const out = defaultSections();
  for (const s of SECTION_IDS) {
    const v = sections?.[s];
    if (v) out[s] = { style: validStyle(s, v.style), inked: !!v.inked };
  }
  return out;
}

/** The sections an old stencil's inked `parts` stand for (gol: bloom, vines: all five fingers, cuff: arrows). */
export function sectionsFromParts(inked: readonly string[] | undefined): Sections {
  const have = inked ?? [];
  const out = defaultSections();
  if (have.includes('gol')) out.gol.inked = true;
  if (have.includes('cuff')) out.cuff.inked = true;
  if (have.includes('vines')) for (const d of DIGIT_SECTIONS) out[d].inked = true;
  return out;
}

export const anyInked = (s: Partial<Record<Section, SectionState>> | undefined): boolean =>
  !!s && SECTION_IDS.some((id) => s[id]?.inked);

/**
 * The design's name: its back-of-hand style and finger style ("Lotus & chevrons"); fingers in
 * different styles read "Lotus & mixed fingers".
 */
export function hennaName(s: Partial<Record<Section, SectionState>> | undefined): string {
  const f = fullSections(s);
  const back = styleName('gol', f.gol.style);
  const styles = new Set(DIGIT_SECTIONS.map((d) => f[d].style));
  if (styles.size > 1) return `${back} & mixed fingers`;
  return `${back} & ${styleName('index', f.index.style).toLowerCase()}`;
}
