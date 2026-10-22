import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTimer } from '@/features/timers/domain/timer';
import {
  TimerRepository,
  TimerStorageError,
} from '@/features/timers/storage/timer-repository';

describe('TimerRepository', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(
    'communicates unavailable IndexedDB without changing the domain object',
    async () => {
      vi.stubGlobal('indexedDB', undefined);
      const repository = new TimerRepository('timers-unavailable-test');
      const result = createTimer({
        id: 'timer-one',
        durationMs: 60_000,
        label: 'Focus',
        createdAt: 1_000,
      });

      if (!result.ok) {
        throw new Error(`Unable to create test timer: ${result.error.code}`);
      }

      await expect(repository.create(result.value)).rejects.toMatchObject({
        name: 'TimerStorageError',
        code: 'unavailable',
        timerId: undefined,
      });
      expect(result.value).toMatchObject({
        status: 'ready',
        remainingMs: 60_000,
      });
    },
  );

  it('exports a typed storage error for callers', () => {
    const error = new TimerStorageError(
      'not-found',
      'The timer to update does not exist.',
      { timerId: 'missing' },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('not-found');
    expect(error.timerId).toBe('missing');
  });
});
