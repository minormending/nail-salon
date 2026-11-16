import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { border, colors, fonts, radius } from '../theme';
import { HardDrop } from './HardDrop';
import { Icon } from './Icon';

/*
 * "Start again" resets at once. Right after, a small Undo chip hangs below the button for a few
 * seconds: tapping it puts everything back exactly as it was. Any other change dismisses it.
 */

const CHIP_MS = 150;
const SHOWN_MS = 6000;

function useReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setOn(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

const NOT_SET = Symbol('not set');
const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

type Props = {
  /**
   * Does the reset. Return a function that puts everything back and the Undo chip appears; return
   * nothing and there is no Undo.
   */
  onConfirm: () => (() => void) | void;
  disabled?: boolean;
  /**
   * The state the screen could change after the reset (painting, inking, zooming...). When any of
   * these changes while the chip is up, the chip goes away and the undo is dropped.
   */
  dismissWhen?: readonly unknown[];
};

export function StartAgainButton({ onConfirm, disabled, dismissWhen = [] }: Props) {
  const reduce = useReduceMotion();
  const [chip, setChip] = useState<{ undo: () => void } | null>(null);
  const [shown, setShown] = useState(false);
  const chipAnim = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseline = useRef<readonly unknown[] | typeof NOT_SET>(NOT_SET);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setChip(null);
    chipAnim.value = withTiming(0, { duration: CHIP_MS });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), CHIP_MS + 30);
  }, [chipAnim]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      cancelAnimation(chipAnim);
    },
    [chipAnim],
  );

  // The first render after a reset is the baseline; any later change drops the chip.
  useEffect(() => {
    if (!chip) return;
    if (baseline.current === NOT_SET) baseline.current = dismissWhen;
    else if (!same(baseline.current, dismissWhen)) dismiss();
  });

  const press = () => {
    if (disabled) return;
    const undo = onConfirm();
    AccessibilityInfo.announceForAccessibility(undo ? 'Started again. Undo is available.' : 'Started again.');
    if (!undo) return;
    baseline.current = NOT_SET;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setChip({ undo });
    setShown(true);
    chipAnim.value = withTiming(1, { duration: CHIP_MS });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, SHOWN_MS);
  };

  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipAnim.value,
    transform: reduce ? [] : [{ scale: 0.92 + 0.08 * chipAnim.value }],
  }));

  return (
    <Animated.View style={{ zIndex: 30 }}>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel="Start again"
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: border,
          borderColor: colors.plum,
          borderRadius: radius.iconButton,
          backgroundColor: colors.cream,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <Icon name="fresh" size={22} color={colors.plum} />
      </Pressable>
      {shown && (
        <Animated.View
          style={[{ position: 'absolute', top: 46 + 8, right: 0, transformOrigin: 'right top' }, chipStyle]}
          pointerEvents={chip ? 'auto' : 'none'}
        >
          <HardDrop
            onPress={() => {
              const undo = chip?.undo;
              dismiss();
              undo?.();
              AccessibilityInfo.announceForAccessibility('Put back.');
            }}
            drop={3}
            radius={999}
            accessibilityLabel="Undo start again"
            face={{
              height: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingLeft: 14,
              paddingRight: 18,
              backgroundColor: colors.cream,
            }}
          >
            <Icon name="undo" size={19} color={colors.plum} />
            <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.plum, includeFontPadding: false }}>
              Undo
            </Text>
          </HardDrop>
        </Animated.View>
      )}
    </Animated.View>
  );
}
