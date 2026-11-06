import type { PomodoroCycle } from '@/features/pomodoro/domain/pomodoro.types';

const MILLIS_PER_SECOND = 1_000;
const MILLIS_PER_MINUTE = 60 * MILLIS_PER_SECOND;
const MILLIS_PER_HOUR = 60 * MILLIS_PER_MINUTE;

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function getPomodoroRemainingMs(
  cycle: PomodoroCycle,
  nowMs: number,
): number {
  switch (cycle.status) {
    case 'ready':
      return Math.max(0, cycle.currentBlock.durationMs);
    case 'running':
      return Number.isFinite(nowMs)
        ? Math.max(0, cycle.endsAt - nowMs)
        : 0;
    case 'paused':
      return Math.max(0, cycle.remainingMs);
  }
}

export function formatPomodoroCountdown(
  remainingMs: number,
  assignedDurationMs: number,
): string {
  const safeRemainingMs = Number.isFinite(remainingMs)
    ? Math.max(0, remainingMs)
    : 0;
  const totalSeconds = Math.ceil(safeRemainingMs / MILLIS_PER_SECOND);
  const seconds = totalSeconds % 60;

  if (
    Number.isFinite(assignedDurationMs) &&
    assignedDurationMs >= MILLIS_PER_HOUR
  ) {
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);

    return [hours, minutes, seconds].map(padTimePart).join(':');
  }

  const minutes = Math.floor(totalSeconds / 60);

  return [minutes, seconds].map(padTimePart).join(':');
}
