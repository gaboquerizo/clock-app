import { describe, expect, it } from 'vitest';

import { advancePomodoroCycle } from './pomodoro-cycle-sequence';
import { DEFAULT_POMODORO_PREFERENCES } from './pomodoro-preferences';
import { transitionPomodoroCycle } from './pomodoro';
import { validatePomodoroCycle } from './pomodoro.rules';
import type {
  PomodoroCycle,
  PomodoroResult,
  RunningPomodoroCycle,
} from './pomodoro.types';

const startTimestamp = 1_800_000_000_000;

function initialCycle(): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 0,
    currentBlock: {
      id: 'block-one',
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

function start(cycle: PomodoroCycle): RunningPomodoroCycle {
  const result = unwrap(
    transitionPomodoroCycle(cycle, {
      type: 'start',
      timestampMs: startTimestamp,
    }),
  );

  if (result.status !== 'running') {
    throw new Error('Expected a running Pomodoro block.');
  }

  return result;
}

function completionEvent(cycle: RunningPomodoroCycle) {
  return {
    type: 'block-completed' as const,
    cycleId: cycle.id,
    blockExecutionId: cycle.currentBlock.id,
    blockType: cycle.currentBlock.type,
    completedAt: cycle.endsAt,
  };
}

describe('Pomodoro cycle sequence', () => {
  it('cycles through four focus blocks, three short breaks, and one long break', () => {
    const expectedSequence = [
      { type: 'short-break', count: 1 },
      { type: 'focus', count: 1 },
      { type: 'short-break', count: 2 },
      { type: 'focus', count: 2 },
      { type: 'short-break', count: 3 },
      { type: 'focus', count: 3 },
      { type: 'long-break', count: 4 },
      { type: 'focus', count: 0, cycleId: 'cycle-two' },
    ] as const;

    let cycle = initialCycle();

    expectedSequence.forEach((expected, index) => {
      const running = start(cycle);
      const nextCycleId = 'cycleId' in expected ? expected.cycleId : undefined;
      const result = advancePomodoroCycle(running, {
        event: completionEvent(running),
        nextBlockExecutionId: `block-${index + 2}`,
        ...(nextCycleId ? { nextCycleId } : {}),
        preferences: DEFAULT_POMODORO_PREFERENCES,
      });

      cycle = unwrap(result);

      expect(cycle).toMatchObject({
        id: nextCycleId ?? 'cycle-one',
        status: 'ready',
        completedFocusCount: expected.count,
        currentBlock: {
          type: expected.type,
          id: `block-${index + 2}`,
        },
      });
      expect(cycle).not.toHaveProperty('startedAt');
      expect(cycle).not.toHaveProperty('endsAt');
      expect(cycle).not.toHaveProperty('remainingMs');
    });
  });

  it('assigns the configured duration to each prepared block', () => {
    const preferences = {
      focusDurationMinutes: 10,
      shortBreakDurationMinutes: 3,
      longBreakDurationMinutes: 8,
    };
    const running = start(initialCycle());
    const shortBreak = unwrap(
      advancePomodoroCycle(running, {
        event: completionEvent(running),
        nextBlockExecutionId: 'block-two',
        preferences,
      }),
    );

    expect(shortBreak.currentBlock.durationMs).toBe(3 * 60_000);

    const shortBreakRunning = start(shortBreak);
    const nextFocus = unwrap(
      advancePomodoroCycle(shortBreakRunning, {
        event: completionEvent(shortBreakRunning),
        nextBlockExecutionId: 'block-three',
        preferences,
      }),
    );

    expect(nextFocus.currentBlock.durationMs).toBe(10 * 60_000);

    const thirdFocus: PomodoroCycle = {
      id: 'cycle-one',
      status: 'ready',
      completedFocusCount: 3,
      currentBlock: {
        id: 'third-focus',
        type: 'focus',
        durationMs: 10 * 60_000,
      },
    };
    const thirdFocusRunning = start(thirdFocus);
    const longBreak = unwrap(
      advancePomodoroCycle(thirdFocusRunning, {
        event: completionEvent(thirdFocusRunning),
        nextBlockExecutionId: 'long-break',
        preferences,
      }),
    );

    expect(longBreak).toMatchObject({
      status: 'ready',
      completedFocusCount: 4,
      currentBlock: { type: 'long-break', durationMs: 8 * 60_000 },
    });
  });

  it('requires a new cycle identity after the long break', () => {
    const longBreak: PomodoroCycle = {
      id: 'cycle-one',
      status: 'ready',
      completedFocusCount: 4,
      currentBlock: {
        id: 'long-break-block',
        type: 'long-break',
        durationMs: 15 * 60_000,
      },
    };
    const running = start(longBreak);

    expect(
      advancePomodoroCycle(running, {
        event: completionEvent(running),
        nextBlockExecutionId: 'next-focus',
        preferences: DEFAULT_POMODORO_PREFERENCES,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-identity' } });

    expect(
      advancePomodoroCycle(running, {
        event: completionEvent(running),
        nextBlockExecutionId: 'next-focus',
        nextCycleId: 'cycle-one',
        preferences: DEFAULT_POMODORO_PREFERENCES,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-identity' } });
  });

  it('rejects stale or mismatched completion events', () => {
    const cycle = initialCycle();
    const running = start(cycle);

    expect(
      advancePomodoroCycle(running, {
        event: { ...completionEvent(running), blockExecutionId: 'old-block' },
        nextBlockExecutionId: 'block-two',
        preferences: DEFAULT_POMODORO_PREFERENCES,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-completion-event' } });
  });

  it('does not advance a ready or paused block', () => {
    const ready = initialCycle();
    const running = start(ready);
    const paused = unwrap(
      transitionPomodoroCycle(running, {
        type: 'pause',
        timestampMs: startTimestamp + 1_000,
      }),
    );
    const event = completionEvent(running);

    for (const cycle of [ready, paused]) {
      expect(
        advancePomodoroCycle(cycle, {
          event,
          nextBlockExecutionId: 'block-two',
          preferences: DEFAULT_POMODORO_PREFERENCES,
        }),
      ).toEqual({ ok: false, error: { code: 'invalid-transition' } });
    }
  });

  it('rejects malformed completion events, identities, and preferences', () => {
    const cycle = initialCycle();
    const running = start(cycle);
    const validInput = {
      event: completionEvent(running),
      nextBlockExecutionId: 'block-two',
      preferences: DEFAULT_POMODORO_PREFERENCES,
    };

    expect(
      advancePomodoroCycle(running, {
        ...validInput,
        event: { ...validInput.event, completedAt: Number.NaN },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-completion-event' } });
    expect(
      advancePomodoroCycle(running, {
        ...validInput,
        nextBlockExecutionId: cycle.currentBlock.id,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-identity' } });
    expect(
      advancePomodoroCycle(running, {
        ...validInput,
        preferences: { ...DEFAULT_POMODORO_PREFERENCES, focusDurationMinutes: 0 },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-preferences' } });
  });

  it('validates that progress and current block agree', () => {
    expect(
      validatePomodoroCycle({
        ...initialCycle(),
        completedFocusCount: 4,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-cycle' } });

    expect(
      validatePomodoroCycle({
        ...initialCycle(),
        currentBlock: {
          ...initialCycle().currentBlock,
          type: 'short-break',
        },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-cycle' } });
  });
});
