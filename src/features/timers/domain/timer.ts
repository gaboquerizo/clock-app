import type {
  CreateTimerInput,
  Timer,
  TimerDomainError,
  TimerField,
  TimerResult,
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

export function createTimer(
  input: CreateTimerInput,
  existingTimers: readonly Timer[] = [],
): TimerResult<Extract<Timer, { status: 'ready' }>> {
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
