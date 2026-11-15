import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { gatePassedRecently } from '../src/lib/gate';
import { cancelReminder, scheduleReminder, stageAt } from '../src/lib/stain';
import { useStore, type Settings } from '../src/state/store';
import { border, colors, fonts } from '../src/theme';

const PRIVACY_URL = 'https://minormending.github.io/nail-salon/paisley/privacy.html';

const SPEEDS: { id: Settings['speed']; name: string; note: string }[] = [
  { id: 'real', name: 'Real life', note: 'About two days' },
  { id: 'quick', name: 'Quick', note: 'About two hours' },
];

/** Cancels every pending reminder and forgets its id. */
async function cancelAllReminders() {
  const { items, updateItem } = useStore.getState();
  for (const it of items) {
    if (!it.notificationId) continue;
    await cancelReminder(it.notificationId);
    updateItem(it.id, { notificationId: undefined });
  }
}

/** Reschedules the one reminder of every henna that has not reached its deepest stage yet. */
async function rescheduleAllReminders() {
  const { items, settings, updateItem } = useStore.getState();
  const now = Date.now();
  for (const it of items) {
    if (it.kind !== 'henna' || it.startedAt == null) continue;
    if (stageAt(it, now, settings.speed).stage === 'brown') {
      // already at its deepest: nothing left to remind about
      if (it.notificationId) {
        await cancelReminder(it.notificationId);
        updateItem(it.id, { notificationId: undefined });
      }
      continue;
    }
    const id = await scheduleReminder(it);
    updateItem(it.id, { notificationId: id ?? undefined });
  }
}

function Section({
  children,
  bg = colors.white,
  style,
}: {
  children: React.ReactNode;
  bg?: string;
  style?: object;
}) {
  return (
    <View
      style={[
        { borderWidth: border, borderColor: colors.plum, borderRadius: 18, backgroundColor: bg, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const caps = {
  fontFamily: fonts.bodyHeavy,
  fontSize: 11.5,
  letterSpacing: 1,
  color: colors.plum,
} as const;

export default function Parents() {
  const router = useRouter();
  // Reached by a deep link (paisley:///parents) without the question? Send it through the gate.
  const [allowed] = useState(() => gatePassedRecently());
  useEffect(() => {
    if (!allowed) router.replace('/gate?next=/parents');
  }, [allowed, router]);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  const done = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const setRemind = (on: boolean) => {
    setSettings({ remind: on });
    if (on) rescheduleAllReminders();
    else cancelAllReminders();
  };

  const setSpeed = (speed: Settings['speed']) => {
    if (speed === settings.speed) return;
    setSettings({ speed });
    if (settings.remind) rescheduleAllReminders();
  };

  const version = Constants.expoConfig?.version;

  if (!allowed) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            marginLeft: 4,
            fontFamily: fonts.heading,
            fontSize: 27,
            lineHeight: 34,
            color: colors.plum,
            includeFontPadding: false,
          }}
        >
          For grown-ups
        </Text>
        <Pressable
          onPress={done}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={({ pressed }) => ({
            height: 46,
            paddingHorizontal: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: border,
            borderColor: colors.plum,
            borderRadius: 14,
            backgroundColor: colors.marigold,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.plum, includeFontPadding: false, paddingTop: 2 }}>
            Done
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        <Section>
          <Text style={[caps, { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 4 }]} accessibilityRole="header">
            REMINDERS
          </Text>
          <View
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderTopWidth: 1.5,
              borderTopColor: colors.rule,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.plum }}>Henna reminder</Text>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16.2, color: colors.muted }}>
                One notification when a stain reaches its deepest
              </Text>
            </View>
            <Switch
              value={settings.remind}
              onValueChange={setRemind}
              accessibilityLabel="Henna reminder"
              trackColor={{ false: colors.rule, true: colors.plum }}
              thumbColor={colors.cream}
              ios_backgroundColor={colors.rule}
            />
          </View>
        </Section>

        <Section style={{ paddingTop: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Text style={caps} accessibilityRole="header">
            HOW FAST HENNA DARKENS
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {SPEEDS.map((s) => {
              const on = settings.speed === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSpeed(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${s.name}. ${s.note}`}
                  style={{
                    flex: 1,
                    minHeight: 58,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    borderWidth: border,
                    borderColor: colors.plum,
                    backgroundColor: on ? colors.marigold : colors.cream,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14.5, color: colors.plum }}>{s.name}</Text>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.plum }}>{s.note}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section
          bg={colors.blush}
          style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonts.heading, fontSize: 19, lineHeight: 24, color: colors.plum, includeFontPadding: false }}
          >
            Why there is no black henna
          </Text>
          <Text style={{ marginTop: 6, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 19.5, color: colors.plum }}>
            Real henna only ever stains orange to reddish-brown. “Black henna” is henna mixed with PPD, a hair dye that is not
            allowed on skin and can cause lasting allergic reactions — most often in children. Paisley never shows it as a
            colour.
          </Text>
        </Section>

        <Section style={{ paddingTop: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Text style={caps} accessibilityRole="header">
            PURCHASES
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.plum }}>The Studio</Text>
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: colors.plum,
                backgroundColor: colors.creamDeep,
              }}
            >
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.plum }}>Open — free while it's new</Text>
            </View>
          </View>
          <Text style={{ marginTop: 10, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 19.5, color: colors.plum }}>
            When the Studio becomes a one-time unlock, it stays open on this device for families who already have it.
          </Text>
        </Section>

        <Text
          style={{
            marginTop: 2,
            marginHorizontal: 6,
            textAlign: 'center',
            fontFamily: fonts.bodyBold,
            fontSize: 12.5,
            lineHeight: 18.75,
            color: colors.muted,
          }}
        >
          No account. No ads. No tracking. Pictures stay on this device unless you send them.
        </Text>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Pressable
            onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="Privacy policy"
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.magenta, textDecorationLine: 'underline' }}>
              Privacy policy
            </Text>
          </Pressable>
          {version ? (
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>Paisley version {version}</Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
