import React, { useId, useMemo } from 'react';
import { Image, View } from 'react-native';
import Svg, { G, SvgXml } from 'react-native-svg';

import openNails from '../art/openNails.json';
import { DIGITS, type Digit, type HennaDesign, type NailDesign } from '../state/store';
import { TONES, type ToneId } from '../theme';
import { IMG_H, PARTS, VB_H, VB_W, overlayXml, splitLayers, type HennaStage, type PartId } from '../lib/henna';
import { CLOSE_ORIGIN, NailPaint, StickerGlyph, closeK, nailMetrics, nailPath } from './NailHand';

export type { HennaStage };

export const HAND_IMAGES: Record<ToneId, number> = {
  t0: require('../../assets/hands/open-hand-t0.png'),
  t1: require('../../assets/hands/open-hand-t1.png'),
  t2: require('../../assets/hands/open-hand-t2.png'),
  t3: require('../../assets/hands/open-hand-t3.png'),
  t4: require('../../assets/hands/open-hand-t4.png'),
  t5: require('../../assets/hands/open-hand-t5.png'),
  t6: require('../../assets/hands/open-hand-t6.png'),
};

/** The tinted hand raster, cropped to the henna viewBox (1024 x 1504 of a 1024 x 1536 image). */
export function HandRaster({ tone, width }: { tone: ToneId; width: number }) {
  const k = width / VB_W;
  return (
    <Image
      source={HAND_IMAGES[tone]}
      resizeMode="stretch"
      style={{ position: 'absolute', left: 0, top: 0, width, height: IMG_H * k }}
      accessibilityIgnoresInvertColors
    />
  );
}

/* ------------------------------------------------------------------ nails on the open hand */

type Place = { x: number; y: number; rotate: number; w: number };
const PLACES = openNails.digits as Record<Digit, Place>;
const SHAPES = openNails.shapes as Record<string, Record<Digit, string>>;
/** How far the longest shapes reach above the raster's top edge (middle finger, stiletto). */
const NAIL_HEAD = 60;

type Placed = { kind: string; x: number; y: number; frame?: 'nail' };

/**
 * Where a sticker sits on a nail, in the nail's local units (cuticle at the origin, tip toward -y).
 * Local adapter with the signature of the nail chair's `stickerLocal(sticker, halfWidth,
 * nailLength)`; switch to that import once it ships. New stickers (`frame: 'nail'`) are stored
 * relative to the nail's half-width; older ones are close-up canvas coordinates, mapped by the chair
 * nail's size (`chair`) onto this nail.
 */
function stickerLocal(
  s: Placed,
  hw: number,
  len: number,
  chair: { hw: number; len: number; c: number },
): { x: number; y: number; scale: number } {
  if (s.frame === 'nail') return { x: s.x * hw, y: s.y * hw, scale: 0.0307 * hw };
  const rx = hw / chair.hw;
  return {
    x: (s.x - CLOSE_ORIGIN.x) * chair.c * rx,
    y: (s.y - CLOSE_ORIGIN.y) * chair.c * (len / chair.len),
    scale: 1.35 * chair.c * 1.25 * rx,
  };
}

const openPath = (shape: string, digit: Digit): string => (SHAPES[shape] ?? SHAPES.almond)[digit];

/**
 * The child's polished nails (colour, pattern, French tip, stickers) over the open hand, in its
 * own nail outlines. Stickers sit at the nail chair's spots, scaled to each nail's size on the
 * chair; long shapes may reach above the hand, so the layer is taller than the hand and sits
 * above it (negative top) without changing the hand's footprint.
 */
function HennaNails({ design, tone, width }: { design: NailDesign; tone: ToneId; width: number }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
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
          const d = openPath(design.shape, dg);
          const look = design.nails[dg];
          const chairD = nailPath(design.shape, dg);
          const chair = nailMetrics(chairD);
          const open = nailMetrics(d);
          // chair nail -> this nail, for the pattern tiles
          const rx = open.hw / chair.hw;
          const c = 1 / closeK(chairD);
          return (
            <G key={dg} transform={`translate(${p.x} ${p.y}) rotate(${p.rotate})`}>
              <NailPaint uid={`${uid}${dg}`} d={d} look={look} line={line} strokeWidth={sw} unit={c * rx} />
              {look.stickers.map((s, i) => {
                const at = stickerLocal(s, open.hw, open.len, { hw: chair.hw, len: chair.len, c });
                return (
                  <G key={i} transform={`translate(${at.x} ${at.y}) scale(${at.scale})`}>
                    <StickerGlyph kind={s.kind} />
                  </G>
                );
              })}
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
  width: number;
  stage: HennaStage;
  /** The polish the child painted on the nail chair; drawn over the hand's own nails. */
  nails?: NailDesign;
};

/**
 * The hand with its henna. A 'stencil' design inks its `parts` at `stage` and shows the rest as
 * ghost guides; a 'studio' design draws every stroke and stamp (both layers) at `stage`, clipped
 * to the hand.
 */
export function HennaHand({ design, tone, width, stage, nails }: Props) {
  const height = (VB_H * width) / VB_W;
  const parts = design.parts;
  const strokes = design.strokes;
  const stamps = design.stamps;
  const xml = useMemo(() => {
    if (design.source === 'studio') {
      return overlayXml({ tone, stage, layers: splitLayers({ source: 'studio', strokes, stamps }) });
    }
    const inked = (parts ?? []) as PartId[];
    return overlayXml({
      tone,
      stage,
      parts: inked,
      guides: PARTS.map((p) => p.id).filter((id) => !inked.includes(id)),
    });
  }, [design.source, parts, strokes, stamps, tone, stage]);

  return (
    <View style={{ width, height, overflow: nails ? 'visible' : 'hidden' }}>
      <View style={{ width, height, overflow: 'hidden' }}>
        <HandRaster tone={tone} width={width} />
        <SvgXml xml={xml} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} />
      </View>
      {nails ? <HennaNails design={nails} tone={tone} width={width} /> : null}
    </View>
  );
}
