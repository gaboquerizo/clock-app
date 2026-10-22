import { describe, expect, it } from 'vitest';

import { createTimer, validateTimer } from './timer';
import { isValidTimerDuration } from './timer.rules';
import type { Timer } from './timer.types';

const createdAt = 1_792_662_400_000;

describe('timer domain model', () => {
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

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
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
});
