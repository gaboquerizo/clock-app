import type {
  StopwatchLap,
  StopwatchLapNumber,
} from './stopwatch.types';
import { areStopwatchLapsValid } from './stopwatch.rules';

const DISPLAY_PRECISION_MS = 10;

export type StopwatchLapRanking = {
  fastestLapNumber: StopwatchLapNumber;
  slowestLapNumber: StopwatchLapNumber;
};

/**
 * Selects the fastest and slowest laps at the display's centisecond precision.
 * Strict comparisons preserve the first chronological occurrence on ties.
 */
export function selectStopwatchLapRanking(
  laps: readonly StopwatchLap[],
): StopwatchLapRanking | undefined {
  if (laps.length < 2 || !areStopwatchLapsValid(laps)) {
    return undefined;
  }

  const firstLap = laps[0];

  if (firstLap === undefined) {
    return undefined;
  }

  let fastestLapNumber = firstLap.number;
  let slowestLapNumber = firstLap.number;
  let fastestCentiseconds = Math.floor(
    firstLap.durationMs / DISPLAY_PRECISION_MS,
  );
  let slowestCentiseconds = fastestCentiseconds;

  for (let index = 1; index < laps.length; index += 1) {
    const lap = laps[index];

    if (lap === undefined) {
      continue;
    }

    const lapCentiseconds = Math.floor(
      lap.durationMs / DISPLAY_PRECISION_MS,
    );

    if (lapCentiseconds < fastestCentiseconds) {
      fastestCentiseconds = lapCentiseconds;
      fastestLapNumber = lap.number;
    }

    if (lapCentiseconds > slowestCentiseconds) {
      slowestCentiseconds = lapCentiseconds;
      slowestLapNumber = lap.number;
    }
  }

  if (fastestCentiseconds === slowestCentiseconds) {
    return undefined;
  }

  return { fastestLapNumber, slowestLapNumber };
}
