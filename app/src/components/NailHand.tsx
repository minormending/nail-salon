import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Pattern,
  Polygon,
  Rect,
} from 'react-native-svg';

import vectors from '../art/handVectors.json';
import nails from '../art/nails.json';
import { NAIL_ORDER, lookOf, nailKey, nailSpokenName, sameNail, withLook, type NailRef } from '../lib/nailNames';
import { DIGITS, handNails, lookShape, type Digit, type Hand, type NailDesign, type NailLook, type ToneId } from '../state/store';
import { colors, TONES } from '../theme';

/* ------------------------------------------------------------------ geometry */

type Place = { x: number; y: number; rotate: number; w: number; tip: number[] };
const PLACES = nails.digits as Record<Digit, Place>;
const SHAPES = nails.shapes as Record<string, Record<Digit, string>>;
const VB = nails.viewBox.split(' ').map(Number); // x y w h
const IMG = nails.image;

/**
 * Two hands side by side, backs to the viewer, thumbs outside. The drawing is of a hand with its
 * thumb at the left: the screen-left (the "left" hand) uses it as drawn, the screen-right (the
 * "right" hand) uses it mirrored, so the little-finger sides face each other across a small gap.
 * Each sits in its own 1024-wide box. `x0` and `w` are the visible span in pair coordinates.
 */
const RIGHT_OFF = 788;
export type Hands = 'both' | 'right';
const SPAN: Record<Hands, { x0: number; w: number }> = {
  both: { x0: 106, w: 1600 },
  right: { x0: 0, w: VB[2] },
};
/** Height over width of the pair's art. */
export const PAIR_ASPECT = VB[3] / SPAN.both.w;
/** The widest the pair is drawn: each hand as large as the single hand used to be (262 across). */
export const PAIR_MAX_WIDTH = (262 / VB[2]) * SPAN.both.w;

/**
 * How big the pair is drawn in a canvas `w` x `h`, and how far (px) to drop it from the canvas
 * centre. As large as fits across, with the thumbs clear of the pills in the top corners (arms may
 * run off the bottom) and the forearms clear of the skin-tone button at the bottom left.
 */
export function pairFit(w: number, h: number): { width: number; shift: number } {
  const U = SPAN.both.w;
  const thumbTop = 125; // art units from the top of the art to the top of the thumbs
  const clearTop = 54; // px kept free under the corner pills
  const crop = 220; // art units of forearm allowed off the bottom
  const armEdge = 176; // art units from the art's left edge to the left forearm at the bottom
  const skin = 66; // px the skin-tone button needs
  const s = Math.max(
    120 / U,
    Math.min(PAIR_MAX_WIDTH / U, (w - 24) / U, (h - clearTop) / (VB[3] - thumbTop - crop), (w / 2 - skin) / (U / 2 - armEdge)),
  );
  const top = (h - VB[3] * s) / 2 + thumbTop * s;
  return { width: s * U, shift: Math.max(0, clearTop - top) };
}

const handsIn = (hands: Hands): Hand[] => (hands === 'both' ? ['left', 'right'] : ['right']);

/** The SVG transform that puts a hand's own drawing into the art's coordinates. */
function handTransform(hand: Hand, hands: Hands): string | undefined {
  if (hands === 'right') return undefined;
  return hand === 'left' ? undefined : `translate(${RIGHT_OFF + IMG.width} 0) scale(-1 1)`;
}

/** A point on a hand's own drawing, in the pair's coordinates. */
function pairPoint(hand: Hand, x: number, y: number) {
  return { x: hand === 'left' ? x : RIGHT_OFF + IMG.width - x, y };
}

/** A point in the pair's coordinates, on a hand's own drawing. */
function handPoint(hand: Hand, x: number, y: number) {
  return { x: hand === 'left' ? x : RIGHT_OFF + IMG.width - x, y };
}
/** The close-up draws a nail at this multiple of its size on the hand (less for very long shapes). */
export const CLOSE_K = 1.25;
/** The close-up nail's cuticle and the canvas's sticker spots (390x844 close-up svg, 350x420). */
export const CLOSE_ORIGIN = { x: 175, y: 290 };
/** Where stickers land, in order: down the middle of the nail (canvas coordinates). */
export const SPOTS: [number, number][] = [
  [175, 150],
  [153, 205],
  [197, 238],
  [175, 268],
];

export function nailPath(shape: string, digit: Digit): string {
  return (SHAPES[shape] ?? SHAPES.almond)[digit];
}

type Metrics = { len: number; hw: number; bot: number };

/** Close-up scale for one nail: CLOSE_K, eased down so a long shape still fits under the title. */
export function closeK(d: string): number {
  return Math.min(CLOSE_K, 232 / nailMetrics(d).len);
}
const metricsCache = new Map<string, Metrics>();

/** Length (cuticle to tip), half-width, and how far the cuticle curve dips below the origin. */
export function nailMetrics(d: string): Metrics {
  const hit = metricsCache.get(d);
  if (hit) return hit;
  let minY = 0;
  let maxY = 0;
  let hw = 0;
  let cx = 0;
  let cy = 0;
  const take = (x: number, y: number) => {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (Math.abs(x) > hw) hw = Math.abs(x);
  };
  const re = /([MLCQAZ])([^MLCQAZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const n = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    switch (m[1]) {
      case 'M':
      case 'L':
        cx = n[0];
        cy = n[1];
        take(cx, cy);
        break;
      case 'C':
      case 'Q': {
        const pts: number[][] = [[cx, cy]];
        for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
        for (let t = 0; t <= 1.001; t += 0.1) {
          let p = pts;
          while (p.length > 1) {
            const next: number[][] = [];
            for (let i = 0; i < p.length - 1; i++) {
              next.push([p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t]);
            }
            p = next;
          }
          take(p[0][0], p[0][1]);
        }
        cx = n[n.length - 2];
        cy = n[n.length - 1];
        break;
      }
      case 'A': {
        const [rx, ry, , , , x, y] = n;
        // The canvas outlines only use half-ellipse tips (both ends at the same height).
        take(x, Math.abs(y - cy) < 1 ? y - ry : y);
        take(rx, 0);
        cx = x;
        cy = y;
        break;
      }
    }
  }
  const out = { len: -minY, hw, bot: maxY };
  metricsCache.set(d, out);
  return out;
}

/* ------------------------------------------------------------ nail frame, stickers */

type StickerPos = { kind: string; x: number; y: number; frame?: 'nail' };

/** A sticker's glyph (about 30 units across) is this many times the nail's half-width, scaled. */
const STICKER_K = 0.038;

/**
 * Where a sticker sits on a nail, in the nail's local units (cuticle at the origin, tip toward
 * -y) and the scale to draw its ~30-unit glyph at. Handles both kinds of saved sticker: new ones
 * (`frame: 'nail'`, x and y in half-widths) and the old close-up's canvas coordinates.
 * `halfWidth` and `nailLength` are the nail's (see `nailMetrics`: `hw` and `len`).
 * Pass the nail's outline path as `outline` and the spot is also moved inward until the whole
 * glyph lies inside it, so a sticker placed for one shape re-fits on a narrower or shorter one.
 */
export function stickerLocal(
  sticker: StickerPos,
  halfWidth: number,
  nailLength: number,
  outline?: string,
): { x: number; y: number; scale: number } {
  const at = stickerRaw(sticker, halfWidth, nailLength);
  if (!outline) return at;
  const f = fitSpot(outline, at.x, at.y, GLYPH_R * at.scale);
  return { x: f.x, y: f.y, scale: at.scale };
}

/** A sticker glyph is about 30 units across plus its outline: this is its radius at scale 1. */
const GLYPH_R = 16;

function stickerRaw(
  sticker: StickerPos,
  halfWidth: number,
  nailLength: number,
): { x: number; y: number; scale: number } {
  if (sticker.frame === 'nail') {
    // A shorter shape than the one it was placed on: keep it on the plate.
    const minY = -(nailLength - 0.35 * halfWidth);
    return { x: sticker.x * halfWidth, y: Math.max(sticker.y * halfWidth, minY), scale: STICKER_K * halfWidth };
  }
  // Old close-up coordinates were laid out for nail-chair nails (half-width ≥ ~34); on smaller
  // nails, such as the open henna hand's, shrink them to match and keep them on the plate.
  const k = Math.min(CLOSE_K, 232 / nailLength) ** -1 * Math.min(1, halfWidth / 34);
  const x = (sticker.x - CLOSE_ORIGIN.x) * k;
  const y = (sticker.y - CLOSE_ORIGIN.y) * k;
  return {
    x: Math.max(-0.7 * halfWidth, Math.min(0.7 * halfWidth, x)),
    y: Math.max(-(nailLength - 0.35 * halfWidth), Math.min(-0.2 * halfWidth, y)),
    scale: 1.35 * k * 1.25,
  };
}

const outlineCache = new Map<string, number[][]>();

/** A nail outline as a polygon in its local frame (curves sampled). */
function nailOutline(d: string): number[][] {
  const hit = outlineCache.get(d);
  if (hit) return hit;
  const pts: number[][] = [];
  let cx = 0;
  let cy = 0;
  const re = /([MLCQAZ])([^MLCQAZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const n = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    switch (m[1]) {
      case 'M':
      case 'L':
        cx = n[0];
        cy = n[1];
        pts.push([cx, cy]);
        break;
      case 'C':
      case 'Q': {
        const ctl: number[][] = [[cx, cy]];
        for (let i = 0; i < n.length; i += 2) ctl.push([n[i], n[i + 1]]);
        for (let t = 0.05; t <= 1.001; t += 0.05) {
          let q = ctl;
          while (q.length > 1) {
            const next: number[][] = [];
            for (let i = 0; i < q.length - 1; i++) {
              next.push([q[i][0] + (q[i + 1][0] - q[i][0]) * t, q[i][1] + (q[i + 1][1] - q[i][1]) * t]);
            }
            q = next;
          }
          pts.push(q[0]);
        }
        cx = n[n.length - 2];
        cy = n[n.length - 1];
        break;
      }
      case 'A': {
        // The nail outlines only use half-ellipse tips (both ends at the same height, over the top).
        const [rx, ry, , , , x, y] = n;
        const mid = (cx + x) / 2;
        for (let i = 1; i <= 24; i++) {
          const th = (Math.PI * i) / 24;
          pts.push([mid - ((x - cx) / 2) * Math.cos(th), cy - ry * Math.sin(th) * (rx > 0 ? 1 : 0)]);
        }
        cx = x;
        cy = y;
        break;
      }
    }
  }
  outlineCache.set(d, pts);
  return pts;
}

function insidePoly(poly: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Nearest point on the polygon's edge to (x, y). */
function nearestOnPoly(poly: number[][], x: number, y: number): { x: number; y: number; dist: number } {
  let best = { x: poly[0][0], y: poly[0][1], dist: Infinity };
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const qx = ax + dx * t;
    const qy = ay + dy * t;
    const dist = Math.hypot(x - qx, y - qy);
    if (dist < best.dist) best = { x: qx, y: qy, dist };
  }
  return best;
}

type Field = { pts: number[][]; best: number[] };
const fieldCache = new Map<string, Field>();

/** The spots on a nail where a glyph of radius `r` fits inside the outline, on a coarse grid. */
function fitField(d: string, r: number): Field {
  const key = `${d}|${r.toFixed(1)}`;
  const hit = fieldCache.get(key);
  if (hit) return hit;
  const poly = nailOutline(d);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const step = Math.max(1.2, (x1 - x0) / 30);
  const pts: number[][] = [];
  let best = [(x0 + x1) / 2, (y0 + y1) / 2];
  let bestD = -1;
  for (let x = x0 + step / 2; x < x1; x += step) {
    for (let y = y0 + step / 2; y < y1; y += step) {
      if (!insidePoly(poly, x, y)) continue;
      const dist = nearestOnPoly(poly, x, y).dist;
      if (dist > bestD) {
        bestD = dist;
        best = [x, y];
      }
      if (dist >= r) pts.push([x, y]);
    }
  }
  const out = { pts, best };
  fieldCache.set(key, out);
  return out;
}

/**
 * The nearest spot to (x, y), in a nail's local units, where a glyph of radius `r` lies wholly
 * inside the outline `d`. If the nail is too small for it anywhere, its widest interior point.
 */
export function fitSpot(d: string, x: number, y: number, r: number): { x: number; y: number } {
  const poly = nailOutline(d);
  const fits = (px: number, py: number) => insidePoly(poly, px, py) && nearestOnPoly(poly, px, py).dist >= r;
  if (fits(x, y)) return { x, y };
  const f = fitField(d, r);
  if (!f.pts.length) return { x: f.best[0], y: f.best[1] };
  let g = f.pts[0];
  let gd = Infinity;
  for (const q of f.pts) {
    const dd = (q[0] - x) ** 2 + (q[1] - y) ** 2;
    if (dd < gd) {
      gd = dd;
      g = q;
    }
  }
  // Slide from that grid spot back toward the touch, to the last place the glyph still fits.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 10; i++) {
    const m = (lo + hi) / 2;
    if (fits(g[0] + (x - g[0]) * m, g[1] + (y - g[1]) * m)) lo = m;
    else hi = m;
  }
  return { x: g[0] + (x - g[0]) * lo, y: g[1] + (y - g[1]) * lo };
}

/** A nail's size and middle in its own frame. */
export function nailFrame(digit: Digit, shape: string) {
  const { len, hw, bot } = nailMetrics(nailPath(shape, digit));
  return { len, hw, centre: { x: 0, y: (bot - len) / 2 } };
}

/**
 * A touch at (x, y) in a nail's local units, as a spot on the nail: on the plate it is kept
 * exactly; just off the plate (within half a nail-width, on the fingertip skin) it is moved to the
 * nearest spot inside the outline; further off, null.
 */
export function spotOnNail(digit: Digit, shape: string, x: number, y: number): { x: number; y: number } | null {
  const d = nailPath(shape, digit);
  const poly = nailOutline(d);
  const { hw, centre } = nailFrame(digit, shape);
  if (insidePoly(poly, x, y)) return { x, y };
  const q = nearestOnPoly(poly, x, y);
  if (q.dist > hw * 0.5) return null;
  const dx = centre.x - q.x;
  const dy = centre.y - q.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: q.x + (dx / l) * hw * 0.3, y: q.y + (dy / l) * hw * 0.3 };
}

/** The topmost sticker under a touch at (x, y) in the nail's local units, or -1. */
export function stickerAt(look: NailLook, digit: Digit, shape: string, x: number, y: number): number {
  const { hw, len } = nailFrame(digit, shape);
  const d = nailPath(shape, digit);
  for (let i = look.stickers.length - 1; i >= 0; i--) {
    const p = stickerLocal(look.stickers[i], hw, len, d);
    if (Math.hypot(x - p.x, y - p.y) <= 15 * p.scale + 0.25 * hw) return i;
  }
  return -1;
}

/** A sticker placed at a spot (local units). */
export function newSticker(kind: string, digit: Digit, shape: string, x: number, y: number): StickerPos {
  const { hw } = nailFrame(digit, shape);
  // Moved in until the whole glyph is on the nail.
  const f = fitSpot(nailPath(shape, digit), x, y, GLYPH_R * STICKER_K * hw);
  return { kind, x: f.x / hw, y: f.y / hw, frame: 'nail' };
}

/* ------------------------------------------------------------------ stickers */

export const STICKERS = [
  { kind: 'gem', name: 'Gem' },
  { kind: 'star', name: 'Star' },
  { kind: 'heart', name: 'Heart' },
  { kind: 'flower', name: 'Flower' },
  { kind: 'moon', name: 'Moon' },
  { kind: 'pearl', name: 'Pearl' },
] as const;

const INK = colors.plum;

/** A sticker drawn around (0,0), roughly 30 units across; the canvas's sticker symbols. */
export function StickerGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'star':
      return (
        <Path
          d="M 0 -15 L 4.4 -6.1 L 14.3 -4.6 L 7.2 2.4 L 8.8 12.1 L 0 7.5 L -8.8 12.1 L -7.2 2.4 L -14.3 -4.6 L -4.4 -6.1 Z"
          fill={colors.marigold}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      );
    case 'heart':
      return (
        <Path
          d="M 0 12 C -17 0, -12 -15, 0 -6 C 12 -15, 17 0, 0 12 Z"
          fill={colors.blush}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      );
    case 'flower':
      return (
        <G>
          {(
            [
              [0, -8],
              [7.6, -2.5],
              [4.7, 6.5],
              [-4.7, 6.5],
              [-7.6, -2.5],
            ] as const
          ).map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={6} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
          ))}
          <Circle r={4.2} fill={colors.marigold} stroke={INK} strokeWidth={2} />
        </G>
      );
    case 'moon':
      return (
        <Path
          d="M 9 -12.4 A 13 13 0 1 0 9 12.4 A 17 17 0 0 1 9 -12.4 Z"
          fill={colors.creamDeep}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      );
    case 'pearl':
      return (
        <G>
          <Circle r={8} fill="#FFFFFF" stroke={INK} strokeWidth={2.2} />
          <Circle cx={-2.6} cy={-2.6} r={2.2} fill={colors.blush} />
        </G>
      );
    case 'gem':
    default:
      return (
        <G>
          <Path
            d="M 0 -12 L 10.4 -6 L 10.4 6 L 0 12 L -10.4 6 L -10.4 -6 Z"
            fill={colors.turquoise}
            stroke={INK}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Path d="M -10.4 -6 L 0 0 L 10.4 -6 M 0 0 L 0 12" fill="none" stroke={INK} strokeWidth={1.4} />
          <Circle cx={-4} cy={-6} r={2} fill="#FFFFFF" />
        </G>
      );
  }
}

/* --------------------------------------------------------------------- paint */

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.75;
}

/**
 * A French tip as plain geometry: the part of the nail outline `d` that lies beyond the smile
 * line (the tip side), as one polygon, plus the smile line itself where it crosses the nail. Both
 * are built inside the outline, so nothing has to be clipped (a clip path that fails to resolve
 * would otherwise let the white band spill past the nail's free edge).
 */
const frenchCache = new Map<string, { tip: string; smile: string }>();
function frenchTip(d: string): { tip: string; smile: string } {
  const hit = frenchCache.get(d);
  if (hit) return hit;
  const poly = nailOutline(d);
  const { len, hw } = nailMetrics(d);
  const b = len * 0.66;
  const W = hw * 1.2;
  const bump = hw * 0.33;
  // The smile: a cubic from (-W, -b) to (W, -b) bowing toward the tip; x is monotonic along it.
  const curve: number[][] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const m = 1 - t;
    const x = -W * m ** 3 + 3 * m * m * t * (-0.42 * W) + 3 * m * t * t * (0.42 * W) + W * t ** 3;
    const y = -b * m ** 3 + 3 * m * m * t * (-b - bump) + 3 * m * t * t * (-b - bump) - b * t ** 3;
    curve.push([x, y]);
  }
  const smileY = (x: number) => {
    for (let i = 1; i < curve.length; i++) {
      if (x <= curve[i][0]) {
        const [x0, y0] = curve[i - 1];
        const [x1, y1] = curve[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
      }
    }
    return curve[curve.length - 1][1];
  };
  // The nail's extent (tip side, cuticle side) at x, from where the outline crosses that vertical.
  const span = (x: number): [number, number] | null => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (xi === xj || (x < Math.min(xi, xj)) || x > Math.max(xi, xj)) continue;
      const y = yi + ((yj - yi) * (x - xi)) / (xj - xi);
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    return lo === Infinity ? null : [lo, hi];
  };
  const N = 60;
  const top: string[] = [];
  const bottom: string[] = [];
  let line = '';
  for (let i = 0; i <= N; i++) {
    const x = -hw + 0.002 + ((2 * hw - 0.004) * i) / N;
    const sp = span(x);
    if (!sp) continue;
    const ys = smileY(x);
    if (sp[0] < ys) {
      top.push(`${x.toFixed(2)} ${sp[0].toFixed(2)}`);
      bottom.push(`${x.toFixed(2)} ${Math.min(sp[1], ys).toFixed(2)}`);
    }
    if (ys >= sp[0] && ys <= sp[1]) line += `${line ? ' L' : 'M'} ${x.toFixed(2)} ${ys.toFixed(2)}`;
  }
  const out = {
    tip: top.length > 1 ? `M ${top.join(' L ')} L ${bottom.reverse().join(' L ')} Z` : '',
    smile: line,
  };
  frenchCache.set(d, out);
  return out;
}

type PaintProps = {
  /** Unique, letters and digits only: names this nail's pattern and clip defs. */
  uid: string;
  /** Nail outline in its local frame (cuticle at the origin, tip toward -y). */
  d: string;
  look: Pick<NailLook, 'color' | 'pattern'>;
  line: string;
  strokeWidth: number;
  /** Local units per canvas unit; scales the pattern tiles (the canvas close-up is 1/CLOSE_K). */
  unit?: number;
};

/**
 * A painted nail in its local frame: colour, dots / stripes (SVG patterns), or a French tip,
 * then the outline. Stickers and the sheen are drawn over it by the caller.
 */
export function NailPaint({ uid, d, look, line, strokeWidth, unit = 1 / CLOSE_K }: PaintProps) {
  const fillId = `${uid}f`;
  const { color, pattern } = look;
  const dot = isLight(color) ? colors.plum : colors.cream;
  const u = unit;

  const fill = pattern === 'dots' || pattern === 'stripes' ? `url(#${fillId})` : color;

  // French: the white tip over the colour, its edge a gentle curve across the nail.
  const french = pattern === 'french' ? frenchTip(d) : null;

  return (
    <>
      <Defs>
        {pattern === 'dots' && (
          <Pattern id={fillId} width={26 * u} height={26 * u} patternUnits="userSpaceOnUse">
            <Rect width={26 * u} height={26 * u} fill={color} />
            <Circle cx={6.5 * u} cy={6.5 * u} r={4.2 * u} fill={dot} />
            <Circle cx={19.5 * u} cy={19.5 * u} r={4.2 * u} fill={dot} />
          </Pattern>
        )}
        {pattern === 'stripes' && (
          <Pattern
            id={fillId}
            width={22 * u}
            height={22 * u}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <Rect width={22 * u} height={22 * u} fill={color} />
            <Rect width={9 * u} height={22 * u} fill={dot} />
          </Pattern>
        )}
      </Defs>
      <Path d={d} fill={fill} />
      {french && (
        <>
          {french.tip ? <Path d={french.tip} fill="#FFFFFF" /> : null}
          {french.smile ? (
            <Path d={french.smile} fill="none" stroke={line} strokeWidth={strokeWidth * 0.75} strokeLinejoin="round" />
          ) : null}
        </>
      )}
      <Path d={d} fill="none" stroke={line} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  );
}

/* ---------------------------------------------------------------------- hand */


/** Where a nail's middle sits in viewBox coordinates. */
export function nailCentre(digit: Digit, shape: string) {
  const p = PLACES[digit];
  const { len, bot } = nailMetrics(nailPath(shape, digit));
  const a = (p.rotate * Math.PI) / 180;
  const ly = (bot - len) / 2; // the middle of the drawn outline, tip to the dip of the cuticle
  return { x: p.x - ly * Math.sin(a), y: p.y + ly * Math.cos(a) };
}

/** Which nail a touch at (x, y) in viewBox units means: the nearest tip, within 1.6 nail widths. */
export function nearestNail(x: number, y: number): Digit | undefined {
  let best: Digit | undefined;
  let bestD = Infinity;
  for (const dg of DIGITS) {
    const p = PLACES[dg];
    const d = Math.hypot(x - p.tip[0], y - p.tip[1]);
    if (d <= p.w * 1.6 && d < bestD) {
      best = dg;
      bestD = d;
    }
  }
  return best;
}

/** Which of the ten nails a touch at (x, y) in the pair's coordinates means: the nearest tip. */
export function nearestPairNail(x: number, y: number): NailRef | undefined {
  let best: NailRef | undefined;
  let bestD = Infinity;
  for (const hand of handsIn('both')) {
    const q = handPoint(hand, x, y);
    for (const dg of DIGITS) {
      const p = PLACES[dg];
      const d = Math.hypot(q.x - p.tip[0], q.y - p.tip[1]);
      if (d <= p.w * 1.6 && d < bestD) {
        best = { hand, digit: dg };
        bestD = d;
      }
    }
  }
  return best;
}

/** Line colour and weight for the nails on a hand shown `logicalWidth` wide. */
function ink(tone: ToneId, logicalWidth: number, units: number = VB[2]) {
  const toneInfo = TONES.find((t) => t.id === tone) ?? TONES[0];
  // About 1.5pt on screen at the canvas size (262pt wide), never thinner than the art's own.
  return { line: toneInfo.line, sw: Math.max(nails.line.width, (1.5 * units) / logicalWidth) };
}

/** One sticker in a nail's local frame; `pop` scales / turns it for the pop on / off animations. */
function StickerAt({
  s,
  hw,
  len,
  d,
  scale = 1,
  rotate = 0,
}: {
  s: StickerPos;
  hw: number;
  len: number;
  /** The nail's outline path, so the sticker is fitted inside it. */
  d: string;
  scale?: number;
  rotate?: number;
}) {
  const p = stickerLocal(s, hw, len, d);
  return (
    <G transform={`translate(${p.x} ${p.y}) rotate(${rotate}) scale(${Math.max(0.001, p.scale * scale)})`}>
      <StickerGlyph kind={s.kind} />
    </G>
  );
}

/**
 * A nail's stickers in its local frame, each fitted inside the outline `d` and, as a safety net,
 * clipped to it so nothing can overhang (even old saved positions).
 */
export function NailStickers({
  uid,
  d,
  stickers,
  hw,
  len,
  scale,
  rotate,
}: {
  /** Unique, letters and digits only: names the clip. */
  uid: string;
  d: string;
  stickers: StickerPos[];
  hw: number;
  len: number;
  scale?: number;
  rotate?: number;
}) {
  if (!stickers.length) return null;
  return (
    <>
      <Defs>
        <ClipPath id={`${uid}k`}>
          <Path d={d} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${uid}k)`}>
        {stickers.map((s, i) => (
          <StickerAt key={i} s={s} hw={hw} len={len} d={d} scale={scale} rotate={rotate} />
        ))}
      </G>
    </>
  );
}

/** One hand's five painted nails (and their stickers) at their places on the hand. */
function NailsLayer({
  design,
  hand,
  uid,
  line,
  sw,
}: {
  design: NailDesign;
  hand: Hand;
  uid: string;
  line: string;
  sw: number;
}) {
  const looks = handNails(design, hand);
  return (
    <>
      {DIGITS.map((dg) => {
        const p = PLACES[dg];
        const d = nailPath(lookShape(design, hand, dg), dg);
        const look = looks[dg];
        const k = 1 / closeK(d);
        const { len, hw } = nailMetrics(d);
        return (
          <G key={dg} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`}>
            <NailPaint uid={`${uid}${dg}`} d={d} look={look} line={line} strokeWidth={sw} unit={k} />
            <NailStickers uid={`${uid}${dg}`} d={d} stickers={look.stickers} hw={hw} len={len} />
          </G>
        );
      })}
    </>
  );
}

/**
 * A hand's traced art: the skin silhouette in the tone's skin colour, then the line art (even-odd
 * fill) in its line colour, in the rasters' own 1024 x 1536 pixel coordinates. Vector, so it stays
 * sharp however far it is zoomed.
 */
export const HandArt = React.memo(function HandArt({
  which,
  tone,
}: {
  which: 'nailHand' | 'openHand';
  tone: ToneId;
}) {
  const t = TONES.find((x) => x.id === tone) ?? TONES[0];
  const art = vectors[which];
  return (
    <>
      <Path d={art.skin} fill={t.skin} />
      <Path d={art.ink} fill={t.line} fillRule="evenodd" />
    </>
  );
});

/*
 * The nail hand's forearm edges below the knuckles are straight lines (fitted over y 1400-1535 of
 * the drawing): x = a + b*y for the outer edge of each outline, which is about 9 units thick.
 */
const ARM_L = { a: 448.41, b: -0.10874 };
const ARM_R = { a: 547.24, b: 0.09962 };
const ARM_LINE = 9;
const ARM_BOTTOM = 1536;
/** The extension starts this far above the drawing's bottom edge, overlapping it. */
const ARM_OVERLAP = 16;
/** Art units of extra forearm that always run past the canvas (the panel covers the rest). */
export const CHAIR_ARM = 1500;

/**
 * Carries both forearm outlines straight down below the drawing, from `y0` to `y1` (art units):
 * skin first, then the two outline bands over it.
 */
function ArmExtension({ skin, line, y0, y1 }: { skin: string; line: string; y0: number; y1: number }) {
  const l = (y: number) => ARM_L.a + ARM_L.b * y - 0.5;
  const r = (y: number) => ARM_R.a + ARM_R.b * y + 0.5;
  const quad = (xa: (y: number) => number, xb: (y: number) => number) =>
    `${xa(y0)},${y0} ${xb(y0)},${y0} ${xb(y1)},${y1} ${xa(y1)},${y1}`;
  return (
    <>
      <Polygon points={quad(l, r)} fill={skin} />
      <Polygon points={quad(l, (y) => l(y) + ARM_LINE)} fill={line} />
      <Polygon points={quad((y) => r(y) - ARM_LINE, r)} fill={line} />
    </>
  );
}

/** The hands: a traced vector hand each, with the five painted nails (and their stickers) drawn over it. */
function HandSvg({
  design,
  tone,
  hands,
  width,
  logicalWidth = width,
  label,
  crop,
  arm = 0,
}: {
  design: NailDesign;
  tone: ToneId;
  hands: Hands;
  /** Art units of extra forearm below the drawing, in a second Svg of its own below the first. */
  arm?: number;
  /** Size to draw at. */
  width: number;
  /** Size the art is shown at (line weight follows this; `width` may be drawn larger and scaled down). */
  logicalWidth?: number;
  label: string;
  /** Draw just this window of the art (art units) into `width` x `height` px, e.g. a zoomed view. */
  crop?: { x: number; y: number; w: number; h: number; height: number };
}) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const span = SPAN[hands];
  const height = crop ? crop.height : (VB[3] * width) / span.w;
  const { line, sw } = ink(tone, logicalWidth, span.w);
  const viewBox = crop ? `${crop.x} ${crop.y} ${crop.w} ${crop.h}` : `${span.x0} ${VB[1]} ${span.w} ${VB[3]}`;

  // The longer forearms are a second Svg of their own, just below the first and sized to hold them
  // (Android's Svg paints nothing outside its own bounds). Same art-to-screen mapping as the first.
  const k = width / (crop ? crop.w : span.w);
  const vx = crop ? crop.x : span.x0;
  const vy = crop ? crop.y : VB[1];
  const vw = crop ? crop.w : span.w;
  const aTop = (ARM_BOTTOM - ARM_OVERLAP - vy) * k;
  // (in the crisp window nothing below the window's bottom edge is needed)
  const aH = crop ? Math.min(arm * k, crop.height - aTop) : arm * k;
  const aY0 = ARM_BOTTOM - ARM_OVERLAP;
  const t = TONES.find((x) => x.id === tone) ?? TONES[0];

  return (
    <>
      <Svg width={width} height={height} viewBox={viewBox} accessibilityLabel={label}>
        {handsIn(hands).map((h) => (
          <G key={h} transform={handTransform(h, hands)}>
            <HandArt which="nailHand" tone={tone} />
            <NailsLayer design={design} hand={h} uid={`${uid}${h[0]}`} line={line} sw={sw} />
          </G>
        ))}
      </Svg>
      {arm > 0 && aH > 0 ? (
        <Svg
          pointerEvents="none"
          width={width}
          height={aH}
          viewBox={`${vx} ${aY0} ${vw} ${aH / k}`}
          style={{ position: 'absolute', left: 0, top: aTop }}
        >
          {handsIn(hands).map((h) => (
            <G key={h} transform={handTransform(h, hands)}>
              <ArmExtension skin={t.skin} line={t.line} y0={aY0} y1={aY0 + aH / k} />
            </G>
          ))}
        </Svg>
      ) : null}
    </>
  );
}

type Props = {
  design: NailDesign;
  tone: ToneId;
  /** Width of the art: the pair when `hands` is 'both' (the default), one hand when 'right'. */
  width: number;
  hands?: Hands;
};

/**
 * The hands with their fingers curled so the nails face you, for display only (Home, My hands,
 * the share picture). Height follows the art's aspect ratio.
 */
export function NailHand({ design, tone, width, hands = 'both' }: Props) {
  const height = (VB[3] * width) / SPAN[hands].w;
  return (
    <View style={{ width, height }}>
      <HandSvg
        design={design}
        tone={tone}
        hands={hands}
        width={width}
        label={hands === 'both' ? 'Two hands with painted nails' : 'A hand with painted nails'}
      />
    </View>
  );
}

/* ------------------------------------------------------------ painting animations */

/*
 * Every motion here runs on the UI thread: one shared value per effect counts milliseconds and the
 * animated styles are plain functions of it (transforms and opacity only), so React renders once
 * when an effect starts and once when it ends, never per frame.
 */

const GHOST_MS = 250;
const FLY_MS = 200;
const STROKE_MS = 420;
const LIFT_MS = 140;
const GLINT_MS = 250;
const PLACE_IN_MS = 220;
const PLACE_OUT_MS = 200;
const FADE_MS = 150;

const clamp01 = (x: number) => {
  'worklet';
  return Math.min(1, Math.max(0, x));
};
const easeOut = (x: number) => {
  'worklet';
  const m = 1 - clamp01(x);
  return 1 - m * m * m;
};
const easeIn = (x: number) => {
  'worklet';
  const v = clamp01(x);
  return v * v;
};

type Fx = {
  id: number;
  nail: NailRef;
  /** A brush stroke of new polish / pattern, a sticker set down or lifted off by tweezers, or (reduce motion) a cross-fade. */
  kind: 'paint' | 'pop' | 'unpop' | 'fade' | 'reshape';
  /** The nail as it ends up, and the shape it ends up in. */
  to: NailLook;
  shape: string;
  /** reshape: the nail as it was, fading out over the new one. */
  fromLook?: NailLook;
  fromShape?: string;
  /** The sticker that is placed / removed. */
  sticker?: StickerPos;
  /** A wet-sheen glint after a new colour. */
  glint?: boolean;
  /** The bristles' colour: the polish, or a pattern's mark colour. */
  bristle?: string;
  /** Where the brush flies in from, in canvas px (the bottle or pattern button that was tapped). */
  from?: { x: number; y: number };
};

const fxMs = (fx: Fx) =>
  fx.kind === 'reshape'
    ? GHOST_MS
    : fx.kind === 'fade'
    ? FADE_MS
    : fx.kind === 'paint'
      ? FLY_MS + STROKE_MS + (fx.glint ? GLINT_MS : LIFT_MS)
      : PLACE_IN_MS + (fx.kind === 'pop' ? 100 : 80) + PLACE_OUT_MS;

/**
 * Where an overlay layer is drawn: art point (x0, y0) sits at the layer's top-left and an art unit
 * is `k` px. The transformed box is one frame; the crisp window (zoomed in) is another, in which
 * `ss` is 1 because the art is already drawn at its on-screen size.
 */
type Frame = { x0: number; y0: number; k: number; ss: number };

/** iOS bitmaps SVGs; the small effect and halo overlays are drawn bigger and scaled back so they stay sharp at the zoom. */
const OVERLAY_SS = Platform.OS === 'ios' ? 2.7 : 1;

/* The tools, drawn once. Mela style: flat fills, plum outlines. */

const BRUSH_S = 1.35;
const BRUSH = { w: 48 * BRUSH_S, h: 112 * BRUSH_S, tipX: 24 * BRUSH_S, tipY: 108 * BRUSH_S };
/** A polish brush: bottle-cap handle, a short stem and a tapered tuft in `colour`; the tip is at the bottom. */
const BrushArt = React.memo(function BrushArt({ colour }: { colour: string }) {
  return (
    <Svg width={BRUSH.w} height={BRUSH.h} viewBox="0 0 48 112">
      <Rect x={11} y={2} width={26} height={38} rx={7} fill={colors.plum} />
      <Path d="M 15 11 V 30" stroke={colors.cream} strokeWidth={2.4} strokeLinecap="round" opacity={0.55} />
      <Rect x={16} y={39} width={16} height={14} rx={3} fill={colors.plum} />
      <Path
        d="M 18 53 C 15.5 70 18 92 24 108 C 30 92 32.5 70 30 53 Z"
        fill={colour}
        stroke={colors.plum}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
});

const TW_S = 1.5;
const TWEEZERS = { w: 70 * TW_S, h: 150 * TW_S, tipX: 35 * TW_S, tipY: 146 * TW_S };
/** One arm of the tweezers, hinged at the top (35, 0); `side` is -1 for the left arm, 1 for the right. */
const TweezerArm = React.memo(function TweezerArm({ side }: { side: -1 | 1 }) {
  const top = 35 + side * 12;
  const tip = 35 + side * 1.6;
  return (
    <Svg width={TWEEZERS.w} height={TWEEZERS.h} viewBox="0 0 70 150">
      <Path
        d={`M ${top - 4.6} 0 L ${top + 4.6} 0 L ${tip + side * 0.2 + 2} 146 L ${tip + side * 0.2 - 2} 146 Z`}
        fill={colors.plum}
        stroke={colors.plum}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d={`M ${top - side * 0.2} 6 L ${tip - side * 0.2 + side * 0.4} 132`}
        stroke={colors.cream}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.8}
      />
      {[14, 20, 26].map((y) => (
        <Path
          key={y}
          d={`M ${top - 3.4 + side * y * 0.01} ${y} h 6.8`}
          stroke={colors.cream}
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}
    </Svg>
  );
});

/**
 * What the child just did to one nail, drawn over the hand while it plays (in the crisp window):
 *  - paint: the new colour or pattern is a static nail-shaped picture inside a clipper; the clipper
 *    and its content slide in opposite directions, so it uncovers from the cuticle to the free
 *    edge without redrawing, under a brush that flies in, strokes, and lifts away;
 *  - pop / unpop: tweezers bring a sticker in and set it down, or lift it off;
 *  - fade: with reduce motion, the new look just fades in.
 */
const FxLayer = React.memo(function FxLayer({
  fx,
  uid,
  line,
  sw,
  fx0,
  fy0,
  k,
  onDone,
}: {
  fx: Fx;
  uid: string;
  line: string;
  sw: number;
  /** The frame: art point (fx0, fy0) at the layer's top-left, `k` px per art unit. */
  fx0: number;
  fy0: number;
  k: number;
  onDone: (id: number) => void;
}) {
  const prog = useSharedValue(0);
  const total = fxMs(fx);
  useEffect(() => {
    prog.value = withTiming(total, { duration: total, easing: Easing.linear });
    const t = setTimeout(() => onDone(fx.id), total + 30);
    return () => {
      clearTimeout(t);
      cancelAnimation(prog);
    };
  }, [prog, total, fx.id, onDone]);

  const { digit, hand } = fx.nail;
  const p = PLACES[digit];
  const mirrored = hand === 'right';
  // (A reshape draws the nail as it was, fading out over the new one.)
  const d = nailPath(fx.kind === 'reshape' ? (fx.fromShape ?? fx.shape) : fx.shape, digit);
  const shown = fx.kind === 'reshape' ? (fx.fromLook ?? fx.to) : fx.to;
  const { len, hw, bot } = nailMetrics(d);
  const unit = 1 / closeK(d);
  const rho = mirrored ? -p.rotate : p.rotate;

  // A point in the nail's own frame, in canvas px.
  const toCanvas = (lx: number, ly: number) => {
    const a = (p.rotate * Math.PI) / 180;
    const q = pairPoint(hand, p.x + lx * Math.cos(a) - ly * Math.sin(a), p.y + lx * Math.sin(a) + ly * Math.cos(a));
    return { x: (q.x - fx0) * k, y: (q.y - fy0) * k };
  };
  const O = toCanvas(0, 0);
  const A = toCanvas(0, bot); // cuticle
  const B = toCanvas(0, -len); // free edge

  // The nail's frame as a layer: cuticle origin at (ox, oy) px, turned to the nail's angle.
  const PAD = 6;
  const w = 2 * (hw + PAD);
  const h = len + bot + 2 * PAD;
  const ox = (hw + PAD) * k;
  const oy = (len + PAD) * k;
  const Hr = (len + bot) * k; // the nail plate, in px, tip to cuticle
  const frameStyle = {
    position: 'absolute' as const,
    left: O.x - ox,
    top: O.y - oy,
    width: w * k,
    height: h * k,
    transformOrigin: `${ox}px ${oy}px`,
    transform: [{ rotate: `${rho}deg` }],
  };
  const flip = mirrored ? 'scale(-1 1)' : undefined;
  const plateBox = { position: 'absolute' as const, left: 0, top: PAD * k, width: w * k, height: Hr };
  const plateView = `${-(hw + PAD)} ${-len} ${w} ${len + bot}`;

  // ---- paint
  const clipStyle = useAnimatedStyle(() => {
    const f = easeOut((prog.value - FLY_MS) / STROKE_MS);
    return { transform: [{ translateY: Hr * (1 - f) }] };
  });
  const innerStyle = useAnimatedStyle(() => {
    const f = easeOut((prog.value - FLY_MS) / STROKE_MS);
    return { transform: [{ translateY: -Hr * (1 - f) }] };
  });
  const band = Math.max(8, hw * 0.7 * k);
  const glintAt = FLY_MS + STROKE_MS - 120;
  const glintClip = useAnimatedStyle(() => {
    const g = clamp01((prog.value - glintAt) / GLINT_MS);
    return { opacity: g > 0 && g < 1 ? Math.sin(Math.PI * g) * 0.9 : 0, transform: [{ translateY: -(Hr + band) * g }] };
  });
  const glintInner = useAnimatedStyle(() => {
    const g = clamp01((prog.value - glintAt) / GLINT_MS);
    return { transform: [{ translateY: (Hr + band) * g }] };
  });
  const fade = useAnimatedStyle(() => ({ opacity: clamp01(prog.value / FADE_MS) }));
  const fadeOut = useAnimatedStyle(() => ({ opacity: 1 - easeOut(prog.value / GHOST_MS) }));

  // ---- tools
  const start = fx.from ?? { x: A.x + 90, y: A.y - 90 };
  // The brush is held about 28 degrees off the nail's axis, handle trailing behind the tip.
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dl = Math.hypot(dx, dy) || 1;
  const tilt = (28 * Math.PI) / 180;
  const hx = (-dx / dl) * Math.cos(tilt) - (-dy / dl) * Math.sin(tilt);
  const hy = (-dx / dl) * Math.sin(tilt) + (-dy / dl) * Math.cos(tilt);
  const phi = (Math.atan2(hy, hx) * 180) / Math.PI + 90;
  const brushStyle = useAnimatedStyle(() => {
    const t = prog.value;
    let x: number;
    let y: number;
    let o = 1;
    if (t < FLY_MS) {
      const e = easeOut(t / FLY_MS);
      x = start.x + (A.x - start.x) * e;
      y = start.y + (A.y - start.y) * e;
      o = clamp01(t / 70);
    } else if (t < FLY_MS + STROKE_MS) {
      const e = easeOut((t - FLY_MS) / STROKE_MS);
      x = A.x + (B.x - A.x) * e;
      y = A.y + (B.y - A.y) * e;
    } else {
      const u = clamp01((t - FLY_MS - STROKE_MS) / LIFT_MS);
      x = B.x;
      y = B.y - 40 * easeIn(u);
      o = 1 - u;
    }
    return { opacity: o, transform: [{ translateX: x }, { translateY: y }, { rotate: `${phi}deg` }] };
  });

  // Tweezers come from the upper right to the sticker's fitted spot.
  const sticker = fx.sticker;
  const sp = sticker ? stickerLocal(sticker, hw, len, d) : { x: 0, y: 0, scale: 1 };
  const T = toCanvas(sp.x, sp.y);
  const glyph = 34 * sp.scale * k;
  const OFF = { x: 110, y: -130 };
  const twPhi = 40;
  const releaseAt = PLACE_IN_MS;
  const outAt = PLACE_IN_MS + (fx.kind === 'pop' ? 100 : 80);
  const twStyle = useAnimatedStyle(() => {
    const t = prog.value;
    let ex: number;
    let o = 1;
    if (t < PLACE_IN_MS) {
      ex = 1 - easeOut(t / PLACE_IN_MS);
      o = clamp01(t / 80);
    } else if (t < outAt) {
      ex = 0;
    } else {
      const u = clamp01((t - outAt) / PLACE_OUT_MS);
      ex = easeIn(u);
      o = 1 - u;
    }
    return {
      opacity: o,
      transform: [{ translateX: T.x + OFF.x * ex }, { translateY: T.y + OFF.y * ex }, { rotate: `${twPhi}deg` }],
    };
  });
  const isPop = fx.kind === 'pop';
  const armL = useAnimatedStyle(() => {
    const t = prog.value;
    // placing: hold, then open slightly as the sticker is released; removing: arrive open, close on it.
    const a =
      isPop
        ? t < releaseAt
          ? 1.2
          : 1.2 + 2.8 * clamp01((t - releaseAt) / 100)
        : 4 - 3.2 * clamp01((t - PLACE_IN_MS) / 80);
    return { transform: [{ rotate: `${-a}deg` }] };
  });
  const armR = useAnimatedStyle(() => {
    const t = prog.value;
    const a =
      isPop
        ? t < releaseAt
          ? 1.2
          : 1.2 + 2.8 * clamp01((t - releaseAt) / 100)
        : 4 - 3.2 * clamp01((t - PLACE_IN_MS) / 80);
    return { transform: [{ rotate: `${a}deg` }] };
  });
  // The sticker on the nail: set down with a little pop (placing), or waiting to be lifted (removing).
  const spotStyle = useAnimatedStyle(() => {
    const t = prog.value;
    if (isPop) {
      const u = clamp01((t - releaseAt) / 150);
      const s = u < 0.45 ? 1 + 0.12 * easeOut(u / 0.45) : 1.12 - 0.12 * easeOut((u - 0.45) / 0.55);
      return { opacity: t < releaseAt ? 0 : 1, transform: [{ rotate: `${rho}deg` }, { scale: s }] };
    }
    return { opacity: t < PLACE_IN_MS ? 1 : 0, transform: [{ rotate: `${rho}deg` }] };
  });
  // The sticker held between the tips (before it is set down, or after it is picked up).
  const heldStyle = useAnimatedStyle(() => {
    const t = prog.value;
    if (isPop) return { opacity: t < releaseAt ? 1 : 0, transform: [{ rotate: `${rho - twPhi}deg` }] };
    const u = clamp01((t - outAt) / PLACE_OUT_MS);
    return {
      opacity: t < PLACE_IN_MS ? 0 : 1 - u,
      transform: [{ rotate: `${rho - twPhi}deg` }, { scale: 1 - 0.2 * u }],
    };
  });

  const glyphSvg = sticker ? (
    <Svg width={glyph} height={glyph} viewBox="-17 -17 34 34">
      <G transform={flip}>
        <StickerGlyph kind={sticker.kind} />
      </G>
    </Svg>
  ) : null;

  if (fx.kind === 'fade' || fx.kind === 'reshape') {
    return (
      <Animated.View pointerEvents="none" style={[frameStyle, fx.kind === 'reshape' ? fadeOut : fade]}>
        <View style={plateBox}>
          <Svg width={w * k} height={Hr} viewBox={plateView}>
            <G transform={flip}>
              <NailPaint uid={`${uid}p`} d={d} look={shown} line={line} strokeWidth={sw} unit={unit} />
              <NailStickers uid={`${uid}q`} d={d} stickers={shown.stickers} hw={hw} len={len} />
            </G>
          </Svg>
        </View>
      </Animated.View>
    );
  }

  if (fx.kind === 'paint') {
    return (
      <>
        <View pointerEvents="none" style={frameStyle}>
          <Animated.View style={[{ ...plateBox, overflow: 'hidden' }, clipStyle]}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w * k, height: Hr }, innerStyle]}>
              <Svg width={w * k} height={Hr} viewBox={plateView}>
                <G transform={flip}>
                  <NailPaint uid={`${uid}p`} d={d} look={fx.to} line={line} strokeWidth={sw} unit={unit} />
                  <NailStickers uid={`${uid}q`} d={d} stickers={fx.to.stickers} hw={hw} len={len} />
                </G>
              </Svg>
            </Animated.View>
          </Animated.View>
          {fx.glint && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  top: PAD * k + Hr,
                  width: w * k,
                  height: band,
                  overflow: 'hidden',
                },
                glintClip,
              ]}
            >
              <Animated.View style={[{ position: 'absolute', left: 0, top: -Hr, width: w * k, height: Hr }, glintInner]}>
                <Svg width={w * k} height={Hr} viewBox={plateView}>
                  <G transform={flip}>
                    <Path d={d} fill="#FFFFFF" fillOpacity={0.7} />
                  </G>
                </Svg>
              </Animated.View>
            </Animated.View>
          )}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: -BRUSH.tipX,
              top: -BRUSH.tipY,
              width: BRUSH.w,
              height: BRUSH.h,
              transformOrigin: `${BRUSH.tipX}px ${BRUSH.tipY}px`,
            },
            brushStyle,
          ]}
        >
          <BrushArt colour={fx.bristle ?? fx.to.color} />
        </Animated.View>
      </>
    );
  }

  // pop / unpop: tweezers and a sticker
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: T.x - glyph / 2, top: T.y - glyph / 2, width: glyph, height: glyph },
          spotStyle,
        ]}
      >
        {glyphSvg}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -TWEEZERS.tipX,
            top: -TWEEZERS.tipY,
            width: TWEEZERS.w,
            height: TWEEZERS.h,
            transformOrigin: `${TWEEZERS.tipX}px ${TWEEZERS.tipY}px`,
          },
          twStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: TWEEZERS.tipX - glyph / 2,
              top: TWEEZERS.tipY - glyph / 2 - 4,
              width: glyph,
              height: glyph,
            },
            heldStyle,
          ]}
        >
          {glyphSvg}
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, width: TWEEZERS.w, height: TWEEZERS.h, transformOrigin: `${TWEEZERS.w / 2}px 0px` },
            armL,
          ]}
        >
          <TweezerArm side={-1} />
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, width: TWEEZERS.w, height: TWEEZERS.h, transformOrigin: `${TWEEZERS.w / 2}px 0px` },
            armR,
          ]}
        >
          <TweezerArm side={1} />
        </Animated.View>
      </Animated.View>
    </>
  );
});

/* ------------------------------------------------------------------- halo */

/** The magenta band that marks the selected nail. */
const HALO_COLOUR = colors.magenta;
/** How far the band reaches past the nail's outline, in screen px: the soft edge, the firm core. */
const HALO_OUTER_PX = 5;
const HALO_INNER_PX = 3;

function useReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

type HaloState = { nail: NailRef; id: number; out: boolean; born: number };
const HALO_IN_MS = 160;
const HALO_BREATH_MS = 1600;

/**
 * A halo that follows the selected nail's own outline: the nail's path stroked twice (wide and
 * faint, narrower and firmer) in magenta, kept OUTSIDE the nail so it never covers its paint,
 * pattern or stickers, with the nail's own outline redrawn over its inner half. It fades in when
 * the camera lands, breathes between 55% and 100% (on the UI thread; steady with reduce-motion),
 * and fades out when it is replaced or the hands zoom back out. Like the effect layers it is a
 * small SVG in the nail's own frame, mirrored on the left hand.
 */
function HaloLayer({
  halo,
  shape,
  line,
  sw,
  frame,
  ppu,
  reduceMotion,
  onGone,
}: {
  halo: HaloState;
  shape: string;
  line: string;
  sw: number;
  frame: Frame;
  /** Screen px per art unit at the zoom. */
  ppu: number;
  reduceMotion: boolean;
  onGone: (id: number) => void;
}) {
  const { nail, out, id, born } = halo;
  const scale = frame.k;
  // Where in its fade-in and its breath this halo is now, so a remount (the camera landing moves
  // it into the crisp window) carries on rather than blinking.
  const [start] = useState(() => {
    const age = Date.now() - born;
    return { enter: Math.min(1, age / HALO_IN_MS), phase: (age % HALO_BREATH_MS) / HALO_BREATH_MS };
  });
  const enter = useSharedValue(start.enter);
  const phase = useSharedValue(start.phase);
  useEffect(() => {
    enter.value = withTiming(out ? 0 : 1, { duration: out ? 200 : Math.max(1, HALO_IN_MS * (1 - start.enter)) });
    if (!out) return;
    const t = setTimeout(() => onGone(id), 260);
    return () => clearTimeout(t);
  }, [out, id, enter, onGone, start.enter]);
  useEffect(() => {
    cancelAnimation(phase);
    if (reduceMotion) {
      phase.value = 0;
    } else {
      // The rest of this breath, then breath after breath: 1 -> 0.55 -> 1 over 1.6s.
      phase.value = start.phase;
      phase.value = withSequence(
        withTiming(1, { duration: Math.max(1, HALO_BREATH_MS * (1 - start.phase)), easing: Easing.linear }),
        withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(1, { duration: HALO_BREATH_MS, easing: Easing.linear }),
          ),
          -1,
        ),
      );
    }
    return () => cancelAnimation(phase);
  }, [reduceMotion, phase, start.phase]);
  const fade = useAnimatedStyle(() => ({
    opacity: enter.value * (0.775 + 0.225 * Math.cos(phase.value * 2 * Math.PI)),
  }));

  const p = PLACES[nail.digit];
  const mirrored = nail.hand === 'right';
  const d = nailPath(shape, nail.digit);
  const { len, hw, bot } = nailMetrics(d);
  const wide = sw + (2 * HALO_OUTER_PX) / ppu;
  const narrow = sw + (2 * HALO_INNER_PX) / ppu;
  const PAD = wide / 2 + 6;
  const x0 = -(hw + PAD);
  const y0 = -(len + PAD);
  const w = 2 * (hw + PAD);
  const h = len + bot + 2 * PAD;
  const ox = (hw + PAD) * scale;
  const oy = (len + PAD) * scale;
  const at = pairPoint(nail.hand, p.x, p.y);
  const art = (
    <>
      <Defs>
        {/* Everything but the nail: a box with the nail cut out of it. */}
        <ClipPath id={`haloOutside${id}`}>
          <Path
            d={`M ${x0 - 4} ${y0 - 4} H ${x0 + w + 4} V ${y0 + h + 4} H ${x0 - 4} Z ${d}`}
            clipRule="evenodd"
          />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#haloOutside${id})`}>
        <Path d={d} fill="none" stroke={HALO_COLOUR} strokeOpacity={0.35} strokeWidth={wide} strokeLinejoin="round" />
        <Path d={d} fill="none" stroke={HALO_COLOUR} strokeOpacity={0.85} strokeWidth={narrow} strokeLinejoin="round" />
      </G>
      <Path d={d} fill="none" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
    </>
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (at.x - frame.x0) * scale - ox,
          top: (p.y - frame.y0) * scale - oy,
          width: w * scale,
          height: h * scale,
          transformOrigin: `${ox}px ${oy}px`,
          transform: [{ rotate: `${mirrored ? -p.rotate : p.rotate}deg` }],
        },
        fade,
      ]}
    >
      <View
        style={{
          width: w * scale * frame.ss,
          height: h * scale * frame.ss,
          transformOrigin: 'left top',
          transform: [{ scale: 1 / frame.ss }],
        }}
      >
        <Svg width={w * scale * frame.ss} height={h * scale * frame.ss} viewBox={`${x0} ${y0} ${w} ${h}`}>
          {mirrored ? <G transform="scale(-1 1)">{art}</G> : art}
        </Svg>
      </View>
    </Animated.View>
  );
}

/** The nails of the shape just left, fading out over the new shape (on the UI thread). */
function GhostLayer({
  design,
  tone,
  width,
  uid,
  onDone,
}: {
  design: NailDesign;
  tone: ToneId;
  width: number;
  uid: string;
  onDone: () => void;
}) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withTiming(0, { duration: GHOST_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(onDone, GHOST_MS + 30);
    return () => {
      clearTimeout(t);
      cancelAnimation(o);
    };
  }, [o, onDone]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  const span = SPAN.both;
  const height = (VB[3] * width) / span.w;
  const { line, sw } = ink(tone, width, span.w);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height }, fade]}>
      <Svg width={width} height={height} viewBox={`${span.x0} ${VB[1]} ${span.w} ${VB[3]}`}>
        {handsIn('both').map((h) => (
          <G key={h} transform={handTransform(h, 'both')}>
            <NailsLayer design={design} hand={h} uid={`${uid}${h[0]}`} line={line} sw={sw} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

const sameLook = (a: NailLook, b: NailLook) =>
  a.color === b.color && a.pattern === b.pattern && JSON.stringify(a.stickers) === JSON.stringify(b.stickers);

/* ------------------------------------------------------------------- zoom */

/** How far the camera flies in on a fingertip. */
export const ZOOM = 2.7;
const ZOOM_MS = 520;
const ZOOM_EASE = Easing.bezier(0.22, 0.8, 0.24, 1);
/** Fingers further than this (px) between press and release are a swipe, not a tap. */
const TAP_SLOP = 12;

type ZoomProps = {
  design: NailDesign;
  tone: ToneId;
  /** Width of the pair's art (both hands). */
  width: number;
  /** The fingertip the camera is on, or null for both whole hands. */
  zoom: NailRef | null;
  /** Px the art sits below the middle of its canvas (see `pairFit`); the camera still centres nails. */
  shift?: number;
  /** The canvas's size (px). With it, the hands are redrawn crisp at the zoomed size once the camera lands. */
  view?: { w: number; h: number };
  /**
   * Where the polish brush flies in from (canvas px): the bottle or pattern button just tapped.
   * `n` changes with every tap; read when the change to the design arrives.
   */
  toolFrom?: { x: number; y: number; n: number };
  /** Bump this when the whole design is reset (Start again): the old nails fade out over the new, whatever changed. */
  resetN?: number;
  /** A touch (or a screen reader's tap) on a nail. */
  onNailPress: (n: NailRef) => void;
  /** A touch on the hands that is not on a nail. */
  onOffPress?: () => void;
  /**
   * A touch on the zoomed nail itself (or just off its plate, moved onto it), as a spot in that
   * nail's local units; see `newSticker` and `stickerAt`.
   */
  onNailTap?: (spot: { x: number; y: number }) => void;
};

/** A point in the pair's coordinates, in a nail's local frame (on the left hand: the mirrored one). */
function toNailLocal(n: NailRef, vx: number, vy: number) {
  const p = PLACES[n.digit];
  const a = (p.rotate * Math.PI) / 180;
  const q = handPoint(n.hand, vx, vy);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Where a nail's middle sits in the pair's coordinates. */
function pairNailCentre(n: NailRef, shape: string) {
  const c = nailCentre(n.digit, shape);
  return pairPoint(n.hand, c.x, c.y);
}

/** The zoomed nail is drawn at least this many px per art unit, whatever size the pair is. */
const ZOOM_PX = (ZOOM * 262) / VB[2];

/** A design with every nail's look from `pick`. */
function designOf(shape: string, pick: (n: NailRef) => NailLook): NailDesign {
  const hand = (h: Hand) =>
    Object.fromEntries(DIGITS.map((digit) => [digit, pick({ hand: h, digit })])) as Record<Digit, NailLook>;
  return { shape, nails: hand('right'), left: hand('left') };
}

/**
 * Both hands with a camera: `zoom` slides the chosen nail's middle to the middle of the box,
 * scaled by ZOOM, over 520ms. The whole thing is one transform on the container (on the UI
 * thread), so the nails, stickers and patterns inside scale with it. Nothing rotates.
 *
 * It also plays what the child just changed (a sweep of new polish, a sticker popping on or off,
 * a shape cross-fade); nails that were already painted never animate again.
 */
export function ZoomHand({ design, tone, width, zoom, shift = 0, view, toolFrom, resetN = 0, onNailPress, onOffPress, onNailTap }: ZoomProps) {
  const span = SPAN.both;
  const scale = width / span.w;
  const height = VB[3] * scale;
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const { line, sw } = ink(tone, width, span.w);
  const shapeOf = (n: NailRef) => lookShape(design, n.hand, n.digit);

  // The halo on the selected nail: a new one fades in, the previous one fades out and is dropped.
  const zoomKey = zoom ? nailKey(zoom) : null;
  const [halos, setHalos] = useState<{ key: string | null; next: number; list: HaloState[] }>(() => ({
    key: zoomKey,
    next: 2,
    list: zoom ? [{ nail: zoom, id: 1, out: false, born: Date.now() }] : [],
  }));
  if (halos.key !== zoomKey) {
    const list: HaloState[] = halos.list.map((h) => (h.out ? h : { ...h, out: true }));
    if (zoom) list.push({ nail: zoom, id: halos.next, out: false, born: Date.now() });
    setHalos({ key: zoomKey, next: halos.next + 1, list });
  }
  const haloGone = useCallback(
    (id: number) => setHalos((cur) => ({ ...cur, list: cur.list.filter((h) => h.id !== id) })),
    [],
  );
  const reduceMotion = useReduceMotion();

  // The camera's glide is a transform on bitmaps, so it is soft. Once it lands, the hands are
  // redrawn as vector at the zoomed size in a window the size of the canvas (below the halo and
  // effect layers), and the box's own copy is hidden.
  const [landed, setLanded] = useState<{ key: string | null; done: boolean }>({ key: zoomKey, done: false });
  if (landed.key !== zoomKey) setLanded({ key: zoomKey, done: false });
  useEffect(() => {
    if (!zoomKey) return;
    const t = setTimeout(
      () => setLanded((l) => (l.key === zoomKey ? { key: l.key, done: true } : l)),
      ZOOM_MS + 80,
    );
    return () => clearTimeout(t);
  }, [zoomKey]);
  const crisp = !!zoom && !!view && landed.key === zoomKey && landed.done;

  // What the hands draw (`base`) lags the design while a brush stroke or the tweezers play on top.
  // Effects only play once the camera has landed (that is where the tools can be placed exactly);
  // a change at any other time, or one that arrives while another plays, just lands at once.
  const [base, setBase] = useState(design);
  const [fx, setFx] = useState<Fx | null>(null);
  const [ghost, setGhost] = useState<{ id: number; design: NailDesign } | null>(null);
  const latest = useRef(design);
  const seq = useRef(0);
  const zoomRef = useRef(zoom);
  const live = useRef({ crisp, reduceMotion, toolFrom, resetN });
  const lastReset = useRef(resetN);
  useEffect(() => {
    live.current = { crisp, reduceMotion, toolFrom, resetN };
    zoomRef.current = zoom;
  });
  useEffect(() => {
    const old = latest.current;
    latest.current = design;
    if (old === design) return;
    const wasReset = live.current.resetN !== lastReset.current;
    lastReset.current = live.current.resetN;
    const eff = (d: NailDesign, n: NailRef) => lookShape(d, n.hand, n.digit);
    const reshaped = NAIL_ORDER.filter((n) => eff(old, n) !== eff(design, n));
    const changed = NAIL_ORDER.filter((n) => !sameLook(lookOf(old, n), lookOf(design, n)));
    const { crisp: on, reduceMotion: calm, toolFrom: tf } = live.current;
    const fadeOld = () => {
      // Several nails at once (a shape, a whole-hands colour, Start again): whatever was playing
      // lands, and the old look fades out over the new.
      setBase(design);
      setFx(null);
      setGhost({ id: ++seq.current, design: old });
    };
    if (!reshaped.length && !changed.length) return;
    if (wasReset || reshaped.length > 1 || changed.length > 1) return fadeOld();
    const one = reshaped[0] ?? changed[0];
    if (!zoomRef.current) return fadeOld();
    if (!on || !sameNail(one, zoomRef.current)) {
      setBase(design);
      setFx(null);
      return;
    }
    const nail = one;
    const a = lookOf(old, nail);
    const b = lookOf(design, nail);
    const id = ++seq.current;
    const shape = eff(design, nail);
    if (reshaped.length) {
      // This nail's own shape changed: the old nail fades out over the new one.
      setBase(design);
      setFx({ id, nail, kind: calm ? 'fade' : 'reshape', to: b, shape, fromLook: a, fromShape: eff(old, nail) });
      return;
    }
    let next: Fx | null = null;
    let baseLook = b;
    if (a.color !== b.color || a.pattern !== b.pattern) {
      baseLook = a;
      const mark = b.pattern === 'french' ? '#FFFFFF' : b.pattern === 'plain' ? b.color : isLight(b.color) ? colors.plum : colors.cream;
      next = {
        id,
        nail,
        kind: calm ? 'fade' : 'paint',
        to: b,
        shape,
        glint: a.color !== b.color,
        bristle: a.color !== b.color ? b.color : mark,
        from: tf ? { x: tf.x, y: tf.y } : undefined,
      };
    } else if (b.stickers.length < a.stickers.length) {
      let i = a.stickers.findIndex((s, j) => !b.stickers[j] || JSON.stringify(s) !== JSON.stringify(b.stickers[j]));
      if (i < 0) i = a.stickers.length - 1;
      baseLook = calm ? a : b;
      next = { id, nail, kind: calm ? 'fade' : 'unpop', to: b, shape, sticker: a.stickers[i] };
    } else if (b.stickers.length) {
      const last = b.stickers[b.stickers.length - 1];
      baseLook = calm ? a : { ...b, stickers: b.stickers.slice(0, -1) };
      next = { id, nail, kind: calm ? 'fade' : 'pop', to: b, shape, sticker: last };
    }
    if (!next) {
      setBase(design);
      setFx(null);
      return;
    }
    // Anything still playing lands at once; this one starts.
    setBase(designOf(design.shape, (n) => (sameNail(n, nail) ? baseLook : lookOf(design, n))));
    setFx(next);
  }, [design]);

  const fxRef = useRef<Fx | null>(null);
  useEffect(() => {
    fxRef.current = fx;
  });
  const fxDone = useCallback((id: number) => {
    const cur = fxRef.current;
    if (!cur || cur.id !== id) return;
    setFx(null);
    setBase((b) => withLook({ ...b, shape: latest.current.shape }, cur.nail, lookOf(latest.current, cur.nail)));
  }, []);
  // The camera moving off (a glide, a zoom out) lands whatever is playing.
  if (fx && !crisp) {
    setFx(null);
    setBase(design);
  }
  const ghostGone = useCallback(() => setGhost(null), []);

  // Camera target: move the nail's centre (box pixels) to the box centre, then scale about it.
  let tx = 0;
  let ty = 0;
  let sc = 1;
  if (zoom) {
    const c = pairNailCentre(zoom, shapeOf(zoom));
    sc = Math.max(ZOOM, ZOOM_PX / scale);
    tx = -sc * ((c.x - span.x0) * scale - width / 2);
    ty = -sc * ((c.y - VB[1]) * scale - height / 2) - shift;
  }

  const x = useSharedValue(tx);
  const y = useSharedValue(ty);
  const s = useSharedValue(sc);
  const lastWidth = useRef(width);
  useEffect(() => {
    if (lastWidth.current !== width) {
      // The canvas was measured or resized: jump, don't fly.
      lastWidth.current = width;
      x.value = tx;
      y.value = ty;
      s.value = sc;
      return;
    }
    const cfg = { duration: ZOOM_MS, easing: ZOOM_EASE };
    x.value = withTiming(tx, cfg);
    y.value = withTiming(ty, cfg);
    s.value = withTiming(sc, cfg);
  }, [tx, ty, sc, width, x, y, s]);

  const camera = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
  }));

  const downAt = useRef<{ x: number; y: number } | null>(null);

  let win: { left: number; top: number; w: number; h: number; crop: { x: number; y: number; w: number; h: number; height: number } } | null = null;
  if (crisp && zoom && view) {
    // The window is the canvas, centred on the nail; it shows the art at `scale * sc` px a unit.
    const c = pairNailCentre(zoom, shapeOf(zoom));
    const aw = view.w / (scale * sc);
    const ah = view.h / (scale * sc);
    win = {
      left: width / 2 - view.w / 2,
      top: height / 2 - shift - view.h / 2,
      w: view.w,
      h: view.h,
      crop: { x: c.x - aw / 2, y: c.y - ah / 2, w: aw, h: ah, height: view.h },
    };
  }

  const layers = (frame: Frame) => (
    <>
      {halos.list.map((h) => (
        <HaloLayer
          key={h.id}
          halo={h}
          shape={lookShape(design, h.nail.hand, h.nail.digit)}
          line={line}
          sw={sw}
          frame={frame}
          ppu={Math.max(ZOOM * scale, ZOOM_PX)}
          reduceMotion={reduceMotion}
          onGone={haloGone}
        />
      ))}
    </>
  );

  return (
    <View style={{ width, height, top: shift }}>
      {win && (
        <View pointerEvents="none" style={{ position: 'absolute', left: win.left, top: win.top, width: win.w, height: win.h }}>
          <HandSvg
            design={base}
            tone={tone}
            hands="both"
            width={win.w}
            logicalWidth={width}
            crop={win.crop}
            arm={CHAIR_ARM}
            label=""
          />
          {/* The halo and effects redrawn at full resolution too, from where they had got to. */}
          {layers({ x0: win.crop.x, y0: win.crop.y, k: scale * sc, ss: 1 })}
          {fx && (
            <FxLayer
              key={fx.id}
              fx={fx}
              uid={`${uid}f${fx.id}`}
              line={line}
              sw={sw}
              fx0={win.crop.x}
              fy0={win.crop.y}
              k={scale * sc}
              onDone={fxDone}
            />
          )}
        </View>
      )}
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height }, camera]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          opacity: win ? 0 : 1,
        }}
      >
        <HandSvg
          design={base}
          tone={tone}
          hands="both"
          width={width}
          logicalWidth={width}
          arm={CHAIR_ARM}
          label={zoom ? `Close up of the ${nailSpokenName(zoom).toLowerCase()} nail` : 'Two hands with painted nails. Tap a nail to look closer.'}
        />
      </View>
      {!win && layers({ x0: span.x0, y0: VB[1], k: scale, ss: OVERLAY_SS })}
      {ghost && (
        <GhostLayer
          key={ghost.id}
          design={ghost.design}
          tone={tone}
          width={width}
          uid={`${uid}g${ghost.id}`}
          onDone={ghostGone}
        />
      )}
      {/* Screen readers: one invisible button per nail (the touch layer above them is skipped). */}
      {NAIL_ORDER.map((n) => {
        const c = pairNailCentre(n, shapeOf(n));
        return (
          <Pressable
            key={nailKey(n)}
            onPress={() => (sameNail(n, zoom) ? onNailTap?.(nailFrame(n.digit, shapeOf(n)).centre) : onNailPress(n))}
            accessibilityRole="button"
            accessibilityLabel={`${nailSpokenName(n)} nail`}
            accessibilityState={{ selected: sameNail(zoom, n) }}
            style={{
              position: 'absolute',
              width: 44,
              height: 44,
              left: (c.x - span.x0) * scale - 22,
              top: (c.y - VB[1]) * scale - 22,
            }}
          />
        );
      })}
      {/* Sighted touch: one layer over both hands picks the NEAREST nail tip. */}
      <View
        accessible={false}
        importantForAccessibility="no"
        style={{ position: 'absolute', left: 0, top: 0, width, height }}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onResponderGrant={(e: GestureResponderEvent) => {
          downAt.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        }}
        onResponderRelease={(e: GestureResponderEvent) => {
          const from = downAt.current;
          downAt.current = null;
          if (from && Math.hypot(e.nativeEvent.pageX - from.x, e.nativeEvent.pageY - from.y) > TAP_SLOP) return;
          // Native reports the touch in the layer's own (unscaled) units; the web reports screen px.
          const k = scale * (Platform.OS === 'web' ? s.value : 1);
          const vx = e.nativeEvent.locationX / k + span.x0;
          const vy = e.nativeEvent.locationY / k + VB[1];
          if (zoom) {
            // On (or just off) the zoomed nail: that is a touch on the nail. Otherwise a
            // neighbouring nail glides in; nothing near any nail zooms out.
            const lo = toNailLocal(zoom, vx, vy);
            const spot = spotOnNail(zoom.digit, shapeOf(zoom), lo.x, lo.y);
            if (spot) {
              onNailTap?.(spot);
              return;
            }
            const n = nearestPairNail(vx, vy);
            if (n && !sameNail(n, zoom)) onNailPress(n);
            else if (!n) onOffPress?.();
            return;
          }
          const n = nearestPairNail(vx, vy);
          if (n) onNailPress(n);
          else onOffPress?.();
        }}
      />
    </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------- small drawings */

/** A nail shape as a button icon (so a child who can't read picks by shape), filled with `fill`. */
export function ShapeIcon({ shape, fill, size = 1 }: { shape: string; fill: string; size?: number }) {
  const d = nailPath(shape, 'middle');
  const s = 5.5 / nailMetrics(nailPath('natural', 'middle')).hw;
  return (
    <Svg width={17 * size} height={36 * size} viewBox="-7.5 -26.5 15 31">
      <G transform={`scale(${s})`}>
        <Path d={d} fill={fill} stroke={colors.plum} strokeWidth={1.6 / s} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

const NAIL_ICON =
  'M -5.5 0 L -5.5 -8.41 C -5.5 -14.96 -1.65 -18.7 0 -18.7 C 1.65 -18.7 5.5 -14.96 5.5 -8.41 L 5.5 0 C 5.5 3.03 -5.5 3.03 -5.5 0 Z';

/** The four patterns, with the colour their little button nail is painted in. */
export const PATTERNS: { id: NailLook['pattern']; name: string; color: string }[] = [
  { id: 'plain', name: 'Plain', color: colors.magentaBright },
  { id: 'dots', name: 'Dots', color: colors.magentaBright },
  { id: 'stripes', name: 'Stripes', color: colors.turquoise },
  { id: 'french', name: 'French', color: colors.blush },
];

/** A little nail showing what a pattern looks like, for the Pattern buttons. */
export function PatternIcon({ pattern, color, size = 1 }: { pattern: NailLook['pattern']; color: string; size?: number }) {
  const uid = 'ico' + useId().replace(/[^A-Za-z0-9]/g, '');
  return (
    <Svg width={18 * size} height={30 * size} viewBox="-7.5 -21 15 26">
      <NailPaint uid={uid} d={NAIL_ICON} look={{ color, pattern }} line={colors.plum} strokeWidth={1.6} unit={5 / 26} />
    </Svg>
  );
}

/** The polish bottle on the Salon shelf. */
export function Bottle({ hex }: { hex: string }) {
  return (
    <Svg width={30} height={52} viewBox="0 0 30 52">
      <Rect x={10} y={2} width={10} height={13} rx={2.5} fill={colors.plum} />
      <Rect x={8.5} y={14} width={13} height={5} rx={1.5} fill={colors.plum} />
      <Path
        d="M 6 20 H 24 a 4 4 0 0 1 4 4 V 45 a 5 5 0 0 1 -5 5 H 7 a 5 5 0 0 1 -5 -5 V 24 a 4 4 0 0 1 4 -4 Z"
        fill={hex}
        stroke={colors.plum}
        strokeWidth={2.4}
      />
      <Path d="M 8 27 V 41" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}

/** The magenta scalloped edge between the white canvas and the magenta panel. */
export function ScallopEdge({ width }: { width: number }) {
  let d = 'M 0 22 L 0 13';
  for (let i = 0; i < 15; i++) d += ' a 13 13 0 0 1 26 0';
  d += ' L 390 22 Z';
  return (
    <View pointerEvents="none" style={{ height: 22, marginTop: -22, zIndex: 1 }}>
      <Svg width={width} height={22} viewBox="0 0 390 22" preserveAspectRatio="none">
        <Path d={d} fill={colors.magenta} />
      </Svg>
    </View>
  );
}
