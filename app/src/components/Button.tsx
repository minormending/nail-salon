import React from 'react';
import { Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '../theme';
import { HardDrop } from './HardDrop';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Icon after the label (e.g. a forward chevron). */
  trailingIcon?: IconName;
  bg?: string;
  color?: string;
  height?: number;
  fontSize?: number;
  /** Hard drop under the button in px; 0 for a flat button. */
  drop?: number;
  iconFill?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Every button a child can reach has a picture icon beside its words. */
export function Button({
  label,
  icon,
  onPress,
  trailingIcon,
  bg = colors.marigold,
  color = colors.plum,
  height = 56,
  fontSize = 18,
  drop = 5,
  iconFill,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <HardDrop
      onPress={onPress}
      drop={drop}
      radius={radius.button}
      style={style}
      accessibilityLabel={accessibilityLabel ?? label}
      face={{
        height,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: bg,
      }}
    >
      <Icon name={icon} size={22} color={color} fill={iconFill} />
      <Text style={{ fontFamily: fonts.heading, fontSize, color, includeFontPadding: false, paddingTop: 2 }}>
        {label}
      </Text>
      {trailingIcon ? <Icon name={trailingIcon} size={20} color={color} /> : null}
    </HardDrop>
  );
}
