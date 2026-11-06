import { describe, expect, it } from 'vitest';

import { transitionPomodoroCycle } from './pomodoro';
import { validatePomodoroCycle } from './pomodoro.rules';
import type {
  PomodoroCycle,
  PomodoroResult,
  RunningPomodoroCycle,
} from './pomodoro.types';

const referenceTimestamp = 1_800_000_000_000;
const blockDurationMs = 25 * 60_000;

function readyCycle(): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 0,
    currentBlock: {
      id: 'block-execution-one',
      type: 'focus',
      durationMs: blockDurationMs,
    },
  };
}

function unwrap<T>(result: PomodoroResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Pomodoro domain error: ${result.error.code}`);
  }

  return result.value;
}

function startCycle(
  timestampMs = referenceTimestamp,
): RunningPomodoroCycle {
  const cycle = unwrap(
    transitionPomodoroCycle(readyCycle(), { type: 'start', timestampMs }),
  );

  if (cycle.status !== 'running') {
    throw new Error('Expected the Pomodoro cycle to be running.');
  }

  return cycle;
}

describe('Pomodoro cycle transitions', () => {
  it('starts a ready block from its assigned duration using an absolute deadline', () => {
    const ready = readyCycle();
    const running = unwrap(
      transitionPomodoroCycle(ready, {
        type: 'start',
        timestampMs: referenceTimestamp,
      }),
    );

    expect(running).toEqual({
      ...ready,
      status: 'running',
      startedAt: referenceTimestamp,
      endsAt: referenceTimestamp + blockDurationMs,
    });
    expect(ready).toEqual(readyCycle());
  });

  it('pauses with the time remaining at the supplied timestamp', () => {
    const running = startCycle();
    const pausedAt = referenceTimestamp + 10 * 60_000;

    expect(
      transitionPomodoroCycle(running, { type: 'pause', timestampMs: pausedAt }),
    ).toEqual({
      ok: true,
      value: {
        id: running.id,
        status: 'paused',
        completedFocusCount: running.completedFocusCount,
        currentBlock: running.currentBlock,
        remainingMs: 15 * 60_000,
      },
    });
  });

  it('resumes after a long pause with only the preserved remaining duration', () => {
    const running = startCycle();
    const paused = unwrap(
      transitionPomodoroCycle(running, {
        type: 'pause',
        timestampMs: referenceTimestamp + 10 * 60_000,
      }),
    );
    const resumedAt = referenceTimestamp + 10 * 24 * 60 * 60_000;
    const resumed = unwrap(
      transitionPomodoroCycle(paused, {
        type: 'resume',
        timestampMs: resumedAt,
      }),
    );

    expect(resumed).toEqual({
      id: paused.id,
      status: 'running',
      startedAt: resumedAt,
      endsAt: resumedAt + 15 * 60_000,
      completedFocusCount: paused.completedFocusCount,
      currentBlock: paused.currentBlock,
    });
  });

  it('preserves the remaining time across multiple pause and resume segments', () => {
    const running = startCycle();
    const paused = unwrap(
      transitionPomodoroCycle(running, {
        type: 'pause',
        timestampMs: referenceTimestamp + 10 * 60_000,
      }),
    );
    const resumedAt = referenceTimestamp + 3 * 60 * 60_000;
    const resumed = unwrap(
      transitionPomodoroCycle(paused, {
        type: 'resume',
        timestampMs: resumedAt,
      }),
    );
    const pausedAgain = unwrap(
      transitionPomodoroCycle(resumed, {
        type: 'pause',
        timestampMs: resumedAt + 30_000,
      }),
    );

    expect(pausedAgain).toMatchObject({
      status: 'paused',
      remainingMs: 14 * 60_000 + 30_000,
    });
  });

  it.each([
    [readyCycle(), 'pause', referenceTimestamp],
    [startCycle(), 'start', referenceTimestamp],
    [startCycle(), 'resume', referenceTimestamp],
    [
      unwrap(
        transitionPomodoroCycle(startCycle(), {
          type: 'pause',
          timestampMs: referenceTimestamp + 1_000,
        }),
      ),
      'pause',
      referenceTimestamp + 2_000,
    ],
  ] as const)(
    'rejects invalid transition %s from the current state',
    (cycle, type, timestampMs) => {
      expect(
        transitionPomodoroCycle(cycle, {
          type,
          timestampMs,
        }),
      ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid timestamp %s',
    (timestampMs) => {
      expect(
        transitionPomodoroCycle(readyCycle(), {
          type: 'start',
          timestampMs,
        }),
      ).toEqual({ ok: false, error: { code: 'invalid-timestamp' } });
    },
  );

  it('rejects pausing before the current running segment began', () => {
    const running = startCycle();

    expect(
      transitionPomodoroCycle(running, {
        type: 'pause',
        timestampMs: referenceTimestamp - 1,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-timestamp' } });
  });

  it('requires an expired block to be completed before pausing it', () => {
    const running = startCycle();

    expect(
      transitionPomodoroCycle(running, {
        type: 'pause',
        timestampMs: running.endsAt,
      }),
    ).toEqual({ ok: false, error: { code: 'block-expired' } });
  });

  it('rejects a deadline that exceeds the safe timestamp range', () => {
    expect(
      transitionPomodoroCycle(readyCycle(), {
        type: 'start',
        timestampMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-deadline' } });
  });

  it('validates cycle state before applying a transition', () => {
    expect(
      validatePomodoroCycle({ ...readyCycle(), completedFocusCount: -1 }),
    ).toEqual({ ok: false, error: { code: 'invalid-cycle' } });
  });
});
