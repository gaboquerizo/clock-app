/** Absolute Unix timestamp measured in milliseconds. */
export type StopwatchTimestampMs = number;

/** Elapsed duration measured in milliseconds. */
export type StopwatchElapsedMs = number;

export type StopwatchLapNumber = number;

export type StopwatchLap = {
  number: StopwatchLapNumber;
  /** Duration since the previous lap, or since start for the first lap. */
  durationMs: StopwatchElapsedMs;
  /** Total elapsed duration at the moment this lap was recorded. */
  elapsedMs: StopwatchElapsedMs;
};

export type StopwatchState = 'idle' | 'running' | 'paused';

export type IdleStopwatch = {
  status: 'idle';
  accumulatedMs: 0;
  laps: readonly [];
};

export type RunningStopwatch = {
  status: 'running';
  /** Elapsed duration accumulated before the current running segment. */
  accumulatedMs: StopwatchElapsedMs;
  /** Absolute start timestamp of the current running segment. */
  startedAt: StopwatchTimestampMs;
  laps: readonly StopwatchLap[];
};

export type PausedStopwatch = {
  status: 'paused';
  /** Elapsed duration accumulated through the most recent pause. */
  accumulatedMs: StopwatchElapsedMs;
  laps: readonly StopwatchLap[];
};

/** A single stopwatch process, represented by its current lifecycle state. */
export type Stopwatch =
  | IdleStopwatch
  | RunningStopwatch
  | PausedStopwatch;

export type StopwatchTransition = 'start' | 'pause' | 'resume' | 'reset';

export type StopwatchTransitionCommand =
  | { type: 'start'; timestampMs: StopwatchTimestampMs }
  | { type: 'pause'; timestampMs: StopwatchTimestampMs }
  | { type: 'resume'; timestampMs: StopwatchTimestampMs }
  | { type: 'reset' };

export type RecordStopwatchLapCommand = {
  type: 'record-lap';
  timestampMs: StopwatchTimestampMs;
};

/** Commands accepted by the stopwatch domain operations. */
export type StopwatchCommand =
  | StopwatchTransitionCommand
  | RecordStopwatchLapCommand;

export type StopwatchDomainErrorCode =
  | 'invalid-transition'
  | 'invalid-timestamp'
  | 'invalid-elapsed-time'
  | 'invalid-lap-history';

export type StopwatchDomainError = {
  code: StopwatchDomainErrorCode;
};

export type StopwatchResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StopwatchDomainError };
