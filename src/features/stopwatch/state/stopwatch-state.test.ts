import { describe, expect, it } from 'vitest';

import type { Stopwatch } from '@/features/stopwatch/domain/stopwatch.types';
import { StopwatchStorageError } from '@/features/stopwatch/storage/stopwatch-repository';

import { createStopwatchState } from './stopwatch-state';
import type { StopwatchRepositoryPort } from './stopwatch-state';

const referenceTimestamp = 1_800_000_000_000;

function makeMemoryRepository(initial?: Stopwatch): {
  repository: StopwatchRepositoryPort;
  current: () => Stopwatch | undefined;
} {
  let storedStopwatch = initial;

  return {
    repository: {
      async read() {
        return storedStopwatch;
      },
      async update(stopwatch) {
        storedStopwatch = stopwatch;
      },
    },
    current: () => storedStopwatch,
  };
}

function makeRunningStopwatch(): Stopwatch {
  return {
    status: 'running',
    accumulatedMs: 500,
    startedAt: referenceTimestamp,
    laps: [{ number: 1, durationMs: 250, elapsedMs: 250 }],
  };
}

function makePausedStopwatch(): Stopwatch {
  return {
    status: 'paused',
    accumulatedMs: 900,
    laps: [{ number: 1, durationMs: 700, elapsedMs: 700 }],
  };
}

describe('Stopwatch state', () => {
  it.each([
    [
      'running',
      makeRunningStopwatch(),
      referenceTimestamp + 2_000,
      2_500,
    ],
    ['paused', makePausedStopwatch(), referenceTimestamp + 90_000, 900],
  ])(
    'restores a valid %s record and derives elapsed time with the injected clock',
    async (_status, storedStopwatch, now, expectedElapsedMs) => {
      const { repository } = makeMemoryRepository(storedStopwatch);
      const controller = createStopwatchState({
        repository,
        now: () => now,
      });

      await expect(controller.actions.load()).resolves.toMatchObject({
        ok: true,
        value: storedStopwatch,
      });
      expect(controller.state).toMatchObject({
        stopwatch: storedStopwatch,
        status: 'ready',
        error: undefined,
      });
      expect(controller.selectors.elapsedAt(now)).toEqual({
        ok: true,
        value: expectedElapsedMs,
      });
    },
  );

  it('persists pause, resume, lap recording, and reset using a controlled clock', async () => {
    let now = referenceTimestamp;
    const { repository, current } = makeMemoryRepository();
    const controller = createStopwatchState({
      repository,
      now: () => now,
    });

    await controller.actions.load();
    await expect(controller.actions.start()).resolves.toMatchObject({
      ok: true,
      value: { status: 'running', startedAt: referenceTimestamp },
    });

    now = referenceTimestamp + 1_000;
    await controller.actions.recordLap();
    now = referenceTimestamp + 2_500;
    await controller.actions.pause();

    expect(controller.state.stopwatch).toMatchObject({
      status: 'paused',
      accumulatedMs: 2_500,
      laps: [{ number: 1, durationMs: 1_000, elapsedMs: 1_000 }],
    });
    expect(controller.selectors.elapsedAt(referenceTimestamp + 50_000)).toEqual({
      ok: true,
      value: 2_500,
    });

    now = referenceTimestamp + 100_000;
    await controller.actions.resume();
    now = referenceTimestamp + 101_000;
    await controller.actions.recordLap();

    expect(controller.state.stopwatch).toMatchObject({
      status: 'running',
      accumulatedMs: 2_500,
      startedAt: referenceTimestamp + 100_000,
      laps: [
        { number: 1, durationMs: 1_000, elapsedMs: 1_000 },
        { number: 2, durationMs: 2_500, elapsedMs: 3_500 },
      ],
    });
    expect(controller.selectors.lapRanking()).toEqual({
      fastestLapNumber: 1,
      slowestLapNumber: 2,
    });
    expect(current()).toEqual(controller.state.stopwatch);

    now = referenceTimestamp + 102_000;
    await controller.actions.pause();
    await expect(controller.actions.reset()).resolves.toMatchObject({
      ok: true,
      value: { status: 'idle', accumulatedMs: 0, laps: [] },
    });
    expect(current()).toEqual({ status: 'idle', accumulatedMs: 0, laps: [] });
  });

  it('keeps an invalid stored record out of the domain state', async () => {
    const repository: StopwatchRepositoryPort = {
      async read() {
        throw new StopwatchStorageError(
          'record-invalid',
          'The stored Stopwatch record failed domain validation.',
        );
      },
      async update() {
        throw new Error('Unexpected write while loading invalid data.');
      },
    };
    const controller = createStopwatchState({ repository });

    await expect(controller.actions.load()).resolves.toMatchObject({
      ok: false,
      error: { operation: 'load', code: 'record-invalid' },
    });
    expect(controller.state).toMatchObject({
      stopwatch: { status: 'idle', accumulatedMs: 0, laps: [] },
      status: 'error',
      error: { operation: 'load', code: 'record-invalid' },
    });
  });
});
