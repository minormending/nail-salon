import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { HennaCanvas, type StudioTool, type WipeHits } from '../../src/components/HennaCanvas';
import { Icon, type IconName } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import {
  NIB_NAMES,
  VB_H,
  VB_W,
  consumePickedMotif,
  defaultStampScale,
  designIsEmpty,
  fitHand,
  getPickedMotif,
  joinHands,
  letItDry,
  motifById,
  otherHand,
  saveDraftForPicture,
  splitHands,
  type BothHands,
  type HandLayers,
  type OverlayLayer,
  type StudioStroke,
} from '../../src/lib/henna';
import { useStore, type Hand, type Stamp } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

type History = { stack: BothHands[]; idx: number };

const TOOLS: { id: StudioTool | 'mirror'; name: string; icon: IconName }[] = [
  { id: 'cone', name: 'Cone', icon: 'cone' },
  { id: 'stamp', name: 'Stamp', icon: 'stamp' },
  { id: 'mirror', name: 'Mirror', icon: 'mirror' },
  { id: 'jaali', name: 'Jaali', icon: 'jaali' },
  { id: 'wipe', name: 'Wipe', icon: 'wipe' },
];

const TOOL_LABEL: Record<StudioTool, (nib: 1 | 2 | 3) => string> = {
  cone: (nib) => 'CONE · ' + NIB_NAMES[nib].toUpperCase(),
  stamp: () => 'STAMP · TAP TO PLACE',
  jaali: () => 'JAALI · DRAG TO FILL IN',
  wipe: () => 'WIPE · RUB IT OUT',
};

const HISTORY_LIMIT = 80;
/** Room above the focused hand: the layer and tool chips, then the hand switch (62 + 42). */
const TOP_CLEAR = 112;
const SWAP_MS = 420;
/** The waiting hand is this share of the focused hand's size. */
const WAIT_SCALE = 0.5;

/** The left- and right-hand glyphs from the design (the pair's switch). */
const HAND_GLYPH: Record<Hand, string> = {
  left: 'M16 13 V6.5 a1.5 1.5 0 0 0 -3 0 V12 M13 11.5 V4.5 a1.5 1.5 0 0 0 -3 0 V11.5 M10 11.5 V5.5 a1.5 1.5 0 0 0 -3 0 V13 M7 9.5 a1.5 1.5 0 0 0 -3 0 V15 a6 6 0 0 0 6 6 h1.5 a6 6 0 0 0 5 -2.7 L19.8 14.6 a1.5 1.5 0 0 0 -2.4 -1.8 L16 14.5',
  right:
    'M8 13 V6.5 a1.5 1.5 0 0 1 3 0 V12 M11 11.5 V4.5 a1.5 1.5 0 0 1 3 0 V11.5 M14 11.5 V5.5 a1.5 1.5 0 0 1 3 0 V13 M17 9.5 a1.5 1.5 0 0 1 3 0 V15 a6 6 0 0 1 -6 6 h-1.5 a6 6 0 0 1 -5 -2.7 L4.2 14.6 a1.5 1.5 0 0 1 2.4 -1.8 L8 14.5',
};
const HAND_NAME: Record<Hand, string> = { left: 'Left hand', right: 'Right hand' };

/** The Nib size slider: three steps, tap or drag. */
function NibSlider({ value, onChange }: { value: 1 | 2 | 3; onChange: (v: 1 | 2 | 3) => void }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pan = useMemo(() => {
    const at = (x: number) => {
      const frac = wRef.current ? Math.min(Math.max(x / wRef.current, 0), 1) : 0;
      onChangeRef.current((1 + Math.round(frac * 2)) as 1 | 2 | 3);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
      onPanResponderMove: (e) => at(e.nativeEvent.locationX),
    });
  }, []);
  const thumb = 26;
  const usable = Math.max(w - thumb, 0);
  const x = ((value - 1) / 2) * usable;
  return (
    <View
      {...pan.panHandlers}
      onLayout={(e: LayoutChangeEvent) => {
        wRef.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Nib size"
      accessibilityValue={{ text: NIB_NAMES[value] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const v = value + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
        onChange(Math.min(3, Math.max(1, v)) as 1 | 2 | 3);
      }}
      style={{ flex: 1, height: 28, justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ marginHorizontal: thumb / 2 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(64,22,60,0.28)' }} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            width: ((value - 1) / 2) * usable,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.plum,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x,
          width: thumb,
          height: thumb,
          borderRadius: thumb / 2,
          backgroundColor: colors.plum,
          borderWidth: 3,
          borderColor: colors.cream,
        }}
      />
    </View>
  );
}

/** The draft in the store; marks saved before there were two hands (no `hand`) land on the left hand. */
function startLayers(): { hands: BothHands; mirror: boolean } {
  const d = useStore.getState().draftStudio;
  return { hands: splitHands(d), mirror: !!d.mirror };
}

export default function Studio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tone = useStore((s) => s.tone);
  const setDraftStudio = useStore((s) => s.setDraftStudio);

  const init = useRef<ReturnType<typeof startLayers> | null>(null);
  if (!init.current) init.current = startLayers();

  const [hist, setHist] = useState<History>({ stack: [init.current.hands], idx: 0 });
  const [tool, setTool] = useState<StudioTool>('cone');
  const [nib, setNib] = useState<1 | 2 | 3>(2);
  const [mirror, setMirror] = useState(init.current.mirror);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [motif, setMotif] = useState(getPickedMotif());
  const [focus, setFocus] = useState<Hand>('left');
  const [canvas, setCanvas] = useState({ w: 360, h: 420 });
  // 0 = the left hand is in front, 1 = the right hand is
  const swap = useRef(new Animated.Value(0)).current;

  const hands = hist.stack[hist.idx];
  const design = useMemo(() => joinHands(hands, mirror), [hands, mirror]);
  const empty = designIsEmpty(design);

  // Coming back from the motif library: stamp the one just picked.
  useFocusEffect(
    useCallback(() => {
      const m = consumePickedMotif();
      if (m) {
        setMotif(m);
        setTool('stamp');
      }
    }, []),
  );

  // The draft in the store follows every change, so leaving and coming back keeps the work.
  const sync = (h: BothHands, m: boolean) => setDraftStudio(joinHands(h, m));
  const commit = (next: BothHands) => {
    setHist((h) => {
      const stack = [...h.stack.slice(0, h.idx + 1), next].slice(-HISTORY_LIMIT);
      return { stack, idx: stack.length - 1 };
    });
    sync(next, mirror);
  };
  /** `hand`'s layer `i` with `patch` applied; the other hand is untouched. */
  const withLayer = (base: BothHands, hand: Hand, i: 0 | 1, patch: (l: OverlayLayer) => OverlayLayer): BothHands => {
    const layers: HandLayers = [base[hand][0], base[hand][1]];
    layers[i] = patch(layers[i]);
    return { ...base, [hand]: layers };
  };

  // Mirror copies each new mark to the other hand with the same points, so it shows reflected there;
  // both go in one commit, so Undo takes the pair away together.
  const onStroke = (stroke: StudioStroke) => {
    const hand = stroke.hand ?? focus;
    let next = withLayer(hands, hand, stroke.layer, (l) => ({ ...l, strokes: [...l.strokes, stroke] }));
    if (mirror) {
      const copy: StudioStroke = { ...stroke, hand: otherHand(hand) };
      next = withLayer(next, otherHand(hand), stroke.layer, (l) => ({ ...l, strokes: [...l.strokes, copy] }));
    }
    commit(next);
  };
  const onStamp = (x: number, y: number) => {
    const stamp: Stamp = {
      layer: activeLayer,
      motif,
      x,
      y,
      scale: defaultStampScale(motifById(motif).family),
      rotate: 0,
      hand: focus,
    };
    let next = withLayer(hands, focus, activeLayer, (l) => ({ ...l, stamps: [...l.stamps, stamp] }));
    if (mirror) {
      const copy: Stamp = { ...stamp, hand: otherHand(focus) };
      next = withLayer(next, otherHand(focus), activeLayer, (l) => ({ ...l, stamps: [...l.stamps, copy] }));
    }
    commit(next);
  };
  /** Wipe only rubs out the marks on the hand being drawn on (indices are into that hand's layer). */
  const onWipe = (hits: WipeHits) => {
    commit(
      withLayer(hands, focus, activeLayer, (l) => ({
        ...l,
        strokes: l.strokes.filter((_, i) => !hits.strokes.includes(i)),
        stamps: l.stamps.filter((_, i) => !hits.stamps.includes(i)),
      })),
    );
  };

  const canUndo = hist.idx > 0;
  const canRedo = hist.idx < hist.stack.length - 1;
  const undo = () => {
    if (!canUndo) return;
    setHist({ ...hist, idx: hist.idx - 1 });
    sync(hist.stack[hist.idx - 1], mirror);
  };
  const redo = () => {
    if (!canRedo) return;
    setHist({ ...hist, idx: hist.idx + 1 });
    sync(hist.stack[hist.idx + 1], mirror);
  };

  const toggleMirror = () => {
    const m = !mirror;
    setMirror(m);
    if (!empty) sync(hands, m);
  };

  const focusHand = (hand: Hand) => {
    if (hand === focus) return;
    setFocus(hand);
    Animated.timing(swap, {
      toValue: hand === 'right' ? 1 : 0,
      duration: SWAP_MS,
      easing: Easing.bezier(0.22, 0.8, 0.24, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const dry = () => {
    if (empty) return;
    const id = letItDry(design, 'Studio henna');
    router.replace(`/stain/${id}` as never);
  };
  const savePicture = () => {
    if (empty) return;
    router.push(`/share/${saveDraftForPicture(design, 'Studio henna')}` as never);
  };

  // Keep the hand in front down to the cuff above the tool panel on short phones; tall phones grow it
  // (up to 82% of the width, or 520); the arm below the cuff may hang under the panel.
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCanvas((c) => (c.w === w && c.h === h ? c : { w, h }));
  };
  const W = canvas.w;
  const { handW, bleed } = fitHand(canvas.h, TOP_CLEAR, 10, Math.max(120, Math.min(Math.floor(W * 0.82), 520)));
  const handH = (VB_H * handW) / VB_W;
  const waitW = handW * WAIT_SCALE;

  // Where each hand rests, as a shift (px) of its full-size box from the canvas's bottom-left corner.
  // The focused hand is full size on its own side; the other waits half size, faded, at the far edge.
  const rest = {
    left: {
      big: { x: 16, y: bleed },
      small: { x: -6 - (handW - waitW) / 2, y: handH * (1 - WAIT_SCALE) * 0.5 - handW * 0.133 },
    },
    right: {
      big: { x: W - handW - 16, y: bleed },
      small: { x: W + 6 - waitW - (handW - waitW) / 2, y: handH * (1 - WAIT_SCALE) * 0.5 - handW * 0.133 },
    },
  };
  const place = (hand: Hand) => {
    const r = rest[hand];
    // swap = 0: left in front; 1: right in front
    const inputRange = [0, 1];
    const big = hand === 'left' ? [r.big, r.small] : [r.small, r.big];
    return {
      opacity: swap.interpolate({ inputRange, outputRange: hand === 'left' ? [1, 0.55] : [0.55, 1] }),
      transform: [
        { translateX: swap.interpolate({ inputRange, outputRange: big.map((b) => b.x) }) },
        { translateY: swap.interpolate({ inputRange, outputRange: big.map((b) => b.y) }) },
        {
          scale: swap.interpolate({
            inputRange,
            outputRange: hand === 'left' ? [1, WAIT_SCALE] : [WAIT_SCALE, 1],
          }),
        },
      ],
    };
  };

  return (
    <Screen>
      <TopBar
        title="The Studio"
        backTo="/"
        right={
          <>
            <IconButton
              icon="undo"
              accessibilityLabel="Undo"
              onPress={undo}
              style={{ opacity: canUndo ? 1 : 0.4 }}
            />
            <IconButton
              icon="redo"
              accessibilityLabel="Redo"
              onPress={redo}
              style={{ opacity: canRedo ? 1 : 0.4 }}
            />
            <IconButton
              icon="camera"
              accessibilityLabel="Save a picture"
              bg={colors.marigold}
              onPress={savePicture}
              style={{ opacity: empty ? 0.5 : 1 }}
            />
          </>
        }
      />

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
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 3,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => setActiveLayer((l) => (l === 0 ? 1 : 0))}
            accessibilityRole="button"
            accessibilityLabel={`Layer ${activeLayer + 1} of 2. Tap to switch layer`}
            style={{
              height: 40,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              borderWidth: border,
              borderColor: colors.plum,
              backgroundColor: colors.white,
            }}
          >
            <Icon name="layers" size={16} color={colors.plum} />
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>
              Layer {activeLayer + 1} of 2
            </Text>
          </Pressable>
          <View
            pointerEvents="none"
            style={{
              flexShrink: 1,
              marginLeft: 8,
              height: 40,
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 999,
              borderWidth: border,
              borderColor: colors.plum,
              backgroundColor: colors.turquoise,
            }}
          >
            {/* the Mirror line is long: on narrow phones it wraps onto two lines inside the pill */}
            <Text
              numberOfLines={2}
              style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, lineHeight: 15, textAlign: 'center', color: colors.plum }}
            >
              {mirror ? `MIRROR → ${otherHand(focus).toUpperCase()} HAND` : TOOL_LABEL[tool](nib)}
            </Text>
          </View>
        </View>

        <SkinToneButton />

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Which hand"
          style={{
            position: 'absolute',
            top: 62,
            alignSelf: 'center',
            zIndex: 3,
            flexDirection: 'row',
            padding: 3,
            gap: 3,
            borderRadius: 999,
            borderWidth: border,
            borderColor: colors.plum,
            backgroundColor: colors.white,
          }}
        >
          {(['left', 'right'] as Hand[]).map((h) => {
            const on = focus === h;
            return (
              <Pressable
                key={h}
                onPress={() => focusHand(h)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, checked: on }}
                accessibilityLabel={`Draw on the ${h} hand`}
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  backgroundColor: on ? colors.marigold : 'transparent',
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path
                    d={HAND_GLYPH[h]}
                    fill="none"
                    stroke={colors.plum}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>{HAND_NAME[h]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* the hands: each is a full-size box that slides and scales between "in front" and "waiting" */}
        {(['left', 'right'] as Hand[]).map((h) => (
          <Animated.View
            key={h}
            style={[
              { position: 'absolute', left: 0, bottom: 0, width: handW, height: handH, zIndex: focus === h ? 2 : 1 },
              place(h) as object,
            ]}
          >
            <HennaCanvas
              width={handW}
              tone={tone}
              hand={h}
              layers={hands[h]}
              activeLayer={activeLayer}
              tool={tool}
              nib={nib}
              active={focus === h}
              onFocus={() => focusHand(h)}
              onStroke={onStroke}
              onStamp={onStamp}
              onWipe={onWipe}
            />
          </Animated.View>
        ))}

        <View pointerEvents="none" style={{ position: 'absolute', right: 70, bottom: 54, zIndex: 2 }}>
          <Svg width={58} height={74} viewBox="0 0 58 74">
            <Path
              d="M 10 6 L 48 6 L 31 62 L 27 62 Z"
              fill={colors.marigold}
              stroke={colors.plum}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            <Path d="M 14 18 L 44 18" stroke={colors.plum} strokeWidth={2} />
            <Path
              d="M 27 62 L 29 70 L 31 62"
              fill="#3B3326"
              stroke={colors.plum}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 14,
          paddingBottom: Math.max(22, insets.bottom),
          backgroundColor: colors.turquoise,
          borderTopWidth: border,
          borderTopColor: colors.plum,
        }}
      >
        <View accessibilityRole="toolbar" accessibilityLabel="Tools" style={{ flexDirection: 'row', gap: 7 }}>
          {TOOLS.map((t) => {
            const on = t.id === 'mirror' ? mirror : t.id === tool;
            return (
              <Pressable
                key={t.id}
                onPress={() => (t.id === 'mirror' ? toggleMirror() : setTool(t.id))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t.name}
                style={{
                  flex: 1,
                  height: 62,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.marigold : colors.cream,
                }}
              >
                <Icon name={t.icon} size={22} color={colors.plum} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11.5, color: colors.plum }}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 2, marginVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="nib" size={20} color={colors.plum} />
            <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: colors.plum, includeFontPadding: false }}>
              Nib
            </Text>
          </View>
          <NibSlider value={nib} onChange={setNib} />
          <Text style={{ minWidth: 62, textAlign: 'right', fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.plum }}>
            {NIB_NAMES[nib]}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="Motifs"
            icon="sparkle"
            bg={colors.cream}
            height={54}
            fontSize={18}
            drop={0}
            style={{ flex: 1 }}
            onPress={() => router.push('/studio/motifs' as never)}
          />
          <View style={{ flex: 1.3, opacity: empty ? 0.55 : 1 }}>
            <Button label="Let it dry" icon="hourglass" height={54} fontSize={18} drop={4} onPress={dry} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
