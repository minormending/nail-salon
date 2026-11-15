import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { border, colors, radius } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  bg?: string;
  color?: string;
  size?: number;
  iconSize?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Square 46px button with a picture icon; the label is read aloud, not shown. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  bg = colors.cream,
  color = colors.plum,
  size = 46,
  iconSize = 20,
  radius: borderRadius = radius.iconButton,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: border,
          borderColor: colors.plum,
          borderRadius,
          backgroundColor: bg,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}
