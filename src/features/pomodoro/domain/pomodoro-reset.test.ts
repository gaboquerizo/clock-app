import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POMODORO_PREFERENCES,
} from './pomodoro-preferences';
import { resetPomodoroBlock, resetPomodoroCycle } from './pomodoro-reset';
import { transitionPomodoroCycle } from './pomodoro';
import type {
  PomodoroCycle,
  PomodoroResult,
  RunningPomodoroCycle,
} from './pomodoro.types';

const timestampMs = 1_800_000_000_000;

function readyFocus(): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 0,
    currentBlock: {
      id: 'focus-one',
      type: 'focus',
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

function running(cycle: PomodoroCycle): RunningPomodoroCycle {
  const result = unwrap(
    transitionPomodoroCycle(cycle, { type: 'start', timestampMs }),
  );

  if (result.status !== 'running') {
    throw new Error('Expected the Pomodoro block to be running.');
  }

  return result;
}

describe('Pomodoro reset operations', () => {
  it('resets a running block to ready with its assigned duration and progress', () => {
    const current = running(readyFocus());
    const reset = unwrap(resetPomodoroBlock(current, 'focus-two'));

    expect(reset).toEqual({
      id: current.id,
      status: 'ready',
      completedFocusCount: current.completedFocusCount,
      currentBlock: {
        id: 'focus-two',
        type: current.currentBlock.type,
        durationMs: current.currentBlock.durationMs,
      },
    });
    expect(current.status).toBe('running');
  });

  it('restores a paused block to its full assigned duration without losing progress', () => {
    const shortBreak: PomodoroCycle = {
      id: 'cycle-one',
      status: 'paused',
      completedFocusCount: 1,
      currentBlock: {
        id: 'short-break-one',
        type: 'short-break',
        durationMs: 5 * 60_000,
      },
      remainingMs: 2 * 60_000,
    };

    expect(resetPomodoroBlock(shortBreak, 'short-break-two')).toEqual({
      ok: true,
      value: {
        id: 'cycle-one',
        status: 'ready',
        completedFocusCount: 1,
        currentBlock: {
          id: 'short-break-two',
          type: 'short-break',
          durationMs: 5 * 60_000,
        },
      },
    });
  });

  it('resets a block from ready without changing its type, duration, or cycle count', () => {
    const current = readyFocus();

    expect(resetPomodoroBlock(current, 'focus-two')).toEqual({
      ok: true,
      value: {
        ...current,
        currentBlock: { ...current.currentBlock, id: 'focus-two' },
      },
    });
  });

  it('prepares a new focus cycle from current preferences and leaves it ready', () => {
    const current: PomodoroCycle = {
      id: 'cycle-one',
      status: 'paused',
      completedFocusCount: 4,
      currentBlock: {
        id: 'long-break-one',
        type: 'long-break',
        durationMs: 15 * 60_000,
      },
      remainingMs: 3 * 60_000,
    };
    const preferences = {
      focusDurationMinutes: 40,
      shortBreakDurationMinutes: 7,
      longBreakDurationMinutes: 20,
    };
    const result = resetPomodoroCycle(current, {
      nextCycleId: 'cycle-two',
      nextBlockExecutionId: 'focus-next-cycle',
      preferences,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 'cycle-two',
        status: 'ready',
        completedFocusCount: 0,
        currentBlock: {
          id: 'focus-next-cycle',
          type: 'focus',
          durationMs: 40 * 60_000,
        },
      },
    });
    expect(current).toMatchObject({ status: 'paused', completedFocusCount: 4 });
  });

  it('does not start the first block when resetting a running cycle', () => {
    const current = running(readyFocus());
    const result = unwrap(
      resetPomodoroCycle(current, {
        nextCycleId: 'cycle-two',
        nextBlockExecutionId: 'focus-next-cycle',
        preferences: DEFAULT_POMODORO_PREFERENCES,
      }),
    );

    expect(result).toMatchObject({ id: 'cycle-two', status: 'ready' });
    expect(result).not.toHaveProperty('startedAt');
    expect(result).not.toHaveProperty('endsAt');
    expect(result).not.toHaveProperty('remainingMs');
  });

  it('rejects unchanged or invalid identities', () => {
    const current = readyFocus();

    expect(resetPomodoroBlock(current, 'focus-one')).toEqual({
      ok: false,
      error: { code: 'invalid-identity' },
    });
    expect(
      resetPomodoroCycle(current, {
        nextCycleId: 'cycle-one',
        nextBlockExecutionId: 'focus-two',
        preferences: DEFAULT_POMODORO_PREFERENCES,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-identity' } });
  });

  it('rejects invalid preferences before preparing a new cycle', () => {
    expect(
      resetPomodoroCycle(readyFocus(), {
        nextCycleId: 'cycle-two',
        nextBlockExecutionId: 'focus-two',
        preferences: { ...DEFAULT_POMODORO_PREFERENCES, focusDurationMinutes: 0 },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-preferences' } });
  });

  it('rejects malformed cycle state without mutating the input', () => {
    const malformed = { ...readyFocus(), completedFocusCount: 5 } as PomodoroCycle;

    expect(resetPomodoroBlock(malformed, 'focus-two')).toEqual({
      ok: false,
      error: { code: 'invalid-cycle' },
    });
    expect(malformed.completedFocusCount).toBe(5);
  });
});
