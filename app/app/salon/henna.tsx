import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path, Rect, SvgXml } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { HennaHand } from '../../src/components/HennaHand';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { StartAgainButton, useReduceMotion, useUndoChip } from '../../src/components/StartAgainButton';
import { RoomTabs } from '../../src/components/RoomTabs';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import {
  VB_H,
  VB_W,
  armFor,
  designThumbXml,
  fitPair,
  glowXml,
  letItDry,
  overlayXml,
  pairRaise,
  pairWidth,
  saveDraftForPicture,
  sectionAtPoint,
} from '../../src/lib/henna';
import {
  DIGIT_SECTIONS,
  STYLES,
  boundsOf,
  fullSections,
  groupOf,
  hennaName,
  sectionsFromParts,
  type Sections,
} from '../../src/lib/hennaSections';
import { emptyHennaDesign, useStore, type HennaDesign, type Section } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

/** What the child has chosen: a section, or "all fingers" (the five digits together). */
type Sel = Section | 'fingers';

const CHIPS: { id: Sel; name: string; verb: string }[] = [
  { id: 'gol', name: 'Back of hand', verb: 'the back of hand' },
  { id: 'fingers', name: 'All fingers', verb: 'all fingers' },
  { id: 'thumb', name: 'Thumb', verb: 'the thumb' },
  { id: 'index', name: 'Pointer', verb: 'the pointer' },
  { id: 'middle', name: 'Middle', verb: 'the middle' },
  { id: 'ring', name: 'Ring', verb: 'the ring' },
  { id: 'pinky', name: 'Little', verb: 'the little' },
  { id: 'cuff', name: 'Wrist', verb: 'the wrist' },
];
const chipOf = (id: Sel) => CHIPS.find((c) => c.id === id) ?? CHIPS[0];
const sectionsOf = (id: Sel): Section[] => (id === 'fingers' ? DIGIT_SECTIONS : [id]);

/** Where "Ink the ..." goes next: the back of the hand, then the fingers, then the wrist. */
function nextTarget(f: Sections): Sel | null {
  if (!f.gol.inked) return 'gol';
  if (DIGIT_SECTIONS.some((d) => !f[d].inked)) return 'fingers';
  if (!f.cuff.inked) return 'cuff';
  return null;
}
/** Is there anything left to ink in this choice? */
const hasInkLeft = (f: Sections, sel: Sel) => sectionsOf(sel).some((x) => !f[x].inked);

/** A chip's picture: the bloom, the cuff, or a little hand with the chosen finger(s) filled in. */
function SectionIcon({ id, color }: { id: Sel; color: string }) {
  if (id === 'gol')
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <G fill={color}>
          <Circle cx={12} cy={12} r={2.6} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Ellipse key={a} cx={12} cy={5.4} rx={1.8} ry={3} transform={`rotate(${a} 12 12)`} />
          ))}
        </G>
      </Svg>
    );
  if (id === 'cuff')
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <G fill={color}>
          <Rect x={3} y={6.5} width={18} height={2.2} rx={1} />
          <Rect x={3} y={15.3} width={18} height={2.2} rx={1} />
          <Path d="M4.5 9.8 L8 12 L4.5 14.2 Z M10.2 9.8 L13.7 12 L10.2 14.2 Z M15.9 9.8 L19.4 12 L15.9 14.2 Z" />
        </G>
      </Svg>
    );
  // five fingers, little to thumb as the left hand shows them; the chosen ones are solid
  const bars: { x: number; h: number; d: Section }[] = [
    { x: 3.2, h: 9, d: 'pinky' },
    { x: 7.4, h: 12, d: 'ring' },
    { x: 11.6, h: 14, d: 'middle' },
    { x: 15.8, h: 12, d: 'index' },
    { x: 20, h: 8, d: 'thumb' },
  ];
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {bars.map((b) => {
        const on = id === 'fingers' || id === b.d;
        return (
          <Rect
            key={b.d}
            x={b.x - 1.5}
            y={19 - b.h}
            width={3}
            height={b.h}
            rx={1.5}
            fill={on ? color : 'none'}
            stroke={color}
            strokeWidth={1.4}
            opacity={on ? 1 : 0.55}
          />
        );
      })}
      <Rect x={2} y={16} width={20} height={5.5} rx={2.7} fill={color} />
    </Svg>
  );
}

/**
 * One section inking itself in: the design (paste colour) is revealed by a growing window: the
 * back of the hand top-down, a finger growing up from the knuckles, the wrist left to right, with
 * a quick fade-in. `window` is the design's own box (designBounds), padded a little.
 */
function InkSweep({
  section,
  style,
  tone,
  progress,
  handW,
}: {
  handW: number;
  section: Section;
  style: string;
  tone: Parameters<typeof overlayXml>[0]['tone'];
  progress: Animated.Value;
}) {
  const k = handW / VB_W;
  const height = VB_H * k;
  const [bx, by, bw, bh] = boundsOf(section, style);
  const pad = 26;
  const L = (bx - pad) * k;
  const T = (by - pad) * k;
  const W = (bw + pad * 2) * k;
  const H = (bh + pad * 2) * k;
  const xml = useMemo(
    () => overlayXml({ tone, stage: 'paste', sections: [{ id: section, style, inked: true }] }),
    [tone, section, style],
  );
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.2, 1, 1] });

  let outer: Record<string, unknown>;
  let inner: Record<string, unknown>;
  if (section === 'cuff') {
    outer = { left: L, top: T, height: H, width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, W] }) };
    inner = { left: -L, top: -T };
  } else if (section === 'gol') {
    outer = { left: L, top: T, width: W, height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, H] }) };
    inner = { left: -L, top: -T };
  } else {
    outer = {
      left: L,
      width: W,
      top: progress.interpolate({ inputRange: [0, 1], outputRange: [T + H, T] }),
      height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, H] }),
    };
    inner = { left: -L, top: progress.interpolate({ inputRange: [0, 1], outputRange: [-(T + H), -T] }) };
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', overflow: 'hidden', opacity }, outer as object]}
    >
      <Animated.View style={[{ position: 'absolute', width: handW, height }, inner as object]}>
        <SvgXml xml={xml} width={handW} height={height} />
      </Animated.View>
    </Animated.View>
  );
}

/** The chosen sections' soft magenta region highlight, breathing with `breath` (drawn behind the henna on each hand). */
function SectionGlow({
  list,
  handW,
  breath,
}: {
  list: { id: Section; style: string }[];
  handW: number;
  breath: Animated.Value;
}) {
  const key = list.map((x) => `${x.id}:${x.style}`).join(',');
  const px = VB_W / handW;
  const xml = useMemo(() => glowXml(list, px), [key, px]); // eslint-disable-line react-hooks/exhaustive-deps
  const height = (VB_H * handW) / VB_W;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: handW, height, opacity: breath }}
    >
      <SvgXml xml={xml} width={handW} height={height} />
    </Animated.View>
  );
}

/** A design's small picture on a cream card, in the paste colour, with its name under it. */
function StyleCard({
  section,
  styleId,
  name,
  on,
  width,
  onPress,
}: {
  section: Section;
  styleId: string;
  name: string;
  on: boolean;
  width: number;
  onPress: () => void;
}) {
  const xml = useMemo(() => designThumbXml(section, styleId), [section, styleId]);
  return (
    <View
      accessible
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={name}
      onStartShouldSetResponder={() => true}
      onResponderRelease={onPress}
      style={{
        width,
        height: 62,
        alignItems: 'center',
        paddingTop: 3,
        paddingBottom: 3,
        borderRadius: 14,
        borderWidth: border,
        borderColor: colors.plum,
        backgroundColor: on ? colors.marigold : colors.cream,
      }}
    >
      <SvgXml xml={xml} width={Math.min(width - 14, 62)} height={35} />
      <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: fonts.bodyHeavy, fontSize: 11, color: colors.plum }}>
        {name}
      </Text>
    </View>
  );
}

export default function SalonHenna() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const tone = useStore((s) => s.tone);
  const draft = useStore((s) => s.draftStencil);
  const draftNails = useStore((s) => s.draftNails);
  const setDraftStencil = useStore((s) => s.setDraftStencil);
  const reduceMotion = useReduceMotion();

  const secs = useMemo<Sections>(() => fullSections(draft.sections ?? sectionsFromParts(draft.parts)), [draft]);
  const [sel, setSelRaw] = useState<Sel>(
    () => nextTarget(fullSections(useStore.getState().draftStencil.sections)) ?? 'gol',
  );
  /** The highlight shows once the child chose a part; after the last inking it rests. */
  const [glow, setGlow] = useState(
    () => !!nextTarget(fullSections(useStore.getState().draftStencil.sections)),
  );
  const setSel = useCallback((x: Sel) => {
    setSelRaw(x);
    setGlow(true);
  }, []);
  /** The sections being inked right now (shared progress); drawn as guides underneath until they land. */
  const [inking, setInking] = useState<{ id: Section; style: string }[] | null>(null);

  const commit = useCallback(
    (next: Sections) => setDraftStencil({ source: 'stencil', sections: next, strokes: [], stamps: [], mirror: false }),
    [setDraftStencil],
  );
  const stencil = useCallback(
    (sections: Sections): HennaDesign => ({ source: 'stencil', sections, strokes: [], stamps: [], mirror: false }),
    [],
  );

  // what is drawn: sections being inked count as not yet inked, so their guide shows under the sweep
  const shown = useMemo(() => {
    if (!inking) return secs;
    const f = { ...secs };
    for (const t of inking) f[t.id] = { ...f[t.id], inked: false };
    return f;
  }, [secs, inking]);
  const design = useMemo(() => stencil(shown), [shown, stencil]);

  const progress = useRef(new Animated.Value(0)).current;

  const allSections = [...DIGIT_SECTIONS, 'gol', 'cuff'] as Section[];
  const inkedCount = allSections.filter((x) => secs[x].inked).length;
  const done = inkedCount === allSections.length;
  const groupsInked =
    (secs.gol.inked ? 1 : 0) + (DIGIT_SECTIONS.every((d) => secs[d].inked) ? 1 : 0) + (secs.cuff.inked ? 1 : 0);

  // The CTA inks the chosen section; if that one is already inked it moves on to the next.
  const target: Sel | null = hasInkLeft(secs, sel) ? sel : nextTarget(secs);

  const runSweep = useCallback(
    (list: { id: Section; style: string }[], then: () => void) => {
      setInking(list);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        then();
        setInking(null);
      });
    },
    [progress],
  );

  const ink = useCallback(() => {
    if (!target || inking) return;
    const ids = sectionsOf(target).filter((x) => !secs[x].inked);
    runSweep(
      ids.map((id) => ({ id, style: secs[id].style })),
      () => {
        const cur = fullSections(useStore.getState().draftStencil.sections);
        for (const id of ids) cur[id] = { ...cur[id], inked: true };
        commit(cur);
        const nxt = nextTarget(cur);
        if (nxt) setSel(nxt);
        else setGlow(false);
      },
    );
  }, [target, inking, secs, runSweep, commit]);

  // Choosing a design: the section changes style at once. A guide just changes; ink is drawn again
  // with a quick reveal.
  const pickStyle = (style: string) => {
    if (inking) return;
    const ids = sectionsOf(sel).filter((x) => secs[x].style !== style);
    if (!ids.length) return;
    const next = { ...secs };
    for (const id of ids) next[id] = { ...next[id], style };
    commit(next);
    const reink = ids.filter((id) => secs[id].inked);
    if (reink.length) {
      runSweep(
        reink.map((id) => ({ id, style })),
        () => {
          const cur = fullSections(useStore.getState().draftStencil.sections);
          for (const id of reink) cur[id] = { ...cur[id], inked: true };
          commit(cur);
        },
      );
    }
  };

  // Start again: the inked sections fade back to the ghost guides (the old hands cross-fade out on top).
  // It hands back an Undo that brings the inking (and the chosen designs) back the same way.
  const undoChip = useUndoChip([draft, inking]);
  const [fading, setFading] = useState<HennaDesign | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const crossFade = (from: HennaDesign) => {
    setFading(from);
    fade.setValue(1);
    Animated.timing(fade, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => setFading(null),
    );
  };
  const reset = () => {
    if (inking) return;
    const fresh = emptyHennaDesign('stencil');
    if (JSON.stringify(secs) === JSON.stringify(fresh.sections)) return; // already as new: nothing to undo
    const was = draft;
    const wasSel = sel;
    crossFade(design);
    setDraftStencil(fresh);
    setSel('gol');
    return () => {
      crossFade(useStore.getState().draftStencil);
      setDraftStencil(was);
      setSel(wasSel);
    };
  };

  const name = hennaName(secs);
  const dry = () => {
    const id = letItDry(stencil(secs), name);
    router.replace(`/stain/${id}` as never);
  };
  const savePicture = () => {
    if (!inkedCount) return;
    router.push(`/share/${saveDraftForPicture(stencil(secs), name)}` as never);
  };

  const scallopH = (22 * winW) / 390;

  // The hint chip is only there until the first section is inked; the hands take its room afterwards.
  // (68 = 54 for the chip plus the 14 a long polished nail can reach above the fingertips; 28 without it.)
  // Keep the hands down to the cuff in view on short phones and let them grow on tall ones (both hands
  // across the canvas, a hand up to 520 wide): the arms below the cuff may hang under the scalloped edge and the panel.
  const showHint = inkedCount === 0;
  const [canvas, setCanvas] = useState({ w: 360, h: 300 });
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCanvas((c) => (c.w === w && c.h === h ? c : { w, h }));
  };
  const fit = useMemo(() => {
    const fitted = fitPair(canvas.w, canvas.h, showHint ? 68 : 28, scallopH + 6);
    // spare height: lift the pair to sit centred between the top (or the hint chip, bottom ~54) and the
    // scallop, and lengthen the forearms so they still run under the panel
    const raise = pairRaise({
      canvasH: canvas.h,
      handW: fitted.handW,
      bleed: fitted.bleed,
      chipBottom: showHint ? 54 : 14,
      panelOverlap: 22,
    });
    return { ...fitted, raise: Math.round(raise), arm: armFor(raise, fitted.bleed, fitted.handW) };
  }, [canvas, showHint, scallopH]);
  const handW = fit.handW;
  const handH = (VB_H * handW) / VB_W;

  // The chosen section's highlight breathes gently (steady with reduce-motion).
  const breath = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    if (reduceMotion) {
      breath.setValue(0.9);
      return;
    }
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
        }),
        Animated.timing(breath, {
          toValue: 0.6,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, breath]);

  const glowList = glow ? sectionsOf(sel).map((id) => ({ id, style: secs[id].style })) : [];

  // Touching a hand picks the section under the finger (either hand).
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const onHandRelease = (e: GestureResponderEvent) => {
    const from = downAt.current;
    downAt.current = null;
    if (from && Math.hypot(e.nativeEvent.pageX - from.x, e.nativeEvent.pageY - from.y) > 10) return;
    const hit = sectionAtPoint(e.nativeEvent.locationX, e.nativeEvent.locationY, handW);
    if (hit) setSel(hit);
  };

  // The chip row follows the choice.
  const chipRow = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const chipPos = useRef<Record<string, { x: number; w: number }>>({});
  const rowW = useRef(0);
  useEffect(() => {
    const p = chipPos.current[sel];
    if (p && rowW.current)
      chipRow.current?.scrollTo({ x: Math.max(0, p.x + p.w / 2 - rowW.current / 2), animated: true });
  }, [sel]);

  // The designs on offer for the chosen section (fingers: shown on the pointer, applied to all five).
  const previewSection: Section = sel === 'fingers' ? 'index' : sel;
  const styles = STYLES[groupOf(previewSection)];
  const chosenStyles = new Set(sectionsOf(sel).map((x) => secs[x].style));
  const chosenStyle = chosenStyles.size === 1 ? [...chosenStyles][0] : null;
  const cardW = Math.max(56, Math.min(76, (winW - 28 - 4 * 6) / 5));

  const hint = 'Pick a part and a design, then ink it';

  return (
    <Screen>
      <TopBar
        title="The Salon"
        backTo="/"
        right={
          <>
            <StartAgainButton onConfirm={reset} disabled={!!inking} undo={undoChip} />
            <IconButton
              icon="camera"
              accessibilityLabel="Save a picture"
              bg={colors.turquoise}
              onPress={savePicture}
              style={{ opacity: inkedCount ? 1 : 0.5 }}
            />
          </>
        }
      />
      <RoomTabs current="henna" />

      <View
        onLayout={onCanvasLayout}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          backgroundColor: colors.creamDeep,
          borderTopWidth: border,
          borderTopColor: colors.plum,
        }}
      >
        {showHint && (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 2, alignItems: 'center' }}
          >
            <Text
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                overflow: 'hidden',
                borderRadius: 999,
                borderWidth: border,
                borderColor: colors.plum,
                backgroundColor: colors.white,
                fontFamily: fonts.bodyHeavy,
                fontSize: 13,
                color: colors.plum,
              }}
            >
              {hint}
            </Text>
          </View>
        )}

        <SkinToneButton />

        <View style={{ marginBottom: fit.raise - fit.bleed }}>
          <View style={{ width: pairWidth(handW), height: handH }}>
            <HennaHand
              design={design}
              tone={tone}
              width={handW}
              stage="paste"
              guides
              nails={draftNails}
              armExtend={fit.arm}
              under={<SectionGlow list={glowList} handW={handW} breath={breath} />}
              overlay={
                inking ? (
                  <>
                    {inking.map((t) => (
                      <InkSweep
                        key={t.id}
                        section={t.id}
                        style={t.style}
                        tone={tone}
                        progress={progress}
                        handW={handW}
                      />
                    ))}
                  </>
                ) : null
              }
            />
            {fading && (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity: fade }}>
                <HennaHand
                  design={fading}
                  tone={tone}
                  width={handW}
                  stage="paste"
                  guides
                  nails={draftNails}
                  armExtend={fit.arm}
                />
              </Animated.View>
            )}
            {/* one touch layer over both hands picks the section under the finger */}
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Two hands with a henna design. Tap a part to choose it."
              style={{ position: 'absolute', left: 0, top: 0, width: pairWidth(handW), height: handH }}
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => true}
              onResponderGrant={(e: GestureResponderEvent) => {
                downAt.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              }}
              onResponderRelease={onHandRelease}
            />
          </View>
        </View>
      </View>

      <View style={{ marginTop: -22, zIndex: 1 }} pointerEvents="none">
        <Svg width={winW} height={scallopH} viewBox="0 0 390 22">
          <Path d={'M 0 22 L 0 13' + ' a 13 13 0 0 1 26 0'.repeat(15) + ' L 390 22 Z'} fill={colors.magenta} />
        </Svg>
      </View>

      <View
        style={{
          paddingTop: 2,
          paddingHorizontal: 14,
          paddingBottom: Math.max(12, insets.bottom),
          backgroundColor: colors.magenta,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fonts.heading,
              fontSize: 17,
              color: colors.cream,
              includeFontPadding: false,
            }}
          >
            {name} · both hands
          </Text>
          <Text
            numberOfLines={1}
            style={{ marginLeft: 8, flexShrink: 0, fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.cream }}
          >
            {groupsInked} of 3 inked
          </Text>
        </View>

        <ScrollView
          ref={chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Parts of the hand"
          onLayout={(e) => (rowW.current = e.nativeEvent.layout.width)}
          style={{ flexGrow: 0, marginHorizontal: -14, marginBottom: 5 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
        >
          {CHIPS.map((c) => {
            const isDone = sectionsOf(c.id).every((x) => secs[x].inked);
            const isSel = sel === c.id;
            return (
              <View
                key={c.id}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={`${c.name}${isDone ? ', inked' : ''}`}
                onLayout={(e) => (chipPos.current[c.id] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => setSel(c.id)}
                style={{
                  height: 36,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: isSel ? colors.cream : isDone ? colors.marigold : colors.blush,
                }}
              >
                <SectionIcon id={c.id} color={colors.plum} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13.5, color: colors.plum }}>{c.name}</Text>
                {isDone ? <Icon name="check" size={15} color={colors.plum} strokeWidth={3.2} /> : null}
              </View>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          accessibilityLabel="Designs"
          style={{ flexGrow: 0, marginHorizontal: -14, marginBottom: 6 }}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
        >
          {styles.map((st) => (
            <StyleCard
              key={st.id}
              section={previewSection}
              styleId={st.id}
              name={st.name}
              on={chosenStyle === st.id}
              width={cardW}
              onPress={() => pickStyle(st.id)}
            />
          ))}
        </ScrollView>

        {done ? (
          <Button
            label="Let it dry"
            icon="hourglass"
            trailingIcon="forward"
            height={48}
            fontSize={18}
            drop={4}
            onPress={dry}
          />
        ) : (
          <Button
            label={target === 'fingers' ? 'Ink all fingers' : `Ink ${chipOf(target ?? 'gol').verb}`}
            icon="cone"
            height={48}
            fontSize={18}
            drop={4}
            onPress={ink}
          />
        )}
      </View>
      {undoChip.chip}
    </Screen>
  );
}
