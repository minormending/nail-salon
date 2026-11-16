import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { border, colors, fonts, radius } from '../theme';
import { Icon } from './Icon';

/*
 * "Start again" is easy to hit by accident, so it takes two taps: the first turns the button
 * marigold and opens a little speech bubble ("Tap again to start over"); a second tap within three
 * seconds does it. Waiting, or touching anything else, puts it back and changes nothing.
 */

const ARMED_MS = 3000;
const BUBBLE_MS = 150;
const HINT = 'Tap again to start over';

/** Screens call this on any touch; every armed button that was not itself touched stands down. */
const outsideListeners = new Set<() => void>();
export function notifyOutsideTouch() {
  outsideListeners.forEach((f) => f());
}

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

export function StartAgainButton({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);
  const reduce = useReduceMotion();
  const pulse = useSharedValue(1);
  const bubble = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const self = useRef(0);
  const node = useRef<unknown>(null);

  const stand = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
    bubble.value = withTiming(0, { duration: BUBBLE_MS });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), BUBBLE_MS + 30);
  }, [bubble]);

  // A touch anywhere else stands the button down (checked a tick later, once its own touch is known).
  const armedRef = useRef(false);
  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);
  useEffect(() => {
    const listener = (e?: Event) => {
      if (!armedRef.current) return;
      // (On the web the touched element tells us at once whether it was the button.)
      const dom = node.current as { contains?: (n: unknown) => boolean } | null;
      if (e && 'target' in e && dom?.contains?.(e.target)) return;
      setTimeout(() => {
        if (armedRef.current && Date.now() - self.current > 80) stand();
      }, 0);
    };
    outsideListeners.add(listener as () => void);
    // (Touch screens report through the Screen's touch capture; a mouse on the web does not.)
    const doc = Platform.OS === 'web' ? (globalThis as { document?: Document }).document : undefined;
    doc?.addEventListener('pointerdown', listener as EventListener, true);
    return () => {
      outsideListeners.delete(listener as () => void);
      doc?.removeEventListener('pointerdown', listener as EventListener, true);
      if (timer.current) clearTimeout(timer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      cancelAnimation(pulse);
      cancelAnimation(bubble);
    };
  }, [stand, pulse, bubble]);
  useEffect(() => {
    if (disabled && armed) stand();
  }, [disabled, armed, stand]);

  const press = () => {
    if (disabled) return;
    if (armed) {
      stand();
      onConfirm();
      return;
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setArmed(true);
    setShown(true);
    if (!reduce) pulse.value = withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 110 }));
    bubble.value = withTiming(1, { duration: BUBBLE_MS });
    AccessibilityInfo.announceForAccessibility(HINT);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(stand, ARMED_MS);
  };

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubble.value,
    transform: reduce ? [] : [{ scale: 0.92 + 0.08 * bubble.value }],
  }));

  return (
    <Animated.View style={[{ zIndex: 30 }, buttonStyle]}>
      <Pressable
        ref={node as React.Ref<React.ComponentRef<typeof Pressable>>}
        onPress={press}
        onPressIn={() => {
          self.current = Date.now();
        }}
        onTouchStartCapture={() => {
          self.current = Date.now();
        }}
        accessibilityRole="button"
        accessibilityLabel="Start again"
        accessibilityHint={armed ? HINT : undefined}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: border,
          borderColor: colors.plum,
          borderRadius: radius.iconButton,
          backgroundColor: armed ? colors.marigold : colors.cream,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <Icon name="fresh" size={22} color={colors.plum} />
      </Pressable>
      {shown && (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              top: 46 + 9,
              right: 0,
              width: 222,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderWidth: border,
              borderColor: colors.plum,
              borderRadius: 14,
              backgroundColor: colors.cream,
              transformOrigin: 'right top',
            },
            bubbleStyle,
          ]}
        >
          {/* the little point, aimed up at the button */}
          <Animated.View
            style={{
              position: 'absolute',
              top: -8,
              right: 15,
              width: 13,
              height: 13,
              borderLeftWidth: border,
              borderTopWidth: border,
              borderColor: colors.plum,
              backgroundColor: colors.cream,
              transform: [{ rotate: '45deg' }],
            }}
          />
          <Icon name="fresh" size={18} color={colors.plum} />
          <Text style={{ flex: 1, fontFamily: fonts.bodyHeavy, fontSize: 13, color: colors.plum }}>{HINT}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}
