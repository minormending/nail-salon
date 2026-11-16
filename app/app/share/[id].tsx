import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { HennaHand } from '../../src/components/HennaHand';
import { NailHand } from '../../src/components/NailHand';
import { Screen } from '../../src/components/Screen';
import { TopBar } from '../../src/components/TopBar';
import { VB_H, VB_W } from '../../src/lib/henna';
import { savePicture } from '../../src/lib/pictures';
import { stageAt } from '../../src/lib/stain';
import { useStore } from '../../src/state/store';
import { border, colors, fonts } from '../../src/theme';

const FRAMES = [
  { id: 'marigold', name: 'Marigold', bg: '#F5A623', ink: '#40163C' },
  { id: 'blush', name: 'Blush', bg: '#F4B6C2', ink: '#40163C' },
  { id: 'sky', name: 'Sky', bg: '#16A0BD', ink: '#40163C' },
  { id: 'plum', name: 'Plum', bg: '#40163C', ink: '#FFF3DC' },
] as const;
type FrameId = (typeof FRAMES)[number]['id'];

/** One hand's width on the picture (the pair is 1.53x as wide, 224 of the frame's 232) and its height. */
const HENNA_W = 146;
const HENNA_H = Math.round((VB_H * HENNA_W) / VB_W);
const DAY = 24 * 60 * 60 * 1000;

export default function Share() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore((s) => s.items.find((it) => it.id === id));
  const speed = useStore((s) => s.settings.speed);
  const [frameId, setFrameId] = useState<FrameId>('marigold');
  const [savedFrame, setSavedFrame] = useState<FrameId | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);

  if (!item) {
    return (
      <Screen>
        <TopBar title="Save a picture" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted, textAlign: 'center' }}>
            That hand isn't in My hands any more.
          </Text>
        </View>
      </Screen>
    );
  }

  const frame = FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];
  const saved = savedFrame === frameId;
  const now = Date.now();
  const caption =
    item.kind === 'henna' && item.startedAt != null
      ? `DAY ${1 + Math.floor(Math.max(0, now - item.startedAt) / DAY)} · PAISLEY`
      : 'PAISLEY';

  const save = async (): Promise<boolean> => {
    if (saved) return true;
    if (busy) return false;
    setBusy(true);
    try {
      await savePicture(cardRef, item.id);
      setSavedFrame(frameId);
      return true;
    } catch (e) {
      console.warn('savePicture failed', e);
      Alert.alert("That didn't save", 'Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (await save()) router.push(`/gate?next=share&id=${item.id}`);
  };

  return (
    <Screen>
      <TopBar title="Save a picture" />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6, paddingBottom: 10 }}>
        {/* the tilt and hard drop live outside the captured card, so the saved picture is straight */}
        <View style={{ width: 270, transform: [{ rotate: '-2deg' }] }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              left: 0,
              right: 0,
              bottom: -6,
              borderRadius: 20,
              backgroundColor: colors.plum,
            }}
          />
          <View
            ref={cardRef}
            collapsable={false}
            style={{
              paddingTop: 14,
              paddingHorizontal: 14,
              paddingBottom: 12,
              borderWidth: border,
              borderColor: colors.plum,
              borderRadius: 20,
              backgroundColor: frame.bg,
            }}
          >
            <View
              style={{
                height: 270,
                borderWidth: border,
                borderColor: colors.plum,
                borderRadius: 12,
                backgroundColor: colors.white,
                overflow: 'hidden',
                alignItems: 'center',
              }}
            >
              <View style={{ marginTop: item.kind === 'henna' ? 270 - HENNA_H : 30 }}>
                {item.kind === 'nails' && item.nails ? (
                  <NailHand design={item.nails} tone={item.tone} width={228} />
                ) : item.henna ? (
                  <HennaHand
                    design={item.henna}
                    tone={item.tone}
                    width={HENNA_W}
                    stage={stageAt(item, now, speed).stage}
                    nails={item.nails}
                  />
                ) : null}
              </View>
            </View>
            <View
              style={{
                marginTop: 10,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  fontFamily: fonts.heading,
                  fontSize: 18,
                  lineHeight: 24,
                  color: frame.ink,
                  includeFontPadding: false,
                }}
              >
                {item.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{ flexShrink: 0, fontFamily: fonts.bodyHeavy, fontSize: 11.5, letterSpacing: 0.5, color: frame.ink }}
              >
                {caption}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text
          accessibilityRole="header"
          style={{ marginBottom: 8, fontFamily: fonts.heading, fontSize: 18, lineHeight: 24, color: colors.plum, includeFontPadding: false }}
        >
          Frame
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {FRAMES.map((f) => {
            const on = f.id === frameId;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFrameId(f.id)}
                accessibilityRole="button"
                accessibilityLabel={`${f.name} frame`}
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  height: 48,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 14,
                  borderWidth: on ? 3.5 : border,
                  borderColor: colors.plum,
                  backgroundColor: colors.white,
                }}
              >
                <View
                  style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: f.bg, borderWidth: 2, borderColor: colors.plum }}
                />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>{f.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={saved ? 'Saved to My hands' : 'Save to My hands'}
          icon={saved ? 'check' : 'save'}
          height={56}
          fontSize={19}
          drop={4}
          onPress={save}
        />
        <Button
          label="Send it — a grown-up helps"
          icon="lock"
          bg={colors.cream}
          height={52}
          fontSize={17}
          drop={0}
          style={{ marginTop: 12 }}
          onPress={send}
        />
      </View>
    </Screen>
  );
}
