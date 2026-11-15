import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useId, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import {
  closeK,
  CLOSE_ORIGIN,
  NailPaint,
  SPOTS,
  STICKERS,
  ScallopEdge,
  StickerGlyph,
  nailMetrics,
  nailPath,
} from '../../src/components/NailHand';
import { RoomTabs } from '../../src/components/RoomTabs';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import { FINGER_NAMES, nailName } from '../../src/lib/nailNames';
import { DIGITS, emptyNailDesign, useStore, type Digit, type NailLook } from '../../src/state/store';
import { border, colors, fonts, TONES } from '../../src/theme';

const MAX_STICKERS = SPOTS.length;
const NAIL_ICON =
  'M -5.5 0 L -5.5 -8.41 C -5.5 -14.96 -1.65 -18.7 0 -18.7 C 1.65 -18.7 5.5 -14.96 5.5 -8.41 L 5.5 0 C 5.5 3.03 -5.5 3.03 -5.5 0 Z';

const PATTERNS: { id: NailLook['pattern']; name: string; color: string }[] = [
  { id: 'plain', name: 'Plain', color: colors.magentaBright },
  { id: 'dots', name: 'Dots', color: colors.magentaBright },
  { id: 'stripes', name: 'Stripes', color: colors.turquoise },
  { id: 'french', name: 'French', color: colors.blush },
];

/** A little nail showing what a pattern looks like, for the Pattern buttons. */
function PatternIcon({ pattern, color }: { pattern: NailLook['pattern']; color: string }) {
  const uid = 'ico' + useId().replace(/[^A-Za-z0-9]/g, '');
  return (
    <Svg width={18} height={30} viewBox="-7.5 -21 15 26">
      <NailPaint uid={uid} d={NAIL_ICON} look={{ color, pattern }} line={colors.plum} strokeWidth={1.6} unit={5 / 26} />
    </Svg>
  );
}

export default function SalonNail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const params = useLocalSearchParams<{ digit?: string }>();
  const tone = useStore((s) => s.tone);
  const stored = useStore((s) => s.draftNails);
  const setDraft = useStore((s) => s.setDraftNails);
  const addItem = useStore((s) => s.addItem);
  const draft = stored?.nails ? stored : emptyNailDesign();

  const [index, setIndex] = useState(() => {
    const i = DIGITS.indexOf(params.digit as Digit);
    return i < 0 ? 0 : i;
  });
  const digit = DIGITS[index];
  const look = draft.nails[digit];
  const toneInfo = TONES.find((t) => t.id === tone) ?? TONES[0];
  const line = toneInfo.line;

  const d = nailPath(draft.shape, digit);
  const { len } = nailMetrics(d);
  const k = closeK(d);

  const go = (step: number) => setIndex((i) => (i + step + DIGITS.length) % DIGITS.length);

  const update = (patch: Partial<NailLook>) =>
    setDraft({ ...draft, nails: { ...draft.nails, [digit]: { ...look, ...patch } } });

  /** Stickers land on the next of the canvas's spots; when they're full the oldest steps aside. */
  const stick = (kind: string) => {
    const kinds = look.stickers.map((s) => s.kind).concat(kind).slice(-MAX_STICKERS);
    update({ stickers: kinds.map((k, i) => ({ kind: k, x: SPOTS[i][0], y: SPOTS[i][1] })) });
  };
  const unstick = () => {
    if (look.stickers.length) update({ stickers: look.stickers.slice(0, -1) });
  };

  const save = () => {
    const id = addItem({ kind: 'nails', name: nailName(draft), tone, nails: draft });
    router.push(`/share/${id}` as never);
  };

  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-28, 28],
    runOnJS: true,
    onDeactivate: (e) => {
      if (e.translationX < -50) go(1);
      else if (e.translationX > 50) go(-1);
    },
  });

  const sheen = Math.min(1, (len * k * 0.68) / 140);

  return (
    <Screen>
      <TopBar
        title="The Salon"
        backTo="/"
        right={
          <>
            <IconButton
              icon="undo"
              accessibilityLabel="Take the stickers off"
              onPress={() => update({ stickers: [] })}
            />
            <IconButton
              icon="camera"
              bg={colors.turquoise}
              accessibilityLabel="Save to My hands"
              onPress={save}
            />
          </>
        }
      />
      <RoomTabs current="stickers" />

      <GestureDetector gesture={pan}>
        <View
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: colors.white,
            borderTopWidth: border,
            borderTopColor: colors.plum,
          }}
        >
          <Svg
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            width="100%"
            height="100%"
            viewBox="0 0 350 420"
            preserveAspectRatio="xMidYMax meet"
            accessibilityLabel={`One fingertip, close up, with a painted ${draft.shape} nail`}
          >
            <Path
              d="M 82 420 L 82 210 C 82 120, 268 120, 268 210 L 268 420"
              fill={toneInfo.skin}
              stroke={line}
              strokeWidth={3.2}
              strokeLinecap="round"
            />
            <Path
              d="M 120 372 C 150 362, 200 362, 230 372"
              fill="none"
              stroke={line}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <G transform={`translate(${CLOSE_ORIGIN.x} ${CLOSE_ORIGIN.y}) scale(${k})`}>
              <NailPaint uid="close" d={d} look={look} line={line} strokeWidth={3.2 / k} unit={1 / k} />
            </G>
            <G transform={`translate(${CLOSE_ORIGIN.x} ${CLOSE_ORIGIN.y}) scale(1 ${sheen})`}>
              <Path
                d="M -35 -28 C -35 -80, -25 -120, -13 -140"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.55}
              />
            </G>
            {look.stickers.map((s, i) => (
              <G key={i} transform={`translate(${s.x} ${s.y}) scale(1.35)`}>
                <StickerGlyph kind={s.kind} />
              </G>
            ))}
            {/* Tapping the nail takes the last sticker off. */}
            <G transform={`translate(${CLOSE_ORIGIN.x} ${CLOSE_ORIGIN.y}) scale(${k})`}>
              <Path d={d} fill="transparent" onPress={unstick} />
            </G>
          </Svg>

          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <ArrowButton icon="back" label="Previous nail" onPress={() => go(-1)} />
            <View style={{ alignItems: 'center' }} pointerEvents="none">
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 20,
                  lineHeight: 24,
                  color: colors.plum,
                  includeFontPadding: false,
                }}
              >
                {FINGER_NAMES[digit]}
              </Text>
              <Text
                style={{ fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.6, color: colors.muted }}
              >
                SWIPE FOR THE NEXT NAIL
              </Text>
            </View>
            <ArrowButton icon="forward" label="Next nail" onPress={() => go(1)} />
          </View>

          <SkinToneButton />
        </View>
      </GestureDetector>

      <ScallopEdge width={screenW} />

      <View
        style={{
          paddingTop: 4,
          paddingHorizontal: 14,
          paddingBottom: 24 + insets.bottom,
          backgroundColor: colors.magenta,
        }}
      >
        <Heading>Pattern</Heading>
        <View accessibilityLabel="Pattern" style={{ flexDirection: 'row', gap: 8 }}>
          {PATTERNS.map((p) => {
            const on = p.id === look.pattern;
            return (
              <Pressable
                key={p.id}
                onPress={() => update({ pattern: p.id })}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  height: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.marigold : colors.cream,
                }}
              >
                <PatternIcon pattern={p.id} color={p.color} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Heading style={{ marginTop: 14 }}>
          Stickers{' '}
          <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.cream }}>
            · tap to stick one on
          </Text>
        </Heading>
        <View accessibilityLabel="Stickers" style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {STICKERS.map((st) => (
            <Pressable
              key={st.kind}
              onPress={() => stick(st.kind)}
              accessibilityRole="button"
              accessibilityLabel={st.name}
              style={({ pressed }) => ({
                flex: 1,
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                borderWidth: border,
                borderColor: colors.plum,
                backgroundColor: colors.cream,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Svg width={34} height={34} viewBox="-17 -17 34 34">
                <StickerGlyph kind={st.kind} />
              </Svg>
            </Pressable>
          ))}
        </View>

        <Button
          label="Now some henna"
          icon="henna"
          trailingIcon="forward"
          height={52}
          fontSize={19}
          drop={4}
          onPress={() => router.push('/salon/henna' as never)}
        />
      </View>
    </Screen>
  );
}

function Heading({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          marginBottom: 8,
          fontFamily: fonts.heading,
          fontSize: 19,
          lineHeight: 26,
          color: colors.cream,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function ArrowButton({ icon, label, onPress }: { icon: 'back' | 'forward'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: border,
        borderColor: colors.plum,
        backgroundColor: colors.cream,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={18} color={colors.plum} strokeWidth={2.8} />
    </Pressable>
  );
}
