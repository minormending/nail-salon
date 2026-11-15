import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { border, colors, fonts } from '../theme';
import { Icon, type IconName } from './Icon';

export type Room = 'nails' | 'stickers' | 'henna';

const TABS: { id: Room; label: string; icon: IconName; href: string }[] = [
  { id: 'nails', label: 'Nails', icon: 'nails', href: '/salon/nails' },
  { id: 'stickers', label: 'Stickers', icon: 'star', href: '/salon/nails?zoom=thumb' },
  { id: 'henna', label: 'Henna', icon: 'henna', href: '/salon/henna' },
];

/**
 * The Nails / Stickers / Henna tab strip under the Salon header. `onSelect` lets the nail chair
 * handle Nails and Stickers itself (they are one screen, zoomed out and in); return true if handled.
 */
export function RoomTabs({ current, onSelect }: { current: Room; onSelect?: (room: Room) => boolean | void }) {
  const router = useRouter();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Salon tables"
      style={{
        flexDirection: 'row',
        gap: 6,
        marginHorizontal: 14,
        marginBottom: 10,
        padding: 4,
        borderWidth: border,
        borderColor: colors.plum,
        borderRadius: 16,
        backgroundColor: colors.creamDeep,
      }}
    >
      {TABS.map((t) => {
        const on = t.id === current;
        const fg = on ? colors.cream : colors.plum;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            onPress={() => {
              if (on || onSelect?.(t.id)) return;
              router.replace(t.href as never);
            }}
            style={{
              flex: 1,
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRadius: 11,
              backgroundColor: on ? colors.magenta : 'transparent',
            }}
          >
            <Icon name={t.icon} size={22} color={fg} />
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 14, color: fg }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
