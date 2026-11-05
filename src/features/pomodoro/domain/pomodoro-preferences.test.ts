import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POMODORO_PREFERENCES,
  isValidPomodoroDurationMinutes,
  validatePomodoroPreferences,
} from './pomodoro-preferences';
import type { PomodoroPreferenceField } from './pomodoro.types';

describe('Pomodoro preferences', () => {
  it('provides the approved default durations in minutes', () => {
    expect(DEFAULT_POMODORO_PREFERENCES).toEqual({
      focusDurationMinutes: 25,
      shortBreakDurationMinutes: 5,
      longBreakDurationMinutes: 15,
    });
  });

  it.each([1, 25, 180])('accepts the integer duration %i minutes', (value) => {
    expect(isValidPomodoroDurationMinutes(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    '',
    '25',
    0,
    -1,
    1.5,
    180.5,
    181,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects the invalid duration value %s', (value) => {
    expect(isValidPomodoroDurationMinutes(value)).toBe(false);
  });

  it('accepts all three valid durations and returns a domain preferences value', () => {
    expect(
      validatePomodoroPreferences({
        focusDurationMinutes: 30,
        shortBreakDurationMinutes: 7,
        longBreakDurationMinutes: 20,
      }),
    ).toEqual({
      ok: true,
      value: {
        focusDurationMinutes: 30,
        shortBreakDurationMinutes: 7,
        longBreakDurationMinutes: 20,
      },
    });
  });

  it.each([
    'focusDurationMinutes',
    'shortBreakDurationMinutes',
    'longBreakDurationMinutes',
  ] satisfies PomodoroPreferenceField[])(
    'rejects an invalid %s value before returning preferences',
    (field) => {
      const preferences = {
        ...DEFAULT_POMODORO_PREFERENCES,
        [field]: '',
      };

      expect(validatePomodoroPreferences(preferences)).toEqual({
        ok: false,
        errors: [{ code: 'invalid-duration', field }],
      });
    },
  );

  it('reports every invalid field and rejects malformed preference objects', () => {
    expect(
      validatePomodoroPreferences({
        focusDurationMinutes: 181,
        shortBreakDurationMinutes: 2.5,
        longBreakDurationMinutes: -4,
      }),
    ).toEqual({
      ok: false,
      errors: [
        { code: 'invalid-duration', field: 'focusDurationMinutes' },
        { code: 'invalid-duration', field: 'shortBreakDurationMinutes' },
        { code: 'invalid-duration', field: 'longBreakDurationMinutes' },
      ],
    });

    expect(validatePomodoroPreferences(null)).toEqual({
      ok: false,
      errors: [{ code: 'invalid-preferences' }],
    });
    expect(validatePomodoroPreferences([])).toEqual({
      ok: false,
      errors: [{ code: 'invalid-preferences' }],
    });
  });
});
