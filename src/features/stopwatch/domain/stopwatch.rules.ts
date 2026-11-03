import type {
  StopwatchElapsedMs,
  StopwatchLap,
  Stopwatch,
  StopwatchDomainErrorCode,
  StopwatchResult,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStopwatchLap(value: unknown): value is StopwatchLap {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.number === 'number' &&
    Number.isSafeInteger(value.number) &&
    value.number > 0 &&
    isValidStopwatchElapsed(value.durationMs) &&
    isValidStopwatchElapsed(value.elapsedMs)
  );
}

function validationFailure<T>(
  code: StopwatchDomainErrorCode,
): StopwatchResult<T> {
  return { ok: false, error: { code } };
}

function validationSuccess<T>(value: T): StopwatchResult<T> {
  return { ok: true, value };
}

export function validateStopwatch(value: unknown): StopwatchResult<Stopwatch> {
  if (!isRecord(value)) {
    return validationFailure('invalid-state');
  }

  if (!isValidStopwatchElapsed(value.accumulatedMs)) {
    return validationFailure('invalid-elapsed-time');
  }

  if (!Array.isArray(value.laps) || !value.laps.every(isStopwatchLap)) {
    return validationFailure('invalid-lap-history');
  }

  const laps = value.laps.map((lap) => ({ ...lap }));

  if (!areStopwatchLapsValid(laps)) {
    return validationFailure('invalid-lap-history');
  }

  const accumulatedMs = value.accumulatedMs;

  if (value.status === 'idle') {
    if (
      accumulatedMs !== 0 ||
      laps.length !== 0 ||
      value.startedAt !== undefined
    ) {
      return validationFailure('invalid-state');
    }

    return validationSuccess({ status: 'idle', accumulatedMs: 0, laps: [] });
  }

  if (value.status === 'running') {
    if (!isValidStopwatchTimestamp(value.startedAt)) {
      return validationFailure('invalid-timestamp');
    }

    return validationSuccess({
      status: 'running',
      accumulatedMs,
      startedAt: value.startedAt,
      laps,
    });
  }

  if (value.status === 'paused') {
    if (
      value.startedAt !== undefined ||
      (laps.at(-1)?.elapsedMs ?? 0) > accumulatedMs
    ) {
      return validationFailure('invalid-state');
    }

    return validationSuccess({ status: 'paused', accumulatedMs, laps });
  }

  return validationFailure('invalid-state');
}
