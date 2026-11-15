import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bottle, NailHand, ScallopEdge, ShapeIcon } from '../../src/components/NailHand';
import { Button } from '../../src/components/Button';
import { IconButton } from '../../src/components/IconButton';
import { RoomTabs } from '../../src/components/RoomTabs';
import { Screen } from '../../src/components/Screen';
import { SkinToneButton } from '../../src/components/SkinToneButton';
import { TopBar } from '../../src/components/TopBar';
import { BOTTLES, FINGER_NAMES, SALON_SHAPES, capitalise, nailName } from '../../src/lib/nailNames';
import { DIGITS, emptyNailDesign, useStore, type Digit } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

const HAND_ASPECT = 1646 / 1024;

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

  // No nail picked: a bottle paints all five (as in the canvas). Pick a nail to paint just that one.
  const [selected, setSelected] = useState<Digit | undefined>(undefined);
  const [area, setArea] = useState({ w: 390, h: 440 });

  const handW = Math.max(80, Math.min(262, (area.h - 12) / HAND_ASPECT, area.w - 24));

  const paint = (hex: string) => {
    const nails = { ...draft.nails };
    for (const dg of selected ? [selected] : DIGITS) nails[dg] = { ...nails[dg], color: hex };
    setDraft({ ...draft, nails });
  };

  const colours = new Set(DIGITS.map((dg) => draft.nails[dg].color));
  const current = selected ? draft.nails[selected].color : colours.size === 1 ? [...colours][0] : undefined;

  const save = () => {
    const id = addItem({ kind: 'nails', name: nailName(draft), tone, nails: draft });
    router.push(`/share/${id}` as never);
  };

  const label = selected ? FINGER_NAMES[selected].toUpperCase() : 'ALL NAILS';

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
                setSelected(undefined);
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
      <RoomTabs current="nails" />

      <View
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
        <Chip style={{ right: 12 }}>{capitalise(draft.shape).toUpperCase()}</Chip>
        <Chip style={{ left: 12 }}>{label}</Chip>
        <NailHand
          design={draft}
          tone={tone}
          width={handW}
          selected={selected}
          onNailPress={(dg) => setSelected((s) => (s === dg ? undefined : dg))}
        />
        <SkinToneButton />
      </View>

      <ScallopEdge width={screenW} />

      <View
        style={{
          paddingTop: 4,
          paddingHorizontal: 14,
          paddingBottom: 24 + insets.bottom,
          backgroundColor: colors.magenta,
        }}
      >
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
                <ShapeIcon shape={name} fill={current ?? draft.nails.thumb.color} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum }}>
                  {capitalise(name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View
          accessibilityLabel="Polish"
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            marginBottom: 14,
          }}
        >
          {BOTTLES.map((b) => {
            const on = b.hex.toLowerCase() === current?.toLowerCase();
            return (
              <Pressable
                key={b.hex}
                onPress={() => paint(b.hex)}
                accessibilityRole="button"
                accessibilityLabel={b.name}
                accessibilityState={{ selected: on }}
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

        <Button
          label="Add stickers"
          icon="star"
          iconFill={colors.cream}
          trailingIcon="forward"
          height={52}
          fontSize={19}
          drop={4}
          onPress={() => router.push(`/salon/nail?digit=${selected ?? 'thumb'}` as never)}
        />
      </View>
    </Screen>
  );
}

/** The little pill in a corner of the canvas (shape name, which nail is being painted). */
function Chip({ children, style }: { children: string; style: object }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 12,
          zIndex: 2,
          paddingVertical: 7,
          paddingHorizontal: 13,
          borderRadius: 999,
          borderWidth: border,
          borderColor: colors.plum,
          backgroundColor: colors.cream,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.4, color: colors.plum }}>
        {children}
      </Text>
    </View>
  );
}
