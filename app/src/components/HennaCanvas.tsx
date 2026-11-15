import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { ClipPath, Circle, Defs, G, Path, Pattern, SvgXml } from 'react-native-svg';

import {
  JAALI_WIDTH,
  MIN_PRESSURE,
  NIB_WIDTH,
  VB_H,
  VB_W,
  hennaArtClip,
  overlayXml,
  stampHit,
  strokeHit,
  strokeLine,
  strokeOutline,
  toneById,
  type OverlayLayer,
  type StudioStroke,
} from '../lib/henna';
import type { Hand } from '../state/store';
import type { ToneId } from '../theme';
import { HandRaster } from './HennaHand';

export type StudioTool = 'cone' | 'stamp' | 'jaali' | 'wipe';
export type WipeHits = { strokes: number[]; stamps: number[] };

type Props = {
  width: number;
  tone: ToneId;
  /**
   * Which hand this is. The right hand is the left hand mirrored: marks are kept in the hand's
   * own coordinates, so on the right hand the screen's x is reflected going in and out.
   */
  hand: Hand;
  /** This hand's two layers, committed marks only. */
  layers: OverlayLayer[];
  activeLayer: 0 | 1;
  tool: StudioTool;
  nib: 1 | 2 | 3;
  /** The hand being drawn on. The other one waits: a tap on it calls `onFocus`. */
  active: boolean;
  onFocus: () => void;
  onStroke: (stroke: StudioStroke) => void;
  onStamp: (x: number, y: number) => void;
  /** Indices (into the active layer's strokes / stamps) the finger rubbed out in one drag. */
  onWipe: (hits: WipeHits) => void;
};

/** A committed layer; re-parses only when its own marks (or the tone) change. */
const LayerSvg = memo(function LayerSvg({
  strokes,
  stamps,
  tone,
  width,
  height,
}: OverlayLayer & { tone: ToneId; width: number; height: number }) {
  const xml = useMemo(
    () => overlayXml({ tone, stage: 'paste', layers: [{ strokes, stamps }] }),
    [strokes, stamps, tone],
  );
  return <SvgXml xml={xml} width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} />;
});

type Live = { points: number[]; jaali: boolean } | null;
const LIVE_CLIP = 'liveHand';

/** The stroke being drawn right now: the only thing that re-renders on every move. */
const LiveSvg = memo(function LiveSvg({
  live,
  tone,
  width,
  height,
}: {
  live: Live;
  tone: ToneId;
  width: number;
  height: number;
}) {
  const t = toneById(tone);
  const fill = t.stain.paste;
  const edge = t.edge;
  const marks: { d: string; jaali: boolean }[] = [];
  if (live) {
    const mk = (pts: number[]) => ({
      d: live.jaali ? strokeLine(pts) : strokeOutline(pts),
      jaali: live.jaali,
    });
    marks.push(mk(live.points));
  }
  const line = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <ClipPath id={LIVE_CLIP}>
          <Path d={hennaArtClip} />
        </ClipPath>
        <Pattern id="jlLive" patternUnits="userSpaceOnUse" width={24} height={24}>
          <Path d="M 12 0 L 24 12 L 12 24 L 0 12 Z" fill="none" stroke={fill} strokeWidth={3.6} strokeLinejoin="round" />
          <Circle cx={12} cy={12} r={2.4} fill={fill} />
        </Pattern>
        {edge ? (
          <Pattern id="jlLiveEdge" patternUnits="userSpaceOnUse" width={24} height={24}>
            <Path d="M 12 0 L 24 12 L 12 24 L 0 12 Z" fill="none" stroke={edge} strokeWidth={8.6} strokeLinejoin="round" />
            <Circle cx={12} cy={12} r={4.9} fill={edge} />
          </Pattern>
        ) : null}
      </Defs>
      <G clipPath={`url(#${LIVE_CLIP})`}>
        {edge &&
          marks.map((m, i) =>
            m.jaali ? (
              <Path key={`e${i}`} d={m.d} fill="none" stroke="url(#jlLiveEdge)" strokeWidth={JAALI_WIDTH + 5} {...line} />
            ) : (
              <Path key={`e${i}`} d={m.d} fill={edge} stroke={edge} strokeWidth={5} strokeLinejoin="round" />
            ),
          )}
        {marks.map((m, i) =>
          m.jaali ? (
            <Path key={i} d={m.d} fill="none" stroke="url(#jlLive)" strokeWidth={JAALI_WIDTH} {...line} />
          ) : (
            <Path key={i} d={m.d} fill={fill} />
          ),
        )}
      </G>
    </Svg>
  );
});

// Speed (viewBox units per ms) at which the cone is at its thinnest.
const V_MAX = 4;

/**
 * The Studio drawing surface: the hand, both committed layers, the live stroke and the touch
 * handling for Cone / Stamp / Jaali / Wipe. Points are stored in viewBox units.
 */
export function HennaCanvas(props: Props) {
  const { width, tone, hand, layers, activeLayer, tool, active } = props;
  const height = (VB_H * width) / VB_W;
  const k = VB_W / width; // viewBox units per px

  const propsRef = useRef(props);
  propsRef.current = props;

  const [live, setLive] = useState<Live>(null);
  const [wiped, setWiped] = useState<WipeHits | null>(null);

  // Gesture working state (refs: no re-render per move).
  const pts = useRef<number[]>([]);
  const pressure = useRef(1);
  const lastT = useRef(0);
  const raf = useRef<number | null>(null);
  const wipe = useRef<{ strokes: Set<number>; stamps: Set<number> }>({ strokes: new Set(), stamps: new Set() });
  const last = useRef<{ x: number; y: number } | null>(null);
  const isJaali = useRef(false);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const flush = () => {
    raf.current = null;
    setLive({ points: pts.current.slice(), jaali: isJaali.current });
  };
  const scheduleFlush = () => {
    if (raf.current == null) raf.current = requestAnimationFrame(flush);
  };

  const pos = (e: GestureResponderEvent) => {
    const ne = e.nativeEvent;
    const x = ne.locationX * k;
    return { x: propsRef.current.hand === 'right' ? VB_W - x : x, y: ne.locationY * k, t: ne.timestamp || Date.now() };
  };

  const rub = (x: number, y: number) => {
    const p = propsRef.current;
    const layer = p.layers[p.activeLayer];
    let changed = false;
    // walk from the last touch to this one so a fast rub doesn't skip marks
    const from = last.current ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 15));
    for (let s = 1; s <= steps; s++) {
      const px = from.x + ((x - from.x) * s) / steps;
      const py = from.y + ((y - from.y) * s) / steps;
      layer.strokes.forEach((st, i) => {
        if (!wipe.current.strokes.has(i) && strokeHit(st, px, py, 14)) {
          wipe.current.strokes.add(i);
          changed = true;
        }
      });
      layer.stamps.forEach((st, i) => {
        if (!wipe.current.stamps.has(i) && stampHit(st, px, py, 8)) {
          wipe.current.stamps.add(i);
          changed = true;
        }
      });
    }
    last.current = { x, y };
    if (changed) setWiped({ strokes: [...wipe.current.strokes], stamps: [...wipe.current.stamps] });
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const p = propsRef.current;
          const { x, y, t } = pos(e);
          last.current = { x, y };
          lastT.current = t;
          if (p.tool === 'cone' || p.tool === 'jaali') {
            isJaali.current = p.tool === 'jaali';
            pressure.current = 1;
            const w = isJaali.current ? JAALI_WIDTH : NIB_WIDTH[p.nib];
            pts.current = [x, y, w];
            scheduleFlush();
          } else if (p.tool === 'wipe') {
            wipe.current = { strokes: new Set(), stamps: new Set() };
            rub(x, y);
          }
        },
        onPanResponderMove: (e) => {
          const p = propsRef.current;
          const { x, y, t } = pos(e);
          if (p.tool === 'wipe') {
            rub(x, y);
            return;
          }
          if (p.tool === 'stamp') {
            last.current = { x, y };
            return;
          }
          const a = pts.current;
          if (a.length < 3) return;
          const dist = Math.hypot(x - a[a.length - 3], y - a[a.length - 2]);
          if (dist < 1.5) return;
          let w: number;
          if (isJaali.current) {
            w = JAALI_WIDTH;
          } else {
            // the cone thins as the hand speeds up, down to 60%, and eases back as it slows
            const speed = dist / Math.max(t - lastT.current, 1);
            const target = 1 - (1 - MIN_PRESSURE) * Math.min(speed / V_MAX, 1);
            pressure.current += (target - pressure.current) * 0.2;
            w = NIB_WIDTH[p.nib] * pressure.current;
          }
          lastT.current = t;
          a.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(w * 10) / 10);
          scheduleFlush();
        },
        onPanResponderRelease: (e) => end(e, false),
        onPanResponderTerminate: (e) => end(e, true),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k],
  );

  const end = (e: GestureResponderEvent, cancelled: boolean) => {
    const p = propsRef.current;
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    if (p.tool === 'cone' || p.tool === 'jaali') {
      const a = pts.current;
      pts.current = [];
      setLive(null);
      if (a.length >= 3) {
        const stroke: StudioStroke = { layer: p.activeLayer, nib: p.nib, points: a, hand: p.hand };
        if (isJaali.current) stroke.jaali = true;
        p.onStroke(stroke);
      }
    } else if (p.tool === 'stamp') {
      if (!cancelled) {
        const { x, y } = pos(e);
        p.onStamp(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      }
    } else if (p.tool === 'wipe') {
      const hits = { strokes: [...wipe.current.strokes], stamps: [...wipe.current.stamps] };
      wipe.current = { strokes: new Set(), stamps: new Set() };
      last.current = null;
      if (hits.strokes.length || hits.stamps.length) {
        setWiped(null);
        p.onWipe(hits);
      } else {
        setWiped(null);
      }
    }
    last.current = null;
  };

  // While rubbing, the touched marks vanish at once (committed on release as one undo step).
  const shown = useMemo(() => {
    if (!wiped) return layers;
    const out = layers.slice();
    const l = layers[activeLayer];
    out[activeLayer] = {
      strokes: l.strokes.filter((_, i) => !wiped.strokes.includes(i)),
      stamps: l.stamps.filter((_, i) => !wiped.stamps.includes(i)),
    };
    return out;
  }, [layers, wiped, activeLayer]);

  return (
    <View style={{ width, height }}>
      {/* the picture is drawn in the hand's own coordinates, then mirrored as a whole for the right hand */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, width, height, transform: hand === 'right' ? [{ scaleX: -1 }] : [] }}
      >
        <HandRaster tone={tone} width={width} />
        {shown.map((l, i) => (
          <View
            key={i}
            style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: i === activeLayer ? 1 : 0.45 }}
          >
            <LayerSvg strokes={l.strokes} stamps={l.stamps} tone={tone} width={width} height={height} />
          </View>
        ))}
        {active ? <LiveSvg live={live} tone={tone} width={width} height={height} /> : null}
      </View>
      {/* the touch surface sits on top (never mirrored) so nothing below can steal the gesture */}
      {active ? (
        <View
          {...responder.panHandlers}
          accessible
          accessibilityLabel={`Drawing area: draw on the ${hand} hand`}
          style={{ position: 'absolute', left: 0, top: 0, width, height }}
        />
      ) : (
        <Pressable
          onPress={props.onFocus}
          accessibilityRole="button"
          accessibilityLabel={`Draw on the ${hand} hand`}
          style={{ position: 'absolute', left: 0, top: 0, width, height }}
        />
      )}
    </View>
  );
}
