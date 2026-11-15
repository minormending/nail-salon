import React, { useId } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
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

type Metrics = { len: number; hw: number };

/** Close-up scale for one nail: CLOSE_K, eased down so a long shape still fits under the title. */
export function closeK(d: string): number {
  return Math.min(CLOSE_K, 232 / nailMetrics(d).len);
}
const metricsCache = new Map<string, Metrics>();

/** Length (cuticle to tip) and half-width of a nail path in its local frame. */
export function nailMetrics(d: string): Metrics {
  const hit = metricsCache.get(d);
  if (hit) return hit;
  let minY = 0;
  let hw = 0;
  let cx = 0;
  let cy = 0;
  const take = (x: number, y: number) => {
    if (y < minY) minY = y;
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
  const out = { len: -minY, hw };
  metricsCache.set(d, out);
  return out;
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
          d="M 3 -13 A 13 13 0 1 0 3 13 A 10 10 0 1 1 3 -13 Z"
          fill={colors.cream}
          stroke={INK}
          strokeWidth={2.2}
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
function nailCentre(digit: Digit, shape: string) {
  const p = PLACES[digit];
  const { len } = nailMetrics(nailPath(shape, digit));
  const a = (p.rotate * Math.PI) / 180;
  const ly = -len * 0.5;
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

type Props = {
  design: NailDesign;
  tone: ToneId;
  width: number;
  onNailPress?: (d: Digit) => void;
  selected?: Digit;
};

/**
 * The hand with its fingers curled so the nails face you: a skin-toned raster with the five
 * painted nails drawn over it. Height follows the art's aspect ratio.
 */
export function NailHand({ design, tone, width, onNailPress, selected }: Props) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const scale = width / VB[2];
  const height = VB[3] * scale;
  const toneInfo = TONES.find((t) => t.id === tone) ?? TONES[0];
  const line = toneInfo.line;
  // About 1.5pt on screen at the canvas size (262pt wide), never thinner than the art's own.
  const sw = Math.max(nails.line.width, (1.5 * VB[2]) / width);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={nails.viewBox} accessibilityLabel="A hand with painted nails">
        <SvgImage href={HAND_IMAGES[tone] ?? HAND_IMAGES.t0} x={0} y={0} width={IMG.width} height={IMG.height} />
        {DIGITS.map((dg) => {
          const p = PLACES[dg];
          const d = nailPath(design.shape, dg);
          const look = design.nails[dg];
          const k = 1 / closeK(d);
          return (
            <G key={dg} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`}>
              {selected === dg && (
                <>
                  <Path d={d} fill="none" stroke={colors.magentaBright} strokeOpacity={0.35} strokeWidth={40} strokeLinejoin="round" />
                  <Path d={d} fill="none" stroke={colors.magentaBright} strokeOpacity={0.7} strokeWidth={18} strokeLinejoin="round" />
                </>
              )}
              <NailPaint uid={`${uid}${dg}`} d={d} look={look} line={line} strokeWidth={sw} unit={k} />
              {look.stickers.map((s, i) => (
                <G
                  key={i}
                  transform={`translate(${(s.x - CLOSE_ORIGIN.x) * k} ${(s.y - CLOSE_ORIGIN.y) * k}) scale(${1.35 * k * 1.25})`}
                >
                  <StickerGlyph kind={s.kind} />
                </G>
              ))}
            </G>
          );
        })}
      </Svg>
      {onNailPress && (
        <>
          {/* Screen readers: one invisible button per nail (the touch layer above them is skipped). */}
          {DIGITS.map((dg) => {
            const c = nailCentre(dg, design.shape);
            return (
              <Pressable
                key={dg}
                onPress={() => onNailPress(dg)}
                accessibilityRole="button"
                accessibilityLabel={`${FINGER_NAMES[dg]} nail`}
                accessibilityState={{ selected: selected === dg }}
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
            onResponderRelease={(e: GestureResponderEvent) => {
              const dg = nearestNail(e.nativeEvent.locationX / scale, e.nativeEvent.locationY / scale + VB[1]);
              if (dg) onNailPress(dg);
            }}
          />
        </>
      )}
    </View>
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
