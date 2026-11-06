import type {
  PomodoroBlockExecutionId,
  PomodoroBlockType,
  PomodoroCycle,
  PomodoroCycleId,
  PomodoroDurationMs,
  PomodoroDomainErrorCode,
  PomodoroResult,
  PomodoroTimestampMs,
} from './pomodoro.types';

export function isValidPomodoroCycleId(
  value: unknown,
): value is PomodoroCycleId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value
  );
}

export function isValidPomodoroBlockExecutionId(
  value: unknown,
): value is PomodoroBlockExecutionId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value
  );
}

export function isValidPomodoroBlockType(
  value: unknown,
): value is PomodoroBlockType {
  return (
    value === 'focus' || value === 'short-break' || value === 'long-break'
  );
}

export function isValidPomodoroDurationMs(
  value: unknown,
): value is PomodoroDurationMs {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  );
}

export function isValidPomodoroTimestampMs(
  value: unknown,
): value is PomodoroTimestampMs {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  );
}

function isValidPomodoroProgress(
  completedFocusCount: number,
  blockType: PomodoroBlockType,
): boolean {
  if (completedFocusCount === 0) {
    return blockType === 'focus';
  }

  if (completedFocusCount < 4) {
    return blockType === 'focus' || blockType === 'short-break';
  }

  return completedFocusCount === 4 && blockType === 'long-break';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure<T>(code: PomodoroDomainErrorCode): PomodoroResult<T> {
  return { ok: false, error: { code } };
}

function success<T>(value: T): PomodoroResult<T> {
  return { ok: true, value };
}

export function validatePomodoroCycle(
  value: unknown,
): PomodoroResult<PomodoroCycle> {
  if (!isRecord(value)) {
    return failure('invalid-cycle');
  }

  const id = value.id;
  const completedFocusCount = value.completedFocusCount;
  const currentBlockValue = value.currentBlock;

  if (
    !isValidPomodoroCycleId(id) ||
    typeof completedFocusCount !== 'number' ||
    !Number.isSafeInteger(completedFocusCount) ||
    completedFocusCount < 0 ||
    completedFocusCount > 4 ||
    !isRecord(currentBlockValue)
  ) {
    return failure('invalid-cycle');
  }

  const blockId = currentBlockValue.id;
  const blockType = currentBlockValue.type;
  const durationMs = currentBlockValue.durationMs;

  if (
    !isValidPomodoroBlockExecutionId(blockId) ||
    !isValidPomodoroBlockType(blockType) ||
    !isValidPomodoroDurationMs(durationMs) ||
    !isValidPomodoroProgress(completedFocusCount, blockType)
  ) {
    return failure('invalid-cycle');
  }

  const base = {
    id,
    completedFocusCount,
    currentBlock: { id: blockId, type: blockType, durationMs },
  };

  if (value.status === 'ready') {
    if (
      value.startedAt !== undefined ||
      value.endsAt !== undefined ||
      value.remainingMs !== undefined
    ) {
      return failure('invalid-cycle');
    }

    return success({ ...base, status: 'ready' });
  }

  if (value.status === 'running') {
    const startedAt = value.startedAt;
    const endsAt = value.endsAt;

    if (
      !isValidPomodoroTimestampMs(startedAt) ||
      !isValidPomodoroTimestampMs(endsAt) ||
      endsAt <= startedAt ||
      endsAt - startedAt > durationMs ||
      value.remainingMs !== undefined
    ) {
      return failure('invalid-cycle');
    }

    return success({ ...base, status: 'running', startedAt, endsAt });
  }

  if (value.status === 'paused') {
    const remainingMs = value.remainingMs;

    if (
      !isValidPomodoroDurationMs(remainingMs) ||
      remainingMs > durationMs ||
      value.startedAt !== undefined ||
      value.endsAt !== undefined
    ) {
      return failure('invalid-cycle');
    }

    return success({ ...base, status: 'paused', remainingMs });
  }

  return failure('invalid-cycle');
}
