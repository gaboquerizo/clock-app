import {
  isValidPomodoroTimestampMs,
  validatePomodoroCycle,
} from './pomodoro.rules';
import type {
  PomodoroCycle,
  PomodoroDomainErrorCode,
  PomodoroResult,
  PomodoroTransitionCommand,
} from './pomodoro.types';

function failure<T>(code: PomodoroDomainErrorCode): PomodoroResult<T> {
  return { ok: false, error: { code } };
}

function success<T>(value: T): PomodoroResult<T> {
  return { ok: true, value };
}

function createRunningCycle(
  cycle: PomodoroCycle,
  timestampMs: number,
  remainingMs: number,
): PomodoroResult<PomodoroCycle> {
  const endsAt = timestampMs + remainingMs;

  if (!isValidPomodoroTimestampMs(endsAt)) {
    return failure('invalid-deadline');
  }

  return success({
    id: cycle.id,
    status: 'running',
    startedAt: timestampMs,
    endsAt,
    completedFocusCount: cycle.completedFocusCount,
    currentBlock: cycle.currentBlock,
  });
}

export function transitionPomodoroCycle(
  cycle: PomodoroCycle,
  command: PomodoroTransitionCommand,
): PomodoroResult<PomodoroCycle> {
  const validation = validatePomodoroCycle(cycle);

  if (!validation.ok) {
    return validation;
  }

  const current = validation.value;

  if (!isValidPomodoroTimestampMs(command.timestampMs)) {
    return failure('invalid-timestamp');
  }

  if (command.type === 'start' && current.status === 'ready') {
    return createRunningCycle(
      current,
      command.timestampMs,
      current.currentBlock.durationMs,
    );
  }

  if (command.type === 'pause' && current.status === 'running') {
    if (command.timestampMs < current.startedAt) {
      return failure('invalid-timestamp');
    }

    if (command.timestampMs >= current.endsAt) {
      return failure('block-expired');
    }

    return success({
      id: current.id,
      status: 'paused',
      completedFocusCount: current.completedFocusCount,
      currentBlock: current.currentBlock,
      remainingMs: current.endsAt - command.timestampMs,
    });
  }

  if (command.type === 'resume' && current.status === 'paused') {
    return createRunningCycle(
      current,
      command.timestampMs,
      current.remainingMs,
    );
  }

  return failure('invalid-transition');
}
