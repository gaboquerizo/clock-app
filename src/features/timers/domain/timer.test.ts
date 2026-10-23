import { describe, expect, it } from 'vitest';

import {
  createTimer,
  getTimerRemainingMs,
  reconcileTimer,
  transitionTimer,
  updateTimer,
  validateTimer,
} from './timer';
import { isValidTimerDuration } from './timer.rules';
import type { Timer } from './timer.types';

const createdAt = 1_792_662_400_000;
const timerDurationMs = 90_000;

function makeReadyTimer(durationMs = timerDurationMs) {
  const result = createTimer({
    id: 'transition-timer',
    durationMs,
    label: 'Tea',
    createdAt,
  });

  if (!result.ok) {
    throw new Error(`Unable to create timer: ${result.error.code}`);
  }

  return result.value;
}

describe('timer domain model', () => {
  it('derives running time from an absolute deadline and clamps elapsed timers to zero', () => {
    const startedAt = createdAt + 1_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the timer to start.');
    }

    expect(getTimerRemainingMs(started.value, startedAt + 30_000)).toBe(
      timerDurationMs - 30_000,
    );
    expect(getTimerRemainingMs(started.value, started.value.endsAt)).toBe(0);
    expect(getTimerRemainingMs(started.value, started.value.endsAt + 5_000)).toBe(
      0,
    );
  });

  it('uses stored remaining time while ready or paused and zero when completed', () => {
    const ready = makeReadyTimer();
    const paused: Timer = {
      id: ready.id,
      durationMs: ready.durationMs,
      label: ready.label,
      status: 'paused',
      remainingMs: 45_000,
      createdAt: ready.createdAt,
      updatedAt: ready.updatedAt,
    };
    const completed: Timer = {
      id: ready.id,
      durationMs: ready.durationMs,
      label: ready.label,
      status: 'completed',
      completedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };

    expect(getTimerRemainingMs(ready, createdAt + 10_000)).toBe(
      timerDurationMs,
    );
    expect(getTimerRemainingMs(paused, createdAt + 10_000)).toBe(45_000);
    expect(getTimerRemainingMs(completed, createdAt + 10_000)).toBe(0);
  });

  it('creates an independent ready timer using millisecond units', () => {
    expect(
      createTimer({
        id: 'timer-one',
        durationMs: 90_000,
        label: 'Tea',
        createdAt,
      }),
    ).toEqual({
      ok: true,
      value: {
        id: 'timer-one',
        durationMs: 90_000,
        label: 'Tea',
        status: 'ready',
        remainingMs: 90_000,
        createdAt,
        updatedAt: createdAt,
      },
    });
  });

  it('allows an empty optional label and trims surrounding whitespace', () => {
    const empty = createTimer({
      id: 'timer-empty-label',
      durationMs: 1,
      createdAt,
    });
    const normalized = createTimer({
      id: 'timer-trimmed-label',
      durationMs: 1,
      label: '  Tea  ',
      createdAt,
    });

    expect(empty.ok && empty.value.label).toBe('');
    expect(normalized.ok && normalized.value.label).toBe('Tea');
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    'rejects invalid duration %s',
    (durationMs) => {
      expect(isValidTimerDuration(durationMs)).toBe(false);
      expect(
        createTimer({ id: 'invalid-duration', durationMs, createdAt }),
      ).toMatchObject({
        ok: false,
        error: { code: 'invalid-duration', field: 'durationMs' },
      });
    },
  );

  it('does not impose an arbitrary maximum duration', () => {
    expect(
      createTimer({
        id: 'long-duration',
        durationMs: Number.MAX_SAFE_INTEGER,
        createdAt,
      }).ok,
    ).toBe(true);
  });

  it('rejects duplicate identities without coupling timers together', () => {
    const first = createTimer({
      id: 'same-id',
      durationMs: 10_000,
      createdAt,
    });
    if (!first.ok) {
      throw new Error('Expected the first timer to be valid.');
    }

    expect(
      createTimer(
        { id: 'same-id', durationMs: 20_000, createdAt },
        [first.value],
      ),
    ).toEqual({ ok: false, error: { code: 'duplicate-id', field: 'id' } });
  });

  it('updates a running timer configuration by resetting it to ready', () => {
    const startedAt = createdAt + 1_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    expect(
      updateTimer(
        started.value,
        { durationMs: 120_000, label: '  Focus  ' },
        startedAt + 1_000,
      ),
    ).toEqual({
      ok: true,
      value: {
        id: 'transition-timer',
        durationMs: 120_000,
        label: 'Focus',
        status: 'ready',
        remainingMs: 120_000,
        createdAt,
        updatedAt: startedAt + 1_000,
      },
    });
  });

  it('keeps the current label when an update omits it and rejects invalid updates', () => {
    const timer = makeReadyTimer();

    expect(updateTimer(timer, { durationMs: 30_000 }, createdAt)).toMatchObject({
      ok: true,
      value: { durationMs: 30_000, label: 'Tea', status: 'ready' },
    });
    expect(
      updateTimer(timer, { durationMs: 0 }, createdAt + 1),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-duration', field: 'durationMs' },
    });
    expect(
      updateTimer(timer, { durationMs: 30_000 }, createdAt - 1),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-timestamp', field: 'updatedAt' },
    });
  });

  it('validates absolute timestamps for a running timer', () => {
    const running: Timer = {
      id: 'running-timer',
      durationMs: 90_000,
      label: '',
      status: 'running',
      startedAt: createdAt + 1_000,
      endsAt: createdAt + 91_000,
      remainingAtStartMs: 90_000,
      createdAt,
      updatedAt: createdAt + 1_000,
    };

    expect(validateTimer(running)).toMatchObject({ ok: true, value: running });
    expect(
      validateTimer({ ...running, endsAt: running.endsAt + 1 }),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-state', field: 'status' },
    });
  });

  it('starts from ready using an absolute deadline', () => {
    const startedAt = createdAt + 10_000;

    expect(transitionTimer(makeReadyTimer(), 'start', startedAt)).toEqual({
      ok: true,
      value: {
        id: 'transition-timer',
        durationMs: timerDurationMs,
        label: 'Tea',
        status: 'running',
        startedAt,
        endsAt: startedAt + timerDurationMs,
        remainingAtStartMs: timerDurationMs,
        createdAt,
        updatedAt: startedAt,
      },
    });
  });

  it('pauses and resumes from the absolute timestamps without accumulated ticks', () => {
    const startedAt = createdAt + 10_000;
    const pausedAt = startedAt + 20_000;
    const resumedAt = pausedAt + 5_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    const paused = transitionTimer(started.value, 'pause', pausedAt);
    expect(paused).toMatchObject({
      ok: true,
      value: {
        status: 'paused',
        remainingMs: timerDurationMs - 20_000,
        durationMs: timerDurationMs,
        updatedAt: pausedAt,
      },
    });

    if (!paused.ok) {
      throw new Error('Expected the timer to pause.');
    }

    expect(transitionTimer(paused.value, 'resume', resumedAt)).toMatchObject({
      ok: true,
      value: {
        status: 'running',
        durationMs: timerDurationMs,
        startedAt: resumedAt,
        remainingAtStartMs: timerDurationMs - 20_000,
        endsAt: resumedAt + timerDurationMs - 20_000,
      },
    });
  });

  it('keeps repeated transitions deterministic and rejects duplicate state changes', () => {
    const startedAt = createdAt + 1_000;
    const pausedAt = startedAt + 10_000;
    const resumedAt = pausedAt + 5_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    expect(transitionTimer(started.value, 'start', startedAt)).toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });

    const paused = transitionTimer(started.value, 'pause', pausedAt);
    if (!paused.ok) {
      throw new Error('Expected the timer to pause.');
    }

    expect(transitionTimer(paused.value, 'pause', pausedAt)).toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });

    const resumed = transitionTimer(paused.value, 'resume', resumedAt);
    if (!resumed.ok) {
      throw new Error('Expected the timer to resume.');
    }

    expect(transitionTimer(resumed.value, 'resume', resumedAt)).toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });

    expect(transitionTimer(resumed.value, 'restart', resumedAt)).toMatchObject({
      ok: true,
      value: {
        status: 'running',
        remainingAtStartMs: timerDurationMs,
        endsAt: resumedAt + timerDurationMs,
      },
    });
  });

  it('restarts a running timer in running state with its original duration', () => {
    const startedAt = createdAt + 1_000;
    const restartedAt = startedAt + 15_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    expect(
      transitionTimer(started.value, 'restart', restartedAt),
    ).toMatchObject({
      ok: true,
      value: {
        status: 'running',
        durationMs: timerDurationMs,
        startedAt: restartedAt,
        endsAt: restartedAt + timerDurationMs,
        remainingAtStartMs: timerDurationMs,
        updatedAt: restartedAt,
      },
    });
  });

  it('restarts a paused timer in paused state with its original duration', () => {
    const startedAt = createdAt + 1_000;
    const pausedAt = startedAt + 15_000;
    const restartedAt = pausedAt + 5_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    const paused = transitionTimer(started.value, 'pause', pausedAt);
    if (!paused.ok) {
      throw new Error('Expected the timer to pause.');
    }

    expect(
      transitionTimer(paused.value, 'restart', restartedAt),
    ).toMatchObject({
      ok: true,
      value: {
        status: 'paused',
        durationMs: timerDurationMs,
        remainingMs: timerDurationMs,
        updatedAt: restartedAt,
      },
    });
  });

  it('reconciles an elapsed timer to completed exactly once', () => {
    const startedAt = createdAt + 1_000;
    const detectedAt = startedAt + timerDurationMs + 25_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok) {
      throw new Error('Expected the timer to start.');
    }

    const firstReconciliation = reconcileTimer(started.value, detectedAt);
    expect(firstReconciliation).toEqual({
      ok: true,
      value: {
        timer: {
          id: 'transition-timer',
          durationMs: timerDurationMs,
          label: 'Tea',
          status: 'completed',
          completedAt: startedAt + timerDurationMs,
          createdAt,
          updatedAt: detectedAt,
        },
        completed: true,
      },
    });

    if (!firstReconciliation.ok) {
      throw new Error('Expected reconciliation to complete the timer.');
    }

    expect(
      reconcileTimer(firstReconciliation.value.timer, detectedAt + 1),
    ).toEqual({
      ok: true,
      value: {
        timer: firstReconciliation.value.timer,
        completed: false,
      },
    });
  });

  it('remains running before its deadline and completes at the exact deadline', () => {
    const started = transitionTimer(makeReadyTimer(), 'start', createdAt + 1_000);

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the timer to start.');
    }

    expect(reconcileTimer(started.value, started.value.endsAt - 1)).toEqual({
      ok: true,
      value: { timer: started.value, completed: false },
    });

    const completed = reconcileTimer(started.value, started.value.endsAt);

    expect(completed).toMatchObject({
      ok: true,
      value: {
        completed: true,
        timer: {
          status: 'completed',
          completedAt: started.value.endsAt,
          updatedAt: started.value.endsAt,
        },
      },
    });

    if (!completed.ok) {
      throw new Error('Expected the timer to complete at its deadline.');
    }

    expect(reconcileTimer(completed.value.timer, started.value.endsAt)).toEqual({
      ok: true,
      value: { timer: completed.value.timer, completed: false },
    });
  });

  it('restarts a completed timer to ready without starting it', () => {
    const startedAt = createdAt + 1_000;
    const started = transitionTimer(makeReadyTimer(), 'start', startedAt);

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the timer to start.');
    }

    const completed = reconcileTimer(started.value, started.value.endsAt);
    if (!completed.ok) {
      throw new Error('Expected the timer to complete.');
    }

    expect(
      transitionTimer(completed.value.timer, 'restart', started.value.endsAt),
    ).toEqual({
      ok: true,
      value: {
        id: 'transition-timer',
        durationMs: timerDurationMs,
        label: 'Tea',
        status: 'ready',
        remainingMs: timerDurationMs,
        createdAt,
        updatedAt: started.value.endsAt,
      },
    });
  });

  it('rejects invalid transitions and timestamps', () => {
    const ready = makeReadyTimer();

    expect(transitionTimer(ready, 'pause', createdAt + 1)).toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });
    expect(transitionTimer(ready, 'start', createdAt - 1)).toMatchObject({
      ok: false,
      error: { code: 'invalid-timestamp', field: 'updatedAt' },
    });
    expect(
      transitionTimer(
        makeReadyTimer(Number.MAX_SAFE_INTEGER),
        'start',
        Number.MAX_SAFE_INTEGER,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-timestamp', field: 'endsAt' },
    });
  });

  it('never stores negative remaining time when pausing at the deadline', () => {
    const started = transitionTimer(
      makeReadyTimer(),
      'start',
      createdAt + 1_000,
    );

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the timer to start.');
    }

    expect(
      transitionTimer(started.value, 'pause', started.value.endsAt),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });
  });
});
