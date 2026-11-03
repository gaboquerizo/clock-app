import type {
  StopwatchElapsedMs,
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
