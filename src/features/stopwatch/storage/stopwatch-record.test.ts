import { describe, expect, it } from 'vitest';

import {
  createStopwatch,
  recordStopwatchLap,
  transitionStopwatch,
} from '@/features/stopwatch/domain/stopwatch';
import type {
  Stopwatch,
  StopwatchResult,
} from '@/features/stopwatch/domain/stopwatch.types';
import {
  fromStopwatchRecord,
  toStopwatchRecord,
} from '@/features/stopwatch/storage/stopwatch-record';

const referenceTimestamp = 1_800_000_000_000;

function unwrap<T>(result: StopwatchResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Stopwatch domain error: ${result.error.code}`);
  }

  return result.value;
}

function makeRunningStopwatch(): Stopwatch {
  const running = unwrap(
    transitionStopwatch(createStopwatch(), {
      type: 'start',
      timestampMs: referenceTimestamp,
    }),
  );

  return unwrap(
    recordStopwatchLap(running, {
      type: 'record-lap',
      timestampMs: referenceTimestamp + 1_250,
    }),
  );
}

describe('Stopwatch record mapping', () => {
  it('maps the idle domain state to the persistent record', () => {
    expect(toStopwatchRecord(createStopwatch())).toEqual({
      id: 'current',
      status: 'idle',
      accumulatedMs: 0,
      laps: [],
    });
  });

  it('preserves the running timestamp and lap history when mapping to storage', () => {
    expect(toStopwatchRecord(makeRunningStopwatch())).toEqual({
      id: 'current',
      status: 'running',
      accumulatedMs: 0,
      startedAt: referenceTimestamp,
      laps: [{ number: 1, durationMs: 1_250, elapsedMs: 1_250 }],
    });
  });

  it('omits startedAt from paused records while preserving accumulated time and laps', () => {
    const paused = unwrap(
      transitionStopwatch(makeRunningStopwatch(), {
        type: 'pause',
        timestampMs: referenceTimestamp + 3_000,
      }),
    );
    const record = toStopwatchRecord(paused);

    expect(record).toEqual({
      id: 'current',
      status: 'paused',
      accumulatedMs: 3_000,
      laps: [{ number: 1, durationMs: 1_250, elapsedMs: 1_250 }],
    });
    expect('startedAt' in record).toBe(false);
  });

  it.each([
    ['idle', createStopwatch()],
    ['running', makeRunningStopwatch()],
    [
      'paused',
      unwrap(
        transitionStopwatch(makeRunningStopwatch(), {
          type: 'pause',
          timestampMs: referenceTimestamp + 3_000,
        }),
      ),
    ],
  ])('round trips a valid %s domain state', (_status, stopwatch) => {
    expect(fromStopwatchRecord(toStopwatchRecord(stopwatch))).toEqual({
      ok: true,
      value: stopwatch,
    });
  });

  it('rejects an unknown identity and malformed persisted lap history', () => {
    const record = toStopwatchRecord(makeRunningStopwatch());

    expect(fromStopwatchRecord({ ...record, id: 'other' })).toMatchObject({
      ok: false,
      error: { code: 'invalid-state' },
    });
    expect(
      fromStopwatchRecord({
        ...record,
        laps: [{ number: 2, durationMs: 1_250, elapsedMs: 1_250 }],
      }),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalid-lap-history' },
    });
  });

  it('rejects an invalid persisted timestamp', () => {
    const record = toStopwatchRecord(makeRunningStopwatch());

    expect(fromStopwatchRecord({ ...record, startedAt: -1 })).toMatchObject({
      ok: false,
      error: { code: 'invalid-timestamp' },
    });
  });
});
