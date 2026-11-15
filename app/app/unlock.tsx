import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { HennaHand } from '../src/components/HennaHand';
import { Icon } from '../src/components/Icon';
import { useStore, type HennaDesign } from '../src/state/store';
import { border, colors, fonts } from '../src/theme';

// Not reachable in v1: the Studio is open for everyone. Kept ready for a future one-time unlock.
const GETS = [
  'A real henna cone, with nib width and pressure',
  'Motif stamps, mirroring and jaali fill',
  'Layers, and undo for every stroke',
  'One payment, on every device your family owns',
  'The Salon stays free and complete, forever',
];

const STENCIL: HennaDesign = { source: 'stencil', parts: ['gol', 'vines', 'cuff'] };

export default function Unlock() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tone = useStore((s) => s.tone);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View
        style={{
          backgroundColor: colors.turquoise,
          borderBottomWidth: border,
          borderBottomColor: colors.plum,
          paddingTop: insets.top,
          paddingHorizontal: 18,
          paddingBottom: 18,
        }}
      >
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            position: 'absolute',
            top: insets.top + 10,
            right: 14,
            zIndex: 2,
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: border,
            borderColor: colors.plum,
            borderRadius: 14,
            backgroundColor: colors.cream,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="close" size={18} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end', marginTop: 12 }}>
          <View
            style={{
              width: 112,
              height: 148,
              borderWidth: border,
              borderColor: colors.plum,
              borderRadius: 18,
              backgroundColor: colors.white,
              overflow: 'hidden',
              alignItems: 'center',
            }}
          >
            <View style={{ marginTop: 2 }}>
              <HennaHand design={STENCIL} tone={tone} width={124} stage="brown" hands="left" />
            </View>
          </View>
          <View style={{ flex: 1, paddingBottom: 4 }}>
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11.5, letterSpacing: 1, color: colors.plum }}>THE OTHER ROOM</Text>
            <Text
              accessibilityRole="header"
              style={{ marginTop: 2, fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, color: colors.plum, includeFontPadding: false }}
            >
              The Studio
            </Text>
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 30, lineHeight: 34, color: colors.plum, includeFontPadding: false }}>
                $5.99
              </Text>
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum }}>once</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, paddingTop: 16, paddingHorizontal: 18 }}>
        <View style={{ gap: 10 }}>
          {GETS.map((g) => (
            <View key={g} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  backgroundColor: colors.marigold,
                  borderWidth: 2,
                  borderColor: colors.plum,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={14} />
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 14.5, lineHeight: 19.6, color: colors.plum }}>{g}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: border,
            borderColor: colors.plum,
            borderRadius: 18,
            backgroundColor: colors.white,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11.5, letterSpacing: 1, color: colors.plum }}>
            WHAT YOU WILL NEVER SEE
          </Text>
          <Text style={{ marginTop: 6, fontFamily: fonts.heading, fontSize: 18, lineHeight: 22.5, color: colors.plum }}>
            No ads. No subscription. No account. No internet needed.
          </Text>
          <Text style={{ marginTop: 4, fontFamily: fonts.bodyBold, fontSize: 12.5, lineHeight: 17.5, color: colors.muted }}>
            Nothing a child taps can ever cost you money.
          </Text>
        </View>
      </View>

      <View style={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 26, gap: 10 }}>
        <Button label="Unlock the Studio — $5.99" icon="unlock" height={58} fontSize={20} drop={4} onPress={back} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable
            onPress={back}
            accessibilityRole="button"
            style={{ height: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum, textDecorationLine: 'underline' }}>
              Restore a purchase
            </Text>
          </Pressable>
          <Pressable
            onPress={back}
            accessibilityRole="button"
            style={{ height: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.plum }}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
