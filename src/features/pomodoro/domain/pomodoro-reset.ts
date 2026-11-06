import {
  isValidPomodoroBlockExecutionId,
  isValidPomodoroCycleId,
  validatePomodoroCycle,
} from './pomodoro.rules';
import { assignPomodoroBlockDuration } from './pomodoro-duration-assignment';
import type {
  PomodoroBlockExecutionId,
  PomodoroCycle,
  PomodoroCycleId,
  PomodoroDomainErrorCode,
  PomodoroPreferences,
  PomodoroResult,
} from './pomodoro.types';

export type ResetPomodoroCycleInput = {
  nextCycleId: PomodoroCycleId;
  nextBlockExecutionId: PomodoroBlockExecutionId;
  preferences: PomodoroPreferences;
};

function failure<T>(code: PomodoroDomainErrorCode): PomodoroResult<T> {
  return { ok: false, error: { code } };
}

/** Resets the current block without changing the cycle's progress. */
export function resetPomodoroBlock(
  cycle: PomodoroCycle,
  nextBlockExecutionId: PomodoroBlockExecutionId,
): PomodoroResult<PomodoroCycle> {
  const validation = validatePomodoroCycle(cycle);

  if (!validation.ok) {
    return validation;
  }

  const current = validation.value;

  if (
    !isValidPomodoroBlockExecutionId(nextBlockExecutionId) ||
    nextBlockExecutionId === current.currentBlock.id
  ) {
    return failure('invalid-identity');
  }

  return {
    ok: true,
    value: {
      id: current.id,
      status: 'ready',
      completedFocusCount: current.completedFocusCount,
      currentBlock: {
        id: nextBlockExecutionId,
        type: current.currentBlock.type,
        durationMs: current.currentBlock.durationMs,
      },
    },
  };
}

/** Starts a fresh cycle configuration in ready state; it does not start timing. */
export function resetPomodoroCycle(
  cycle: PomodoroCycle,
  input: ResetPomodoroCycleInput,
): PomodoroResult<PomodoroCycle> {
  const validation = validatePomodoroCycle(cycle);

  if (!validation.ok) {
    return validation;
  }

  const current = validation.value;

  if (
    !isValidPomodoroCycleId(input.nextCycleId) ||
    input.nextCycleId === current.id ||
    !isValidPomodoroBlockExecutionId(input.nextBlockExecutionId) ||
    input.nextBlockExecutionId === current.currentBlock.id
  ) {
    return failure('invalid-identity');
  }

  const assignedDuration = assignPomodoroBlockDuration(
    'focus',
    input.preferences,
  );

  if (!assignedDuration.ok) {
    return assignedDuration;
  }

  return {
    ok: true,
    value: {
      id: input.nextCycleId,
      status: 'ready',
      completedFocusCount: 0,
      currentBlock: {
        id: input.nextBlockExecutionId,
        type: 'focus',
        durationMs: assignedDuration.value,
      },
    },
  };
}
