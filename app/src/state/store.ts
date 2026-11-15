import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ToneId } from '../theme';

export type { ToneId };
export type Digit = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export const DIGITS: Digit[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export type NailLook = {
  color: string;
  pattern: 'plain' | 'dots' | 'stripes' | 'french';
  stickers: { kind: string; x: number; y: number }[];
};
export type NailDesign = { shape: string; nails: Record<Digit, NailLook> };
export type Stroke = {
  layer: 0 | 1;
  nib: 1 | 2 | 3;
  points: number[] /* x,y,w,... */;
  /** A Jaali band (diamond lattice) rather than a freehand line. */
  jaali?: boolean;
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
};
export type HennaDesign = {
  source: 'stencil' | 'studio';
  parts?: ('gol' | 'vines' | 'cuff')[];
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

export const DEFAULT_POLISH = '#D81E5B';

export function emptyNailDesign(shape = 'almond', color = DEFAULT_POLISH): NailDesign {
  const look = (): NailLook => ({ color, pattern: 'plain', stickers: [] });
  return {
    shape,
    nails: { thumb: look(), index: look(), middle: look(), ring: look(), pinky: look() },
  };
}

export function emptyHennaDesign(source: HennaDesign['source'] = 'stencil'): HennaDesign {
  return { source, parts: [], strokes: [], stamps: [], mirror: false };
}

/** Version 1 kept a single shared `draftHenna`; version 2 splits it by source. */
export const STORE_VERSION = 2;

/**
 * Moves a persisted v1 `draftHenna` into `draftStencil` or `draftStudio` (whichever matches its
 * `source`; the other starts empty), so nobody loses a drawing. Later versions pass through.
 */
export function migrateStore(persisted: unknown, version: number): unknown {
  if (!persisted || typeof persisted !== 'object') return persisted;
  const old = persisted as Record<string, unknown>;
  if (version >= 2) return old;
  const { draftHenna, ...rest } = old;
  const d = draftHenna as HennaDesign | undefined;
  const has = d && typeof d === 'object';
  return {
    ...rest,
    draftStencil: has && d.source !== 'studio' ? d : emptyHennaDesign('stencil'),
    draftStudio: has && d.source === 'studio' ? d : emptyHennaDesign('studio'),
  };
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
