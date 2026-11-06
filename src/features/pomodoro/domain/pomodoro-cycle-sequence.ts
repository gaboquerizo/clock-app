import {
  isValidPomodoroBlockExecutionId,
  isValidPomodoroBlockType,
  isValidPomodoroCycleId,
  isValidPomodoroTimestampMs,
  validatePomodoroCycle,
} from './pomodoro.rules';
import { assignPomodoroBlockDuration } from './pomodoro-duration-assignment';
import type {
  PomodoroBlockCompletedEvent,
  PomodoroBlockExecutionId,
  PomodoroBlockType,
  PomodoroCycle,
  PomodoroCycleId,
  PomodoroDomainErrorCode,
  PomodoroPreferences,
  PomodoroResult,
} from './pomodoro.types';

export type AdvancePomodoroCycleInput = {
  event: PomodoroBlockCompletedEvent;
  nextBlockExecutionId: PomodoroBlockExecutionId;
  preferences: PomodoroPreferences;
  /** Required only after the long break completes. */
  nextCycleId?: PomodoroCycleId;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCompletionEvent(
  value: unknown,
): value is PomodoroBlockCompletedEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'block-completed' &&
    isValidPomodoroCycleId(value.cycleId) &&
    isValidPomodoroBlockExecutionId(value.blockExecutionId) &&
    isValidPomodoroBlockType(value.blockType) &&
    isValidPomodoroTimestampMs(value.completedAt)
  );
}

function failure<T>(code: PomodoroDomainErrorCode): PomodoroResult<T> {
  return { ok: false, error: { code } };
}

/** Prepares the next block after a matching completion event; it never starts it. */
export function advancePomodoroCycle(
  cycle: PomodoroCycle,
  input: AdvancePomodoroCycleInput,
): PomodoroResult<PomodoroCycle> {
  const validation = validatePomodoroCycle(cycle);

  if (!validation.ok) {
    return validation;
  }

  const current = validation.value;

  if (current.status !== 'running') {
    return failure('invalid-transition');
  }

  if (
    !isValidCompletionEvent(input.event) ||
    input.event.cycleId !== current.id ||
    input.event.blockExecutionId !== current.currentBlock.id ||
    input.event.blockType !== current.currentBlock.type
  ) {
    return failure('invalid-completion-event');
  }

  if (
    !isValidPomodoroBlockExecutionId(input.nextBlockExecutionId) ||
    input.nextBlockExecutionId === current.currentBlock.id
  ) {
    return failure('invalid-identity');
  }

  let cycleId = current.id;
  let completedFocusCount = current.completedFocusCount;
  let nextBlockType: PomodoroBlockType;

  if (current.currentBlock.type === 'focus') {
    completedFocusCount += 1;
    nextBlockType = completedFocusCount === 4 ? 'long-break' : 'short-break';
  } else if (current.currentBlock.type === 'short-break') {
    nextBlockType = 'focus';
  } else {
    if (
      !isValidPomodoroCycleId(input.nextCycleId) ||
      input.nextCycleId === current.id
    ) {
      return failure('invalid-identity');
    }

    cycleId = input.nextCycleId;
    completedFocusCount = 0;
    nextBlockType = 'focus';
  }

  const assignedDuration = assignPomodoroBlockDuration(
    nextBlockType,
    input.preferences,
  );

  if (!assignedDuration.ok) {
    return assignedDuration;
  }

  return {
    ok: true,
    value: {
      id: cycleId,
      status: 'ready',
      completedFocusCount,
      currentBlock: {
        id: input.nextBlockExecutionId,
        type: nextBlockType,
        durationMs: assignedDuration.value,
      },
    },
  };
}
