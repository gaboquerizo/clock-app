import type {
  PomodoroDurationMinutes,
  PomodoroPreferenceField,
  PomodoroPreferences,
  PomodoroPreferencesValidationError,
  PomodoroPreferencesValidationResult,
} from './pomodoro.types';

export const MIN_POMODORO_DURATION_MINUTES = 1;
export const MAX_POMODORO_DURATION_MINUTES = 180;

export const DEFAULT_POMODORO_PREFERENCES: Readonly<PomodoroPreferences> =
  Object.freeze({
    focusDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
  });

export function isValidPomodoroDurationMinutes(
  value: unknown,
): value is PomodoroDurationMinutes {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_POMODORO_DURATION_MINUTES &&
    value <= MAX_POMODORO_DURATION_MINUTES
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDuration(
  preferences: Record<string, unknown>,
  field: PomodoroPreferenceField,
  errors: PomodoroPreferencesValidationError[],
): PomodoroDurationMinutes | undefined {
  const value = preferences[field];

  if (!isValidPomodoroDurationMinutes(value)) {
    errors.push({ code: 'invalid-duration', field });
    return undefined;
  }

  return value;
}

export function validatePomodoroPreferences(
  value: unknown,
): PomodoroPreferencesValidationResult {
  if (!isRecord(value)) {
    return { ok: false, errors: [{ code: 'invalid-preferences' }] };
  }

  const errors: PomodoroPreferencesValidationError[] = [];
  const focusDurationMinutes = readDuration(
    value,
    'focusDurationMinutes',
    errors,
  );
  const shortBreakDurationMinutes = readDuration(
    value,
    'shortBreakDurationMinutes',
    errors,
  );
  const longBreakDurationMinutes = readDuration(
    value,
    'longBreakDurationMinutes',
    errors,
  );

  if (
    focusDurationMinutes === undefined ||
    shortBreakDurationMinutes === undefined ||
    longBreakDurationMinutes === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      focusDurationMinutes,
      shortBreakDurationMinutes,
      longBreakDurationMinutes,
    },
  };
}
