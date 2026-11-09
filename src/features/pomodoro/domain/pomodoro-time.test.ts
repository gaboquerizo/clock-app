import { describe, expect, it } from 'vitest';

import { getPomodoroRemainingMs } from './pomodoro-time';
import type { PomodoroCycle } from './pomodoro.types';

const referenceTimestamp = 1_800_000_000_000;

function readyCycle(durationMs = 25 * 60_000): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 0,
    currentBlock: { id: 'focus-one', type: 'focus', durationMs },
  };
}

describe('Pomodoro remaining time calculations', () => {
  it('returns the assigned duration for a ready block', () => {
    expect(getPomodoroRemainingMs(readyCycle(90_000), referenceTimestamp)).toBe(
      90_000,
    );
  });

  it('derives a running block from its absolute deadline', () => {
    const running: PomodoroCycle = {
      ...readyCycle(),
      status: 'running',
      startedAt: referenceTimestamp,
      endsAt: referenceTimestamp + 90_000,
    };

    expect(
      getPomodoroRemainingMs(running, referenceTimestamp + 25_000),
    ).toBe(65_000);
    expect(getPomodoroRemainingMs(running, running.endsAt)).toBe(0);
    expect(getPomodoroRemainingMs(running, running.endsAt + 5_000)).toBe(0);
    expect(getPomodoroRemainingMs(running, Number.NaN)).toBe(0);
  });

  it('keeps a paused snapshot unchanged as the reference time advances', () => {
    const paused: PomodoroCycle = {
      ...readyCycle(),
      status: 'paused',
      remainingMs: 42_500,
    };

    expect(getPomodoroRemainingMs(paused, referenceTimestamp)).toBe(42_500);
    expect(getPomodoroRemainingMs(paused, referenceTimestamp + 86_400_000)).toBe(
      42_500,
    );
  });

  it('clamps malformed or negative durations to zero', () => {
    expect(getPomodoroRemainingMs(readyCycle(-1), referenceTimestamp)).toBe(0);
    expect(
      getPomodoroRemainingMs(
        { ...readyCycle(), status: 'paused', remainingMs: Number.POSITIVE_INFINITY },
        referenceTimestamp,
      ),
    ).toBe(0);
  });
});
