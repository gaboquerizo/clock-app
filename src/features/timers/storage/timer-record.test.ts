import { describe, expect, it } from 'vitest';

import {
  createTimer,
  reconcileTimer,
  transitionTimer,
} from '@/features/timers/domain/timer';
import type { Timer } from '@/features/timers/domain/timer.types';
import {
  fromTimerRecord,
  toTimerRecord,
} from '@/features/timers/storage/timer-record';

function makeTimer(): Timer {
  const result = createTimer({
    id: 'timer-one',
    durationMs: 90_000,
    label: 'Focus',
    createdAt: 1_000,
  });

  if (!result.ok) {
    throw new Error(`Unable to create test timer: ${result.error.code}`);
  }

  return result.value;
}

function makeRunningTimer(): Timer {
  const result = transitionTimer(makeTimer(), 'start', 2_000);

  if (!result.ok) {
    throw new Error(`Unable to start test timer: ${result.error.code}`);
  }

  return result.value;
}

function makePausedTimer(): Timer {
  const result = transitionTimer(makeRunningTimer(), 'pause', 47_000);

  if (!result.ok) {
    throw new Error(`Unable to pause test timer: ${result.error.code}`);
  }

  return result.value;
}

function makeCompletedTimer(): Timer {
  const result = reconcileTimer(makeRunningTimer(), 92_000);

  if (!result.ok) {
    throw new Error(`Unable to complete test timer: ${result.error.code}`);
  }

  return result.value.timer;
}

describe('timer record mapping', () => {
  it('maps a domain timer to its ready persistent record', () => {
    const timer = makeTimer();

    expect(toTimerRecord(timer)).toEqual({
      id: timer.id,
      durationMs: timer.durationMs,
      label: timer.label,
      status: 'ready',
      remainingMs: timer.durationMs,
      createdAt: timer.createdAt,
      updatedAt: timer.updatedAt,
    });
  });

  it('preserves an empty optional label', () => {
    const result = createTimer({
      id: 'timer-without-label',
      durationMs: 30_000,
      createdAt: 1_000,
    });

    if (!result.ok) {
      throw new Error(`Unable to create test timer: ${result.error.code}`);
    }

    expect(toTimerRecord(result.value).label).toBe('');
    expect(fromTimerRecord(toTimerRecord(result.value))).toMatchObject({
      ok: true,
      value: { label: '' },
    });
  });

  it.each([
    ['running', makeRunningTimer],
    ['paused', makePausedTimer],
    ['completed', makeCompletedTimer],
  ] as const)(
    'round-trips the %s state and its temporal fields',
    (_, makeState) => {
      const timer = makeState();

      expect(fromTimerRecord(toTimerRecord(timer))).toEqual({
        ok: true,
        value: timer,
      });
    },
  );

  it('normalizes a persisted label through domain validation', () => {
    const record = { ...toTimerRecord(makeTimer()), label: '  Focus  ' };

    expect(fromTimerRecord(record)).toMatchObject({
      ok: true,
      value: { label: 'Focus' },
    });
  });

  it('rejects invalid persisted data instead of trusting the record', () => {
    const record = { ...toTimerRecord(makeTimer()), durationMs: 0 };

    expect(fromTimerRecord(record)).toEqual({
      ok: false,
      error: { code: 'invalid-duration', field: 'durationMs' },
    });
  });
});
