import { describe, expect, it } from 'vitest';

import { selectStopwatchLapRanking } from './stopwatch-lap-ranking';
import type { StopwatchLap } from './stopwatch.types';

function makeLaps(durationsMs: number[]): StopwatchLap[] {
  let elapsedMs = 0;

  return durationsMs.map((durationMs, index) => {
    elapsedMs += durationMs;
    return {
      number: index + 1,
      durationMs,
      elapsedMs,
    };
  });
}

describe('Stopwatch lap ranking', () => {
  it('omits rankings with fewer than two laps', () => {
    expect(selectStopwatchLapRanking([])).toBeUndefined();
    expect(selectStopwatchLapRanking(makeLaps([1_000]))).toBeUndefined();
  });

  it('selects the fastest and slowest lap numbers without reordering the history', () => {
    const laps = makeLaps([500, 120, 300, 900]);
    const originalOrder = [...laps];

    expect(selectStopwatchLapRanking(laps)).toEqual({
      fastestLapNumber: 2,
      slowestLapNumber: 4,
    });
    expect(laps).toEqual(originalOrder);
  });

  it('keeps the first chronological occurrence for fastest and slowest ties', () => {
    expect(
      selectStopwatchLapRanking(makeLaps([500, 120, 120, 900, 900, 400])),
    ).toEqual({ fastestLapNumber: 2, slowestLapNumber: 4 });
  });

  it('omits rankings when all durations are equal at centisecond precision', () => {
    expect(selectStopwatchLapRanking(makeLaps([1_000, 1_000, 1_000]))).toBe(
      undefined,
    );
    expect(selectStopwatchLapRanking(makeLaps([101, 109]))).toBeUndefined();
  });

  it('omits rankings for an invalid lap sequence', () => {
    expect(
      selectStopwatchLapRanking([
        { number: 1, durationMs: 100, elapsedMs: 100 },
        { number: 3, durationMs: 200, elapsedMs: 300 },
      ]),
    ).toBeUndefined();
  });
});
