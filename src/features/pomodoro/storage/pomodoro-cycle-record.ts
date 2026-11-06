import {
  isValidPomodoroBlockExecutionId,
  isValidPomodoroCycleId,
  validatePomodoroCycle,
} from '../domain/pomodoro.rules';
import type {
  PomodoroBlockExecution,
  PomodoroBlockExecutionId,
  PomodoroCycle,
  PomodoroCycleId,
  PomodoroTimestampMs,
} from '../domain/pomodoro.types';

export const POMODORO_CYCLE_DATABASE_NAME = 'clock-app-pomodoro';
export const POMODORO_CYCLE_DATABASE_VERSION = 1;
export const POMODORO_CYCLE_STORE_NAME = 'pomodoro-cycle';
export const POMODORO_CYCLE_RECORD_ID = 'current';

export type PomodoroCompletionReceipt = {
  cycleId: PomodoroCycleId;
  blockExecutionId: PomodoroBlockExecutionId;
};

/** Storage-facing snapshot with the latest completion used for deduplication. */
export type PomodoroCycleSnapshot = {
  cycle: PomodoroCycle;
  lastProcessedCompletion: PomodoroCompletionReceipt | null;
};

type PomodoroCycleRecordBase = {
  id: typeof POMODORO_CYCLE_RECORD_ID;
  cycleId: PomodoroCycleId;
  completedFocusCount: number;
  currentBlock: PomodoroBlockExecution;
  lastProcessedCompletion: PomodoroCompletionReceipt | null;
};

export type PomodoroCycleRecord =
  | (PomodoroCycleRecordBase & { status: 'ready' })
  | (PomodoroCycleRecordBase & {
      status: 'running';
      startedAt: PomodoroTimestampMs;
      endsAt: PomodoroTimestampMs;
    })
  | (PomodoroCycleRecordBase & {
      status: 'paused';
      remainingMs: number;
    });

export type PomodoroCycleRecordResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: 'invalid-record' } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCompletionReceipt(
  value: unknown,
): value is PomodoroCompletionReceipt {
  return (
    isRecord(value) &&
    isValidPomodoroCycleId(value.cycleId) &&
    isValidPomodoroBlockExecutionId(value.blockExecutionId)
  );
}

function validReceiptOrEmpty(
  value: unknown,
): value is PomodoroCompletionReceipt | null {
  return value === null || isValidCompletionReceipt(value);
}

function invalidRecord<T>(): PomodoroCycleRecordResult<T> {
  return { ok: false, error: { code: 'invalid-record' } };
}

export function toPomodoroCycleRecord(
  value: PomodoroCycleSnapshot,
): PomodoroCycleRecordResult<PomodoroCycleRecord> {
  if (!isRecord(value)) {
    return invalidRecord();
  }

  const cycleResult = validatePomodoroCycle(value.cycle);
  const lastProcessedCompletion = value.lastProcessedCompletion;

  if (
    !cycleResult.ok ||
    !validReceiptOrEmpty(lastProcessedCompletion)
  ) {
    return invalidRecord();
  }

  const cycle = cycleResult.value;
  const base: PomodoroCycleRecordBase = {
    id: POMODORO_CYCLE_RECORD_ID,
    cycleId: cycle.id,
    completedFocusCount: cycle.completedFocusCount,
    currentBlock: cycle.currentBlock,
    lastProcessedCompletion,
  };

  if (cycle.status === 'ready') {
    return { ok: true, value: { ...base, status: 'ready' } };
  }

  if (cycle.status === 'running') {
    return {
      ok: true,
      value: {
        ...base,
        status: 'running',
        startedAt: cycle.startedAt,
        endsAt: cycle.endsAt,
      },
    };
  }

  return {
    ok: true,
    value: {
      ...base,
      status: 'paused',
      remainingMs: cycle.remainingMs,
    },
  };
}

export function fromPomodoroCycleRecord(
  value: unknown,
): PomodoroCycleRecordResult<PomodoroCycleSnapshot> {
  if (
    !isRecord(value) ||
    value.id !== POMODORO_CYCLE_RECORD_ID ||
    !validReceiptOrEmpty(value.lastProcessedCompletion)
  ) {
    return invalidRecord();
  }

  const cycleValue = {
    id: value.cycleId,
    status: value.status,
    completedFocusCount: value.completedFocusCount,
    currentBlock: value.currentBlock,
    startedAt: value.startedAt,
    endsAt: value.endsAt,
    remainingMs: value.remainingMs,
  };
  const cycleResult = validatePomodoroCycle(cycleValue);

  if (!cycleResult.ok) {
    return invalidRecord();
  }

  return {
    ok: true,
    value: {
      cycle: cycleResult.value,
      lastProcessedCompletion: value.lastProcessedCompletion,
    },
  };
}
