import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, G, Path, Rect, SvgXml } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { HennaHand } from '../../src/components/HennaHand';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { RoomTabs } from '../../src/components/RoomTabs';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import {
  PARTS,
  VB_H,
  VB_W,
  fitPair,
  letItDry,
  armFor,
  pairRaise,
  overlayXml,
  partBounds,
  saveDraftForPicture,
  type PartId,
} from '../../src/lib/henna';
import { emptyHennaDesign, useStore, type HennaDesign } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

const NO_PARTS: PartId[] = [];

/** The part icons from the canvas (the Vines one is the Icon set's `henna`). */
function PartIcon({ id, color }: { id: PartId; color: string }) {
  if (id === 'vines') return <Icon name="henna" size={24} color={color} />;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {id === 'gol' ? (
        <G fill={color}>
          <Circle cx={12} cy={12} r={2.6} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Ellipse key={a} cx={12} cy={5.4} rx={1.8} ry={3} transform={`rotate(${a} 12 12)`} />
          ))}
        </G>
      ) : (
        <G fill={color}>
          <Rect x={3} y={6.5} width={18} height={2.2} rx={1} />
          <Rect x={3} y={15.3} width={18} height={2.2} rx={1} />
          <Path d="M4.5 9.8 L8 12 L4.5 14.2 Z M10.2 9.8 L13.7 12 L10.2 14.2 Z M15.9 9.8 L19.4 12 L15.9 14.2 Z" />
        </G>
      )}
    </Svg>
  );
}

/**
 * One part inking itself in: the part (paste colour) is revealed by a growing window, bloom
 * top-down, vines growing up from the knuckles, cuff left to right, with a quick fade-in.
 */
function InkSweep({
  part,
  tone,
  progress,
  handW,
}: {
  handW: number;
  part: PartId;
  tone: Parameters<typeof overlayXml>[0]['tone'];
  progress: Animated.Value;
}) {
  const k = handW / VB_W;
  const height = VB_H * k;
  const [bx, by, bw, bh] = partBounds[part];
  const pad = 26;
  const L = (bx - pad) * k;
  const T = (by - pad) * k;
  const W = (bw + pad * 2) * k;
  const H = (bh + pad * 2) * k;
  const xml = useMemo(() => overlayXml({ tone, stage: 'paste', parts: [part] }), [tone, part]);
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.2, 1, 1] });

  let outer: Record<string, unknown>;
  let inner: Record<string, unknown>;
  if (part === 'vines') {
    outer = {
      left: L,
      width: W,
      top: progress.interpolate({ inputRange: [0, 1], outputRange: [T + H, T] }),
      height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, H] }),
    };
    inner = { left: -L, top: progress.interpolate({ inputRange: [0, 1], outputRange: [-(T + H), -T] }) };
  } else if (part === 'cuff') {
    outer = { left: L, top: T, height: H, width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, W] }) };
    inner = { left: -L, top: -T };
  } else {
    outer = { left: L, top: T, width: W, height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, H] }) };
    inner = { left: -L, top: -T };
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

export default function SalonHenna() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const tone = useStore((s) => s.tone);
  const draft = useStore((s) => s.draftStencil);
  const draftNails = useStore((s) => s.draftNails);
  const setDraftStencil = useStore((s) => s.setDraftStencil);

  const inked: PartId[] = (draft.parts as PartId[] | undefined) ?? NO_PARTS;
  const design = useMemo<HennaDesign>(() => ({ source: 'stencil', parts: inked }), [inked]);

  const [inking, setInking] = useState<PartId | null>(null);
  const [fit, setFit] = useState({ handW: 200, bleed: 40, raise: 0, arm: 0 });
  const handW = fit.handW;
  const progress = useRef(new Animated.Value(0)).current;

  const next = PARTS.find((p) => !inked.includes(p.id));
  const done = inked.length >= PARTS.length;

  const inkNext = useCallback(() => {
    if (!next || inking) return;
    const id = next.id;
    setInking(id);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      const have = useStore.getState().draftStencil.parts ?? [];
      setDraftStencil({
        source: 'stencil',
        parts: have.includes(id) ? have : [...have, id],
        strokes: [],
        stamps: [],
        mirror: false,
      });
      setInking(null);
    });
  }, [next, inking, progress, setDraftStencil]);

  const reset = () => {
    if (inking) return;
    setDraftStencil(emptyHennaDesign('stencil'));
  };

  const dry = () => {
    const id = letItDry(design, 'Bloom & vines');
    router.replace(`/stain/${id}` as never);
  };

  const savePicture = () => {
    if (!inked.length) return;
    router.push(`/share/${saveDraftForPicture(design, 'Bloom & vines')}` as never);
  };

  const scallopH = (22 * winW) / 390;

  // (68 = 54 for the hint chip plus the 14 a long polished nail can reach above the fingertips.)
  // Keep the hands down to the cuff in view on short phones and let them grow on tall ones (both hands
  // across the canvas, a hand up to 520 wide): the arms below the cuff may hang under the scalloped edge and the panel.
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    const fitted = fitPair(w, h, 68, scallopH + 6);
    // spare height: lift the pair to sit centred between the hint chip (bottom ~54) and the scallop, and
    // lengthen the forearms so they still run under the panel
    const raise = pairRaise({
      canvasH: h,
      handW: fitted.handW,
      bleed: fitted.bleed,
      chipBottom: 54,
      panelOverlap: 22,
    });
    const next = { ...fitted, raise: Math.round(raise), arm: armFor(raise, fitted.bleed, fitted.handW) };
    setFit((f) =>
      f.handW === next.handW && f.bleed === next.bleed && f.raise === next.raise && f.arm === next.arm ? f : next,
    );
  };

  return (
    <Screen>
      <TopBar
        title="The Salon"
        backTo="/"
        right={
          <>
            <IconButton icon="undo" accessibilityLabel="Start again" onPress={reset} />
            <IconButton
              icon="camera"
              accessibilityLabel="Save a picture"
              bg={colors.turquoise}
              onPress={savePicture}
              style={{ opacity: inked.length ? 1 : 0.5 }}
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
            {done ? 'All inked! Now it needs to dry.' : 'Tap a faded part and the cone inks it in'}
          </Text>
        </View>

        <SkinToneButton />

        <Pressable
          onPress={inkNext}
          accessibilityRole="button"
          accessibilityLabel={
            done
              ? 'Two hands with a full henna design in fresh dark paste'
              : 'Ink the next part of the stencil on both hands. Two hands with a faded henna stencil, partly inked in'
          }
          style={{ marginBottom: fit.raise - fit.bleed }}
        >
          <HennaHand
            design={design}
            tone={tone}
            width={handW}
            stage="paste"
            nails={draftNails}
            armExtend={fit.arm}
            overlay={inking ? <InkSweep part={inking} tone={tone} progress={progress} handW={handW} /> : null}
          />
        </Pressable>
      </View>

      <View style={{ marginTop: -22, zIndex: 1 }} pointerEvents="none">
        <Svg width={winW} height={scallopH} viewBox="0 0 390 22">
          <Path
            d={'M 0 22 L 0 13' + ' a 13 13 0 0 1 26 0'.repeat(15) + ' L 390 22 Z'}
            fill={colors.magenta}
          />
        </Svg>
      </View>

      <View
        style={{
          paddingTop: 4,
          paddingHorizontal: 14,
          paddingBottom: Math.max(24, insets.bottom),
          backgroundColor: colors.magenta,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 19, color: colors.cream, includeFontPadding: false }}>
            Bloom &amp; vines · both hands
          </Text>
          <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.cream }}>
            {inked.length} of {PARTS.length} inked
          </Text>
        </View>

        <View accessibilityLabel="Stencil parts" style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {PARTS.map((p, i) => {
            const isDone = inked.includes(p.id);
            const isNext = next?.id === p.id;
            return (
              <View
                key={p.id}
                style={{
                  flex: 1,
                  height: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: isDone ? colors.marigold : isNext ? colors.cream : colors.blush,
                }}
              >
                <PartIcon id={p.id} color={colors.plum} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum }}>{p.name}</Text>
                {isDone ? <Icon name="check" size={16} color={colors.plum} strokeWidth={3.2} /> : null}
              </View>
            );
          })}
        </View>

        {done ? (
          <Button
            label="Let it dry"
            icon="hourglass"
            trailingIcon="forward"
            height={56}
            fontSize={19}
            drop={4}
            onPress={dry}
          />
        ) : (
          <Button
            label={`Ink the ${(next?.name ?? '').toLowerCase()}`}
            icon="cone"
            height={56}
            fontSize={19}
            drop={4}
            onPress={inkNext}
          />
        )}
      </View>
    </Screen>
  );
}
