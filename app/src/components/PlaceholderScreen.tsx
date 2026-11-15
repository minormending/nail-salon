import React from 'react';
import { Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { RoomTabs, type Room } from './RoomTabs';
import { Screen } from './Screen';
import { TopBar } from './TopBar';

type Props = {
  title: string;
  note?: string;
  room?: Room;
  backTo?: string;
  hideBack?: boolean;
};

/** Stand-in for a screen that isn't built yet: TopBar + title so navigation works. */
export function PlaceholderScreen({ title, note, room, backTo, hideBack }: Props) {
  return (
    <Screen>
      <TopBar title={title} backTo={backTo} hideBack={hideBack} />
      {room ? <RoomTabs current={room} /> : null}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          {note ?? 'Coming soon'}
        </Text>
      </View>
    </Screen>
  );
}
