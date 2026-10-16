/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Rules â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import { isValidAlarmTime, isValidTimestamp } from './alarm.rules';

/*â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Types â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”*/
import type {
  Alarm,
  AlarmReconciliationReason,
  AlarmResult,
  AlarmTime,
} from './alarm.types';

function failure<T>(
  code: 'invalid-time' | 'invalid-timestamp' | 'invalid-transition',
): AlarmResult<T> {
  return { ok: false, error: { code } };
}

function parseAlarmTime(time: AlarmTime): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);

  return { hours, minutes };
}

function getLocalOccurrenceAt(
  time: AlarmTime,
  referenceTimestamp: number,
): Date {
  const { hours, minutes } = parseAlarmTime(time);
  const occurrence = new Date(referenceTimestamp);

  occurrence.setHours(hours, minutes, 0, 0);

  return occurrence;
}

function hasConfiguredLocalTime(
  timestamp: number,
  time: AlarmTime,
): boolean {
  const occurrence = new Date(timestamp);
  const hours = String(occurrence.getHours()).padStart(2, '0');
  const minutes = String(occurrence.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}` === time;
}

/**
 * Returns the next local occurrence of an alarm as an absolute timestamp.
 * The local calendar is rebuilt from the reference timestamp on every call,
 * so the result follows device clock and time-zone changes.
 */
export function getNextAlarmActivationAt(
  time: AlarmTime,
  referenceTimestamp: number,
): AlarmResult<number> {
  if (!isValidAlarmTime(time)) {
    return failure('invalid-time');
  }

  if (!isValidTimestamp(referenceTimestamp)) {
    return failure('invalid-timestamp');
  }

  const occurrence = getLocalOccurrenceAt(time, referenceTimestamp);

  if (occurrence.getTime() <= referenceTimestamp) {
    occurrence.setDate(occurrence.getDate() + 1);
  }

  return { ok: true, value: occurrence.getTime() };
}

/**
 * Creates or refreshes the absolute timestamp used by an enabled alarm.
 */
export function scheduleAlarm(
  alarm: Alarm,
  timestamp: number,
): AlarmResult<Alarm> {
  if (!isValidTimestamp(timestamp) || timestamp < alarm.updatedAt) {
    return failure('invalid-timestamp');
  }

  if (alarm.status !== 'scheduled' || !alarm.enabled) {
    return failure('invalid-transition');
  }

  const nextActivation = getNextAlarmActivationAt(alarm.time, timestamp);

  if (!nextActivation.ok) {
    return nextActivation;
  }

  return {
    ok: true,
    value: {
      ...alarm,
      nextActivationAt: nextActivation.value,
      updatedAt: timestamp,
    },
  };
}

/**
 * Reconciles an enabled alarm after a scheduler wake-up or recovery.
 * `activation` is used by the scheduler when the due process was running;
 * `recovery` marks a persisted past occurrence as skipped without alerting.
 */
export function reconcileAlarm(
  alarm: Alarm,
  timestamp: number,
  reason: AlarmReconciliationReason = 'recovery',
): AlarmResult<Alarm> {
  if (!isValidTimestamp(timestamp) || timestamp < alarm.updatedAt) {
    return failure('invalid-timestamp');
  }

  if (alarm.status !== 'scheduled' || !alarm.enabled) {
    return { ok: true, value: alarm };
  }

  const nextActivation = getNextAlarmActivationAt(alarm.time, timestamp);

  if (!nextActivation.ok) {
    return nextActivation;
  }

  const scheduledAt = alarm.nextActivationAt;

  if (scheduledAt === undefined) {
    return {
      ok: true,
      value: {
        ...alarm,
        nextActivationAt: nextActivation.value,
        updatedAt: timestamp,
      },
    };
  }

  if (scheduledAt > timestamp) {
    if (scheduledAt === nextActivation.value) {
      return { ok: true, value: alarm };
    }

    return {
      ok: true,
      value: {
        ...alarm,
        nextActivationAt: nextActivation.value,
        updatedAt: timestamp,
      },
    };
  }

  // A changed device time zone can make the persisted absolute timestamp no
  // longer represent the configured local time. Rebuild the future schedule
  // instead of treating that stale timestamp as a missed alarm.
  if (
    nextActivation.value > timestamp &&
    !hasConfiguredLocalTime(scheduledAt, alarm.time)
  ) {
    return {
      ok: true,
      value: {
        ...alarm,
        nextActivationAt: nextActivation.value,
        updatedAt: timestamp,
      },
    };
  }

  if (reason === 'activation') {
    return {
      ok: true,
      value: {
        ...alarm,
        enabled: false,
        status: 'triggered',
        nextActivationAt: undefined,
        triggeredAt: timestamp,
        updatedAt: timestamp,
      },
    };
  }

  return {
    ok: true,
    value: {
      ...alarm,
      enabled: false,
      status: 'skipped',
      nextActivationAt: undefined,
      skippedAt: timestamp,
      updatedAt: timestamp,
    },
  };
}
