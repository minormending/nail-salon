import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

/** Cream full-screen ground that keeps clear of the status bar (the canvas's 44px spacer). */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}
