import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { defaultSections, sectionsFromParts } from '../lib/hennaSections';
import type { ToneId } from '../theme';

export type { ToneId };
export type Digit = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export const DIGITS: Digit[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export type NailLook = {
  color: string;
  pattern: 'plain' | 'dots' | 'stripes' | 'french';
  /**
   * `frame: 'nail'` stickers sit in the nail's own frame, x and y in half-widths from the cuticle
   * (y is negative toward the tip). Without it they are the old close-up's canvas coordinates.
   */
  stickers: { kind: string; x: number; y: number; frame?: 'nail' }[];
  /** This nail's own shape; missing means the design's `shape`. */
  shape?: string;
  /**
   * True once the child changed THIS nail while zoomed on it (colour, shape, pattern or stickers).
   * The whole-hands colour and shape taps only reach nails that are not styled yet.
   */
  styled?: boolean;
};
/** The two hands. The drawn nail-chair hand is a right hand; the drawn open hand is a left hand. */
export type Hand = 'left' | 'right';
export const HANDS: Hand[] = ['left', 'right'];
/**
 * `shape` is the default shape ("all nails"); a nail can have its own (`NailLook.shape`). `nails` is the right hand (the drawn nail-chair hand, and every
 * design saved before there were two hands); `left` is the left hand, missing in older saves,
 * which then show a bare left hand.
 */
export type NailDesign = { shape: string; nails: Record<Digit, NailLook>; left?: Record<Digit, NailLook> };
export type Stroke = {
  layer: 0 | 1;
  nib: 1 | 2 | 3;
  points: number[] /* x,y,w,... */;
  /** A Jaali band (diamond lattice) rather than a freehand line. */
  jaali?: boolean;
  /** The hand it's on, in that hand's own drawing coordinates; missing means left (older saves). */
  hand?: Hand;
};
export type Stamp = {
  layer: 0 | 1;
  motif: string;
  x: number;
  y: number;
  /** Always positive for new stamps; old saves mirrored with a negative scale (read as flipped). */
  scale: number;
  rotate: number;
  /** Reflected left-right. */
  flip?: boolean;
  /** The hand it's on, in that hand's own drawing coordinates; missing means left (older saves). */
  hand?: Hand;
};
/** The Salon stencil's sections: the back of the hand, the five fingers, the wrist. */
export type Section = 'gol' | 'thumb' | 'index' | 'middle' | 'ring' | 'pinky' | 'cuff';
export type SectionState = { style: string; inked: boolean };
export type HennaDesign = {
  source: 'stencil' | 'studio';
  /** Old stencils (before sections): which of the three parts were inked. Read only when `sections` is missing. */
  parts?: ('gol' | 'vines' | 'cuff')[];
  /** The stencil's sections, each in its chosen style, inked or still a ghost guide. */
  sections?: Partial<Record<Section, SectionState>>;
  strokes?: Stroke[];
  stamps?: Stamp[];
  mirror?: boolean;
};
export type Item = {
  id: string;
  kind: 'nails' | 'henna';
  name: string;
  createdAt: number;
  tone: ToneId;
  nails?: NailDesign;
  henna?: HennaDesign;
  startedAt?: number;
  notificationId?: string;
  pictureUri?: string;
};
export type Settings = { remind: boolean; speed: 'real' | 'quick' };

export type State = {
  tone: ToneId;
  items: Item[];
  draftNails: NailDesign;
  /** The Salon stencil's work in progress (source 'stencil'). */
  draftStencil: HennaDesign;
  /** The Studio's work in progress (source 'studio'); kept apart so neither overwrites the other. */
  draftStudio: HennaDesign;
  settings: Settings;
  earlyFamily: boolean;
  firstLaunchAt: number;
};

export type Actions = {
  setTone: (tone: ToneId) => void;
  setDraftNails: (draft: NailDesign) => void;
  setDraftStencil: (draft: HennaDesign) => void;
  setDraftStudio: (draft: HennaDesign) => void;
  /** Adds an item (newest first) and returns its generated id. */
  addItem: (item: Omit<Item, 'id' | 'createdAt'> & Partial<Pick<Item, 'id' | 'createdAt'>>) => string;
  updateItem: (id: string, patch: Partial<Omit<Item, 'id'>>) => void;
  removeItem: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
};

/** The magenta nails every design used to start with (kept to recognise untouched old saves). */
export const DEFAULT_POLISH = '#D81E5B';
/** A pale natural nail: what a nail looks like before any polish, fine on every skin tone. */
export const BARE_NAIL = '#F7E6DA';

export function emptyNailDesign(shape = 'oval', color = BARE_NAIL): NailDesign {
  const look = (): NailLook => ({ color, pattern: 'plain', stickers: [], styled: false });
  return {
    shape,
    nails: { thumb: look(), index: look(), middle: look(), ring: look(), pinky: look() },
    left: { thumb: look(), index: look(), middle: look(), ring: look(), pinky: look() },
  };
}

/** One hand's nails; a design saved before there were two hands has a bare (unpainted) left hand. */
export function handNails(design: NailDesign, hand: Hand): Record<Digit, NailLook> {
  if (hand === 'right') return design.nails;
  if (design.left) return design.left;
  const bare = (): NailLook => ({ color: '#FFFFFF', pattern: 'plain', stickers: [], styled: false });
  return { thumb: bare(), index: bare(), middle: bare(), ring: bare(), pinky: bare() };
}

/** The shape a nail is drawn in: its own, or the design's default. */
export function lookShape(design: NailDesign, hand: Hand, digit: Digit): string {
  return handNails(design, hand)[digit].shape ?? design.shape;
}

/** Which hand a Studio mark is on (older marks were all drawn on the left hand). */
export const markHand = (m: { hand?: Hand }): Hand => m.hand ?? 'left';

export function emptyHennaDesign(source: HennaDesign['source'] = 'stencil'): HennaDesign {
  if (source === 'stencil') return { source, sections: defaultSections(), strokes: [], stamps: [], mirror: false };
  return { source, parts: [], strokes: [], stamps: [], mirror: false };
}

/**
 * Version 1 kept a single shared `draftHenna`; version 2 splits it by source; version 3 adds
 * per-nail shapes and `styled`; version 4 turns a stencil's `parts` into `sections`.
 */
export const STORE_VERSION = 4;

/** Old designs: a nail that still looks untouched (magenta, plain, no stickers) is not styled; any other is. */
function withStyledFlags(design: NailDesign | undefined): NailDesign | undefined {
  if (!design || typeof design !== 'object' || !design.nails) return design;
  const fix = (hand?: Record<Digit, NailLook>) =>
    hand &&
    (Object.fromEntries(
      DIGITS.map((d) => {
        const l = hand[d];
        if (!l || l.styled !== undefined) return [d, l];
        const untouched = l.color?.toUpperCase() === DEFAULT_POLISH && l.pattern === 'plain' && !l.stickers?.length;
        return [d, { ...l, styled: !untouched }];
      }),
    ) as Record<Digit, NailLook>);
  return { ...design, nails: fix(design.nails) as Record<Digit, NailLook>, left: fix(design.left) };
}

/** An old stencil (inked `parts`) as one with sections; anything else passes through. */
function withSections(design: HennaDesign | undefined): HennaDesign | undefined {
  if (!design || typeof design !== 'object' || design.source === 'studio' || design.sections) return design;
  const { parts, ...rest } = design;
  return { ...rest, sections: sectionsFromParts(parts) };
}

/**
 * Moves a persisted v1 `draftHenna` into `draftStencil` or `draftStudio` (whichever matches its
 * `source`; the other starts empty), so nobody loses a drawing. Later versions pass through.
 */
export function migrateStore(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  let old = persisted as Record<string, unknown>;
  if (version < 2) {
    const { draftHenna, ...rest } = old;
    const d = draftHenna as HennaDesign | undefined;
    const has = d && typeof d === 'object';
    old = {
      ...rest,
      draftStencil: has && d.source !== 'studio' ? d : emptyHennaDesign('stencil'),
      draftStudio: has && d.source === 'studio' ? d : emptyHennaDesign('studio'),
    };
  }
  if (version < 3) {
    const items = Array.isArray(old.items)
      ? (old.items as Item[]).map((it) => (it.nails ? { ...it, nails: withStyledFlags(it.nails) } : it))
      : old.items;
    old = { ...old, items, draftNails: withStyledFlags(old.draftNails as NailDesign | undefined) };
  }
  if (version < 4) {
    const items = Array.isArray(old.items)
      ? (old.items as Item[]).map((it) => (it.henna ? { ...it, henna: withSections(it.henna) } : it))
      : old.items;
    old = { ...old, items, draftStencil: withSections(old.draftStencil as HennaDesign | undefined) };
  }
  return old;
}

export const useStore = create<State & Actions>()(
  persist(
    (set) => ({
      tone: 't0',
      items: [],
      draftNails: emptyNailDesign(),
      draftStencil: emptyHennaDesign('stencil'),
      draftStudio: emptyHennaDesign('studio'),
      settings: { remind: true, speed: 'real' },
      // A future paid unlock must keep the Studio open for these installs.
      earlyFamily: false,
      firstLaunchAt: 0,

      setTone: (tone) => set({ tone }),
      setDraftNails: (draftNails) => set({ draftNails }),
      setDraftStencil: (draftStencil) => set({ draftStencil }),
      setDraftStudio: (draftStudio) => set({ draftStudio }),
      addItem: (item) => {
        const id = item.id ?? Crypto.randomUUID();
        const full: Item = { ...item, id, createdAt: item.createdAt ?? Date.now() };
        set((s) => ({ items: [full, ...s.items] }));
        return id;
      },
      updateItem: (id, patch) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'paisley-store',
      version: STORE_VERSION,
      migrate: (persisted, version) => migrateStore(persisted, version) as State & Actions,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tone: s.tone,
        items: s.items,
        draftNails: s.draftNails,
        draftStencil: s.draftStencil,
        draftStudio: s.draftStudio,
        settings: s.settings,
        earlyFamily: s.earlyFamily,
        firstLaunchAt: s.firstLaunchAt,
      }),
      onRehydrateStorage: () => (state) => {
        // First ever launch: remember it, and mark this install as an early family.
        if (state && !state.firstLaunchAt) {
          useStore.setState({ firstLaunchAt: Date.now(), earlyFamily: true });
        }
      },
    },
  ),
);

/** Resolves once the persisted store has been read from disk. */
export function whenHydrated(): Promise<void> {
  if (useStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
