import type {
  TimerDurationMs,
  TimerId,
  TimerTimestampMs,
} from './timer.types';

export function isValidTimerId(value: unknown): value is TimerId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value
  );
}

export function isValidTimerDuration(
  value: unknown,
): value is TimerDurationMs {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

export function isValidTimerTimestamp(
  value: unknown,
): value is TimerTimestampMs {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  );
}

export function hasDuplicateTimerId(
  timers: readonly { id: TimerId }[],
  id: TimerId,
): boolean {
  return timers.some((timer) => timer.id === id);
}
