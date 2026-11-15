import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
  Pattern,
  Rect,
} from 'react-native-svg';

import nails from '../art/nails.json';
import { FINGER_NAMES } from '../lib/nailNames';
import { DIGITS, type Digit, type NailDesign, type NailLook, type ToneId } from '../state/store';
import { colors, TONES } from '../theme';

/* ------------------------------------------------------------------ geometry */

type Place = { x: number; y: number; rotate: number; w: number; tip: number[] };
const PLACES = nails.digits as Record<Digit, Place>;
const SHAPES = nails.shapes as Record<string, Record<Digit, string>>;
const VB = nails.viewBox.split(' ').map(Number); // x y w h
const IMG = nails.image;

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
 */
export function stickerLocal(
  sticker: StickerPos,
  halfWidth: number,
  nailLength: number,
): { x: number; y: number; scale: number } {
  if (sticker.frame === 'nail') {
    // A shorter shape than the one it was placed on: keep it on the plate.
    const minY = -(nailLength - 0.35 * halfWidth);
    return { x: sticker.x * halfWidth, y: Math.max(sticker.y * halfWidth, minY), scale: STICKER_K * halfWidth };
  }
  const k = Math.min(CLOSE_K, 232 / nailLength) ** -1;
  return {
    x: (sticker.x - CLOSE_ORIGIN.x) * k,
    y: (sticker.y - CLOSE_ORIGIN.y) * k,
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
        for (let t = 0.1; t <= 1.001; t += 0.1) {
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
        for (let i = 1; i <= 12; i++) {
          const th = (Math.PI * i) / 12;
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
  for (let i = look.stickers.length - 1; i >= 0; i--) {
    const p = stickerLocal(look.stickers[i], hw, len);
    if (Math.hypot(x - p.x, y - p.y) <= 15 * p.scale + 0.25 * hw) return i;
  }
  return -1;
}

/** A sticker placed at a spot (local units). */
export function newSticker(kind: string, digit: Digit, shape: string, x: number, y: number): StickerPos {
  const { hw } = nailFrame(digit, shape);
  return { kind, x: x / hw, y: y / hw, frame: 'nail' };
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
  const { len, hw } = nailMetrics(d);
  const fillId = `${uid}f`;
  const clipId = `${uid}c`;
  const { color, pattern } = look;
  const dot = isLight(color) ? colors.plum : colors.cream;
  const u = unit;

  const fill = pattern === 'dots' || pattern === 'stripes' ? `url(#${fillId})` : color;

  // French: the white tip over the colour, its edge a gentle curve across the nail.
  const b = len * 0.66;
  const W = hw * 1.2;
  const bump = hw * 0.33;
  const smile = `M ${-W} ${-b} C ${-W * 0.42} ${-b - bump} ${W * 0.42} ${-b - bump} ${W} ${-b}`;

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
        {pattern === 'french' && (
          <ClipPath id={clipId}>
            <Path d={d} />
          </ClipPath>
        )}
      </Defs>
      <Path d={d} fill={fill} />
      {pattern === 'french' && (
        <>
          <Path
            d={`M ${-W} ${-len - 40} L ${W} ${-len - 40} L ${W} ${-b} C ${W * 0.42} ${-b - bump} ${-W * 0.42} ${-b - bump} ${-W} ${-b} Z`}
            fill="#FFFFFF"
            clipPath={`url(#${clipId})`}
          />
          <Path
            d={smile}
            fill="none"
            stroke={line}
            strokeWidth={strokeWidth * 0.75}
            clipPath={`url(#${clipId})`}
          />
        </>
      )}
      <Path d={d} fill="none" stroke={line} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </>
  );
}

/* ---------------------------------------------------------------------- hand */

const HAND_IMAGES: Record<ToneId, number> = {
  t0: require('../../assets/hands/nail-hand-t0.png'),
  t1: require('../../assets/hands/nail-hand-t1.png'),
  t2: require('../../assets/hands/nail-hand-t2.png'),
  t3: require('../../assets/hands/nail-hand-t3.png'),
  t4: require('../../assets/hands/nail-hand-t4.png'),
  t5: require('../../assets/hands/nail-hand-t5.png'),
  t6: require('../../assets/hands/nail-hand-t6.png'),
};

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

/** Line colour and weight for the nails on a hand shown `logicalWidth` wide. */
function ink(tone: ToneId, logicalWidth: number) {
  const toneInfo = TONES.find((t) => t.id === tone) ?? TONES[0];
  // About 1.5pt on screen at the canvas size (262pt wide), never thinner than the art's own.
  return { line: toneInfo.line, sw: Math.max(nails.line.width, (1.5 * VB[2]) / logicalWidth) };
}

/** One sticker in a nail's local frame; `pop` scales / turns it for the pop on / off animations. */
function StickerAt({
  s,
  hw,
  len,
  scale = 1,
  rotate = 0,
}: {
  s: StickerPos;
  hw: number;
  len: number;
  scale?: number;
  rotate?: number;
}) {
  const p = stickerLocal(s, hw, len);
  return (
    <G transform={`translate(${p.x} ${p.y}) rotate(${rotate}) scale(${Math.max(0.001, p.scale * scale)})`}>
      <StickerGlyph kind={s.kind} />
    </G>
  );
}

/** The five painted nails (and their stickers) at their places on the hand. */
function NailsLayer({
  design,
  uid,
  line,
  sw,
}: {
  design: NailDesign;
  uid: string;
  line: string;
  sw: number;
}) {
  return (
    <>
      {DIGITS.map((dg) => {
        const p = PLACES[dg];
        const d = nailPath(design.shape, dg);
        const look = design.nails[dg];
        const k = 1 / closeK(d);
        const { len, hw } = nailMetrics(d);
        return (
          <G key={dg} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`}>
            <NailPaint uid={`${uid}${dg}`} d={d} look={look} line={line} strokeWidth={sw} unit={k} />
            {look.stickers.map((s, i) => (
              <StickerAt key={i} s={s} hw={hw} len={len} />
            ))}
          </G>
        );
      })}
    </>
  );
}

/** The hand: a skin-toned raster with the five painted nails (and their stickers) drawn over it. */
function HandSvg({
  design,
  tone,
  width,
  logicalWidth = width,
  label,
}: {
  design: NailDesign;
  tone: ToneId;
  /** Size to draw at. */
  width: number;
  /** Size the hand is shown at (line weight follows this; `width` may be drawn larger and scaled down). */
  logicalWidth?: number;
  label: string;
}) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const height = (VB[3] * width) / VB[2];
  const { line, sw } = ink(tone, logicalWidth);

  return (
    <Svg width={width} height={height} viewBox={nails.viewBox} accessibilityLabel={label}>
      <SvgImage href={HAND_IMAGES[tone] ?? HAND_IMAGES.t0} x={0} y={0} width={IMG.width} height={IMG.height} />
      <NailsLayer design={design} uid={uid} line={line} sw={sw} />
    </Svg>
  );
}

type Props = {
  design: NailDesign;
  tone: ToneId;
  width: number;
};

/**
 * The hand with its fingers curled so the nails face you, for display only (Home, My hands,
 * the share picture). Height follows the art's aspect ratio.
 */
export function NailHand({ design, tone, width }: Props) {
  const height = (VB[3] * width) / VB[2];
  return (
    <View style={{ width, height }}>
      <HandSvg design={design} tone={tone} width={width} label="A hand with painted nails" />
    </View>
  );
}

/* ------------------------------------------------------------ painting animations */

const SWEEP_MS = 420;
const GLINT_AT = 200;
const GLINT_MS = 250;
const POP_MS = 280;
const UNPOP_MS = 220;
const GHOST_MS = 250;
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Milliseconds since mount, every frame, until `ms` (then `onDone`). Only the caller re-renders. */
function useElapsed(ms: number, onDone: () => void): number {
  const [t, setT] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const e = Date.now() - t0;
      if (e >= ms) {
        done.current();
        return;
      }
      setT(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms]);
  return t;
}

type Fx = {
  id: number;
  dg: Digit;
  kind: 'paint' | 'pop' | 'unpop';
  /** The nail as it ends up. */
  to: NailLook;
  /** The sticker that pops on / off. */
  sticker?: StickerPos;
  /** A wet-sheen glint after a new colour. */
  glint?: boolean;
};

/** iOS bitmaps SVGs, so the overlay is drawn bigger and scaled back to stay sharp at the zoom. */
const OVERLAY_SS = Platform.OS === 'ios' ? 2.7 : 1;

/**
 * What the child just did to one nail, drawn over the hand while it plays: a new colour or
 * pattern sweeping up from the cuticle (then a glint), a sticker popping on, or one popping off.
 * It sits in the nail's own frame in a small SVG of its own, so the rest of the hand never redraws.
 */
function FxLayer({
  fx,
  shape,
  uid,
  line,
  sw,
  scale,
  onDone,
}: {
  fx: Fx;
  shape: string;
  uid: string;
  line: string;
  sw: number;
  scale: number;
  onDone: (id: number) => void;
}) {
  const ms = fx.kind === 'paint' ? (fx.glint ? GLINT_AT + GLINT_MS : SWEEP_MS) : fx.kind === 'pop' ? POP_MS : UNPOP_MS;
  const t = useElapsed(ms, () => onDone(fx.id));
  const p = PLACES[fx.dg];
  const d = nailPath(shape, fx.dg);
  const { len, hw, bot } = nailMetrics(d);
  const k = 1 / closeK(d);
  const PAD = 36;
  const x0 = -(hw + PAD);
  const y0 = -(len + PAD);
  const w = 2 * (hw + PAD);
  const h = len + bot + 2 * PAD;
  const clipId = `${uid}s`;
  const nailClip = `${uid}n`;

  let art: React.ReactNode = null;
  if (fx.kind === 'paint') {
    const sweep = easeOut(Math.min(1, t / SWEEP_MS)) * (bot + len + PAD);
    const g = (t - GLINT_AT) / GLINT_MS;
    art = (
      <>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={x0} y={bot - sweep} width={w} height={sweep} />
          </ClipPath>
          <ClipPath id={nailClip}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <NailPaint uid={`${uid}p`} d={d} look={fx.to} line={line} strokeWidth={sw} unit={k} />
          {fx.to.stickers.map((s, i) => (
            <StickerAt key={i} s={s} hw={hw} len={len} />
          ))}
        </G>
        {fx.glint && g > 0 && g < 1 && (
          <G clipPath={`url(#${nailClip})`}>
            <G transform={`translate(0 ${bot + hw - g * (bot + len + 2 * hw)}) rotate(28)`}>
              <Rect
                x={-hw * 0.22}
                y={-hw * 3}
                width={hw * 0.44}
                height={hw * 6}
                fill="#FFFFFF"
                opacity={Math.sin(Math.PI * g) * 0.6}
              />
            </G>
          </G>
        )}
      </>
    );
  } else if (fx.sticker) {
    let s: number;
    let rot: number;
    let opacity = 1;
    if (fx.kind === 'pop') {
      const x = Math.min(1, t / POP_MS);
      s = x < 0.6 ? 1.15 * easeOut(x / 0.6) : 1.15 - 0.15 * easeOut((x - 0.6) / 0.4);
      rot = -25 * (1 - easeOut(x));
    } else {
      const x = Math.min(1, t / UNPOP_MS);
      s = x < 0.3 ? 1 + 0.15 * (x / 0.3) : 1.15 * (1 - ((x - 0.3) / 0.7) ** 2);
      rot = 25 * x * x;
      opacity = 1 - x * x;
    }
    art = (
      <G opacity={opacity}>
        <StickerAt s={fx.sticker} hw={hw} len={len} scale={s} rotate={rot} />
      </G>
    );
  }

  const ox = (hw + PAD) * scale;
  const oy = (len + PAD) * scale;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: p.x * scale - ox,
        top: (p.y - VB[1]) * scale - oy,
        width: w * scale,
        height: h * scale,
        transformOrigin: `${ox}px ${oy}px`,
        transform: [{ rotate: `${p.rotate}deg` }],
      }}
    >
      <View
        style={{
          width: w * scale * OVERLAY_SS,
          height: h * scale * OVERLAY_SS,
          transformOrigin: 'left top',
          transform: [{ scale: 1 / OVERLAY_SS }],
        }}
      >
        <Svg width={w * scale * OVERLAY_SS} height={h * scale * OVERLAY_SS} viewBox={`${x0} ${y0} ${w} ${h}`}>
          {art}
        </Svg>
      </View>
    </View>
  );
}

/** The nails of the shape just left, fading out over the new shape. */
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
  const t = useElapsed(GHOST_MS, onDone);
  const height = (VB[3] * width) / VB[2];
  const { line, sw } = ink(tone, width);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height} viewBox={nails.viewBox}>
        <G opacity={1 - easeOut(Math.min(1, t / GHOST_MS))}>
          <NailsLayer design={design} uid={uid} line={line} sw={sw} />
        </G>
      </Svg>
    </View>
  );
}

const sameLook = (a: NailLook, b: NailLook) =>
  a.color === b.color && a.pattern === b.pattern && JSON.stringify(a.stickers) === JSON.stringify(b.stickers);

/* ------------------------------------------------------------------- zoom */

/** How far the camera flies in on a fingertip. */
export const ZOOM = 2.7;
const ZOOM_MS = 520;
const ZOOM_EASE = Easing.bezier(0.22, 0.8, 0.24, 1);
/**
 * iOS draws an SVG once into a bitmap, so scaling it up would blur it. Draw the hand this many
 * times larger and shrink it back, so the zoom lands on sharp pixels.
 */
const SUPERSAMPLE = Platform.OS === 'ios' ? 2 : 1;
/** Fingers further than this (px) between press and release are a swipe, not a tap. */
const TAP_SLOP = 12;

type ZoomProps = {
  design: NailDesign;
  tone: ToneId;
  width: number;
  /** The fingertip the camera is on, or null for the whole hand. */
  zoom: Digit | null;
  /** A touch (or a screen reader's tap) on a nail. */
  onNailPress: (d: Digit) => void;
  /** A touch on the hand that is not on a nail. */
  onOffPress?: () => void;
  /**
   * A touch on the zoomed nail itself (or just off its plate, moved onto it), as a spot in that
   * nail's local units; see `newSticker` and `stickerAt`.
   */
  onNailTap?: (spot: { x: number; y: number }) => void;
};

/** A point in hand (viewBox) coordinates, in a nail's local frame. */
function toNailLocal(digit: Digit, vx: number, vy: number) {
  const p = PLACES[digit];
  const a = (p.rotate * Math.PI) / 180;
  const dx = vx - p.x;
  const dy = vy - p.y;
  return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a) };
}

/**
 * The hand with a camera: `zoom` slides the chosen nail's middle to the middle of the hand box,
 * scaled by ZOOM, over 520ms. The whole thing is one transform on the container (on the UI
 * thread), so the nails, stickers and patterns inside scale with it. Nothing rotates.
 *
 * It also plays what the child just changed (a sweep of new polish, a sticker popping on or off,
 * a shape cross-fade); nails that were already painted never animate again.
 */
export function ZoomHand({ design, tone, width, zoom, onNailPress, onOffPress, onNailTap }: ZoomProps) {
  const scale = width / VB[2];
  const height = VB[3] * scale;
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const { line, sw } = ink(tone, width);

  // What the hand draws (`base`) lags the design for a moment while an animation plays on top.
  const [base, setBase] = useState(design);
  const [fxs, setFxs] = useState<Fx[]>([]);
  const [ghost, setGhost] = useState<{ id: number; design: NailDesign } | null>(null);
  const fxRef = useRef(fxs);
  useEffect(() => {
    fxRef.current = fxs;
  });
  const latest = useRef(design);
  const seq = useRef(0);
  useEffect(() => {
    const old = latest.current;
    latest.current = design;
    if (old === design) return;
    if (old.shape !== design.shape) {
      setBase(design);
      setFxs([]);
      setGhost({ id: ++seq.current, design: old });
      return;
    }
    const changed = DIGITS.filter((dg) => !sameLook(old.nails[dg], design.nails[dg]));
    if (!changed.length) return;
    const instant = () => {
      setBase(design);
      setFxs([]);
    };
    if (changed.length > 1) return instant(); // Start again: no show
    const dg = changed[0];
    const a = old.nails[dg];
    const b = design.nails[dg];
    let fx: Fx | null = null;
    let baseLook = b;
    if (a.color !== b.color || a.pattern !== b.pattern) {
      fx = { id: ++seq.current, dg, kind: 'paint', to: b, glint: a.color !== b.color };
      baseLook = a;
    } else if (b.stickers.length < a.stickers.length) {
      let i = a.stickers.findIndex((s, j) => !b.stickers[j] || JSON.stringify(s) !== JSON.stringify(b.stickers[j]));
      if (i < 0) i = a.stickers.length - 1;
      fx = { id: ++seq.current, dg, kind: 'unpop', to: b, sticker: a.stickers[i] };
    } else if (b.stickers.length) {
      const last = b.stickers[b.stickers.length - 1];
      fx = { id: ++seq.current, dg, kind: 'pop', to: b, sticker: last };
      baseLook = { ...b, stickers: b.stickers.slice(0, -1) };
    }
    if (!fx) return instant();
    const running = new Set(fxRef.current.map((f) => f.dg));
    const next = fx;
    setBase((cur) => ({
      ...design,
      nails: Object.fromEntries(
        DIGITS.map((k) => [k, k === dg ? baseLook : running.has(k) ? cur.nails[k] : design.nails[k]]),
      ) as Record<Digit, NailLook>,
    }));
    setFxs((list) => [...list.filter((f) => f.dg !== dg), next]);
  }, [design]);

  const fxDone = useCallback((id: number) => {
    const f = fxRef.current.find((x) => x.id === id);
    if (!f) return;
    setFxs((list) => list.filter((x) => x.id !== id));
    setBase((cur) => ({ ...cur, shape: latest.current.shape, nails: { ...cur.nails, [f.dg]: latest.current.nails[f.dg] } }));
  }, []);

  // Camera target: move the nail's centre (box pixels) to the box centre, then scale about it.
  let tx = 0;
  let ty = 0;
  let sc = 1;
  if (zoom) {
    const c = nailCentre(zoom, design.shape);
    sc = ZOOM;
    tx = -ZOOM * (c.x * scale - width / 2);
    ty = -ZOOM * ((c.y - VB[1]) * scale - height / 2);
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

  return (
    <Animated.View style={[{ width, height }, camera]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: width * SUPERSAMPLE,
          height: height * SUPERSAMPLE,
          transformOrigin: 'left top',
          transform: [{ scale: 1 / SUPERSAMPLE }],
        }}
      >
        <HandSvg
          design={base}
          tone={tone}
          width={width * SUPERSAMPLE}
          logicalWidth={width}
          label={zoom ? `Close up of the ${FINGER_NAMES[zoom].toLowerCase()} nail` : 'A hand with painted nails. Tap a nail to look closer.'}
        />
      </View>
      {fxs.map((f) => (
        <FxLayer
          key={f.id}
          fx={f}
          shape={design.shape}
          uid={`${uid}f${f.id}`}
          line={line}
          sw={sw}
          scale={scale}
          onDone={fxDone}
        />
      ))}
      {ghost && (
        <GhostLayer
          key={ghost.id}
          design={ghost.design}
          tone={tone}
          width={width}
          uid={`${uid}g${ghost.id}`}
          onDone={() => setGhost(null)}
        />
      )}
      {/* Screen readers: one invisible button per nail (the touch layer above them is skipped). */}
      {DIGITS.map((dg) => {
        const c = nailCentre(dg, design.shape);
        return (
          <Pressable
            key={dg}
            onPress={() => (dg === zoom ? onNailTap?.(nailFrame(dg, design.shape).centre) : onNailPress(dg))}
            accessibilityRole="button"
            accessibilityLabel={`${FINGER_NAMES[dg]} nail`}
            accessibilityState={{ selected: zoom === dg }}
            style={{
              position: 'absolute',
              width: 44,
              height: 44,
              left: c.x * scale - 22,
              top: (c.y - VB[1]) * scale - 22,
            }}
          />
        );
      })}
      {/* Sighted touch: one layer over the whole hand picks the NEAREST nail tip. */}
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
          const vx = e.nativeEvent.locationX / k;
          const vy = e.nativeEvent.locationY / k + VB[1];
          if (zoom) {
            // On (or just off) the zoomed nail: that is a touch on the nail. Otherwise a
            // neighbouring nail glides in; nothing near any nail zooms out.
            const lo = toNailLocal(zoom, vx, vy);
            const spot = spotOnNail(zoom, design.shape, lo.x, lo.y);
            if (spot) {
              onNailTap?.(spot);
              return;
            }
            const dg = nearestNail(vx, vy);
            if (dg && dg !== zoom) onNailPress(dg);
            else if (!dg) onOffPress?.();
            return;
          }
          const dg = nearestNail(vx, vy);
          if (dg) onNailPress(dg);
          else onOffPress?.();
        }}
      />
    </Animated.View>
  );
}

/* ------------------------------------------------------------- small drawings */

/** A nail shape as a button icon (so a child who can't read picks by shape), filled with `fill`. */
export function ShapeIcon({ shape, fill }: { shape: string; fill: string }) {
  const d = nailPath(shape, 'middle');
  const s = 5.5 / nailMetrics(nailPath('natural', 'middle')).hw;
  return (
    <Svg width={17} height={36} viewBox="-7.5 -26.5 15 31">
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
export function PatternIcon({ pattern, color }: { pattern: NailLook['pattern']; color: string }) {
  const uid = 'ico' + useId().replace(/[^A-Za-z0-9]/g, '');
  return (
    <Svg width={18} height={30} viewBox="-7.5 -21 15 26">
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
