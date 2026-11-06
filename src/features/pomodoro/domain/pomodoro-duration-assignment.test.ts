import { describe, expect, it } from 'vitest';

import {
  applyPomodoroPreferencesToCycle,
  assignPomodoroBlockDuration,
} from './pomodoro-duration-assignment';
import { resetPomodoroBlock } from './pomodoro-reset';
import { transitionPomodoroCycle } from './pomodoro';
import type {
  PomodoroBlockType,
  PomodoroCycle,
  PomodoroPreferences,
  PomodoroResult,
  RunningPomodoroCycle,
} from './pomodoro.types';

const timestampMs = 1_800_000_000_000;

const preferences: PomodoroPreferences = {
  focusDurationMinutes: 30,
  shortBreakDurationMinutes: 6,
  longBreakDurationMinutes: 18,
};

function readyCycle(
  type: PomodoroBlockType = 'focus',
  completedFocusCount = 0,
): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount,
    currentBlock: {
      id: 'block-one',
      type,
      durationMs: 25 * 60_000,
    },
  };
}

function unwrap<T>(result: PomodoroResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Pomodoro domain error: ${result.error.code}`);
  }

  return result.value;
}

function start(cycle: PomodoroCycle): RunningPomodoroCycle {
  const result = unwrap(
    transitionPomodoroCycle(cycle, { type: 'start', timestampMs }),
  );

  if (result.status !== 'running') {
    throw new Error('Expected the Pomodoro block to be running.');
  }

  return result;
}

describe('Pomodoro duration assignment', () => {
  it.each([
    ['focus', 30],
    ['short-break', 6],
    ['long-break', 18],
  ] as const)(
    'assigns the current preference to a newly prepared %s block',
    (type, minutes) => {
      expect(assignPomodoroBlockDuration(type, preferences)).toEqual({
        ok: true,
        value: minutes * 60_000,
      });
    },
  );

  it('updates a prepared block when its preference changes', () => {
    const current = readyCycle('short-break', 2);
    const updated = unwrap(
      applyPomodoroPreferencesToCycle(current, preferences),
    );

    expect(updated).toEqual({
      ...current,
      currentBlock: { ...current.currentBlock, durationMs: 6 * 60_000 },
    });
    expect(current.currentBlock.durationMs).toBe(25 * 60_000);
  });

  it('preserves an assigned running duration when preferences change', () => {
    const current = start(readyCycle());

    expect(
      applyPomodoroPreferencesToCycle(current, {
        ...preferences,
        focusDurationMinutes: 45,
      }),
    ).toEqual({ ok: true, value: current });
  });

  it('preserves an assigned paused duration and remaining time when preferences change', () => {
    const current = start(readyCycle());
    const paused = unwrap(
      transitionPomodoroCycle(current, {
        type: 'pause',
        timestampMs: timestampMs + 5 * 60_000,
      }),
    );

    expect(
      applyPomodoroPreferencesToCycle(paused, {
        ...preferences,
        focusDurationMinutes: 45,
      }),
    ).toEqual({ ok: true, value: paused });
  });

  it('keeps the assigned duration when a prepared block is reset', () => {
    const prepared = unwrap(
      applyPomodoroPreferencesToCycle(readyCycle(), {
        ...preferences,
        focusDurationMinutes: 45,
      }),
    );
    const reset = unwrap(resetPomodoroBlock(prepared, 'block-two'));

    expect(reset.currentBlock.durationMs).toBe(45 * 60_000);
    expect(reset.status).toBe('ready');
  });

  it('rejects invalid preferences without changing the cycle', () => {
    const current = readyCycle();
    const invalidPreferences = {
      ...preferences,
      shortBreakDurationMinutes: 181,
    };

    expect(
      applyPomodoroPreferencesToCycle(current, invalidPreferences),
    ).toEqual({ ok: false, error: { code: 'invalid-preferences' } });
    expect(
      assignPomodoroBlockDuration('focus', invalidPreferences),
    ).toEqual({ ok: false, error: { code: 'invalid-preferences' } });
  });
});
