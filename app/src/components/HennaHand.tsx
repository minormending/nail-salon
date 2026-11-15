import React, { useMemo } from 'react';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { HennaDesign } from '../state/store';
import type { ToneId } from '../theme';
import { IMG_H, PARTS, VB_H, VB_W, overlayXml, splitLayers, type HennaStage, type PartId } from '../lib/henna';

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

type Props = { design: HennaDesign; tone: ToneId; width: number; stage: HennaStage };

/**
 * The hand with its henna. A 'stencil' design inks its `parts` at `stage` and shows the rest as
 * ghost guides; a 'studio' design draws every stroke and stamp (both layers) at `stage`, clipped
 * to the hand.
 */
export function HennaHand({ design, tone, width, stage }: Props) {
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
    <View style={{ width, height, overflow: 'hidden' }}>
      <HandRaster tone={tone} width={width} />
      <SvgXml xml={xml} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} />
    </View>
  );
}
