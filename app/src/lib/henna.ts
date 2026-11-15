import hennaArt from '../art/henna.json';
import motifsArt from '../art/motifs.json';
import { emptyHennaDesign, useStore, type HennaDesign, type Item, type Stamp, type Stroke } from '../state/store';
import { henna as HENNA, type ToneId } from '../theme';
import { scheduleReminder } from './stain';

/* ------------------------------------------------------------------ geometry */

export const VB_W = 1024;
export const VB_H = 1504; // viewBox height; the raster is 1024x1536 and is cropped to this
export const IMG_H = 1536;
/** The centre of the back of the hand: Mirror reflects across x = 445. */
export const MIRROR_X = 445;

export type HennaStage = 'ghost' | 'paste' | 'orange' | 'red' | 'brown';
export type PartId = 'gol' | 'vines' | 'cuff';
export const PARTS: { id: PartId; name: string }[] = [
  { id: 'gol', name: 'Bloom' },
  { id: 'vines', name: 'Vines' },
  { id: 'cuff', name: 'Cuff' },
];

export type Tone = (typeof hennaArt.tones)[number];
export const hennaTones = hennaArt.tones as Tone[];
export const toneById = (id: ToneId): Tone => hennaTones.find((t) => t.id === id) ?? hennaTones[0];

export const hennaArtClip: string = hennaArt.handClip;
export const partBounds = hennaArt.partBounds as Record<PartId, [number, number, number, number]>;

/** Bottom of the stencil's cuff in viewBox units: the lowest thing a painted hand must show. */
export const CUFF_BOTTOM = partBounds.cuff[1] + partBounds.cuff[3];

/**
 * Sizes the hand on a painting canvas so everything down to the bottom of the cuff is in view.
 * The hand hangs off the canvas bottom (the arm below the cuff may be cut off or covered).
 * `top` is the room kept above the fingertips (chips, titles), `clear` the room kept between
 * the cuff and whatever covers the canvas bottom (a panel, a scalloped edge). Returns the hand
 * width and how far (px) its bottom edge hangs below the canvas.
 */
export function fitHand(canvasH: number, top: number, clear: number, maxW: number, minW = 120) {
  const wanted = ((canvasH - top - clear) * VB_W) / CUFF_BOTTOM;
  const handW = Math.max(minW, Math.min(maxW, Math.floor(wanted)));
  const bleed = Math.max(0, ((VB_H - CUFF_BOTTOM) * handW) / VB_W - clear);
  return { handW, bleed };
}

/** Nib sizes in viewBox units (Fine / Medium / Bold). */
export const NIB_WIDTH: Record<1 | 2 | 3, number> = { 1: 6, 2: 10, 3: 16 };
export const NIB_NAMES = ['', 'Fine', 'Medium', 'Bold'];
/** Width of the Jaali band in viewBox units. */
export const JAALI_WIDTH = 40;
/** The stroke "pressure" never thins below this share of the nib. */
export const MIN_PRESSURE = 0.6;
/**
 * How big a new stamp lands, in motif scale (the motifs are drawn in an 80-unit box, a
 * mandala about 76 units across). A mandala matches the stencil's bloom (partBounds.gol,
 * 364 units wide); borders span the wrist (~280 units). Stamps already saved keep their own scale.
 */
export const DEFAULT_STAMP_SCALE = 4.8;
export const BORDER_STAMP_SCALE = 4;
export const defaultStampScale = (family: string): number =>
  family === 'borders' ? BORDER_STAMP_SCALE : DEFAULT_STAMP_SCALE;
export const DEFAULT_MOTIF = 'mandala';

/** Kept as an alias; `Stroke` itself now carries the optional `jaali` flag. */
export type StudioStroke = Stroke;

/** Old saves mirrored a stamp with a negative scale; new ones set `flip`. Both read as flipped. */
export const isFlipped = (s: Stamp): boolean => !!s.flip || s.scale < 0;

/* ------------------------------------------------------------------ motifs */

export type Motif = { id: string; name: string; family: string; viewBox: string; svg: string };
export const MOTIFS = motifsArt as Motif[];
export const motifById = (id: string): Motif => MOTIFS.find((m) => m.id === id) ?? MOTIFS[0];
const MOTIF_TOKEN = /#9C3418/gi;

// The motif picked in the library, handed back to the Studio (module state; no store change).
let pickedMotif = DEFAULT_MOTIF;
let pickedFresh = false;
export const getPickedMotif = () => pickedMotif;
export function setPickedMotif(id: string) {
  pickedMotif = id;
  pickedFresh = true;
}
/** Returns the motif the library just picked, once; null when nothing new was picked. */
export function consumePickedMotif(): string | null {
  if (!pickedFresh) return null;
  pickedFresh = false;
  return pickedMotif;
}

/* ------------------------------------------------------------------ stroke geometry */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Drops points that sit closer than `min` to the previous kept one (always keeps the last). */
function thin(points: number[], min: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    const n = out.length;
    if (n === 0) {
      out.push(points[i], points[i + 1], points[i + 2]);
      continue;
    }
    const d = Math.hypot(points[i] - out[n - 3], points[i + 1] - out[n - 2]);
    if (d >= min) out.push(points[i], points[i + 1], points[i + 2]);
  }
  const n = out.length;
  const li = points.length - 3;
  if (n >= 6 && (out[n - 3] !== points[li] || out[n - 2] !== points[li + 1])) {
    out[n - 3] = points[li];
    out[n - 2] = points[li + 1];
    out[n - 1] = points[li + 2];
  }
  return out;
}

const outlineCache = new WeakMap<number[], string>();

/**
 * A freehand stroke (x,y,w triples) as one closed, filled outline: left edge, round end cap,
 * right edge back, round start cap. The width varies along the stroke ("pressure").
 */
export function strokeOutline(points: number[]): string {
  const cached = outlineCache.get(points);
  if (cached) return cached;
  const p = thin(points, 1.2);
  const n = p.length / 3;
  let d: string;
  if (n === 1) {
    const r = Math.max(p[2], 1) / 2;
    d = `M ${r1(p[0] - r)} ${r1(p[1])} a ${r} ${r} 0 1 0 ${r1(2 * r)} 0 a ${r} ${r} 0 1 0 ${r1(-2 * r)} 0 Z`;
  } else {
    const L: number[][] = [];
    const R: number[][] = [];
    for (let i = 0; i < n; i++) {
      const x = p[i * 3];
      const y = p[i * 3 + 1];
      const hw = Math.max(p[i * 3 + 2], 1) / 2;
      const a = Math.max(i - 1, 0);
      const b = Math.min(i + 1, n - 1);
      let dx = p[b * 3] - p[a * 3];
      let dy = p[b * 3 + 1] - p[a * 3 + 1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      L.push([x - dy * hw, y + dx * hw]);
      R.push([x + dy * hw, y - dx * hw]);
    }
    const smooth = (pts: number[][]) => {
      let s = '';
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        s += `Q ${r1(pts[i][0])} ${r1(pts[i][1])} ${r1(mx)} ${r1(my)} `;
      }
      const last = pts[pts.length - 1];
      return s + `L ${r1(last[0])} ${r1(last[1])} `;
    };
    const rEnd = Math.max(p[(n - 1) * 3 + 2], 1) / 2;
    const rStart = Math.max(p[2], 1) / 2;
    const Rrev = R.slice().reverse();
    d =
      `M ${r1(L[0][0])} ${r1(L[0][1])} ` +
      smooth(L) +
      `A ${r1(rEnd)} ${r1(rEnd)} 0 0 0 ${r1(Rrev[0][0])} ${r1(Rrev[0][1])} ` +
      smooth(Rrev) +
      `A ${r1(rStart)} ${r1(rStart)} 0 0 0 ${r1(L[0][0])} ${r1(L[0][1])} Z`;
  }
  outlineCache.set(points, d);
  return d;
}

const lineCache = new WeakMap<number[], string>();
/** A centre line (for the Jaali band, which is painted with a pattern stroke). */
export function strokeLine(points: number[]): string {
  const cached = lineCache.get(points);
  if (cached) return cached;
  const p = thin(points, 4);
  let d = `M ${r1(p[0])} ${r1(p[1])} `;
  if (p.length === 3) d += 'l 0.01 0';
  for (let i = 3; i < p.length; i += 3) d += `L ${r1(p[i])} ${r1(p[i + 1])} `;
  lineCache.set(points, d);
  return d;
}

export function strokeWidthAt(s: StudioStroke): number {
  return s.jaali ? JAALI_WIDTH : NIB_WIDTH[s.nib] ?? NIB_WIDTH[2];
}

/** Reflects a stroke across the centre line. */
export function mirrorStroke<T extends Stroke>(s: T): T {
  const points = s.points.slice();
  for (let i = 0; i < points.length; i += 3) points[i] = 2 * MIRROR_X - points[i];
  return { ...s, points };
}
/** Reflects a stamp across the centre line (toggles `flip`; the scale stays positive). */
export function mirrorStamp(s: Stamp): Stamp {
  return { ...s, x: 2 * MIRROR_X - s.x, scale: Math.abs(s.scale), flip: !isFlipped(s), rotate: -s.rotate };
}

/* ------------------------------------------------------------------ hit testing (Wipe) */

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeHit(s: StudioStroke, x: number, y: number, slop: number): boolean {
  const pts = s.points;
  const reach = strokeWidthAt(s) / 2 + slop;
  if (pts.length === 3) return Math.hypot(x - pts[0], y - pts[1]) <= reach;
  for (let i = 0; i + 5 < pts.length; i += 3) {
    if (distToSegment(x, y, pts[i], pts[i + 1], pts[i + 3], pts[i + 4]) <= reach) return true;
  }
  return false;
}

export function stampHit(s: Stamp, x: number, y: number, slop: number): boolean {
  return Math.hypot(x - s.x, y - s.y) <= 38 * Math.abs(s.scale) + slop;
}

/* ------------------------------------------------------------------ SVG composition */

const hex = (c: string) => c.replace('#', '');
const EDGE_W = 5;

type Paint = { fill: string; edge: string | null; ghost: string };
const paintFor = (tone: Tone, stage: HennaStage): Paint => ({
  fill: stage === 'ghost' ? tone.ghost : tone.stain[stage],
  edge: tone.edge ?? null,
  ghost: tone.ghost,
});

/** The diamond-lattice pattern the Jaali band is painted with (one per colour). */
function jaaliPattern(color: string, extra: number): string {
  const sw = 3.6 + extra;
  return (
    `<pattern id="jl${extra ? 'e' : ''}-${hex(color)}" patternUnits="userSpaceOnUse" width="24" height="24">` +
    `<path d="M 12 0 L 24 12 L 12 24 L 0 12 Z" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    `<circle cx="12" cy="12" r="${2.4 + extra / 2}" fill="${color}"/>` +
    `</pattern>`
  );
}

function defsXml(paint: Paint, withClip: boolean): string {
  let s = hennaArt.defs.replace('<defs>', '').replace('</defs>', '');
  if (withClip) s += `<clipPath id="hennaHand"><path d="${hennaArt.handClip}"/></clipPath>`;
  s += jaaliPattern(paint.fill, 0);
  if (paint.edge) s += jaaliPattern(paint.edge, EDGE_W);
  return `<defs>${s}</defs>`;
}

function strokeXml(s: StudioStroke, paint: Paint, pass: 'edge' | 'fill' | 'ghost'): string {
  if (pass === 'ghost') {
    const d = s.jaali ? strokeLine(s.points) : strokeOutline(s.points);
    return s.jaali
      ? `<path d="${d}" fill="none" stroke="${paint.ghost}" stroke-width="${JAALI_WIDTH}" stroke-opacity="0.35" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${d}" fill="none" stroke="${paint.ghost}" stroke-width="3.4" stroke-dasharray="10 8" stroke-linejoin="round"/>`;
  }
  if (s.jaali) {
    const d = strokeLine(s.points);
    if (pass === 'edge') {
      return `<path d="${d}" fill="none" stroke="url(#jle-${hex(paint.edge!)})" stroke-width="${JAALI_WIDTH + EDGE_W}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return `<path d="${d}" fill="none" stroke="url(#jl-${hex(paint.fill)})" stroke-width="${JAALI_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const d = strokeOutline(s.points);
  if (pass === 'edge') {
    return `<path d="${d}" fill="${paint.edge}" stroke="${paint.edge}" stroke-width="${EDGE_W}" stroke-linejoin="round"/>`;
  }
  return `<path d="${d}" fill="${paint.fill}"/>`;
}

function stampXml(s: Stamp, paint: Paint, pass: 'edge' | 'fill' | 'ghost'): string {
  const m = motifById(s.motif);
  const abs = Math.abs(s.scale) || 1;
  const sx = isFlipped(s) ? -abs : abs;
  const t = `translate(${r1(s.x)} ${r1(s.y)}) rotate(${r1(s.rotate)}) scale(${sx} ${abs})`;
  if (pass === 'ghost') {
    return `<g transform="${t}" fill="none" stroke="${paint.ghost}" stroke-width="${r1(3.4 / abs)}" stroke-dasharray="${r1(10 / abs)} ${r1(8 / abs)}" stroke-linejoin="round">${m.svg.replace(/fill="#9C3418"/gi, 'fill="none"').replace(MOTIF_TOKEN, paint.ghost)}</g>`;
  }
  if (pass === 'edge') {
    const w = EDGE_W / abs;
    // widen the motif's own strokes as well, so line motifs get an edge too
    const frag = m.svg
      .replace(/stroke-width="([\d.]+)"/g, (_, n) => `stroke-width="${Number(n) + w}"`)
      .replace(MOTIF_TOKEN, paint.edge!);
    return `<g transform="${t}" stroke="${paint.edge}" stroke-width="${r1(w)}" stroke-linejoin="round">${frag}</g>`;
  }
  return `<g transform="${t}">${m.svg.replace(MOTIF_TOKEN, paint.fill)}</g>`;
}

function marksPass(
  strokes: StudioStroke[],
  stamps: Stamp[],
  paint: Paint,
  pass: 'edge' | 'fill' | 'ghost',
): string {
  let s = '';
  for (const st of strokes) s += strokeXml(st, paint, pass);
  for (const st of stamps) s += stampXml(st, paint, pass);
  return s;
}

/** The marks of one layer (edge pass first when the tone has an edge). */
export function marksXml(strokes: StudioStroke[], stamps: Stamp[], tone: Tone, stage: HennaStage): string {
  const paint = paintFor(tone, stage);
  if (stage === 'ghost') return marksPass(strokes, stamps, paint, 'ghost');
  return (paint.edge ? marksPass(strokes, stamps, paint, 'edge') : '') + marksPass(strokes, stamps, paint, 'fill');
}

/** One stencil part as an inked shape (edge first, then fill) or a dashed guide. */
export function partXml(part: PartId, tone: Tone, stage: HennaStage): string {
  const frag = hennaArt.parts[part];
  const paint = paintFor(tone, stage);
  if (stage === 'ghost') {
    return `<g fill="none" stroke="${paint.ghost}" stroke-width="3.4" stroke-dasharray="10 8" stroke-linejoin="round">${frag}</g>`;
  }
  return (
    (paint.edge
      ? `<g fill="${paint.edge}" stroke="${paint.edge}" stroke-width="${EDGE_W}" stroke-linejoin="round">${frag}</g>`
      : '') + `<g fill="${paint.fill}">${frag}</g>`
  );
}

export type OverlayLayer = { strokes: StudioStroke[]; stamps: Stamp[]; opacity?: number };

/** The full SVG document drawn over the hand raster: stencil parts and/or Studio layers. */
export function overlayXml(opts: {
  tone: ToneId;
  stage: HennaStage;
  /** Stencil parts to ink at `stage`; the others in `guides` are drawn as ghost guides. */
  parts?: PartId[];
  guides?: PartId[];
  layers?: OverlayLayer[];
}): string {
  const tone = toneById(opts.tone);
  const paint = paintFor(tone, opts.stage);
  let body = '';
  for (const g of opts.guides ?? []) body += partXml(g, tone, 'ghost');
  for (const p of opts.parts ?? []) body += partXml(p, tone, opts.stage);
  if (opts.layers) {
    let marks = '';
    for (const l of opts.layers) {
      const x = marksXml(l.strokes, l.stamps, tone, opts.stage);
      marks += l.opacity != null && l.opacity < 1 ? `<g opacity="${l.opacity}">${x}</g>` : x;
    }
    body += `<g clip-path="url(#hennaHand)">${marks}</g>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}">` +
    defsXml(paint, !!opts.layers) +
    body +
    `</svg>`
  );
}

/** A single motif as a small standalone picture (for the library and icons). */
export function motifThumbXml(m: Motif, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}">${m.svg.replace(MOTIF_TOKEN, color)}</svg>`;
}

/** Splits a design's marks by layer (for rendering and editing). */
export function splitLayers(design: HennaDesign): [OverlayLayer, OverlayLayer] {
  const out: [OverlayLayer, OverlayLayer] = [
    { strokes: [], stamps: [] },
    { strokes: [], stamps: [] },
  ];
  for (const s of design.strokes ?? []) out[s.layer === 1 ? 1 : 0].strokes.push(s);
  for (const s of design.stamps ?? []) out[s.layer === 1 ? 1 : 0].stamps.push(s);
  return out;
}

export function joinLayers(layers: OverlayLayer[], mirror: boolean): HennaDesign {
  return {
    source: 'studio',
    strokes: layers.flatMap((l) => l.strokes),
    stamps: layers.flatMap((l) => l.stamps),
    mirror,
  };
}

/* ------------------------------------------------------------------ finishing a henna */

export const designIsEmpty = (d: HennaDesign) =>
  d.source === 'studio'
    ? !(d.strokes?.length || d.stamps?.length)
    : !d.parts?.length;

/**
 * "Let it dry": makes the Item, starts the stain clock, asks for the (optional) reminder, resets the
 * draft. Returns the new id; the reminder is scheduled in the background.
 */
export function letItDry(design: HennaDesign, name: string): string {
  const st = useStore.getState();
  const now = Date.now();
  const id = st.addItem({ kind: 'henna', name, tone: st.tone, henna: design, createdAt: now, startedAt: now });
  if (design.source === 'studio') st.setDraftStudio(emptyHennaDesign('studio'));
  else st.setDraftStencil(emptyHennaDesign('stencil'));
  const item: Item = { id, kind: 'henna', name, tone: st.tone, henna: design, createdAt: now, startedAt: now };
  scheduleReminder(item).then((nid) => {
    if (nid) useStore.getState().updateItem(id, { notificationId: nid });
  });
  return id;
}

let lastSaved: { sig: string; id: string } | null = null;
/**
 * "Save a picture" on a draft: the picture lives in an Item, so the draft is saved as one (not
 * started, no reminder) and the Share screen takes its id. The draft itself stays editable.
 */
export function saveDraftForPicture(design: HennaDesign, name: string): string {
  const st = useStore.getState();
  const sig = JSON.stringify([design, st.tone]);
  if (lastSaved && lastSaved.sig === sig && st.items.some((i) => i.id === lastSaved!.id)) return lastSaved.id;
  const id = st.addItem({ kind: 'henna', name, tone: st.tone, henna: design });
  lastSaved = { sig, id };
  return id;
}

export const STAGE_HEX = HENNA;
