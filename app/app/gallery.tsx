import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { HennaHand } from '../src/components/HennaHand';
import { Icon, type IconName } from '../src/components/Icon';
import { IconButton } from '../src/components/IconButton';
import { NailHand } from '../src/components/NailHand';
import { Screen } from '../src/components/Screen';
import { deletePicture } from '../src/lib/pictures';
import { cancelReminder, deepestAt, stageAt } from '../src/lib/stain';
import { emptyNailDesign, useStore, type Item } from '../src/state/store';
import { border, colors, fonts } from '../src/theme';

type Filter = 'all' | 'henna' | 'nails';
const FILTERS: { id: Filter; name: string; icon: IconName }[] = [
  { id: 'all', name: 'Everything', icon: 'grid' },
  { id: 'henna', name: 'Henna', icon: 'henna' },
  { id: 'nails', name: 'Nails', icon: 'nails' },
];

const DAY = 24 * 60 * 60 * 1000;
const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekday(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { weekday: 'long' });
}

/** "Saved today" / "Yesterday" / a weekday this week / a date. */
function savedWhen(createdAt: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY);
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekday(createdAt);
  const sameYear = new Date(createdAt).getFullYear() === new Date(now).getFullYear();
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function hennaWhen(item: Item, now: number, speed: 'real' | 'quick'): { text: string; chip: string } {
  const { stage } = stageAt(item, now, speed);
  if (item.startedAt == null || stage === 'paste') return { text: 'Paste · drying', chip: colors.white };
  if (stage === 'brown') {
    const day = 1 + Math.floor(Math.max(0, now - item.startedAt) / DAY);
    return { text: `Day ${day} · deepest`, chip: colors.blush };
  }
  const ready = deepestAt(item.startedAt, speed);
  const days = Math.round((startOfDay(ready) - startOfDay(now)) / DAY);
  const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : weekday(ready);
  return { text: `Darkening · ready ${when}`, chip: colors.marigold };
}

function countText(n: number): string {
  const word = n <= 12 ? NUMBER_WORDS[n] : String(n);
  return `${word} saved · henna keeps changing after you leave`;
}

function confirmRemove(name: string, onRemove: () => void) {
  const title = 'Take this hand out of My hands?';
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${name}`)) onRemove();
    return;
  }
  Alert.alert(title, name, [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Take it out', style: 'destructive', onPress: onRemove },
  ]);
}

export default function Gallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const items = useStore((s) => s.items);
  const speed = useStore((s) => s.settings.speed);
  const [filter, setFilter] = useState<Filter>('all');
  const [now, setNow] = useState(() => Date.now());

  // Henna keeps changing while you're away: recompute the stages whenever this screen shows.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const startNew = () => {
    useStore.getState().setDraftNails(emptyNailDesign());
    router.push('/salon/nails');
  };

  const open = (item: Item) => {
    if (item.kind === 'nails' && item.nails) {
      useStore.getState().setDraftNails(item.nails);
      router.push('/salon/nails');
    } else if (item.kind === 'henna') {
      router.push(`/stain/${item.id}`);
    }
  };

  const remove = (item: Item) =>
    confirmRemove(item.name, async () => {
      await cancelReminder(item.notificationId);
      deletePicture(item.pictureUri);
      useStore.getState().removeItem(item.id);
    });

  const shown = items.filter((it) => filter === 'all' || it.kind === filter);
  const cardW = (width - 32 - 14) / 2;

  return (
    <Screen>
      <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <IconButton icon="back" accessibilityLabel="Back to home" onPress={goBack} />
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, color: colors.plum, includeFontPadding: false }}
          >
            My hands
          </Text>
          <Text style={{ marginTop: 2, fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted }}>
            {items.length === 0 ? 'Nothing saved yet' : countText(items.length)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 12 }}>
        {FILTERS.map((f) => {
          const on = f.id === filter;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                height: 46,
                paddingLeft: 12,
                paddingRight: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                borderRadius: 999,
                borderWidth: border,
                borderColor: colors.plum,
                backgroundColor: on ? colors.marigold : colors.cream,
              }}
            >
              <Icon name={f.icon} size={22} />
              <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.plum }}>{f.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {shown.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 }}>
            <Icon name={items.length === 0 ? 'hand' : FILTERS.find((f) => f.id === filter)!.icon} size={44} color={colors.muted} />
            <Text style={{ fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, color: colors.plum, textAlign: 'center' }}>
              {items.length === 0
                ? 'Nothing here yet'
                : filter === 'henna'
                  ? 'No henna yet'
                  : 'No nails yet'}
            </Text>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' }}>
              {items.length === 0
                ? 'Decorate a hand and it will wait for you here.'
                : 'Start a new hand and it will show up here.'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {shown.map((item) => {
              const isHenna = item.kind === 'henna';
              const when = isHenna
                ? hennaWhen(item, now, speed)
                : { text: savedWhen(item.createdAt, now), chip: colors.white };
              return (
                <Pressable
                  key={item.id}
                  onPress={() => open(item)}
                  onLongPress={() => remove(item)}
                  delayLongPress={500}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}. ${when.text}`}
                  accessibilityHint="Long press to take it out of My hands"
                  accessibilityActions={[{ name: 'longpress', label: 'Take it out' }]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'longpress') remove(item);
                  }}
                  style={({ pressed }) => ({
                    width: cardW,
                    borderWidth: border,
                    borderColor: colors.plum,
                    borderRadius: 18,
                    backgroundColor: colors.white,
                    overflow: 'hidden',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      height: 168,
                      alignItems: 'center',
                      overflow: 'hidden',
                      borderBottomWidth: border,
                      borderBottomColor: colors.plum,
                    }}
                  >
                    <View style={{ marginTop: isHenna ? 4 : 8 }} pointerEvents="none">
                      {isHenna && item.henna ? (
                        <HennaHand
                          design={item.henna}
                          tone={item.tone}
                          width={150}
                          stage={stageAt(item, now, speed).stage}
                        />
                      ) : item.nails ? (
                        <NailHand design={item.nails} tone={item.tone} width={118} />
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexGrow: 1, paddingTop: 9, paddingHorizontal: 10, paddingBottom: 11, backgroundColor: colors.cream }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.heading, fontSize: 16, lineHeight: 20, color: colors.plum, includeFontPadding: false }}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 6,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: colors.plum,
                        backgroundColor: when.chip,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 10.5, letterSpacing: 0.2, color: colors.plum }}>
                        {when.text}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: Math.max(22, insets.bottom + 8),
          borderTopWidth: border,
          borderTopColor: colors.plum,
          backgroundColor: colors.creamDeep,
        }}
      >
        <Button label="Start a new hand" icon="plus" height={56} fontSize={19} drop={4} onPress={startNew} />
      </View>
    </Screen>
  );
}
