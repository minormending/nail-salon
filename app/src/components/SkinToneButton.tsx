import React, { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStore } from '../state/store';
import { border, colors, TONES } from '../theme';
import { Icon } from './Icon';

/**
 * The round hand button at the bottom-left of the painting screens. Tapping opens a
 * column of the 7 skin tones; choosing one sets the global tone and closes it.
 * Positioned absolutely over the canvas area (left 12, bottom 30) unless `style` overrides.
 */
export function SkinToneButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const tone = useStore((s) => s.tone);
  const setTone = useStore((s) => s.setTone);
  const [open, setOpen] = useState(false);
  const current = TONES.find((t) => t.id === tone) ?? TONES[0];
  const iconColor = tone === 't5' || tone === 't6' ? colors.cream : colors.plum;

  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 12,
          bottom: 30,
          zIndex: 3,
          flexDirection: 'column-reverse',
          alignItems: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      <View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 3,
            bottom: -3,
            borderRadius: 999,
            backgroundColor: colors.plum,
          }}
        />
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Skin colour"
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => ({
            width: 50,
            height: 50,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            borderWidth: border,
            borderColor: colors.plum,
            backgroundColor: current.skin,
            transform: [{ translateY: pressed ? 3 : 0 }],
          })}
        >
          <Icon name="hand" size={26} color={iconColor} />
        </Pressable>
      </View>
      {open && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Skin colour"
          style={{
            flexDirection: 'column-reverse',
            gap: 4,
            padding: 5,
            borderWidth: border,
            borderColor: colors.plum,
            borderRadius: 999,
            backgroundColor: colors.cream,
          }}
        >
          {TONES.map((t) => {
            const on = t.id === tone;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t.label}
                onPress={() => {
                  setTone(t.id);
                  setOpen(false);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  borderWidth: on ? 3.5 : 2,
                  borderColor: on ? colors.magenta : colors.plum,
                  backgroundColor: t.skin,
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
