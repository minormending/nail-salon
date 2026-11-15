import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, colors } from '../theme';

type Props = {
  onPress?: () => void;
  /** Height of the hard plum drop under the face (the canvas's `0 5px 0 #40163C`). */
  drop?: number;
  radius: number;
  /** Face styles: background, padding, flex layout of the content. */
  face?: StyleProp<ViewStyle>;
  /** Outer styles: width, flex, margins. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  disabled?: boolean;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  children?: React.ReactNode;
};

/**
 * A pressable face with a 2.5px plum border and a hard plum drop offset behind it.
 * (React Native has no box-shadow without blur, so the drop is a plum view behind.)
 * Pressing slides the face down onto the drop.
 */
export function HardDrop({
  onPress,
  drop = 5,
  radius,
  face,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
  accessibilityState,
  children,
}: Props) {
  return (
    <View style={[{ paddingBottom: drop }, style]}>
      {drop > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { top: drop, backgroundColor: colors.plum, borderRadius: radius },
          ]}
        />
      )}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          {
            borderWidth: border,
            borderColor: colors.plum,
            borderRadius: radius,
            transform: [{ translateY: pressed ? drop : 0 }],
          },
          face,
        ]}
      >
        {children}
      </Pressable>
    </View>
  );
}
