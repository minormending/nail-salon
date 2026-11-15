import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { makeQuestion, markGatePassed, type GateQuestion } from '../src/lib/gate';
import { shareItem } from '../src/lib/pictures';
import { colors, fonts } from '../src/theme';

// ?next=/parents  |  ?next=share&id=<itemId>
export default function Gate() {
  const router = useRouter();
  const { next, id } = useLocalSearchParams<{ next?: string; id?: string }>();
  const [q, setQ] = useState<GateQuestion>(() => makeQuestion());
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const goNext = useCallback(async () => {
    if (next === '/parents') {
      router.replace('/parents');
    } else if (next === 'share' && id) {
      // open the share sheet; when it closes, return to the share screen
      await shareItem(id);
      close();
    } else {
      setDone(true); // nothing to open: offer Grown-up settings
    }
  }, [next, id, router, close]);

  const pick = (n: number) => {
    if (picked !== null || done) return;
    setPicked(n);
    if (n === q.answer) {
      markGatePassed();
      timer.current = setTimeout(goNext, 350);
    } else {
      // gentle message, then a fresh question
      timer.current = setTimeout(() => {
        setQ(makeQuestion(q.answer));
        setPicked(null);
      }, 1600);
    }
  };

  const right = picked === q.answer;
  const msg = picked === null ? '' : right ? 'Thank you, grown-up.' : 'Not quite — a grown-up can try again.';

  return (
    <Screen style={{ backgroundColor: colors.plum }}>
      <StatusBar style="light" />
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 14 }}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2.5,
            borderColor: colors.cream,
            borderRadius: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="close" size={18} color={colors.cream} />
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingTop: 4, paddingHorizontal: 26, paddingBottom: 28 }}>
        <View
          accessibilityElementsHidden
          style={{
            width: 74,
            height: 74,
            borderRadius: 24,
            backgroundColor: colors.marigold,
            borderWidth: 2.5,
            borderColor: colors.cream,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={colors.plum} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={4.5} y={10.5} width={15} height={10} rx={2} />
            <Path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" />
            <Circle cx={12} cy={15.5} r={1.4} fill={colors.plum} />
          </Svg>
        </View>
        <Text
          accessibilityRole="header"
          style={{ marginTop: 18, fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, color: colors.cream, includeFontPadding: false }}
        >
          Ask a grown-up
        </Text>
        <Text style={{ marginTop: 10, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22.5, color: colors.cream }}>
          Everything to make and play with stays open. This question only guards things that cost money or leave this device.
        </Text>

        <Text
          accessibilityRole="header"
          style={{ marginTop: 30, marginBottom: 14, fontFamily: fonts.heading, fontSize: 26, lineHeight: 34, color: colors.cream, includeFontPadding: false }}
        >
          {q.text}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {q.choices.map((n) => {
            const on = n === picked;
            return (
              <Pressable
                key={n}
                onPress={() => pick(n)}
                accessibilityRole="button"
                accessibilityLabel={String(n)}
                style={{
                  flexGrow: 1,
                  flexBasis: '40%',
                  height: 66,
                  borderRadius: 18,
                  borderWidth: 2.5,
                  borderColor: colors.cream,
                  backgroundColor: on ? (right ? colors.marigold : colors.cream) : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: 28,
                    lineHeight: 36,
                    color: on ? colors.plum : colors.cream,
                    includeFontPadding: false,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ marginTop: 16, minHeight: 22, fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.marigold }}
        >
          {msg}
        </Text>

        {done ? (
          <View style={{ marginTop: 'auto' }}>
            <Pressable
              onPress={() => router.replace('/parents')}
              accessibilityRole="button"
              accessibilityLabel="Grown-up settings"
              style={({ pressed }) => ({
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                borderWidth: 2.5,
                borderColor: colors.cream,
                borderRadius: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.cream} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={3} />
                <Path d="M12 2.5 v3 M12 18.5 v3 M2.5 12 h3 M18.5 12 h3 M5.3 5.3 l2.1 2.1 M16.6 16.6 l2.1 2.1 M5.3 18.7 l2.1 -2.1 M16.6 7.4 l2.1 -2.1" />
                <Circle cx={12} cy={12} r={6.5} />
              </Svg>
              <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: colors.cream, includeFontPadding: false, paddingTop: 2 }}>
                Grown-up settings
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
