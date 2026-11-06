import { validatePomodoroCycle } from './pomodoro.rules';
import { validatePomodoroPreferences } from './pomodoro-preferences';
import type {
  PomodoroBlockType,
  PomodoroCycle,
  PomodoroDomainErrorCode,
  PomodoroDurationMs,
  PomodoroPreferences,
  PomodoroResult,
} from './pomodoro.types';

function failure<T>(code: PomodoroDomainErrorCode): PomodoroResult<T> {
  return { ok: false, error: { code } };
}

function durationForValidatedPreferences(
  blockType: PomodoroBlockType,
  preferences: PomodoroPreferences,
): PomodoroDurationMs {
  const durationMinutes =
    blockType === 'focus'
      ? preferences.focusDurationMinutes
      : blockType === 'short-break'
        ? preferences.shortBreakDurationMinutes
        : preferences.longBreakDurationMinutes;

  return durationMinutes * 60_000;
}

/** Resolves the configured duration to assign to a newly prepared block. */
export function assignPomodoroBlockDuration(
  blockType: PomodoroBlockType,
  preferences: PomodoroPreferences,
): PomodoroResult<PomodoroDurationMs> {
  const preferencesValidation = validatePomodoroPreferences(preferences);

  if (!preferencesValidation.ok) {
    return failure('invalid-preferences');
  }

  return {
    ok: true,
    value: durationForValidatedPreferences(
      blockType,
      preferencesValidation.value,
    ),
  };
}

/** Applies preferences only to a prepared block that has not started. */
export function applyPomodoroPreferencesToCycle(
  cycle: PomodoroCycle,
  preferences: PomodoroPreferences,
): PomodoroResult<PomodoroCycle> {
  const cycleValidation = validatePomodoroCycle(cycle);

  if (!cycleValidation.ok) {
    return cycleValidation;
  }

  const preferencesValidation = validatePomodoroPreferences(preferences);

  if (!preferencesValidation.ok) {
    return failure('invalid-preferences');
  }

  const current = cycleValidation.value;

  if (current.status !== 'ready') {
    return { ok: true, value: current };
  }

  return {
    ok: true,
    value: {
      ...current,
      currentBlock: {
        ...current.currentBlock,
        durationMs: durationForValidatedPreferences(
          current.currentBlock.type,
          preferencesValidation.value,
        ),
      },
    },
  };
}
