export type TimerId = string;
export type TimerDurationMs = number;
export type TimerTimestampMs = number;
export type TimerLabel = string;

export type TimerStatus = 'ready' | 'running' | 'paused' | 'completed';

type TimerBase = {
  id: TimerId;
  durationMs: TimerDurationMs;
  label: TimerLabel;
  createdAt: TimerTimestampMs;
  updatedAt: TimerTimestampMs;
};

export type ReadyTimer = TimerBase & {
  status: 'ready';
  remainingMs: TimerDurationMs;
};

export type RunningTimer = TimerBase & {
  status: 'running';
  startedAt: TimerTimestampMs;
  endsAt: TimerTimestampMs;
  remainingAtStartMs: TimerDurationMs;
};

export type PausedTimer = TimerBase & {
  status: 'paused';
  remainingMs: TimerDurationMs;
};

export type CompletedTimer = TimerBase & {
  status: 'completed';
  completedAt: TimerTimestampMs;
};

export type Timer = ReadyTimer | RunningTimer | PausedTimer | CompletedTimer;

export type CreateTimerInput = {
  id: TimerId;
  durationMs: TimerDurationMs;
  label?: TimerLabel;
  createdAt: TimerTimestampMs;
};

export type UpdateTimerInput = {
  durationMs: TimerDurationMs;
  label?: TimerLabel;
};

export type RemoveTimerInput = {
  id: TimerId;
};

export type TimerTransition = 'start' | 'pause' | 'resume' | 'restart';

export type TimerField =
  | 'id'
  | 'durationMs'
  | 'label'
  | 'status'
  | 'remainingMs'
  | 'remainingAtStartMs'
  | 'startedAt'
  | 'endsAt'
  | 'completedAt'
  | 'createdAt'
  | 'updatedAt';

export type TimerErrorCode =
  | 'invalid-id'
  | 'invalid-duration'
  | 'invalid-label'
  | 'invalid-state'
  | 'invalid-timestamp'
  | 'duplicate-id'
  | 'not-found'
  | 'invalid-transition';

export type TimerDomainError = {
  code: TimerErrorCode;
  field?: TimerField;
};

export type TimerResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: TimerDomainError };
