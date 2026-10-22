import { describe, expect, it } from 'vitest';

import {
  getTimerDurationFields,
  MAX_TIMER_DURATION_MS,
  parseTimerDuration,
} from './timer-duration-input.utils';

describe('timer duration input utilities', () => {
  it('converts a millisecond duration into two-digit hour, minute, and second fields', () => {
    expect(getTimerDurationFields(3_661_000)).toEqual({
      hours: '01',
      minutes: '01',
      seconds: '01',
    });
  });

  it('represents the approved maximum duration', () => {
    expect(MAX_TIMER_DURATION_MS).toBe(359_999_000);
    expect(getTimerDurationFields(MAX_TIMER_DURATION_MS)).toEqual({
      hours: '99',
      minutes: '59',
      seconds: '59',
    });
  });

  it('converts valid fields to the domain millisecond unit', () => {
    expect(
      parseTimerDuration({ hours: '02', minutes: '05', seconds: '09' }),
    ).toEqual({ ok: true, durationMs: 7_509_000 });
  });

  it('accepts a one-second minimum and zero-valued individual units', () => {
    expect(
      parseTimerDuration({ hours: '00', minutes: '00', seconds: '01' }),
    ).toEqual({ ok: true, durationMs: 1_000 });
    expect(
      parseTimerDuration({ hours: '01', minutes: '00', seconds: '00' }),
    ).toEqual({ ok: true, durationMs: 3_600_000 });
  });

  it.each([
    {
      fields: { hours: '100', minutes: '00', seconds: '00' },
      code: 'invalid-format',
      field: 'hours',
    },
    {
      fields: { hours: '00', minutes: '60', seconds: '00' },
      code: 'minutes-out-of-range',
      field: 'minutes',
    },
    {
      fields: { hours: '00', minutes: '00', seconds: '60' },
      code: 'seconds-out-of-range',
      field: 'seconds',
    },
    {
      fields: { hours: '0.5', minutes: '00', seconds: '00' },
      code: 'invalid-format',
      field: 'hours',
    },
  ])('rejects invalid fields: $fields', ({ fields, code, field }) => {
    expect(parseTimerDuration(fields)).toMatchObject({
      ok: false,
      code,
      field,
    });
  });

  it('rejects a zero duration', () => {
    expect(
      parseTimerDuration({ hours: '00', minutes: '00', seconds: '00' }),
    ).toMatchObject({ ok: false, code: 'zero-duration' });
  });

  it('rejects incomplete or non-numeric values', () => {
    expect(
      parseTimerDuration({ hours: '', minutes: '10', seconds: '00' }),
    ).toMatchObject({ ok: false, code: 'invalid-format', field: 'hours' });
    expect(
      parseTimerDuration({ hours: 'aa', minutes: '10', seconds: '00' }),
    ).toMatchObject({ ok: false, code: 'invalid-format', field: 'hours' });
  });
});
