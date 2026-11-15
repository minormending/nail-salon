import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
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
  MIRROR_X,
  NIB_NAMES,
  VB_H,
  VB_W,
  consumePickedMotif,
  defaultStampScale,
  designIsEmpty,
  fitHand,
  getPickedMotif,
  joinLayers,
  letItDry,
  mirrorStamp,
  mirrorStroke,
  motifById,
  saveDraftForPicture,
  splitLayers,
  type OverlayLayer,
  type StudioStroke,
} from '../../src/lib/henna';
import { useStore, type Stamp } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

type Layers = [OverlayLayer, OverlayLayer];
type History = { stack: Layers[]; idx: number };

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

const MAX_HAND_W = 300;
const HISTORY_LIMIT = 80;

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

function startLayers(): { layers: Layers; mirror: boolean } {
  const d = useStore.getState().draftStudio;
  return { layers: splitLayers(d), mirror: !!d.mirror };
}

export default function Studio() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tone = useStore((s) => s.tone);
  const setDraftStudio = useStore((s) => s.setDraftStudio);

  const init = useRef<ReturnType<typeof startLayers> | null>(null);
  if (!init.current) init.current = startLayers();

  const [hist, setHist] = useState<History>({ stack: [init.current.layers], idx: 0 });
  const [tool, setTool] = useState<StudioTool>('cone');
  const [nib, setNib] = useState<1 | 2 | 3>(2);
  const [mirror, setMirror] = useState(init.current.mirror);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [motif, setMotif] = useState(getPickedMotif());
  const [fit, setFit] = useState({ handW: MAX_HAND_W, bleed: 46 });
  const handW = fit.handW;

  const layers = hist.stack[hist.idx];
  const design = useMemo(() => joinLayers(layers, mirror), [layers, mirror]);
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
  const sync = (l: Layers, m: boolean) => setDraftStudio(joinLayers(l, m));
  const commit = (next: Layers) => {
    setHist((h) => {
      const stack = [...h.stack.slice(0, h.idx + 1), next].slice(-HISTORY_LIMIT);
      return { stack, idx: stack.length - 1 };
    });
    sync(next, mirror);
  };
  const replaceLayer = (i: 0 | 1, patch: Partial<OverlayLayer>): Layers => {
    const next: Layers = [layers[0], layers[1]];
    next[i] = { ...layers[i], ...patch };
    return next;
  };

  const onStroke = (stroke: StudioStroke) => {
    const l = layers[stroke.layer];
    const add = mirror ? [stroke, mirrorStroke(stroke)] : [stroke];
    commit(replaceLayer(stroke.layer, { strokes: [...l.strokes, ...add] }));
  };
  const onStamp = (x: number, y: number) => {
    const stamp: Stamp = { layer: activeLayer, motif, x, y, scale: defaultStampScale(motifById(motif).family), rotate: 0 };
    const l = layers[activeLayer];
    const add = mirror ? [stamp, mirrorStamp(stamp)] : [stamp];
    commit(replaceLayer(activeLayer, { stamps: [...l.stamps, ...add] }));
  };
  const onWipe = (hits: WipeHits) => {
    const l = layers[activeLayer];
    commit(
      replaceLayer(activeLayer, {
        strokes: l.strokes.filter((_, i) => !hits.strokes.includes(i)),
        stamps: l.stamps.filter((_, i) => !hits.stamps.includes(i)),
      }),
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
    if (!empty) sync(layers, m);
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

  // Keep the hand down to the cuff above the tool panel on short phones (the design's 300px
  // hand is the cap); the arm below the cuff may hang under the panel.
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    const next = fitHand(h, 58, 10, MAX_HAND_W);
    setFit((f) => (f.handW === next.handW && f.bleed === next.bleed ? f : next));
  };
  const handH = (VB_H * handW) / VB_W;

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
              height: 40,
              paddingHorizontal: 14,
              justifyContent: 'center',
              borderRadius: 999,
              borderWidth: border,
              borderColor: colors.plum,
              backgroundColor: colors.turquoise,
            }}
          >
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>
              {TOOL_LABEL[tool](nib)}
            </Text>
          </View>
        </View>

        <SkinToneButton />

        <View style={{ width: handW, height: handH, marginBottom: -fit.bleed }}>
          <HennaCanvas
            width={handW}
            tone={tone}
            layers={layers}
            activeLayer={activeLayer}
            tool={tool}
            nib={nib}
            mirror={mirror}
            onStroke={onStroke}
            onStamp={onStamp}
            onWipe={onWipe}
          />
        </View>

        {mirror ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' }}
          >
            <View style={{ width: handW, height: '100%' }}>
              <View
                style={{
                  position: 'absolute',
                  top: 64,
                  bottom: 0,
                  left: (MIRROR_X * handW) / VB_W - 1.25,
                  borderLeftWidth: border,
                  borderLeftColor: colors.turquoiseDeep,
                  borderStyle: 'dashed',
                }}
              />
              <Text
                style={{
                  position: 'absolute',
                  top: 70,
                  left: (MIRROR_X * handW) / VB_W + 7,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  overflow: 'hidden',
                  borderRadius: 8,
                  backgroundColor: colors.turquoiseDeep,
                  fontFamily: fonts.bodyHeavy,
                  fontSize: 11,
                  color: colors.white,
                }}
              >
                MIRROR
              </Text>
            </View>
          </View>
        ) : null}

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
