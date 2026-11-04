import { describe, expect, it } from 'vitest';

import {
  createStopwatch,
  getStopwatchElapsedMs,
  recordStopwatchLap,
  transitionStopwatch,
} from './stopwatch';
import type {
  Stopwatch,
  StopwatchResult,
} from './stopwatch.types';

const referenceTimestamp = 1_800_000_000_000;

function unwrap<T>(result: StopwatchResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Stopwatch domain error: ${result.error.code}`);
  }

  return result.value;
}

function startStopwatch(timestampMs = referenceTimestamp): Stopwatch {
  return unwrap(
    transitionStopwatch(createStopwatch(), {
      type: 'start',
      timestampMs,
    }),
  );
}

describe('Stopwatch domain', () => {
  it('creates an idle stopwatch with no accumulated time or laps', () => {
    expect(createStopwatch()).toEqual({
      status: 'idle',
      accumulatedMs: 0,
      laps: [],
    });
  });

  it('starts, pauses, and resumes from explicit absolute timestamps', () => {
    const running = startStopwatch();
    const paused = unwrap(
      transitionStopwatch(running, {
        type: 'pause',
        timestampMs: referenceTimestamp + 5_000,
      }),
    );
    const resumed = unwrap(
      transitionStopwatch(paused, {
        type: 'resume',
        timestampMs: referenceTimestamp + 1_000_000,
      }),
    );

    expect(running).toMatchObject({
      status: 'running',
      startedAt: referenceTimestamp,
      accumulatedMs: 0,
    });
    expect(paused).toEqual({
      status: 'paused',
      accumulatedMs: 5_000,
      laps: [],
    });
    expect(resumed).toEqual({
      status: 'running',
      startedAt: referenceTimestamp + 1_000_000,
      accumulatedMs: 5_000,
      laps: [],
    });
  });

  it('derives elapsed time from timestamps and excludes the paused interval', () => {
    const running = startStopwatch();
    const paused = unwrap(
      transitionStopwatch(running, {
        type: 'pause',
        timestampMs: referenceTimestamp + 5_000,
      }),
    );

    expect(
      getStopwatchElapsedMs(paused, referenceTimestamp + 500_000),
    ).toEqual({ ok: true, value: 5_000 });

    const resumed = unwrap(
      transitionStopwatch(paused, {
        type: 'resume',
        timestampMs: referenceTimestamp + 1_000_000,
      }),
    );

    expect(
      getStopwatchElapsedMs(resumed, referenceTimestamp + 1_001_250),
    ).toEqual({ ok: true, value: 6_250 });
    expect(getStopwatchElapsedMs(createStopwatch(), referenceTimestamp)).toEqual({
      ok: true,
      value: 0,
    });
  });

  it('records sequential laps with individual and accumulated durations', () => {
    const running = startStopwatch();
    const firstLap = unwrap(
      recordStopwatchLap(running, {
        type: 'record-lap',
        timestampMs: referenceTimestamp + 1_500,
      }),
    );
    const secondLap = unwrap(
      recordStopwatchLap(firstLap, {
        type: 'record-lap',
        timestampMs: referenceTimestamp + 3_200,
      }),
    );

    expect(secondLap).toMatchObject({
      status: 'running',
      startedAt: referenceTimestamp,
      accumulatedMs: 0,
      laps: [
        { number: 1, durationMs: 1_500, elapsedMs: 1_500 },
        { number: 2, durationMs: 1_700, elapsedMs: 3_200 },
      ],
    });
  });

  it('excludes paused time from the next lap duration', () => {
    const running = startStopwatch();
    const firstLap = unwrap(
      recordStopwatchLap(running, {
        type: 'record-lap',
        timestampMs: referenceTimestamp + 1_000,
      }),
    );
    const paused = unwrap(
      transitionStopwatch(firstLap, {
        type: 'pause',
        timestampMs: referenceTimestamp + 2_500,
      }),
    );
    const resumed = unwrap(
      transitionStopwatch(paused, {
        type: 'resume',
        timestampMs: referenceTimestamp + 100_000,
      }),
    );
    const secondLap = unwrap(
      recordStopwatchLap(resumed, {
        type: 'record-lap',
        timestampMs: referenceTimestamp + 101_000,
      }),
    );

    expect(secondLap.laps).toEqual([
      { number: 1, durationMs: 1_000, elapsedMs: 1_000 },
      { number: 2, durationMs: 2_500, elapsedMs: 3_500 },
    ]);
    expect(secondLap.status).toBe('running');
  });

  it('rejects invalid transitions and only resets from paused', () => {
    const idle = createStopwatch();
    const running = startStopwatch();
    const paused = unwrap(
      transitionStopwatch(running, {
        type: 'pause',
        timestampMs: referenceTimestamp + 2_000,
      }),
    );

    expect(
      transitionStopwatch(idle, {
        type: 'pause',
        timestampMs: referenceTimestamp,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
    expect(
      transitionStopwatch(running, {
        type: 'start',
        timestampMs: referenceTimestamp + 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
    expect(
      transitionStopwatch(running, { type: 'reset' }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
    expect(
      transitionStopwatch(paused, {
        type: 'reset',
      }),
    ).toEqual({
      ok: true,
      value: { status: 'idle', accumulatedMs: 0, laps: [] },
    });
  });

  it('rejects invalid or regressive timestamps without changing the input', () => {
    const running = startStopwatch();

    expect(getStopwatchElapsedMs(running, referenceTimestamp - 1)).toMatchObject({
      ok: false,
      error: { code: 'invalid-timestamp' },
    });
    expect(
      transitionStopwatch(running, {
        type: 'pause',
        timestampMs: referenceTimestamp - 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-timestamp' } });
    expect(
      recordStopwatchLap(running, {
        type: 'record-lap',
        timestampMs: referenceTimestamp - 1,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-timestamp' } });
    expect(running).toEqual({
      status: 'running',
      startedAt: referenceTimestamp,
      accumulatedMs: 0,
      laps: [],
    });
  });

  it('does not record laps while idle or paused', () => {
    const idle = createStopwatch();
    const paused = unwrap(
      transitionStopwatch(startStopwatch(), {
        type: 'pause',
        timestampMs: referenceTimestamp + 1_000,
      }),
    );

    expect(
      recordStopwatchLap(idle, {
        type: 'record-lap',
        timestampMs: referenceTimestamp,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
    expect(
      recordStopwatchLap(paused, {
        type: 'record-lap',
        timestampMs: referenceTimestamp + 2_000,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid-transition' } });
  });
});
