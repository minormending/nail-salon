import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { henna } from '../theme';
import { useStore, type Item } from '../state/store';

export type StainStage = 'paste' | 'orange' | 'red' | 'brown';
export type Speed = 'real' | 'quick';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
// stage thresholds at real speed (ms after startedAt); quick is everything / 24
const STAGES: { stage: StainStage; from: number }[] = [
  { stage: 'paste', from: 0 },
  { stage: 'orange', from: 30 * MIN },
  { stage: 'red', from: 12 * HOUR },
  { stage: 'brown', from: 36 * HOUR },
];
const QUICK_DIVISOR = 24;

export const STAGE_COLOR: Record<StainStage, string> = {
  paste: henna.paste,
  orange: henna.orange,
  red: henna.red,
  brown: henna.brown,
};

const scale = (speed: Speed) => (speed === 'quick' ? 1 / QUICK_DIVISOR : 1);

/** Timestamp (ms) at which a design started at `startedAt` reaches its deepest stage. */
export function deepestAt(startedAt: number, speed: Speed): number {
  return startedAt + STAGES[STAGES.length - 1].from * scale(speed);
}

/**
 * Current stain stage, and when the next stage begins (null at the deepest).
 * Pure: pass `now` in. A design with no `startedAt` has not been started, so it is paste.
 */
export function stageAt(
  item: Pick<Item, 'startedAt'>,
  now: number,
  speed: Speed,
): { stage: StainStage; nextAt: number | null } {
  if (item.startedAt == null) return { stage: 'paste', nextAt: null };
  const elapsed = Math.max(0, now - item.startedAt);
  const k = scale(speed);
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (elapsed >= STAGES[i].from * k) index = i;
  }
  const next = STAGES[index + 1];
  return {
    stage: STAGES[index].stage,
    nextAt: next ? item.startedAt + next.from * k : null,
  };
}

/**
 * Schedules the one reminder, at the deepest stage. Asks for notification permission
 * here (the first time a henna is finished), never at launch. Returns the notification
 * id, or null when not permitted, not due in the future, or the platform can't schedule.
 */
export async function scheduleReminder(item: Item): Promise<string | null> {
  if (item.startedAt == null) return null;
  const { settings } = useStore.getState();
  if (!settings.remind) return null; // grown-up setting is off
  const at = deepestAt(item.startedAt, settings.speed);
  if (at <= Date.now() + 1000) return null;
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Henna reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (item.notificationId) await cancelReminder(item.notificationId);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your henna is at its deepest',
        body: `${item.name || 'Your henna'} has darkened all the way. Come and take a look!`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelReminder(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already fired or never existed
  }
}
