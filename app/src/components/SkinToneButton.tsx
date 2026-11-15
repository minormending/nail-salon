import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useStore } from '../state/store';
import { border, colors, TONES } from '../theme';
import { Icon } from './Icon';

const SWATCH = 44;
const GAP = 4;
const PAD = 5;
const BTN = 50;
const BOTTOM = 30;
const COL_H = 7 * SWATCH + 6 * GAP + 2 * PAD + 2 * border;
/** Keeps the column below the chips along the top of the canvas. */
const TOP_CLEAR = 12;

/**
 * The round hand button at the bottom-left of the painting screens. Tapping opens a
 * column of the 7 skin tones; choosing one sets the global tone and closes it.
 * Positioned absolutely over the canvas area (left 12, bottom 30) unless `style` overrides.
 *
 * It always fits: the swatches (44pt each) stand in a column above the button when the canvas
 * is tall enough, otherwise they sit in a small grid to the right of the button.
 */
export function SkinToneButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const tone = useStore((s) => s.tone);
  const setTone = useStore((s) => s.setTone);
  const [open, setOpen] = useState(false);
  const current = TONES.find((t) => t.id === tone) ?? TONES[0];
  const iconColor = tone === 't5' || tone === 't6' ? colors.cream : colors.plum;
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  const bottom = (StyleSheet.flatten(style) as ViewStyle | undefined)?.bottom;
  const bottomGap = typeof bottom === 'number' ? bottom : BOTTOM;
  const inColumn = !area || bottomGap + BTN + 8 + COL_H + TOP_CLEAR <= area.h;
  // Beside the button: as many columns as fit, then the fewest rows that hold 7.
  const availW = (area?.w ?? 360) - 12 - BTN - 8 - 12;
  const maxCols = Math.max(
    1,
    Math.min(7, Math.floor((availW - 2 * PAD - 2 * border + GAP) / (SWATCH + GAP))),
  );
  const cols = Math.ceil(7 / Math.ceil(7 / maxCols));
  const gridW = cols * SWATCH + (cols - 1) * GAP + 2 * PAD + 2 * border;

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) =>
        setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3 }}
    >
      <View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 12,
            bottom: BOTTOM,
            flexDirection: inColumn ? 'column-reverse' : 'row',
            alignItems: inColumn ? 'center' : 'flex-end',
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
              flexDirection: inColumn ? 'column-reverse' : 'row',
              flexWrap: inColumn ? 'nowrap' : 'wrap',
              width: inColumn ? undefined : gridW,
              gap: GAP,
              padding: PAD,
              borderWidth: border,
              borderColor: colors.plum,
              borderRadius: inColumn ? 999 : 30,
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
                    width: SWATCH,
                    height: SWATCH,
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
    </View>
  );
}
