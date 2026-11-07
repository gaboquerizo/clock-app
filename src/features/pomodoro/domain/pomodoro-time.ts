import type { PomodoroCycle } from './pomodoro.types';

function nonNegativeFiniteValue(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Returns the remaining block duration from its absolute deadline or snapshot. */
export function getPomodoroRemainingMs(
  cycle: PomodoroCycle,
  nowMs: number,
): number {
  switch (cycle.status) {
    case 'ready':
      return nonNegativeFiniteValue(cycle.currentBlock.durationMs);
    case 'running':
      return Number.isFinite(nowMs)
        ? nonNegativeFiniteValue(cycle.endsAt - nowMs)
        : 0;
    case 'paused':
      return nonNegativeFiniteValue(cycle.remainingMs);
  }
}
