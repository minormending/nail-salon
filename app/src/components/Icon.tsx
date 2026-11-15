import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Stroke icons ported from the canvas SVGs (24x24 viewBox, currentColor -> `color`).
type Shape =
  | { t: 'path'; d: string; fill?: 'color' }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: 'color' };

type Def = { sw: number; shapes: Shape[]; viewBox?: string; round?: boolean; solid?: boolean };

const p = (d: string): Shape => ({ t: 'path', d });
const r = (x: number, y: number, w: number, h: number, rx?: number): Shape => ({ t: 'rect', x, y, w, h, rx });

const DEFS = {
  grid: {
    sw: 2.4,
    round: false,
    shapes: [r(3.5, 3.5, 7, 7, 1.5), r(13.5, 3.5, 7, 7, 1.5), r(3.5, 13.5, 7, 7, 1.5), r(13.5, 13.5, 7, 7, 1.5)],
  },
  lock: { sw: 2.4, shapes: [r(4.5, 10.5, 15, 10, 2), p('M8 10.5 V7.5 a4 4 0 0 1 8 0 v3')] },
  unlock: { sw: 2.4, shapes: [r(4.5, 10.5, 15, 10, 2), p('M8 10.5 V7.5 a4 4 0 0 1 7.6 -1.7')] },
  back: { sw: 2.6, shapes: [p('M15 5 L8 12 L15 19')] },
  forward: { sw: 2.6, shapes: [p('M9 5 L16 12 L9 19')] },
  hand: {
    sw: 2.1,
    shapes: [
      p(
        'M8 13 V6.5 a1.5 1.5 0 0 1 3 0 V12 M11 11.5 V4.5 a1.5 1.5 0 0 1 3 0 V11.5 M14 11.5 V5.5 a1.5 1.5 0 0 1 3 0 V13 M17 9.5 a1.5 1.5 0 0 1 3 0 V15 a6 6 0 0 1 -6 6 h-1.5 a6 6 0 0 1 -5 -2.7 L4.2 14.6 a1.5 1.5 0 0 1 2.4 -1.8 L8 14.5',
      ),
    ],
  },
  // polish bottle (cap, neck, body)
  polish: {
    sw: 2.2,
    round: false,
    shapes: [r(9.5, 2.5, 5, 5, 1), r(8, 7.5, 8, 2.5, 1), r(6, 10, 12, 11.5, 3)],
  },
  // the Nails tab icon in the canvas is the same bottle outline
  nails: {
    sw: 2.2,
    round: false,
    shapes: [r(9.5, 2.5, 5, 5, 1), r(8, 7.5, 8, 2.5, 1), r(6, 10, 12, 11.5, 3)],
  },
  star: {
    sw: 2.2,
    round: false,
    shapes: [p('M12 3 L14.6 8.6 L20.6 9.3 L16.1 13.4 L17.3 19.4 L12 16.4 L6.7 19.4 L7.9 13.4 L3.4 9.3 L9.4 8.6 Z')],
  },
  // the Henna tab icon: a vine
  henna: {
    sw: 2.2,
    shapes: [
      p('M12 21.5 V6'),
      p('M12 16 C8.5 15.5 6.5 13 6 10 C9 10.2 11.3 12 12 14.5'),
      p('M12 16 C15.5 15.5 17.5 13 18 10 C15 10.2 12.7 12 12 14.5'),
      p('M12 10 C9.5 9.5 8.5 7.5 8.5 5 C10.5 5.5 11.8 7 12 9'),
      p('M12 10 C14.5 9.5 15.5 7.5 15.5 5 C13.5 5.5 12.2 7 12 9'),
    ],
  },
  cone: { sw: 2.3, shapes: [p('M14.5 3.5 L20.5 9.5 L9 21 L3 21 L3 15 Z M12 6 L18 12')] },
  sparkle: {
    sw: 2.3,
    round: false,
    shapes: [
      { t: 'circle', cx: 12, cy: 12, r: 3 },
      p('M12 3 v3 M12 18 v3 M3 12 h3 M18 12 h3 M5.6 5.6 l2.1 2.1 M16.3 16.3 l2.1 2.1 M5.6 18.4 l2.1 -2.1 M16.3 7.7 l2.1 -2.1'),
    ],
  },
  check: { sw: 3.4, shapes: [p('M5 12.5 L10 17.5 L19 7')] },
  undo: { sw: 2.4, shapes: [p('M4 11 h11 a4.5 4.5 0 1 1 0 9 h-2.5'), p('M4 11 l4.5-4.5'), p('M4 11 l4.5 4.5')] },
  redo: { sw: 2.4, shapes: [p('M20 11 H9 a4.5 4.5 0 1 0 0 9 h2.5'), p('M20 11 l-4.5-4.5'), p('M20 11 l-4.5 4.5')] },
  layers: { sw: 2.4, round: false, shapes: [p('M12 3 L21 8 L12 13 L3 8 Z'), p('M3 12.5 L12 17.5 L21 12.5'), p('M3 17 L12 22 L21 17')] },
  mirror: { sw: 2.3, shapes: [p('M12 3 V21 M9 7 L3 17 H9 Z M15 7 L21 17 H15 Z')] },
  stamp: { sw: 2.3, shapes: [p('M9 3 H15 V9 H13 V12 H19 V16 H5 V12 H11 V9 H9 Z M5 20 H19')] },
  jaali: { sw: 2.3, shapes: [p('M12 3 L21 12 L12 21 L3 12 Z M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5')] },
  wipe: { sw: 2.3, shapes: [p('M8 20 H20 M4.5 15.5 L13 7 L18 12 L11.5 18.5 H7.5 Z M9 11 L14 16')] },
  // nib sizes: three filled dots, 30x20 viewBox
  nib: {
    sw: 0,
    solid: true,
    viewBox: '0 0 30 20',
    shapes: [
      { t: 'circle', cx: 4, cy: 10, r: 2, fill: 'color' },
      { t: 'circle', cx: 12.5, cy: 10, r: 3.6, fill: 'color' },
      { t: 'circle', cx: 24, cy: 10, r: 5.6, fill: 'color' },
    ],
  },
  camera: { sw: 2.4, shapes: [p('M4 8.5 h3.2 L9 6.5 h6 l1.8 2 H20 v11 H4 Z'), { t: 'circle', cx: 12, cy: 14, r: 3.4 }] },
  // save a picture (tray with down arrow)
  save: { sw: 2.5, shapes: [p('M12 4 V15 M7.5 10.5 L12 15 L16.5 10.5'), p('M4.5 16.5 V19.5 H19.5 V16.5')] },
  // send / share (tray with up arrow)
  share: { sw: 2.5, shapes: [p('M12 15 V4 M7.5 8.5 L12 4 L16.5 8.5'), p('M4.5 16.5 V19.5 H19.5 V16.5')] },
  bell: { sw: 2.3, shapes: [p('M6 16 V11 a6 6 0 0 1 12 0 v5 l1.5 2 H4.5 Z'), p('M10 20.5 a2 2 0 0 0 4 0')] },
  plus: { sw: 2.8, shapes: [p('M12 5 V19 M5 12 H19')] },
  close: { sw: 2.8, shapes: [p('M6 6 L18 18 M18 6 L6 18')] },
  // hourglass: "Let it dry"
  hourglass: {
    sw: 2.3,
    shapes: [
      p('M6.5 3 H17.5 M6.5 21 H17.5'),
      p('M8 3 C8 8 12 9 12 12 C12 15 8 16 8 21 M16 3 C16 8 12 9 12 12 C12 15 16 16 16 21'),
      { t: 'path', d: 'M10 18.5 L12 16.8 L14 18.5 Z', fill: 'color' },
    ],
  },
} satisfies Record<string, Def>;

export type IconName = keyof typeof DEFS;
export const ICON_NAMES = Object.keys(DEFS) as IconName[];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Overrides the icon's own stroke width (24-unit viewBox). */
  strokeWidth?: number;
  /** Fill for closed shapes (e.g. a star filled cream). */
  fill?: string;
};

export function Icon({ name, size = 22, color = '#40163C', strokeWidth, fill }: Props) {
  const def = DEFS[name] as Def;
  const sw = strokeWidth ?? def.sw;
  const w = def.viewBox ? (size * 30) / 20 : size;
  return (
    <Svg
      width={w}
      height={size}
      viewBox={def.viewBox ?? '0 0 24 24'}
      fill="none"
      stroke={def.solid ? 'none' : color}
      strokeWidth={sw}
      strokeLinecap={def.round === false ? undefined : 'round'}
      strokeLinejoin="round"
    >
      {def.shapes.map((s, i) => {
        if (s.t === 'path')
          return <Path key={i} d={s.d} fill={s.fill === 'color' ? color : fill ?? 'none'} />;
        if (s.t === 'rect')
          return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill ?? 'none'} />;
        return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill === 'color' ? color : 'none'} />;
      })}
    </Svg>
  );
}
