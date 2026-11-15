import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { colors, fonts } from '../theme';
import { IconButton } from './IconButton';

type Props = {
  title: string;
  /** Where Back goes; defaults to the previous screen, or Home if there isn't one. */
  backTo?: string;
  /** Hide Back (e.g. the grown-ups screen has its own Done button). */
  hideBack?: boolean;
  /** Extra icon buttons on the right. */
  right?: React.ReactNode;
};

/** The header on the Salon screens: Back, big title, then action buttons. */
export function TopBar({ title, backTo, hideBack, right }: Props) {
  const router = useRouter();
  const goBack = () => {
    if (backTo) router.replace(backTo as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return (
    <View
      style={{
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
      }}
    >
      {!hideBack && <IconButton icon="back" accessibilityLabel="Back" onPress={goBack} />}
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
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
