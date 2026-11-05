/** Stable identity of the single Pomodoro cycle. */
export type PomodoroCycleId = string;

/** Stable identity of one focus or break block execution. */
export type PomodoroBlockExecutionId = string;

/** Block duration measured in milliseconds. */
export type PomodoroDurationMs = number;

/** Configured Pomodoro block duration measured in whole minutes. */
export type PomodoroDurationMinutes = number;

/** Absolute Unix timestamp measured in milliseconds. */
export type PomodoroTimestampMs = number;

export type PomodoroPreferences = {
  focusDurationMinutes: PomodoroDurationMinutes;
  shortBreakDurationMinutes: PomodoroDurationMinutes;
  longBreakDurationMinutes: PomodoroDurationMinutes;
};

export type PomodoroPreferenceField = keyof PomodoroPreferences;

export type PomodoroPreferencesValidationError =
  | { code: 'invalid-preferences' }
  | { code: 'invalid-duration'; field: PomodoroPreferenceField };

export type PomodoroPreferencesValidationResult =
  | { ok: true; value: PomodoroPreferences }
  | {
      ok: false;
      errors: readonly PomodoroPreferencesValidationError[];
    };

export type PomodoroBlockType = 'focus' | 'short-break' | 'long-break';

export type PomodoroCycleStatus = 'ready' | 'running' | 'paused';

/** Configuration assigned to this particular execution of a cycle block. */
export type PomodoroBlockExecution = {
  id: PomodoroBlockExecutionId;
  type: PomodoroBlockType;
  durationMs: PomodoroDurationMs;
};

type PomodoroCycleBase = {
  id: PomodoroCycleId;
  completedFocusCount: number;
  currentBlock: PomodoroBlockExecution;
};

export type ReadyPomodoroCycle = PomodoroCycleBase & {
  status: 'ready';
};

export type RunningPomodoroCycle = PomodoroCycleBase & {
  status: 'running';
  /** Absolute deadline of the current block execution. */
  endsAt: PomodoroTimestampMs;
};

export type PausedPomodoroCycle = PomodoroCycleBase & {
  status: 'paused';
  /** Remaining block duration captured when the cycle was paused. */
  remainingMs: PomodoroDurationMs;
};

/** A single Pomodoro cycle with its current block and lifecycle state. */
export type PomodoroCycle =
  | ReadyPomodoroCycle
  | RunningPomodoroCycle
  | PausedPomodoroCycle;

/** Emitted once when a particular block execution reaches its deadline. */
export type PomodoroBlockCompletedEvent = {
  type: 'block-completed';
  cycleId: PomodoroCycleId;
  blockExecutionId: PomodoroBlockExecutionId;
  blockType: PomodoroBlockType;
  completedAt: PomodoroTimestampMs;
};
