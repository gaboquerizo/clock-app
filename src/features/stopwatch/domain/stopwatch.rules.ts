import type {
  StopwatchElapsedMs,
  StopwatchLap,
  StopwatchTimestampMs,
} from './stopwatch.types';

export function isValidStopwatchTimestamp(
  value: unknown,
): value is StopwatchTimestampMs {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  );
}

export function isValidStopwatchElapsed(
  value: unknown,
): value is StopwatchElapsedMs {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  );
}

export function areStopwatchLapsValid(
  laps: readonly StopwatchLap[],
): boolean {
  let previousElapsedMs = 0;

  return laps.every((lap, index) => {
    if (
      lap.number !== index + 1 ||
      !isValidStopwatchElapsed(lap.durationMs) ||
      !isValidStopwatchElapsed(lap.elapsedMs) ||
      lap.elapsedMs < previousElapsedMs ||
      lap.durationMs !== lap.elapsedMs - previousElapsedMs
    ) {
      return false;
    }

    previousElapsedMs = lap.elapsedMs;
    return true;
  });
}
