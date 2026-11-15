import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, type GestureResponderEvent, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg from 'react-native-svg';

import {
  Bottle,
  PATTERNS,
  PatternIcon,
  STICKERS,
  newSticker,
  stickerAt,
  ScallopEdge,
  ShapeIcon,
  StickerGlyph,
  ZoomHand,
  pairFit,
} from '../../src/components/NailHand';
import { Button } from '../../src/components/Button';
import { HardDrop } from '../../src/components/HardDrop';
import { Icon, type IconName } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { RoomTabs } from '../../src/components/RoomTabs';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import {
  BOTTLES,
  NAIL_ORDER,
  RIGHT_THUMB,
  SALON_SHAPES,
  capitalise,
  lookOf,
  nailChipLabel,
  nailFromParam,
  nailName,
  sameNail,
  withLook,
  type NailRef,
} from '../../src/lib/nailNames';
import { emptyNailDesign, handNails, useStore, type NailLook } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

const MAX_STICKERS = 8;
/** The panel's two swappable rows keep one height, so the canvas above never jumps. */
const TOP_ROW_H = 54;
const BOTTOM_ROW_H = 56;

export default function SalonNails() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const tone = useStore((s) => s.tone);
  const stored = useStore((s) => s.draftNails);
  const setDraft = useStore((s) => s.setDraftNails);
  const addItem = useStore((s) => s.addItem);

  const draft = stored?.nails ? stored : emptyNailDesign();
  useEffect(() => {
    if (!stored?.nails) setDraft(draft);
  }, [stored, draft, setDraft]);

  // Whole hand (null): bottles wait for a nail to be chosen. Zoomed on a fingertip: they paint just that one.
  const params = useLocalSearchParams<{ zoom?: string }>();
  const [zoom, setZoom] = useState<NailRef | null>(() => nailFromParam(params.zoom));
  // A link that lands on this screen again (e.g. the Stickers tab from the henna screen).
  const [seenZoomParam, setSeenZoomParam] = useState(params.zoom);
  if (params.zoom !== seenZoomParam) {
    setSeenZoomParam(params.zoom);
    if (params.zoom !== undefined) setZoom(nailFromParam(params.zoom));
  }
  const [area, setArea] = useState({ w: 390, h: 440 });

  // Both hands as large as fit, clear of the pills and the skin-tone button.
  const { width: handW, shift: handShift } = pairFit(area.w, area.h);

  const look = zoom ? lookOf(draft, zoom) : undefined;

  // The hint pill wiggles when a bottle is tapped before a nail is chosen.
  const wiggle = useSharedValue(0);
  const nudge = () => {
    wiggle.value = withSequence(
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 80 }),
      withTiming(-3, { duration: 70 }),
      withTiming(0, { duration: 90 }),
    );
  };

  // Where the last bottle / pattern button was tapped, relative to the canvas: the polish brush
  // flies in from there. (The canvas's window origin sits half the top border below its corner.)
  const canvasRef = useRef<React.ComponentRef<typeof View>>(null);
  const toolSeq = useRef(0);
  const [toolFrom, setToolFrom] = useState<{ x: number; y: number; n: number } | undefined>(undefined);
  const withTool = (e: GestureResponderEvent, act: () => void) => {
    const px = e.nativeEvent.pageX;
    const py = e.nativeEvent.pageY;
    const c = canvasRef.current;
    if (!c || typeof px !== 'number') return act();
    c.measureInWindow((cx, cy) => {
      setToolFrom({ x: px - cx, y: py - cy - border / 2, n: ++toolSeq.current });
      act();
    });
  };

  const paint = (hex: string) => {
    if (!zoom) return nudge();
    setDraft(withLook(draft, zoom, { ...lookOf(draft, zoom), color: hex }));
  };

  const update = (patch: Partial<NailLook>) => {
    if (!zoom || !look) return;
    setDraft(withLook(draft, zoom, { ...look, ...patch }));
  };

  // Stickers are picked, then placed where the child taps the zoomed nail. With none picked,
  // a tap on a placed sticker takes it off.
  const [pick, setPick] = useState<string | null>(null);
  const onNailTap = (spot: { x: number; y: number }) => {
    if (!zoom || !look) return;
    if (pick) {
      const st = newSticker(pick, zoom.digit, draft.shape, spot.x, spot.y);
      update({ stickers: [...look.stickers, st].slice(-MAX_STICKERS) });
      AccessibilityInfo.announceForAccessibility('Sticker on');
    } else {
      const i = stickerAt(look, zoom.digit, draft.shape, spot.x, spot.y);
      if (i < 0) return;
      update({ stickers: look.stickers.filter((_, j) => j !== i) });
      AccessibilityInfo.announceForAccessibility('Sticker off');
    }
  };

  const go = (step: number) => {
    if (!zoom) return;
    const i = NAIL_ORDER.findIndex((n) => sameNail(n, zoom));
    setZoom(NAIL_ORDER[(i + step + NAIL_ORDER.length) % NAIL_ORDER.length]);
  };

  // A horizontal swipe on the zoomed canvas moves to the next / previous nail.
  const pan = usePanGesture({
    enabled: zoom !== null,
    activeOffsetX: [-24, 24],
    failOffsetY: [-28, 28],
    runOnJS: true,
    onDeactivate: (e) => {
      if (e.translationX < -50) go(1);
      else if (e.translationX > 50) go(-1);
    },
  });

  const colours = new Set(NAIL_ORDER.map((n) => lookOf(draft, n).color));
  const current = look ? look.color : colours.size === 1 ? [...colours][0] : undefined;

  const save = () => {
    const id = addItem({ kind: 'nails', name: nailName(draft), tone, nails: draft });
    router.push(`/share/${id}` as never);
  };

  return (
    <Screen>
      <TopBar
        title="The Salon"
        backTo="/"
        right={
          <>
            <IconButton
              icon="undo"
              accessibilityLabel="Start again"
              onPress={() => {
                setDraft(emptyNailDesign());
                setZoom(null);
              }}
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
      <RoomTabs
        current={zoom ? 'stickers' : 'nails'}
        onSelect={(room) => {
          if (room === 'henna') return false;
          setZoom(room === 'stickers' ? zoom ?? RIGHT_THUMB : null);
          return true;
        }}
      />

      <GestureDetector gesture={pan}>
        <View
          ref={canvasRef}
          onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.white,
            borderTopWidth: border,
            borderTopColor: colors.plum,
          }}
        >
          {/* Zoomed: a tap anywhere off the hand zooms back out. */}
          {zoom && (
            <Pressable
              onPress={() => setZoom(null)}
              accessible={false}
              importantForAccessibility="no"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
          )}

          <ZoomHand
            design={draft}
            tone={tone}
            width={handW}
            shift={handShift}
            view={area}
            zoom={zoom}
            toolFrom={toolFrom}
            onNailPress={(n) => {
              if (!sameNail(n, zoom)) setZoom(n);
            }}
            onOffPress={() => setZoom(null)}
            onNailTap={onNailTap}
          />

          {zoom ? (
            <>
              <HardDrop
                onPress={() => setZoom(null)}
                drop={3}
                radius={999}
                accessibilityLabel="Show the whole hand"
                style={{ position: 'absolute', top: 12, left: 12, zIndex: 3 }}
                face={{
                  height: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  paddingLeft: 10,
                  paddingRight: 14,
                  backgroundColor: colors.cream,
                }}
              >
                <Icon name="zoomOut" size={20} color={colors.plum} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.plum }}>Whole hand</Text>
              </HardDrop>
              <Chip style={{ right: 12 }} bg={colors.marigold}>
                {nailChipLabel(zoom)}
              </Chip>
              <ArrowButton icon="back" label="Previous nail" side="left" onPress={() => go(-1)} />
              <ArrowButton icon="forward" label="Next nail" side="right" onPress={() => go(1)} />
            </>
          ) : (
            <>
              <Chip style={{ left: 12 }} icon="zoomIn" wiggle={wiggle}>
                TAP A NAIL TO LOOK CLOSER
              </Chip>
              <Chip style={{ right: 12 }}>{capitalise(draft.shape).toUpperCase()}</Chip>
            </>
          )}
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
        <View style={{ height: TOP_ROW_H }}>
          {look ? (
            <View accessibilityLabel="Pattern for this nail" style={{ flexDirection: 'row', gap: 8 }}>
              {PATTERNS.map((p) => {
                const on = p.id === look.pattern;
                return (
                  <Pressable
                    key={p.id}
                    onPress={(e) => withTool(e, () => update({ pattern: p.id }))}
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
                      paddingHorizontal: 4,
                      borderRadius: 14,
                      borderWidth: border,
                      borderColor: colors.plum,
                      backgroundColor: on ? colors.marigold : colors.cream,
                    }}
                  >
                    <PatternIcon pattern={p.id} color={look.color} />
                    <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Nail shape"
          contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
        >
          {SALON_SHAPES.map((name) => {
            const on = name === draft.shape;
            return (
              <Pressable
                key={name}
                onPress={() => setDraft({ ...draft, shape: name })}
                accessibilityRole="button"
                accessibilityLabel={capitalise(name)}
                accessibilityState={{ selected: on }}
                style={{
                  height: 52,
                  paddingLeft: 10,
                  paddingRight: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.marigold : colors.cream,
                }}
              >
                <ShapeIcon shape={name} fill={current ?? handNails(draft, 'right').thumb.color} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum }}>
                  {capitalise(name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
          )}
        </View>

        <View
          accessibilityLabel={zoom ? 'Polish for this nail' : 'Polish for every nail'}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            marginBottom: 14,
            // Pick a nail first: the bottles are faint on the whole hand.
            opacity: zoom ? 1 : 0.55,
          }}
        >
          {BOTTLES.map((b) => {
            const on = !!zoom && b.hex.toLowerCase() === current?.toLowerCase();
            return (
              <Pressable
                key={b.hex}
                onPress={(e) => withTool(e, () => paint(b.hex))}
                accessibilityRole="button"
                accessibilityLabel={b.name}
                accessibilityState={{ selected: on }}
                accessibilityHint={zoom ? undefined : 'Tap a nail first'}
                style={{
                  width: 46,
                  height: 66,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  borderWidth: border,
                  borderColor: on ? colors.plum : 'transparent',
                  backgroundColor: on ? colors.cream : 'transparent',
                }}
              >
                <Bottle hex={b.hex} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: BOTTOM_ROW_H }}>
          {zoom ? (
            <View accessibilityLabel="Stickers: pick one, then tap the nail" style={{ flexDirection: 'row', gap: 8 }}>
              {STICKERS.map((st) => {
                const on = st.kind === pick;
                return (
                  <HardDrop
                    key={st.kind}
                    onPress={() => setPick((p) => (p === st.kind ? null : st.kind))}
                    drop={3}
                    radius={14}
                    accessibilityLabel={st.name}
                    accessibilityState={{ selected: on }}
                    style={{ flex: 1, transform: [{ translateY: on ? -3 : 0 }] }}
                    face={{
                      height: 52,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? colors.marigold : colors.cream,
                    }}
                  >
                    <Svg width={30} height={30} viewBox="-17 -17 34 34">
                      <StickerGlyph kind={st.kind} />
                    </Svg>
                  </HardDrop>
                );
              })}
            </View>
          ) : (
            <Button
              label="Add stickers"
              icon="star"
              iconFill={colors.cream}
              trailingIcon="forward"
              height={52}
              fontSize={19}
              drop={4}
              onPress={() => setZoom(RIGHT_THUMB)}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

/** The little pill in a corner of the canvas (shape name, a hint, which finger is zoomed). */
function Chip({
  children,
  style,
  icon,
  bg = colors.cream,
  wiggle,
}: {
  children: string;
  style: object;
  icon?: IconName;
  bg?: string;
  /** Degrees of tilt, driven from outside for a little wiggle. */
  wiggle?: SharedValue<number>;
}) {
  const tilt = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle ? wiggle.value : 0}deg` }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 12,
          zIndex: 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 7,
          paddingLeft: icon ? 9 : 13,
          paddingRight: icon ? 12 : 13,
          borderRadius: 999,
          borderWidth: border,
          borderColor: colors.plum,
          backgroundColor: bg,
        },
        style,
        tilt,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.plum} /> : null}
      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.4, color: colors.plum }}>
        {children}
      </Text>
    </Animated.View>
  );
}

/** Round previous / next button at the left or right edge of the zoomed canvas. */
function ArrowButton({
  icon,
  label,
  side,
  onPress,
}: {
  icon: 'back' | 'forward';
  label: string;
  side: 'left' | 'right';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        position: 'absolute',
        [side]: 12,
        top: '50%',
        marginTop: -24,
        zIndex: 3,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: border,
        borderColor: colors.plum,
        backgroundColor: colors.cream,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={colors.plum} strokeWidth={2.8} />
    </Pressable>
  );
}
