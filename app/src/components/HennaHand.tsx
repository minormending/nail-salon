import React, { useId, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { G, Polygon, SvgXml } from 'react-native-svg';

import openNails from '../art/openNails.json';
import { DIGITS, handNails, type Digit, type Hand, type HennaDesign, type NailDesign, type NailLook } from '../state/store';
import { TONES, type ToneId } from '../theme';
import {
  IMG_H,
  PAIR_OVERLAP,
  PAIR_PAD,
  PARTS,
  VB_H,
  VB_W,
  overlayXml,
  pairWidth,
  sectionList,
  splitHands,
  type HennaStage,
  type PartId,
} from '../lib/henna';
import { HandArt, NailPaint, NailStickers, closeK, nailMetrics, nailPath } from './NailHand';

export type { HennaStage };

/** The traced hand (skin and line art in the tone's colours), cropped to the henna viewBox (1024 x 1504 of 1024 x 1536). */
export function HandRaster({ tone, width }: { tone: ToneId; width: number }) {
  const k = width / VB_W;
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={IMG_H * k}
      viewBox={`0 0 ${VB_W} ${IMG_H}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <HandArt which="openHand" tone={tone} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ longer forearms */

/*
 * The raster's forearm edges below the knuckles are straight lines (fitted over y 1380-1503 of the
 * viewBox; the same for every tone): x = a + b*y. Its outline is about 7.5 units thick.
 */
const ARM_LEFT = { a: 351.22, b: -0.06649 };
const ARM_RIGHT = { a: 479.62, b: 0.08241 };
const ARM_LINE = 7.5;
/** The extension starts this far above the raster's cropped bottom (VB_H), overlapping it. */
const ARM_OVERLAP = 16;

/**
 * Carries both forearm outlines straight down for `length` more viewBox units below the raster's
 * bottom edge: a line-coloured arm with a skin-coloured inside, laid over the raster's last rows so
 * the join does not show.
 */
function ArmExtension({ tone, width, length }: { tone: ToneId; width: number; length: number }) {
  const k = width / VB_W;
  const t = TONES.find((x) => x.id === tone) ?? TONES[0];
  const y0 = VB_H - ARM_OVERLAP;
  const y1 = VB_H + length;
  const l = (y: number) => ARM_LEFT.a + ARM_LEFT.b * y - 0.5;
  const r = (y: number) => ARM_RIGHT.a + ARM_RIGHT.b * y + 0.5;
  const quad = (xa: (y: number) => number, xb: (y: number) => number) =>
    `${xa(y0)},${y0} ${xb(y0)},${y0} ${xb(y1)},${y1} ${xa(y1)},${y1}`;
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={(y1 - y0) * k}
      viewBox={`0 ${y0} ${VB_W} ${y1 - y0}`}
      style={{ position: 'absolute', left: 0, top: y0 * k }}
    >
      {/* skin first, then the two outline bands on top: no line colour bleeds through the top edge */}
      <Polygon points={quad(l, r)} fill={t.skin} />
      <Polygon points={quad(l, (y) => l(y) + ARM_LINE)} fill={t.line} />
      <Polygon points={quad((y) => r(y) - ARM_LINE, r)} fill={t.line} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ nails on the open hand */

type Place = { x: number; y: number; rotate: number; w: number };
const PLACES = openNails.digits as Record<Digit, Place>;
const SHAPES = openNails.shapes as Record<string, Record<Digit, string>>;
/** How far the longest shapes reach above the raster's top edge (middle finger, stiletto). */
const NAIL_HEAD = 60;

const openPath = (shape: string, digit: Digit): string => (SHAPES[shape] ?? SHAPES.almond)[digit];

/**
 * One hand's polished nails (colour, pattern, French tip, stickers) over the open hand, in its
 * own nail outlines. Stickers sit where they were put on the nail chair (`stickerLocal`), scaled
 * to each nail's size; long shapes may reach above the hand, so the layer is taller than the hand
 * and sits above it (negative top) without changing the hand's footprint.
 */
function HennaNails({
  shape,
  looks,
  tone,
  width,
  hand,
}: {
  shape: string;
  looks: Record<Digit, NailLook>;
  tone: ToneId;
  width: number;
  hand: Hand;
}) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '') + hand;
  const k = width / VB_W;
  const line = (TONES.find((t) => t.id === tone) ?? TONES[0]).line;
  const sw = openNails.line.width;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: -NAIL_HEAD * k, width, height: (VB_H + NAIL_HEAD) * k }}
    >
      <Svg
        width={width}
        height={(VB_H + NAIL_HEAD) * k}
        viewBox={`0 ${-NAIL_HEAD} ${VB_W} ${VB_H + NAIL_HEAD}`}
        style={{ overflow: 'visible' }}
      >
        {DIGITS.map((dg) => {
          const p = PLACES[dg];
          const look = looks[dg];
          // Each nail in its own shape (or the design's).
          const nailShape = look.shape ?? shape;
          const d = openPath(nailShape, dg);
          const chairD = nailPath(nailShape, dg);
          const chair = nailMetrics(chairD);
          const open = nailMetrics(d);
          // chair nail -> this nail, for the pattern tiles
          const rx = open.hw / chair.hw;
          const c = 1 / closeK(chairD);
          return (
            <G key={dg} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`}>
              <NailPaint uid={`${uid}${dg}`} d={d} look={look} line={line} strokeWidth={sw} unit={c * rx} />
              <NailStickers uid={`${uid}${dg}`} d={d} stickers={look.stickers} hw={open.hw} len={open.len} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

type Props = {
  design: HennaDesign;
  tone: ToneId;
  /** The width of ONE hand; a pair's box is `pairWidth(width)` wide (the hands' empty margins overlap). */
  width: number;
  stage: HennaStage;
  /** The polish the child painted on the nail chair; drawn over each hand's own nails. */
  nails?: NailDesign;
  /** 'both' (default) the left and right hand; 'left' just the left hand. */
  hands?: 'both' | 'left';
  /** Drawn over each hand in that hand's own frame (mirrored with the right hand), e.g. an ink sweep. */
  overlay?: ReactNode;
  /** Lengthens the forearms by this many viewBox units below the raster's bottom (0: as drawn). */
  armExtend?: number;
  /** Drawn on each hand between the skin and the henna (e.g. a highlight behind the chosen section). */
  under?: ReactNode;
  /**
   * A stencil with sections: draw the sections still to ink as dashed guides (the Salon). Off, only
   * the inked sections show (a saved henna). Stencils with the old `parts` always show their guides.
   */
  guides?: boolean;
};

/** One hand: the raster, its henna overlay and (if given) its nails. */
function OneHand({
  hand,
  xml,
  tone,
  width,
  nails,
  overlay,
  armExtend = 0,
  under,
}: {
  hand: Hand;
  xml: string;
  tone: ToneId;
  width: number;
  nails?: NailDesign;
  overlay?: ReactNode;
  armExtend?: number;
  under?: ReactNode;
}) {
  const height = (VB_H * width) / VB_W;
  return (
    <View style={{ width, height, overflow: nails || armExtend > 0 ? 'visible' : 'hidden' }}>
      <View style={{ width, height, overflow: 'hidden' }}>
        <HandRaster tone={tone} width={width} />
        {under}
        <SvgXml xml={xml} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} />
        {overlay}
      </View>
      {armExtend > 0 ? <ArmExtension tone={tone} width={width} length={armExtend} /> : null}
      {nails ? (
        <HennaNails shape={nails.shape} looks={handNails(nails, hand)} tone={tone} width={width} hand={hand} />
      ) : null}
    </View>
  );
}

/**
 * The hands with their henna. A 'stencil' design inks its `parts` at `stage` on both hands and
 * shows the rest as ghost guides; a 'studio' design draws every stroke and stamp (both layers)
 * on the hand it was made on, clipped to the hand. The right hand is the left hand mirrored, so
 * a mark keeps its own-hand coordinates there and the nails too.
 */
export function HennaHand({ design, tone, width, stage, nails, hands = 'both', overlay, armExtend, under, guides = false }: Props) {
  const height = (VB_H * width) / VB_W;
  const both = hands === 'both';
  const parts = design.parts;
  const sections = design.sections;
  const strokes = design.strokes;
  const stamps = design.stamps;
  const xml = useMemo(() => {
    if (design.source === 'studio') {
      const marks = splitHands({ source: 'studio', strokes, stamps });
      return {
        left: overlayXml({ tone, stage, layers: marks.left }),
        right: overlayXml({ tone, stage, layers: marks.right }),
      };
    }
    if (sections) {
      const one = overlayXml({ tone, stage, sections: sectionList(sections, !guides) });
      return { left: one, right: one };
    }
    const inked = (parts ?? []) as PartId[];
    const one = overlayXml({
      tone,
      stage,
      parts: inked,
      guides: PARTS.map((p) => p.id).filter((id) => !inked.includes(id)),
    });
    return { left: one, right: one };
  }, [design.source, parts, sections, guides, strokes, stamps, tone, stage]);

  if (!both) {
    return (
      <View style={{ width, height }}>
        <OneHand hand="left" xml={xml.left} tone={tone} width={width} nails={nails} overlay={overlay} armExtend={armExtend} under={under} />
      </View>
    );
  }
  const pad = PAIR_PAD * width;
  return (
    <View style={{ width: pairWidth(width), height }}>
      <View style={{ position: 'absolute', left: -pad, top: 0, width, height }}>
        <OneHand hand="left" xml={xml.left} tone={tone} width={width} nails={nails} overlay={overlay} armExtend={armExtend} under={under} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: (1 - PAIR_OVERLAP) * width - pad,
          top: 0,
          width,
          height,
          transform: [{ scaleX: -1 }],
        }}
      >
        <OneHand hand="right" xml={xml.right} tone={tone} width={width} nails={nails} overlay={overlay} armExtend={armExtend} under={under} />
      </View>
    </View>
  );
}
