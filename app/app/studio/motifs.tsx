import { useRouter } from 'expo-router';
import React, { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { Button } from '../../src/components/Button';
import { HennaHand } from '../../src/components/HennaHand';
import { IconButton } from '../../src/components/IconButton';
import { MOTIFS, getPickedMotif, motifById, motifThumbXml, setPickedMotif } from '../../src/lib/henna';
import { useStore } from '../../src/state/store';
import { border, colors, fonts, henna } from '../../src/theme';

const FAMILIES: { id: string; name: string; thumb: string }[] = [
  { id: 'all', name: 'All', thumb: 'all' },
  { id: 'mandalas', name: 'Mandalas', thumb: 'mandala' },
  { id: 'paisleys', name: 'Paisleys', thumb: 'paisley' },
  { id: 'vines', name: 'Vines', thumb: 'vine' },
  { id: 'borders', name: 'Borders', thumb: 'cuff-band' },
  { id: 'jaali', name: 'Jaali', thumb: 'jaali' },
];

// the "All" chip: four rounded squares (plum, it is not a motif)
const ALL_XML =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -40 80 80"><g fill="${colors.plum}">` +
  '<rect x="-32" y="-32" width="26" height="26" rx="6"/><rect x="6" y="-32" width="26" height="26" rx="6"/>' +
  '<rect x="-32" y="6" width="26" height="26" rx="6"/><rect x="6" y="6" width="26" height="26" rx="6"/></g></svg>';

const Thumb = memo(function Thumb({ id, size }: { id: string; size: number }) {
  const xml = useMemo(() => (id === 'all' ? ALL_XML : motifThumbXml(motifById(id), henna.brown)), [id]);
  return <SvgXml xml={xml} width={size} height={size} />;
});

export default function Motifs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tone = useStore((s) => s.tone);
  const draft = useStore((s) => s.draftHenna);
  const [family, setFamily] = useState('all');
  const [picked, setPicked] = useState(getPickedMotif());

  const list = MOTIFS.filter((m) => family === 'all' || m.family === family);
  const tile = (Math.min(width, 520) - 32 - 20) / 3;
  const sheetH = Math.min(600, height - insets.top - 40);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/studio' as never));
  const stamp = () => {
    setPickedMotif(picked);
    close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.creamDeep, overflow: 'hidden' }}>
      {/* the Studio's hand behind the sheet, dimmed */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 380, alignItems: 'center', overflow: 'hidden' }}
      >
        <View style={{ marginTop: 60 }}>
          <HennaHand design={draft.source === 'studio' ? draft : { source: 'studio' }} tone={tone} width={300} stage="paste" />
        </View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(64,22,60,0.42)' }} />

      <View
        accessibilityLabel="Motifs"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: sheetH,
          paddingTop: 10,
          paddingHorizontal: 16,
          paddingBottom: Math.max(24, insets.bottom),
          backgroundColor: colors.cream,
          borderTopWidth: border,
          borderTopColor: colors.plum,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
      >
        <View
          style={{ alignSelf: 'center', width: 52, height: 6, borderRadius: 3, backgroundColor: colors.plum, opacity: 0.35, marginBottom: 10 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.heading, fontSize: 27, lineHeight: 30, color: colors.plum, includeFontPadding: false }}
            >
              Motifs
            </Text>
            <Text style={{ marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.muted }}>
              Pick one, then tap the hand to stamp it
            </Text>
          </View>
          <IconButton icon="close" iconSize={18} accessibilityLabel="Close motifs" onPress={close} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Motif family"
          style={{ flexGrow: 0, marginHorizontal: -16, marginVertical: 12 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 2 }}
        >
          {FAMILIES.map((f) => {
            const on = f.id === family;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFamily(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={f.name}
                style={{
                  height: 46,
                  paddingLeft: 10,
                  paddingRight: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 999,
                  borderWidth: border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.turquoise : colors.cream,
                }}
              >
                <Thumb id={f.thumb} size={26} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.plum }}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((m) => {
            const on = m.id === picked;
            return (
              <Pressable
                key={m.id}
                onPress={() => setPicked(m.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m.name}
                style={{
                  width: tile,
                  height: 112,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  borderRadius: 18,
                  borderWidth: on ? 3.5 : border,
                  borderColor: colors.plum,
                  backgroundColor: on ? colors.creamDeep : colors.white,
                }}
              >
                <Thumb id={m.id} size={66} />
                <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12.5, color: colors.plum }}>{m.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button
          label={`Stamp the ${motifById(picked).name.toLowerCase()}`}
          icon="stamp"
          height={56}
          fontSize={19}
          drop={4}
          style={{ marginTop: 14 }}
          onPress={stamp}
        />
      </View>
    </View>
  );
}
