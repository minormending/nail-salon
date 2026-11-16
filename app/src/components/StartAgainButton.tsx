import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

type UndoFn = () => void;
export type UndoChipApi = {
  /** Show the chip (or nothing, if there is nothing to undo). */
  offer: (undo: UndoFn | void) => void;
  /** Render this once, as the LAST child of the Screen: it floats over the canvas just under the header. */
  chip: React.ReactNode;
};

/**
 * The Undo chip's state and its floating overlay. It lives with the screen, not with the header
 * button: Android only delivers a touch inside the bounds of the views above it, so a chip hanging
 * out of the 46px button would never be tapped. `dismissWhen` is the state the screen could change
 * after the reset (painting, inking, zooming...); when any of it changes the chip goes away.
 */
export function useUndoChip(dismissWhen: readonly unknown[] = []): UndoChipApi {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [undo, setUndo] = useState<{ fn: UndoFn } | null>(null);
  const [shown, setShown] = useState(false);
  const anim = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseline = useRef<readonly unknown[] | typeof NOT_SET>(NOT_SET);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setUndo(null);
    anim.value = withTiming(0, { duration: CHIP_MS });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), CHIP_MS + 30);
  }, [anim]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      cancelAnimation(anim);
    },
    [anim],
  );

  // The first render after a reset is the baseline; any later change drops the chip.
  useEffect(() => {
    if (!undo) return;
    if (baseline.current === NOT_SET) baseline.current = dismissWhen;
    else if (!same(baseline.current, dismissWhen)) dismiss();
  });

  const offer = useCallback(
    (fn: UndoFn | void) => {
      AccessibilityInfo.announceForAccessibility(fn ? 'Started again. Undo is available.' : 'Started again.');
      if (!fn) return;
      baseline.current = NOT_SET;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setUndo({ fn });
      setShown(true);
      anim.value = withTiming(1, { duration: CHIP_MS });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(dismiss, SHOWN_MS);
    },
    [anim, dismiss],
  );

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: reduce ? [] : [{ scale: 0.92 + 0.08 * anim.value }],
  }));

  const chip = shown ? (
    <Animated.View
      // Under the header (60px) at the right, over the canvas; its bounds are its own, so it takes touches on every platform.
      style={[
        { position: 'absolute', top: insets.top + 62, right: 14, zIndex: 50, transformOrigin: 'right top' },
        style,
      ]}
      pointerEvents={undo ? 'auto' : 'none'}
    >
      <HardDrop
        onPress={() => {
          const fn = undo?.fn;
          dismiss();
          fn?.();
          AccessibilityInfo.announceForAccessibility('Put back.');
        }}
        drop={3}
        radius={999}
        accessibilityLabel="Undo start again"
        face={{
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          backgroundColor: colors.cream,
        }}
      >
        <Icon name="undo" size={19} color={colors.plum} />
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.plum, includeFontPadding: false, flexShrink: 0 }}
        >
          Undo
        </Text>
      </HardDrop>
    </Animated.View>
  ) : null;

  return { offer, chip };
}

type Props = {
  /**
   * Does the reset. Return a function that puts everything back and the Undo chip appears; return
   * nothing and there is no Undo.
   */
  onConfirm: () => UndoFn | void;
  disabled?: boolean;
  /** From `useUndoChip`; the screen renders its `chip`. */
  undo: UndoChipApi;
};

/** The header's Start again button: it resets at once and offers an Undo. */
export function StartAgainButton({ onConfirm, disabled, undo }: Props) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        undo.offer(onConfirm());
      }}
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
  );
}
