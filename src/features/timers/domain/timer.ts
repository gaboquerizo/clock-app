import type {
  CompletedTimer,
  CreateTimerInput,
  PausedTimer,
  ReadyTimer,
  RunningTimer,
  Timer,
  TimerDomainError,
  TimerField,
  TimerReconciliationResult,
  TimerResult,
  TimerTransition,
  UpdateTimerInput,
} from './timer.types';
import {
  hasDuplicateTimerId,
  isValidTimerDuration,
  isValidTimerId,
  isValidTimerTimestamp,
} from './timer.rules';

function failure<T>(
  code: TimerDomainError['code'],
  field?: TimerField,
): TimerResult<T> {
  return {
    ok: false,
    error: { code, ...(field === undefined ? {} : { field }) },
  };
}

function success<T>(value: T): TimerResult<T> {
  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasTemporalFields(value: Record<string, unknown>): boolean {
  return (
    value.startedAt !== undefined ||
    value.endsAt !== undefined ||
    value.remainingAtStartMs !== undefined ||
    value.completedAt !== undefined
  );
}

export function validateTimer(value: unknown): TimerResult<Timer> {
  if (!isRecord(value)) {
    return failure('invalid-state');
  }

  if (!isValidTimerId(value.id)) {
    return failure('invalid-id', 'id');
  }

  if (!isValidTimerDuration(value.durationMs)) {
    return failure('invalid-duration', 'durationMs');
  }

  if (typeof value.label !== 'string') {
    return failure('invalid-label', 'label');
  }

  if (!isValidTimerTimestamp(value.createdAt)) {
    return failure('invalid-timestamp', 'createdAt');
  }

  if (
    !isValidTimerTimestamp(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return failure('invalid-timestamp', 'updatedAt');
  }

  const base = {
    id: value.id,
    durationMs: value.durationMs,
    label: value.label.trim(),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.status === 'ready') {
    if (
      value.remainingMs !== value.durationMs ||
      hasTemporalFields(value)
    ) {
      return failure('invalid-state', 'status');
    }

    return success({ ...base, status: 'ready', remainingMs: value.durationMs });
  }

  if (value.status === 'running') {
    if (
      !isValidTimerDuration(value.remainingAtStartMs) ||
      value.remainingAtStartMs > value.durationMs ||
      !isValidTimerTimestamp(value.startedAt) ||
      !isValidTimerTimestamp(value.endsAt) ||
      value.startedAt < value.createdAt ||
      value.updatedAt < value.startedAt ||
      value.endsAt - value.startedAt !== value.remainingAtStartMs ||
      value.remainingMs !== undefined ||
      value.completedAt !== undefined
    ) {
      return failure('invalid-state', 'status');
    }

    return success({
      ...base,
      status: 'running',
      startedAt: value.startedAt,
      endsAt: value.endsAt,
      remainingAtStartMs: value.remainingAtStartMs,
    });
  }

  if (value.status === 'paused') {
    if (
      !isValidTimerDuration(value.remainingMs) ||
      value.remainingMs > value.durationMs ||
      hasTemporalFields(value)
    ) {
      return failure('invalid-state', 'status');
    }

    return success({
      ...base,
      status: 'paused',
      remainingMs: value.remainingMs,
    });
  }

  if (value.status === 'completed') {
    if (
      !isValidTimerTimestamp(value.completedAt) ||
      value.completedAt < value.createdAt ||
      value.completedAt > value.updatedAt ||
      value.remainingMs !== undefined ||
      value.startedAt !== undefined ||
      value.endsAt !== undefined ||
      value.remainingAtStartMs !== undefined
    ) {
      return failure('invalid-state', 'status');
    }

    return success({
      ...base,
      status: 'completed',
      completedAt: value.completedAt,
    });
  }

  return failure('invalid-state', 'status');
}

export function getTimerRemainingMs(timer: Timer, timestamp: number): number {
  if (timer.status === 'completed') {
    return 0;
  }

  if (timer.status === 'running') {
    return Math.max(0, timer.endsAt - timestamp);
  }

  return timer.remainingMs;
}

export function createTimer(
  input: CreateTimerInput,
  existingTimers: readonly Timer[] = [],
): TimerResult<ReadyTimer> {
  if (hasDuplicateTimerId(existingTimers, input.id)) {
    return failure('duplicate-id', 'id');
  }

  const timer = validateTimer({
    id: input.id,
    durationMs: input.durationMs,
    label: input.label ?? '',
    status: 'ready',
    remainingMs: input.durationMs,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });

  if (!timer.ok) {
    return timer;
  }

  if (timer.value.status !== 'ready') {
    return failure('invalid-state', 'status');
  }

  return success(timer.value);
}

export function updateTimer(
  timer: Timer,
  input: UpdateTimerInput,
  timestamp: number,
): TimerResult<ReadyTimer> {
  const current = validateTimer(timer);

  if (!current.ok) {
    return current;
  }

  if (!isValidTimerDuration(input.durationMs)) {
    return failure('invalid-duration', 'durationMs');
  }

  if (input.label !== undefined && typeof input.label !== 'string') {
    return failure('invalid-label', 'label');
  }

  if (
    !isValidTimerTimestamp(timestamp) ||
    timestamp < current.value.updatedAt
  ) {
    return failure('invalid-timestamp', 'updatedAt');
  }

  const updated = validateTimer({
    id: current.value.id,
    durationMs: input.durationMs,
    label: input.label ?? current.value.label,
    status: 'ready',
    remainingMs: input.durationMs,
    createdAt: current.value.createdAt,
    updatedAt: timestamp,
  });

  if (!updated.ok) {
    return updated;
  }

  if (updated.value.status !== 'ready') {
    return failure('invalid-state', 'status');
  }

  return success(updated.value);
}

function createRunningTimer(
  timer: Timer,
  remainingMs: number,
  timestamp: number,
): TimerResult<RunningTimer> {
  const endsAt = timestamp + remainingMs;

  if (!isValidTimerTimestamp(endsAt)) {
    return failure('invalid-timestamp', 'endsAt');
  }

  return success({
    id: timer.id,
    durationMs: timer.durationMs,
    label: timer.label,
    status: 'running',
    startedAt: timestamp,
    endsAt,
    remainingAtStartMs: remainingMs,
    createdAt: timer.createdAt,
    updatedAt: timestamp,
  });
}

function toCompletedTimer(
  timer: RunningTimer,
  timestamp: number,
): CompletedTimer {
  return {
    id: timer.id,
    durationMs: timer.durationMs,
    label: timer.label,
    status: 'completed',
    completedAt: timer.endsAt,
    createdAt: timer.createdAt,
    updatedAt: timestamp,
  };
}

export function reconcileTimer(
  timer: Timer,
  timestamp: number,
): TimerResult<TimerReconciliationResult> {
  const validation = validateTimer(timer);

  if (!validation.ok) {
    return validation;
  }

  const current = validation.value;

  if (
    !isValidTimerTimestamp(timestamp) ||
    timestamp < current.updatedAt
  ) {
    return failure('invalid-timestamp', 'updatedAt');
  }

  if (current.status !== 'running' || timestamp < current.endsAt) {
    return success({ timer: current, completed: false });
  }

  return success({
    timer: toCompletedTimer(current, timestamp),
    completed: true,
  });
}

export function transitionTimer(
  timer: Timer,
  transition: TimerTransition,
  timestamp: number,
): TimerResult<Timer> {
  const reconciliation = reconcileTimer(timer, timestamp);

  if (!reconciliation.ok) {
    return reconciliation;
  }

  const current = reconciliation.value.timer;

  if (transition === 'start' && current.status === 'ready') {
    return createRunningTimer(current, current.durationMs, timestamp);
  }

  if (transition === 'pause' && current.status === 'running') {
    const remainingMs = current.endsAt - timestamp;

    if (!isValidTimerDuration(remainingMs)) {
      return failure('invalid-transition', 'remainingMs');
    }

    const pausedTimer: PausedTimer = {
      id: current.id,
      durationMs: current.durationMs,
      label: current.label,
      status: 'paused',
      remainingMs,
      createdAt: current.createdAt,
      updatedAt: timestamp,
    };

    return success(pausedTimer);
  }

  if (transition === 'resume' && current.status === 'paused') {
    return createRunningTimer(current, current.remainingMs, timestamp);
  }

  if (transition === 'restart' && current.status === 'running') {
    return createRunningTimer(current, current.durationMs, timestamp);
  }

  if (transition === 'restart' && current.status === 'paused') {
    return success({
      id: current.id,
      durationMs: current.durationMs,
      label: current.label,
      status: 'paused',
      remainingMs: current.durationMs,
      createdAt: current.createdAt,
      updatedAt: timestamp,
    });
  }

  if (transition === 'restart' && current.status === 'completed') {
    const readyTimer: ReadyTimer = {
      id: current.id,
      durationMs: current.durationMs,
      label: current.label,
      status: 'ready',
      remainingMs: current.durationMs,
      createdAt: current.createdAt,
      updatedAt: timestamp,
    };

    return success(readyTimer);
  }

  return failure('invalid-transition');
}
