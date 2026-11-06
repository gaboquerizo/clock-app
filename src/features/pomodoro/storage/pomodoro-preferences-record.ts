import { validatePomodoroPreferences } from '../domain/pomodoro-preferences';
import type {
  PomodoroPreferences,
  PomodoroPreferencesValidationResult,
} from '../domain/pomodoro.types';

export const POMODORO_PREFERENCES_STORAGE_KEY = 'pomodoro-preferences';

export type PomodoroPreferencesRecord = {
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
};

export function toPomodoroPreferencesRecord(
  preferences: PomodoroPreferences,
): PomodoroPreferencesRecord {
  return {
    focusDurationMinutes: preferences.focusDurationMinutes,
    shortBreakDurationMinutes: preferences.shortBreakDurationMinutes,
    longBreakDurationMinutes: preferences.longBreakDurationMinutes,
  };
}

export function fromPomodoroPreferencesRecord(
  value: unknown,
): PomodoroPreferencesValidationResult {
  return validatePomodoroPreferences(value);
}
