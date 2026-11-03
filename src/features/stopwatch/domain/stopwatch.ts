import type {
  IdleStopwatch,
  Stopwatch,
  StopwatchDomainErrorCode,
  StopwatchResult,
  StopwatchTransitionCommand,
} from './stopwatch.types';
import {
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
