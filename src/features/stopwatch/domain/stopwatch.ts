import type {
  IdleStopwatch,
  RecordStopwatchLapCommand,
  RunningStopwatch,
  Stopwatch,
  StopwatchDomainErrorCode,
  StopwatchLap,
  StopwatchResult,
  StopwatchTransitionCommand,
} from './stopwatch.types';
import {
  areStopwatchLapsValid,
  isValidStopwatchElapsed,
  isValidStopwatchTimestamp,
} from './stopwatch.rules';

function failure<T>(
  code: StopwatchDomainErrorCode,
): StopwatchResult<T> {
  return { ok: false, error: { code } };
}

function success<T>(value: T): StopwatchResult<T> {
  return { ok: true, value };
}

export function createStopwatch(): IdleStopwatch {
  return {
    status: 'idle',
    accumulatedMs: 0,
    laps: [],
  };
}

export function transitionStopwatch(
  stopwatch: Stopwatch,
  command: StopwatchTransitionCommand,
): StopwatchResult<Stopwatch> {
  if (command.type === 'start') {
    if (stopwatch.status !== 'idle') {
      return failure('invalid-transition');
    }

    if (!isValidStopwatchTimestamp(command.timestampMs)) {
      return failure('invalid-timestamp');
    }

    return success({
      status: 'running',
      accumulatedMs: 0,
      startedAt: command.timestampMs,
      laps: stopwatch.laps,
    });
  }

  if (command.type === 'pause') {
    if (stopwatch.status !== 'running') {
      return failure('invalid-transition');
    }

    if (
      !isValidStopwatchTimestamp(command.timestampMs) ||
      !isValidStopwatchTimestamp(stopwatch.startedAt) ||
      command.timestampMs < stopwatch.startedAt
    ) {
      return failure('invalid-timestamp');
    }

    if (!isValidStopwatchElapsed(stopwatch.accumulatedMs)) {
      return failure('invalid-elapsed-time');
    }

    const segmentMs = command.timestampMs - stopwatch.startedAt;
    const accumulatedMs = stopwatch.accumulatedMs + segmentMs;

    if (
      !isValidStopwatchElapsed(segmentMs) ||
      !isValidStopwatchElapsed(accumulatedMs)
    ) {
      return failure('invalid-elapsed-time');
    }

    return success({
      status: 'paused',
      accumulatedMs,
      laps: stopwatch.laps,
    });
  }

  if (command.type === 'resume') {
    if (stopwatch.status !== 'paused') {
      return failure('invalid-transition');
    }

    if (!isValidStopwatchTimestamp(command.timestampMs)) {
      return failure('invalid-timestamp');
    }

    if (!isValidStopwatchElapsed(stopwatch.accumulatedMs)) {
      return failure('invalid-elapsed-time');
    }

    return success({
      status: 'running',
      accumulatedMs: stopwatch.accumulatedMs,
      startedAt: command.timestampMs,
      laps: stopwatch.laps,
    });
  }

  if (stopwatch.status !== 'paused') {
    return failure('invalid-transition');
  }

  return success(createStopwatch());
}

export function recordStopwatchLap(
  stopwatch: Stopwatch,
  command: RecordStopwatchLapCommand,
): StopwatchResult<RunningStopwatch> {
  if (stopwatch.status !== 'running') {
    return failure('invalid-transition');
  }

  if (
    !isValidStopwatchTimestamp(command.timestampMs) ||
    !isValidStopwatchTimestamp(stopwatch.startedAt) ||
    command.timestampMs < stopwatch.startedAt
  ) {
    return failure('invalid-timestamp');
  }

  if (!isValidStopwatchElapsed(stopwatch.accumulatedMs)) {
    return failure('invalid-elapsed-time');
  }

  if (!areStopwatchLapsValid(stopwatch.laps)) {
    return failure('invalid-lap-history');
  }

  const elapsedSegmentMs = command.timestampMs - stopwatch.startedAt;
  const elapsedMs = stopwatch.accumulatedMs + elapsedSegmentMs;

  if (
    !isValidStopwatchElapsed(elapsedSegmentMs) ||
    !isValidStopwatchElapsed(elapsedMs)
  ) {
    return failure('invalid-elapsed-time');
  }

  const previousLap = stopwatch.laps.at(-1);
  const previousLapElapsedMs = previousLap?.elapsedMs ?? 0;

  if (elapsedMs < previousLapElapsedMs) {
    return failure('invalid-timestamp');
  }

  const lap: StopwatchLap = {
    number: stopwatch.laps.length + 1,
    durationMs: elapsedMs - previousLapElapsedMs,
    elapsedMs,
  };

  return success({
    ...stopwatch,
    laps: [...stopwatch.laps, lap],
  });
}
