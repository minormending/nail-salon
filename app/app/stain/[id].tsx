import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { HennaHand } from '../../src/components/HennaHand';
import { Icon } from '../../src/components/Icon';
import { IconButton } from '../../src/components/IconButton';
import { Screen } from '../../src/components/Screen';
import { armFor, fitPair, pairRaise } from '../../src/lib/henna';
import { STAGE_COLOR, stageAt, type StainStage } from '../../src/lib/stain';
import { useStore, type HennaDesign } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

const STAGES: { id: StainStage; name: string; short: string; when: string; alt: string; body: string }[] = [
  {
    id: 'paste',
    name: 'Paste',
    short: 'at first',
    when: 'STILL WET',
    alt: 'Fresh henna paste, nearly black-green',
    body: 'Fresh paste is dark and earthy. Keep it on while it dries — the longer it stays, the deeper the stain.',
  },
  {
    id: 'orange',
    name: 'Orange',
    short: 'flakes off',
    when: 'FLAKED OFF',
    alt: 'Bright orange henna stain',
    body: 'When the dry paste flakes away, the stain underneath is bright orange. That is exactly right.',
  },
  {
    id: 'red',
    name: 'Red',
    short: 'tomorrow',
    when: 'DARKENING',
    alt: 'Henna darkening to red',
    body: 'Overnight it turns red, then keeps darkening — even while the app is closed.',
  },
  {
    id: 'brown',
    name: 'Deepest',
    short: 'day 2',
    when: 'DEEPEST',
    alt: 'Deep reddish-brown henna stain',
    body: 'Deep reddish-brown — as dark as real henna gets. Over the next two weeks it slowly fades.',
  },
];

const ALL_PARTS: HennaDesign = { source: 'stencil', parts: ['gol', 'vines', 'cuff'] };

/** "started today, 4:10 pm" / "started yesterday, …" / "started Mon 3 Nov, …" */
function startedText(startedAt: number, now: number): string {
  const d = new Date(startedAt);
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  const day0 = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diff = Math.round((day0(now) - day0(startedAt)) / 86400000);
  let when: string;
  if (diff <= 0) when = 'today';
  else if (diff === 1) when = 'yesterday';
  else {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    when = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  }
  return `started ${when}, ${time}`;
}

export default function Stain() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore((s) => s.items.find((i) => i.id === id));
  const settings = useStore((s) => s.settings);

  const [now, setNow] = useState(() => Date.now());
  const [preview, setPreview] = useState<StainStage | null>(null);
  const [fit, setFit] = useState({ handW: 200, bleed: 70, raise: 0, arm: 0 });
  const handW = fit.handW;

  // Recompute on focus and every minute while this screen is open.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const t = setInterval(() => setNow(Date.now()), 60 * 1000);
      return () => clearInterval(t);
    }, []),
  );

  const current = useMemo(
    () => (item ? stageAt(item, now, settings.speed).stage : 'paste'),
    [item, now, settings.speed],
  );
  const shownId = preview ?? current;
  const shown = STAGES.find((s) => s.id === shownId) ?? STAGES[0];
  const isPreview = preview != null && preview !== current;
  const design = item?.henna ?? ALL_PARTS;

  const goGallery = () => router.replace('/gallery' as never);

  if (!item) {
    return (
      <Screen>
        <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
          <IconButton icon="back" accessibilityLabel="Back to my hands" onPress={goGallery} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.plum, textAlign: 'center' }}>
            That henna isn't here any more
          </Text>
          <Button label="My hands" icon="grid" bg={colors.cream} drop={0} onPress={goGallery} />
        </View>
      </Screen>
    );
  }

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    // the hand down to the cuff stays in view; the arm below it may be cut off
    const fitted = fitPair(w, h, 56, 12);
    // spare height: lift the pair to sit centred between the "now" chip (bottom ~46) and the panel below,
    // and lengthen the forearms so they still run past the canvas bottom
    const raise = pairRaise({
      canvasH: h,
      handW: fitted.handW,
      bleed: fitted.bleed,
      chipBottom: 46,
      panelOverlap: 0,
    });
    const next = { ...fitted, raise: Math.round(raise), arm: armFor(raise, fitted.bleed, fitted.handW) };
    setFit((f) =>
      f.handW === next.handW && f.bleed === next.bleed && f.raise === next.raise && f.arm === next.arm ? f : next,
    );
  };

  const onChip = (sid: StainStage) => {
    // tapping a chip previews that stage; tapping it again (or the live one) returns to now
    setPreview((p) => (p === sid || sid === current ? null : sid));
  };

  return (
    <Screen>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
        <IconButton icon="back" accessibilityLabel="Back to my hands" onPress={goGallery} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ fontFamily: fonts.heading, fontSize: 27, lineHeight: 30, color: colors.plum, includeFontPadding: false }}
          >
            Watch it darken
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
            {item.name}
            {item.startedAt != null ? ` · ${startedText(item.startedAt, now)}` : ''}
          </Text>
        </View>
      </View>

      <View
        onLayout={onCanvasLayout}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          backgroundColor: colors.creamDeep,
          borderTopWidth: border,
          borderBottomWidth: border,
          borderColor: colors.plum,
        }}
      >
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            height: 34,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            borderRadius: 999,
            borderWidth: border,
            borderColor: colors.plum,
            backgroundColor: colors.white,
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: STAGE_COLOR[shown.id],
              borderWidth: 1.5,
              borderColor: colors.plum,
            }}
          />
          <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.plum }}>
            {isPreview ? 'PREVIEW' : 'NOW'} · {shown.when}
          </Text>
        </View>
        <View style={{ marginBottom: fit.raise - fit.bleed }} accessible accessibilityLabel={shown.alt}>
          <HennaHand design={design} tone={item.tone} width={handW} stage={shown.id} nails={item.nails} armExtend={fit.arm} />
        </View>
      </View>

      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: Math.max(22, insets.bottom) }}>
        <View accessibilityLabel="How the stain changes" style={{ flexDirection: 'row', gap: 7 }}>
          {STAGES.map((st) => {
            const on = st.id === shownId;
            const live = st.id === current;
            return (
              <Pressable
                key={st.id}
                onPress={() => onChip(st.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${st.name}${live ? ', now' : ''}${on && !live ? ', preview' : ''}`}
                style={{
                  flex: 1,
                  height: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  borderRadius: 14,
                  borderWidth: on ? 3.5 : border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.creamDeep : colors.white,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    backgroundColor: STAGE_COLOR[st.id],
                    borderWidth: 2,
                    borderColor: colors.plum,
                  }}
                />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 13, color: colors.plum }}>
                  {st.name}
                </Text>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, lineHeight: 11, color: colors.muted }}>
                  {live ? 'now' : st.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            marginHorizontal: 2,
            marginTop: 12,
            minHeight: 41,
            fontFamily: fonts.bodyBold,
            fontSize: 14,
            lineHeight: 20,
            color: colors.plum,
          }}
        >
          {shown.body}
        </Text>

        {settings.remind && !!item.notificationId && current !== 'brown' ? (
          <View
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: border,
              borderColor: colors.plum,
              backgroundColor: colors.white,
            }}
          >
            <Icon name="bell" size={22} color={colors.plum} />
            <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 12.5, lineHeight: 17.5, color: colors.plum }}>
              We'll send <Text style={{ fontFamily: fonts.bodyHeavy }}>one</Text> reminder when it reaches its deepest
              colour. Grown-ups can turn it off.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button
            label="My hands"
            icon="grid"
            bg={colors.cream}
            height={54}
            fontSize={17}
            drop={0}
            style={{ flex: 1 }}
            onPress={goGallery}
          />
          <Button
            label="Save a picture"
            icon="camera"
            height={54}
            fontSize={17}
            drop={4}
            style={{ flex: 1.4 }}
            onPress={() => router.push(`/share/${item.id}` as never)}
          />
        </View>
      </View>
    </Screen>
  );
}
